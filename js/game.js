/**
 * game.js - Core game logic and command execution
 * This module contains all game functions including combat, movement, item handling, NPC interaction, etc.
 * 
 * MUD Game Engine
 * Copyright (C) 2025 JPH Software (http://jphsoftware.com)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 * ** IMPORTANT: This copyright notice and the link to jphsoftware.com must be preserved
 * ** in all copies or substantial portions of this software.
 */

export function initializeGameLogic(dependencies) {
    const { 
        db, 
        appId, 
        auth,
        gameWorld, 
        gameItems, 
        gameNpcs, 
        gameMonsters,
        gamePlayers,
        activeMonsters,
        gameSpells,
        gameClasses,
        gameGuilds,
        gameQuests,
        gameParties,
        logToTerminal,
        callGeminiForText,
        parseCommandWithGemini,
        authFunctions,
        firestoreFunctions
    } = dependencies;

    const { 
        doc, 
        getDoc,
        setDoc,
        updateDoc, 
        deleteDoc,
        addDoc,
        collection,
        query,
        where,
        orderBy,
        limit,
        getDocs,
        arrayUnion, 
        arrayRemove,
        serverTimestamp,
        runTransaction
    } = firestoreFunctions;
    
    const { signOut } = authFunctions;

    // Phase 3: Access to player persistence system
    const playerPersistence = window.playerPersistence;

    let userId = null;
    let playerName = null;
    let currentPlayerRoomId = null;
    let lastNpcInteraction = null;
    let lastNpcResponseTime = 0; // Track when we last got an NPC response locally
    let conversationHistory = []; // Track conversation with AI NPCs
    let gameActions = {}; // Store custom actions/emotes
    
    // Helper function to add appropriate article (a/an) to a noun
    function addArticle(name) {
        if (!name) return 'something';
        
        // Check if name already starts with an article
        const nameLower = name.toLowerCase();
        if (nameLower.startsWith('a ') || nameLower.startsWith('an ') || 
            nameLower.startsWith('the ') || nameLower.startsWith('some ')) {
            return name; // Already has an article, don't add another
        }
        
        const firstChar = name.charAt(0).toLowerCase();
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        const article = vowels.includes(firstChar) ? 'an' : 'a';
        return `${article} ${name}`;
    }
    
    // Level configuration (can be overridden from Firebase)
    let LEVEL_NAMES = {
        1: "Novice", 2: "Beginner", 3: "Apprentice", 4: "Student", 5: "Initiate",
        6: "Trainee", 7: "Journeyman", 8: "Practitioner", 9: "Adept", 10: "Expert",
        11: "Specialist", 12: "Veteran", 13: "Master", 14: "Champion", 15: "Hero",
        16: "Legend", 17: "Titan", 18: "Demigod", 19: "Avatar", 20: "Ascended",
        21: "Immortal", 22: "Celestial", 23: "Divine", 24: "Eternal", 25: "Supreme",
        26: "Transcendent", 27: "Omnipotent", 28: "Primordial", 29: "Cosmic", 30: "God"
    };
    
    // XP requirements (can be overridden from Firebase)
    let LEVEL_XP = {};
    
    // Load level configuration from Firebase
    async function loadLevelConfig(db, appId) {
        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            const levelsDoc = await getDoc(doc(db, `/artifacts/${appId}/public/data/mud-levels/config`));
            
            if (levelsDoc.exists()) {
                const levelsData = levelsDoc.data();
                // Override level names and XP requirements
                for (let i = 1; i <= 30; i++) {
                    if (levelsData[i]) {
                        LEVEL_NAMES[i] = levelsData[i].name;
                        LEVEL_XP[i] = levelsData[i].xp;
                    }
                }
                console.log('Loaded custom level configuration from Firebase');
            }
        } catch (error) {
            console.warn('Could not load level config, using defaults:', error);
        }
    }
    
    function getLevelName(level, playerClass = null) {
        // Check for class-specific level titles first
        if (playerClass && gameClasses[playerClass]) {
            const classData = gameClasses[playerClass];
            if (classData.levelTitles && classData.levelTitles[level]) {
                return classData.levelTitles[level];
            }
        }
        
        // Fall back to generic level names
        return LEVEL_NAMES[level] || `Level ${level}`;
    }
    
    // Store pending death choice
    let pendingDeathChoice = null;
    
    // Offer death choice to player
    function offerDeathChoice(playerData, causeOfDeath) {
        const MIN_LEVEL_FOR_PERMADEATH = 10;
        const playerLevel = playerData.level || 1;
        
        // Store the death context
        pendingDeathChoice = {
            playerData: playerData,
            causeOfDeath: causeOfDeath,
            timestamp: Date.now()
        };
        
        if (playerLevel >= MIN_LEVEL_FOR_PERMADEATH) {
            logToTerminal(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'error');
            logToTerminal(`YOU HAVE BEEN DEFEATED!`, 'error');
            logToTerminal(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'error');
            logToTerminal(`As a level ${playerLevel} ${playerData.class || 'Adventurer'}, you have earned the right to choose your fate:`, 'system');
            logToTerminal(``, 'system');
            logToTerminal(`1. RESPAWN - Return to the Nexus, lose your inventory and 10% of your gold`, 'game');
            logToTerminal(`2. PERMADEATH - Your character dies permanently, but receives a memorial gravestone`, 'game');
            logToTerminal(``, 'system');
            logToTerminal(`Type: respawn or permadeath`, 'system');
            logToTerminal(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'error');
        } else {
            // Below level 10 - auto-respawn, no choice
            logToTerminal(`You have been defeated! You respawn at the Nexus and lose all your items.`, 'error');
            logToTerminal(`(Reach level 10 to unlock the permadeath option)`, 'system');
            handleRespawn();
        }
    }
    
    // Handle respawn choice
    async function handleRespawn() {
        if (!pendingDeathChoice) return;
        
        const { playerData } = pendingDeathChoice;
        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
        
        try {
            await updateDoc(playerRef, {
                roomId: 'start',
                hp: playerData.maxHp,
                money: Math.floor((playerData.money || 0) * 0.9),
                inventory: []
            });
            
            logToTerminal(`You respawn at the Nexus, battered but alive.`, 'system');
            logToTerminal(`You've lost your inventory and 10% of your gold.`, 'game');
            pendingDeathChoice = null;
        } catch (error) {
            logToTerminal(`Error during respawn: ${error.message}`, 'error');
        }
    }
    
    // Handle permadeath choice
    async function handlePermadeath() {
        if (!pendingDeathChoice) return;
        
        const { playerData, causeOfDeath } = pendingDeathChoice;
        
        try {
            // Create gravestone
            const gravestoneCreated = await createGravestone(playerData, causeOfDeath);
            
            if (gravestoneCreated) {
                logToTerminal(``, 'system');
                logToTerminal(`Your character has passed into legend...`, 'system');
                logToTerminal(`A gravestone has been erected in the graveyard in your honor.`, 'game');
                logToTerminal(`Visit the graveyard to pay your respects.`, 'game');
                logToTerminal(``, 'system');
            }
            
            // Delete character
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await deleteDoc(playerRef);
            
            logToTerminal(`Your character has been permanently deleted.`, 'error');
            logToTerminal(`Refresh the page to create a new character.`, 'system');
            
            pendingDeathChoice = null;
            
            // Disable input
            const inputField = document.getElementById('command-input');
            if (inputField) {
                inputField.disabled = true;
                inputField.placeholder = 'Character deleted - Refresh to create new character';
            }
        } catch (error) {
            logToTerminal(`Error during permadeath: ${error.message}`, 'error');
        }
    }
    
    // Create gravestone for fallen player (level 10+)
    async function createGravestone(playerData, causeOfDeath = 'unknown') {
        const MIN_LEVEL_FOR_GRAVESTONE = 10;
        
        if ((playerData.level || 1) < MIN_LEVEL_FOR_GRAVESTONE) {
            // Level too low - goes to pauper's grave
            return false;
        }
        
        try {
            const gravestoneId = `grave_${playerData.userId || playerData.id}_${Date.now()}`;
            const epitaph = playerData.epitaph || `Here lies ${playerData.name}, who fell to ${causeOfDeath}`;
            const deathDate = new Date().toLocaleDateString();
            
            // Create gravestone data
            const gravestoneData = {
                playerName: playerData.name,
                playerLevel: playerData.level || 1,
                playerClass: playerData.class || 'Adventurer',
                epitaph: epitaph,
                causeOfDeath: causeOfDeath,
                deathDate: deathDate,
                timestamp: serverTimestamp()
            };
            
            // Add to gravestones collection
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-gravestones/${gravestoneId}`), gravestoneData);
            
            // Add to graveyard room details (if graveyard exists)
            const graveyardRoomId = 'graveyard'; // You'll need to create this room
            const graveyardRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${graveyardRoomId}`);
            const graveyardDoc = await getDoc(graveyardRef);
            
            if (graveyardDoc.exists()) {
                const graveyardData = graveyardDoc.data();
                const details = graveyardData.details || {};
                
                // Add gravestone as an examinable detail
                const graveName = `${playerData.name.toLowerCase().replace(/\s+/g, '_')}_gravestone`;
                details[graveName] = `╔════════════════════════════════════╗\n` +
                                    `║     HERE LIES ${playerData.name.toUpperCase()}     ║\n` +
                                    `╠════════════════════════════════════╣\n` +
                                    `║  Level ${playerData.level} ${playerData.class || 'Adventurer'}  ║\n` +
                                    `║  ${deathDate}  ║\n` +
                                    `╠════════════════════════════════════╣\n` +
                                    `║  "${epitaph}"  ║\n` +
                                    `╚════════════════════════════════════╝`;
                
                await updateDoc(graveyardRef, { details: details });
            }
            
            console.log(`[Graveyard] Created gravestone for ${playerData.name}`);
            return true;
        } catch (error) {
            console.error('[Graveyard] Error creating gravestone:', error);
            return false;
        }
    }
    
    // Load custom actions from Firebase
    async function loadActions(db, appId) {
        // Default actions as fallback
        const defaultActions = {
            'wave': '{player} waves.',
            'dance': '{player} dances around!',
            'laugh': '{player} laughs heartily.',
            'smile': '{player} smiles.',
            'nod': '{player} nods.',
            'bow': '{player} bows gracefully.',
            'clap': '{player} claps their hands.',
            'cheer': '{player} cheers loudly!',
            'cry': '{player} cries.',
            'sigh': '{player} sighs deeply.',
            'shrug': '{player} shrugs.',
            'grin': '{player} grins widely.',
            'frown': '{player} frowns.',
            'wink': '{player} winks.',
            'yawn': '{player} yawns.',
            'stretch': '{player} stretches.',
            'jump': '{player} jumps up and down!',
            'sit': '{player} sits down.',
            'stand': '{player} stands up.',
            'kneel': '{player} kneels down.',
            'salute': '{player} salutes.',
            'think': '{player} looks thoughtful.',
            'ponder': '{player} ponders deeply.',
            'scratch': '{player} scratches their head.'
        };
        
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            const actionsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-actions`));
            
            if (actionsSnapshot.empty) {
                // Use defaults if no actions in Firebase
                gameActions = { ...defaultActions };
                console.log('No actions in Firebase, using default actions');
            } else {
                gameActions = {};
                actionsSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    gameActions[data.command] = data.message;
                });
                console.log(`Loaded ${Object.keys(gameActions).length} custom actions from Firebase`);
            }
        } catch (error) {
            console.warn('Could not load actions from Firebase, using defaults:', error);
            gameActions = { ...defaultActions };
        }
    }
    
    // Helper function to convert Firebase timestamp to "time ago" string
    function getTimeAgo(timestamp) {
        if (!timestamp) return 'just now';
        
        // Handle Firestore Timestamp objects
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
        const now = new Date();
        const secondsAgo = Math.floor((now - date) / 1000);
        
        if (secondsAgo < 60) return 'just now';
        if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`;
        if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
        return `${Math.floor(secondsAgo / 86400)} days ago`;
    }

    // Level system configuration (30 levels)
    const MAX_LEVEL = 30;
    const BASE_XP = 100; // XP needed for level 2
    
    // Get class data for a player
    function getClassData(playerClass) {
        return gameClasses[playerClass] || null;
    }
    
    // Calculate XP required for a given level (class-specific)
    function getXpForLevel(level, playerClass = null) {
        if (level <= 1) return 0;
        if (level > MAX_LEVEL) return getXpForLevel(MAX_LEVEL, playerClass);
        
        // Use custom XP if loaded from Firebase, otherwise calculate
        if (LEVEL_XP[level] !== undefined) {
            return LEVEL_XP[level];
        }
        
        // Default exponential formula: XP = BASE_XP * level^1.5
        let baseXp = Math.floor(BASE_XP * Math.pow(level, 1.5));
        
        // Apply class-specific XP multiplier
        if (playerClass) {
            const classData = getClassData(playerClass);
            if (classData && classData.xpMultiplier) {
                baseXp = Math.floor(baseXp * classData.xpMultiplier);
            }
        }
        
        return baseXp;
    }

    // Helper function to generate quest objective descriptions
    function getObjectiveDescription(objective) {
        switch (objective.type) {
            case 'kill':
                const monster = gameMonsters[objective.monsterId];
                const monsterName = monster?.name || objective.target || `[missing monster: ${objective.monsterId}]`;
                return `Kill ${objective.count} ${monsterName}`;
            case 'collect':
                const item = gameItems[objective.itemId];
                const itemName = item?.name || objective.item || `[missing item: ${objective.itemId}]`;
                return `Collect ${objective.count} ${itemName}`;
            case 'visit':
                const room = gameWorld[objective.roomId];
                const roomName = room?.name || objective.room || `[missing room: ${objective.roomId}]`;
                return `Visit ${roomName}`;
            case 'talk':
                const npc = gameNpcs[objective.npcId];
                const npcName = npc?.name || objective.npc || `[missing NPC: ${objective.npcId}]`;
                return `Talk to ${npcName}`;
            default:
                return `Complete objective: ${objective.type}`;
        }
    }

    // Helper function to update quest progress
    async function updateQuestProgress(playerId, progressType, target, count = 1) {
        console.log(`[updateQuestProgress] Called with: playerId=${playerId}, type=${progressType}, target=${target}, count=${count}`);
        
        const playerData = gamePlayers[playerId];
        if (!playerData || !playerData.activeQuests || playerData.activeQuests.length === 0) {
            console.log('[updateQuestProgress] No active quests found');
            return [];
        }

        console.log(`[updateQuestProgress] Active quests:`, playerData.activeQuests);

        // Find player's party
        const playerParty = Object.values(gameParties).find(p => 
            p.members && Object.keys(p.members).includes(playerId)
        );

        const completedQuests = [];
        const updatedQuests = [];
        
        for (const quest of playerData.activeQuests) {
            const questData = gameQuests[quest.questId];
            let questUpdated = false;
            const updatedObjectives = quest.objectives.map(obj => {
                if (obj.type === progressType) {
                    // Match target (case insensitive) - support multiple field names
                    const objTarget = (obj.target || obj.itemId || obj.monsterId || obj.roomId || obj.npcId || obj.item || obj.room || obj.npc || '').toLowerCase();
                    const matchTarget = target.toLowerCase();
                    
                    console.log(`[updateQuestProgress] Checking objective: type=${obj.type}, objTarget=${objTarget}, matchTarget=${matchTarget}, current=${obj.current}/${obj.count}`);
                    
                    if (objTarget === matchTarget || objTarget.includes(matchTarget) || matchTarget.includes(objTarget)) {
                        if (obj.current < obj.count) {
                            console.log(`[updateQuestProgress] MATCH! Incrementing from ${obj.current} to ${obj.current + count}`);
                            questUpdated = true;
                            return { ...obj, current: Math.min(obj.current + count, obj.count) };
                        } else {
                            console.log(`[updateQuestProgress] Already at max count`);
                        }
                    }
                }
                return obj;
            });

            if (questUpdated) {
                // Check if all objectives are complete
                const allComplete = updatedObjectives.every(obj => obj.current >= obj.count);
                
                if (allComplete) {
                    completedQuests.push({ questId: quest.questId, objectives: updatedObjectives });
                } else {
                    updatedQuests.push({ ...quest, objectives: updatedObjectives });
                }
                
                // If this is a party quest and player is in a party, update all party members
                if (questData && questData.isPartyQuest && playerParty) {
                    for (const memberId of Object.keys(playerParty.members)) {
                        if (memberId !== playerId) {
                            const memberData = gamePlayers[memberId];
                            if (memberData && memberData.activeQuests) {
                                // Find matching quest in member's active quests
                                const memberQuestIndex = memberData.activeQuests.findIndex(aq => aq.questId === quest.questId);
                                if (memberQuestIndex !== -1) {
                                    const memberUpdatedQuests = [...memberData.activeQuests];
                                    memberUpdatedQuests[memberQuestIndex] = {
                                        ...memberUpdatedQuests[memberQuestIndex],
                                        objectives: updatedObjectives
                                    };
                                    
                                    // Update member's quest progress
                                    const memberRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${memberId}`);
                                    await updateDoc(memberRef, {
                                        activeQuests: allComplete 
                                            ? memberUpdatedQuests.filter(q => q.questId !== quest.questId)
                                            : memberUpdatedQuests
                                    });
                                }
                            }
                        }
                    }
                }
            } else {
                updatedQuests.push(quest);
            }
        }

        // Update player's active quests if any changed
        if (completedQuests.length > 0 || updatedQuests.length !== playerData.activeQuests.length) {
            // Phase 3: Active quests are permanent data
            await playerPersistence.syncToMySQL(playerId, {
                activeQuests: updatedQuests
            });
        }

        return completedQuests;
    }
    
    // Calculate current level from XP (class-specific)
    function getLevelFromXp(xp, playerClass = null) {
        for (let level = MAX_LEVEL; level >= 1; level--) {
            if (xp >= getXpForLevel(level, playerClass)) {
                return level;
            }
        }
        return 1;
    }
    
    // Calculate stat bonuses for a given level (class-specific)
    function getLevelBonuses(level, playerClass = null, playerData = null) {
        const classData = getClassData(playerClass);
        
        // Base HP calculation
        let baseMaxHp = 100;
        let hpPerLevel = 10; // Default
        let mpPerLevel = 5;  // Default
        
        // Apply class-specific starting bonuses
        if (playerData) {
            baseMaxHp = playerData.maxHp || 100; // Use current max HP as base
        } else if (classData) {
            baseMaxHp = 100 + (classData.hpBonus || 0);
        }
        
        // Get class-specific HP/MP per level
        if (classData) {
            hpPerLevel = classData.hpPerLevel || 10;
            mpPerLevel = classData.mpPerLevel || 5;
        }
        
        const maxHp = baseMaxHp + (level - 1) * hpPerLevel;
        const maxMp = 100 + (level - 1) * mpPerLevel;
        
        // Calculate stat growth based on class
        const statGrowth = classData?.statGrowth || {
            str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3
        };
        
        return {
            maxHp,
            maxMp,
            strength: Math.floor((level - 1) / statGrowth.str),
            dexterity: Math.floor((level - 1) / statGrowth.dex),
            constitution: Math.floor((level - 1) / statGrowth.con),
            intelligence: Math.floor((level - 1) / statGrowth.int),
            wisdom: Math.floor((level - 1) / statGrowth.wis),
            charisma: Math.floor((level - 1) / statGrowth.cha),
            gold: level * 50
        };
    }
    
    // Log a news entry for important achievements
    async function logNews(type, playerName, details) {
        try {
            const newsIcons = {
                'kill': '⚔️',
                'found': '💎',
                'levelup': '⭐'
            };
            
            const newsEntry = {
                type: type,
                playerName: playerName,
                event: details,
                icon: newsIcons[type] || '📰',
                timestamp: serverTimestamp()
            };
            
            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-news`), newsEntry);
        } catch (error) {
            console.error('Error logging news:', error);
        }
    }
    
    // Check and handle level up
    async function checkLevelUp(playerRef, currentXp, currentLevel) {
        const playerDoc = await getDoc(playerRef);
        const playerData = playerDoc.data();
        const playerClass = playerData.class || 'Adventurer';
        
        const newLevel = getLevelFromXp(currentXp, playerClass);
        
        if (newLevel > currentLevel && newLevel <= MAX_LEVEL) {
            const oldBonuses = getLevelBonuses(currentLevel, playerClass, playerData);
            const bonuses = getLevelBonuses(newLevel, playerClass, playerData);
            
            // Calculate new stats based on class and character creation bonuses
            const classData = getClassData(playerClass);
            const baseAttributes = playerData.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            
            // Get initial class bonuses (from character creation)
            const initialBonuses = classData?.statBonuses || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            
            // New attributes = 10 (base) + initial class bonus + level bonus
            const newAttributes = {
                str: 10 + initialBonuses.str + bonuses.strength,
                dex: 10 + initialBonuses.dex + bonuses.dexterity,
                con: 10 + initialBonuses.con + bonuses.constitution,
                int: 10 + initialBonuses.int + bonuses.intelligence,
                wis: 10 + initialBonuses.wis + bonuses.wisdom,
                cha: 10 + initialBonuses.cha + bonuses.charisma
            };
            
            // Calculate HP/MP increases
            const newMaxHp = bonuses.maxHp;
            const newMaxMp = bonuses.maxMp;
            const hpGain = newMaxHp - (playerData.maxHp || 100);
            const mpGain = newMaxMp - (playerData.maxMp || 100);
            const newHp = Math.min(playerData.hp + hpGain, newMaxHp); // Heal on level up
            const newMp = Math.min((playerData.mp || 100) + mpGain, newMaxMp);
            
            // Update player with new level and stats
            await updateDoc(playerRef, {
                level: newLevel,
                maxHp: newMaxHp,
                hp: newHp,
                maxMp: newMaxMp,
                mp: newMp,
                attributes: newAttributes
            });
            
            // Announce level up!
            const newLevelName = getLevelName(newLevel, playerClass);
            const className = classData?.name || playerClass;
            logToTerminal(`🎉 LEVEL UP! You are now level ${newLevel} ${className} - ${newLevelName}!`, 'system');
            
            if (hpGain > 0) {
                logToTerminal(`Max HP increased to ${newMaxHp}! (+${hpGain})`, 'game');
            }
            if (mpGain > 0) {
                logToTerminal(`Max MP increased to ${newMaxMp}! (+${mpGain})`, 'game');
            }
            
            // Show stat increases
            const statNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
            for (const [stat, name] of Object.entries(statNames)) {
                const oldStat = 10 + initialBonuses[stat] + oldBonuses[stat.slice(0, -2) === 'ch' ? 'charisma' : stat === 'str' ? 'strength' : stat === 'dex' ? 'dexterity' : stat === 'con' ? 'constitution' : stat === 'int' ? 'intelligence' : 'wisdom'];
                const newStat = newAttributes[stat];
                if (newStat > oldStat) {
                    logToTerminal(`${name} increased to ${newStat}! (+${newStat - oldStat})`, 'game');
                }
            }
            
            // Log to news feed
            await logNews('levelup', playerData.name, `reached level ${newLevel} - ${newLevelName}!`);
            
            const xpForNext = getXpForLevel(newLevel + 1, playerClass);
            if (newLevel < MAX_LEVEL) {
                logToTerminal(`XP to next level: ${xpForNext - currentXp}`, 'game');
            } else {
                logToTerminal(`You have reached the maximum level!`, 'game');
            }
            
            return newLevel;
        }
        
        return currentLevel;
    }
    
    // Fetch and display leaderboard
    async function displayLeaderboard() {
        try {
            const { query, collection, orderBy, limit, getDocs } = firestoreFunctions;
            
            // Query top players by XP (get more than 20 to account for admins being filtered)
            const playersCollection = collection(db, `/artifacts/${appId}/public/data/mud-players`);
            const leaderboardQuery = query(playersCollection, orderBy('xp', 'desc'), limit(50));
            const querySnapshot = await getDocs(leaderboardQuery);
            
            if (querySnapshot.empty) {
                logToTerminal("The leaderboard is empty.", 'game');
                return;
            }
            
            // Filter out admins and limit to top 20 non-admin players
            const nonAdminPlayers = [];
            querySnapshot.forEach((doc) => {
                const player = doc.data();
                // Exclude admins from the leaderboard
                if (!player.isAdmin) {
                    nonAdminPlayers.push(player);
                }
            });
            
            // Limit to top 20
            const topPlayers = nonAdminPlayers.slice(0, 20);
            
            if (topPlayers.length === 0) {
                logToTerminal("The leaderboard is empty.", 'game');
                return;
            }
            
            logToTerminal("═══════════════════════════════════════════════", 'system');
            logToTerminal("           🏆 HALL OF CHAMPIONS 🏆", 'system');
            logToTerminal("═══════════════════════════════════════════════", 'system');
            logToTerminal("", 'game');
            
            let rank = 1;
            topPlayers.forEach((player) => {
                const playerLevel = player.level || 1;
                const playerXp = player.xp || 0;
                const playerName = player.name || "Unknown";
                const playerClass = player.class || 'Adventurer';
                
                // Format rank with medal emojis for top 3
                let rankDisplay = `${rank}.`;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";
                else rankDisplay = `${rank}.`.padEnd(3);
                
                // Format the line with proper spacing
                const nameDisplay = playerName.padEnd(20);
                const levelName = getLevelName(playerLevel, playerClass);
                const levelDisplay = `Lv.${playerLevel} ${levelName}`.padEnd(20);
                const xpDisplay = `${playerXp} XP`;
                
                logToTerminal(`${rankDisplay} ${nameDisplay} ${levelDisplay} ${xpDisplay}`, 'game');
                rank++;
            });
            
            logToTerminal("", 'game');
            logToTerminal("═══════════════════════════════════════════════", 'system');
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
            logToTerminal("Unable to load the leaderboard at this time.", 'error');
        }
    }

    // Set userId and playerName from outside
    function setPlayerInfo(id, name, roomId) {
        userId = id;
        playerName = name;
        currentPlayerRoomId = roomId;
    }

    // Update current room ID
    function setCurrentRoom(roomId) {
        currentPlayerRoomId = roomId;
    }

    // Get current room ID
    function getCurrentRoom() {
        return currentPlayerRoomId;
    }

    function logNpcResponse(npc, rawText) {
        const npcDisplayName = npc.shortName || npc.name;
        
        // Parse and display the response locally with proper formatting
        const regex = /(\*[^*]+\*|"[^"]+"|[^"*]+)/g;
        const parts = rawText.match(regex) || [];

        parts.forEach(part => {
            const trimmedPart = part.trim();
            if (trimmedPart.startsWith('*') && trimmedPart.endsWith('*')) {
                logToTerminal(trimmedPart.slice(1, -1), 'action');
            } else if (trimmedPart.startsWith('"') && trimmedPart.endsWith('"')) {
                logToTerminal(`${npcDisplayName} says, ${trimmedPart}`, 'npc');
            } else if (trimmedPart) {
                logToTerminal(trimmedPart, 'action');
            }
        });
        
        // Track that we just displayed this locally (to avoid showing it again from Firebase)
        lastNpcResponseTime = Date.now();
        
        // Broadcast NPC response to all OTHER players in the same room via Firebase
        if (currentPlayerRoomId && npcDisplayName && rawText) {
            addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                roomId: currentPlayerRoomId,
                userId: `npc-${npc.id}`,
                username: npcDisplayName,
                text: rawText,
                timestamp: serverTimestamp(),
                isNpcConversation: true
            }).catch(err => {
                console.error('[NPC Response] Error broadcasting to room:', err);
            });
        }
    }

    async function showRoom(roomId) {
        lastNpcInteraction = null;
        let room = gameWorld[roomId];
        
        if (!room) {
             if (roomId === 'start') {
                room = { 
                    name: "The Nexus",
                    description: "A shimmering portal hangs in the center of this timeless space... The world is materializing around you.",
                    exits: {}
                };
            } else {
                logToTerminal("You are lost in the void. Returning to Nexus...", "error");
                await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`), { roomId: 'start' });
                return;
            }
        }
        
        // Load room item entries from Firebase (for writable items in rooms)
        // This ensures entries persist even when rooms are loaded from MySQL
        const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`);
        const roomSnapshot = await getDoc(roomRef);
        if (roomSnapshot.exists()) {
            const firebaseRoomData = roomSnapshot.data();
            if (firebaseRoomData.items && room.items) {
                // Merge Firebase item data (with entries) into local room data
                room.items = room.items.map((localItem, index) => {
                    const firebaseItem = firebaseRoomData.items[index];
                    if (firebaseItem && typeof firebaseItem === 'object' && firebaseItem.entries) {
                        // Merge: preserve entries from Firebase
                        const localItemId = typeof localItem === 'string' ? localItem : localItem.id;
                        if (firebaseItem.id === localItemId) {
                            return firebaseItem; // Use Firebase version with entries
                        }
                    }
                    return localItem; // Use local version
                });
            }
        }

        currentPlayerRoomId = roomId;

        logToTerminal(`\n<span class="text-white text-xl font-bold">${room.name}</span>`, 'game');
        logToTerminal(room.description, 'game');
        
        // Show weather information for outdoor rooms
        if (typeof weatherSystem !== 'undefined' && !room.isIndoor) {
            const weather = weatherSystem.getCurrentWeather();
            logToTerminal(`<span class="text-yellow-400">⛅ ${weather.description}</span>`, 'game');
        }
        
        // Collect all items: regular room items + revealed items from pushables
        const allItemsInRoom = [...(room.items || [])];
        
        // Check for revealed items from room state
        const roomStateRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${roomId}`);
        const roomStateSnap = await getDoc(roomStateRef);
        if (roomStateSnap.exists()) {
            const revealedItems = roomStateSnap.data().revealedItems || [];
            allItemsInRoom.push(...revealedItems);
        }
        
        if (allItemsInRoom.length > 0) {
            const itemNames = allItemsInRoom.map(itemEntry => {
                // Support both old format (string) and new format ({id, quantity})
                let itemId, quantity;
                if (typeof itemEntry === 'string') {
                    itemId = itemEntry;
                    quantity = 1;
                } else {
                    itemId = itemEntry.id;
                    quantity = itemEntry.quantity || 1;
                }
                
                const item = gameItems[itemId];
                if (!item) return 'an unknown object';
                
                const itemName = addArticle(item.name);
                return quantity > 1 ? `${itemName} (x${quantity})` : itemName;
            }).join(', ');
            logToTerminal(`You see here: <span class="text-yellow-300">${itemNames}</span>.`, 'game');
        }
        
        if (room.npcs && room.npcs.length > 0) {
            const npcNames = room.npcs.map(npcId => gameNpcs[npcId]?.name || 'a mysterious figure').join(', ');
            logToTerminal(`You see <span class="text-lime-300">${npcNames}</span> here.`, 'game');
        }
        
        const monstersInRoom = Object.values(activeMonsters).filter(m => m.roomId === roomId);
        if (monstersInRoom.length > 0) {
            monstersInRoom.forEach(monster => {
                const monsterTemplate = gameMonsters[monster.monsterId];
                
                // Check if monster is dead
                if (monster.isDead) {
                    logToTerminal(`<span class="text-gray-400">The corpse of ${monster.name} lies here.</span>`, 'game');
                } else {
                    // Living monster
                    const description = monsterTemplate?.description || 'A fearsome creature stands before you.';
                    logToTerminal(`<span class="combat-log">${monster.name}</span> is here. ${description}`, 'game');
                    logToTerminal(`HP: ${monster.hp}/${monster.maxHp}`, 'system');
                }
            });
        }
        
        // Show other players in the room
        const playersInRoom = Object.values(gamePlayers).filter(p => {
            // Filter out yourself
            if (p.name === playerName) return false;
            // Filter out offline players (kicked or logged out)
            if (p.online === false) return false;
            // Filter out invisible admins (unless you're an admin)
            if (p.invisible && !gamePlayers[userId]?.isAdmin) return false;
            // Must be in the same room
            return p.roomId === roomId;
        });
        if (playersInRoom.length > 0) {
            const playerNames = playersInRoom.map(p => {
                const invisMarker = p.invisible ? ' 👻' : '';
                return p.name + invisMarker;
            }).join(', ');
            logToTerminal(`Also here: <span class="text-cyan-300">${playerNames}</span>.`, 'game');
        }
        
        const roomTemplate = gameWorld[roomId];
        if(roomTemplate && roomTemplate.monsterSpawns && roomTemplate.monsterSpawns.length > 0) {
            roomTemplate.monsterSpawns.forEach(spawn => {
                const isMonsterActive = Object.values(activeMonsters).some(m => m.roomId === roomId && m.monsterId === spawn.monsterId);
                if(!isMonsterActive) {
                    // Handle lastDefeated - could be Timestamp, number, or undefined
                    let lastDefeatedTime = 0;
                    if (spawn.lastDefeated) {
                        if (typeof spawn.lastDefeated.toMillis === 'function') {
                            lastDefeatedTime = spawn.lastDefeated.toMillis();
                        } else if (typeof spawn.lastDefeated === 'number') {
                            lastDefeatedTime = spawn.lastDefeated;
                        }
                    }
                    
                    const respawnTime = (spawn.respawnTime || 60) * 1000;
                    if(Date.now() - lastDefeatedTime > respawnTime) {
                        spawnMonster(spawn.monsterId, roomId);
                    }
                }
            });
        }
        
        // Start NPC conversations if there are 2+ AI NPCs in this room
        startNpcConversationsInRoom(roomId);
        
        // Check for proactive AI NPCs that might greet the player
        checkProactiveNpcs(roomId);
    }
    
    async function spawnMonster(monsterId, roomId) {
        const monsterTemplate = gameMonsters[monsterId];
        if (!monsterTemplate) return;

        // Spawn the monster
        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), {
            monsterId: monsterId,
            roomId: roomId,
            name: monsterTemplate.name,
            hp: monsterTemplate.hp,
            maxHp: monsterTemplate.hp
        });
        
        // Remove corpse details from the room
        const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`);
        const roomDoc = await getDoc(roomRef);
        if (roomDoc.exists()) {
            const roomData = roomDoc.data();
            const currentDetails = roomData.details || {};
            const newDetails = { ...currentDetails };
            
            // Remove corpse-related details
            delete newDetails[`${monsterTemplate.name.toLowerCase()} corpse`];
            delete newDetails.corpse;
            
            await updateDoc(roomRef, { details: newDetails });
        }
        
        logToTerminal(`A ${monsterTemplate.name} appears!`, 'combat-log');
    }
    
    // Clean up old corpses (dead monsters older than 5000 seconds)
    async function cleanupOldCorpses() {
        const CORPSE_LIFETIME = 5000 * 1000; // 5000 seconds in milliseconds
        const now = Date.now();
        
        try {
            const corpses = Object.entries(activeMonsters).filter(([id, monster]) => {
                if (!monster.isDead || !monster.deathTimestamp) return false;
                
                // Check if corpse is older than CORPSE_LIFETIME
                const age = now - monster.deathTimestamp;
                return age > CORPSE_LIFETIME;
            });
            
            if (corpses.length > 0) {
                console.log(`[Corpse Cleanup] Removing ${corpses.length} old corpse(s)`);
                
                for (const [corpseId, corpseData] of corpses) {
                    const corpseRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${corpseId}`);
                    await deleteDoc(corpseRef);
                    console.log(`[Corpse Cleanup] Removed ${corpseData.name} from ${corpseData.roomId}`);
                }
            }
        } catch (error) {
            console.error('[Corpse Cleanup] Error:', error);
        }
    }
    
    // Start periodic corpse cleanup (every 60 seconds)
    let corpseCleanupInterval = null;
    function startCorpseCleanup() {
        if (corpseCleanupInterval) return; // Already running
        
        console.log('[Corpse Cleanup] Starting periodic cleanup (every 60 seconds)');
        corpseCleanupInterval = setInterval(cleanupOldCorpses, 60000); // Run every minute
        
        // Run immediately on start
        cleanupOldCorpses();
    }
    
    function stopCorpseCleanup() {
        if (corpseCleanupInterval) {
            clearInterval(corpseCleanupInterval);
            corpseCleanupInterval = null;
            console.log('[Corpse Cleanup] Stopped');
        }
    }
    
    // Poison tick system - damages poisoned players over time
    let poisonTickInterval = null;
    async function processPoisonTicks() {
        const now = Date.now();
        
        for (const [playerId, playerData] of Object.entries(gamePlayers)) {
            // Check if player is poisoned
            if (!playerData.poisonedUntil || playerData.poisonedUntil <= now) {
                // Poison expired, clean up
                if (playerData.poisonedUntil) {
                    try {
                        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${playerId}`);
                        await updateDoc(playerRef, {
                            poisonedUntil: null,
                            poisonDamage: null,
                            poisonInterval: null,
                            lastPoisonTick: null
                        });
                        
                        if (playerId === userId) {
                            logToTerminal("The poison has worn off.", 'system');
                        }
                    } catch (error) {
                        console.error('[Poison] Error clearing poison status:', error);
                    }
                }
                continue;
            }
            
            // Check if it's time for next poison tick
            const lastTick = playerData.lastPoisonTick || 0;
            const tickInterval = (playerData.poisonInterval || 10) * 1000; // Convert to ms
            
            if (now - lastTick >= tickInterval) {
                const poisonDamage = playerData.poisonDamage || 5;
                
                try {
                    const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${playerId}`);
                    const playerDoc = await getDoc(playerRef);
                    
                    if (playerDoc.exists()) {
                        const currentData = playerDoc.data();
                        const newHp = Math.max(0, (currentData.hp || 10) - poisonDamage);
                        
                        await updateDoc(playerRef, {
                            hp: newHp,
                            lastPoisonTick: now
                        });
                        
                        // Notify the poisoned player
                        if (playerId === userId) {
                            logToTerminal(`💀 The poison courses through your veins! You take ${poisonDamage} damage.`, 'error');
                            logToTerminal(`HP: ${newHp}/${currentData.maxHp || 100}`, 'game');
                        }
                        
                        // Check if player died from poison
                        if (newHp <= 0) {
                            if (playerId === userId) {
                                logToTerminal("💀 You have died from poison!", 'error');
                                await handlePlayerDeath(playerRef, currentData, "poison");
                            } else {
                                // Notify other players in the room
                                const victimRoom = currentData.roomId;
                                if (victimRoom) {
                                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                        senderId: 'system',
                                        senderName: 'System',
                                        roomId: victimRoom,
                                        text: `${currentData.name} has succumbed to poison!`,
                                        isSystem: true,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Poison] Error processing poison tick:', error);
                }
            }
        }
    }
    
    function startPoisonTicks() {
        if (poisonTickInterval) return; // Already running
        
        console.log('[Poison] Starting poison tick system (every 5 seconds)');
        poisonTickInterval = setInterval(processPoisonTicks, 5000); // Check every 5 seconds
    }
    
    function stopPoisonTicks() {
        if (poisonTickInterval) {
            clearInterval(poisonTickInterval);
            poisonTickInterval = null;
            console.log('[Poison] Stopped');
        }
    }
    
    async function handleAiNpcInteraction(npc, interactionType, currentRoom, topicOrSpeech = null, availableQuests = []) {
        // If starting a new conversation with a different NPC, clear history
        if (lastNpcInteraction !== npc.id) {
            conversationHistory = [];
        }
        
        lastNpcInteraction = npc.id;
        
        // Broadcast player's question/action to other players in the room
        if (interactionType === 'ask_npc' && topicOrSpeech) {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                senderId: userId,
                senderName: playerName,
                roomId: currentPlayerRoomId,
                text: `asks ${npc.shortName || npc.name} about ${topicOrSpeech}`,
                timestamp: serverTimestamp(),
                isEmote: true
            });
        } else if (interactionType === 'talk') {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                senderId: userId,
                senderName: playerName,
                roomId: currentPlayerRoomId,
                text: `talks to ${npc.shortName || npc.name}`,
                timestamp: serverTimestamp(),
                isEmote: true
            });
        } else if (interactionType === 'reply' && topicOrSpeech) {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                senderId: userId,
                senderName: playerName,
                roomId: currentPlayerRoomId,
                text: topicOrSpeech,
                timestamp: serverTimestamp()
            });
        }
        
        logToTerminal(`${npc.shortName || npc.name} is thinking...`, 'action');

        // Handle dialogue as either array or string
        let personalityPrompt = '';
        if (Array.isArray(npc.dialogue)) {
            personalityPrompt = npc.dialogue.join(' ');
        } else if (typeof npc.dialogue === 'string') {
            personalityPrompt = npc.dialogue;
        } else {
            personalityPrompt = 'You are a friendly NPC.';
        }
        
        let taskPrompt = "";
        switch(interactionType) {
            case 'talk': 
                taskPrompt = `The player has just started a conversation with you. Respond to them based on your personality.`;
                conversationHistory = []; // Clear history on new talk
                break;
            case 'ask_npc': 
                taskPrompt = `The player has asked you specifically about "${topicOrSpeech}". Formulate a response based on your personality.`;
                break;
            case 'reply': 
                taskPrompt = `The player is replying to you. Their reply is: "${topicOrSpeech}". Continue the conversation naturally, keeping context from your previous responses.`;
                break;
        }

        let triggerInstructions = "";
        if (npc.triggers && Object.keys(npc.triggers).length > 0) {
            triggerInstructions += "You have the ability to give items. Here are the rules: ";
            const rules = Object.entries(npc.triggers).map(([keyword, itemId]) =>
                `If the player's query mentions '${keyword}', you can give them the '${gameItems[itemId]?.name || itemId}'. To do so, you MUST include the tag [GIVE_ITEM:${itemId}] in your response.`
            ).join(' ');
            triggerInstructions += rules;
        }
        
        // Add quest information if this NPC has quests available
        let questInstructions = "";
        if (availableQuests && availableQuests.length > 0) {
            questInstructions += "\n\nQUESTS AVAILABLE: You have the following quest(s) available for the player:\n";
            for (const quest of availableQuests) {
                questInstructions += `- "${quest.title}": ${quest.description}\n`;
            }
            questInstructions += "You should naturally mention these quests in your conversation. The player can accept them by typing 'quest accept [quest name]'.\n";
        }

        // Build conversation history context
        let historyContext = "";
        if (conversationHistory.length > 0) {
            historyContext = "\n\nCONVERSATION HISTORY (recent messages):\n";
            conversationHistory.slice(-6).forEach(msg => { // Keep last 6 messages (3 exchanges)
                historyContext += `${msg.speaker}: ${msg.text}\n`;
            });
        }

        const fullPrompt = `CONTEXT: You are playing an NPC in a game. Your name is ${npc.shortName || npc.name}. The player you are talking to is named ${playerName}. You are in a location called "${currentRoom.name}".
        PERSONALITY: ${personalityPrompt}
        ${triggerInstructions}${questInstructions}${historyContext}
        TASK: ${taskPrompt}
        
        IMPORTANT FORMATTING RULES:
        - For dialogue/speech: Use first-person ("I", "me", "my")
        - For actions/emotes: Use third-person ("he", "she", "they") referring to yourself
        - Example: "Welcome!" he says warmly, adjusting his spectacles.
        - Example: She nods thoughtfully. "I understand your concern."
        - Keep responses natural and in character
        
        Remember to stay in character and keep your response coherent with the conversation history above.`;

        let aiResponse = await callGeminiForText(fullPrompt);

        // Store this exchange in conversation history
        if (interactionType === 'reply' || interactionType === 'ask_npc') {
            conversationHistory.push({ speaker: playerName, text: topicOrSpeech });
        } else if (interactionType === 'talk') {
            conversationHistory.push({ speaker: playerName, text: "[started conversation]" });
        }
        conversationHistory.push({ speaker: npc.shortName || npc.name, text: aiResponse });

        const giveMatch = aiResponse.match(/\[GIVE_ITEM:(\w+)\]/);
        if (giveMatch) {
            const itemIdToGive = giveMatch[1];
            if (gameItems[itemIdToGive]) {
                const item = { id: itemIdToGive, ...gameItems[itemIdToGive] };
                const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
                await updateDoc(playerRef, { inventory: arrayUnion(item) });
                logToTerminal(`${npc.shortName || npc.name} gives you ${item.name}.`, 'system');
                aiResponse = aiResponse.replace(giveMatch[0], '').trim();
            }
        }

        logNpcResponse(npc, aiResponse);
    }
    
    // NPC-to-NPC Conversation System
    let npcConversationTimers = {}; // Track conversation timers by room
    let npcConversationStates = {}; // Track conversation history between NPCs
    let npcConversationsEnabled = true; // Global toggle for NPC conversations
    let quotaExhausted = false; // Track if we've hit the daily quota
    let npcChatPlayerThreshold = 0; // Auto-disable threshold (0 = no limit)
    let npcConversationsAutoDisabled = false; // Track if auto-disabled due to player count
    
    // Wandering NPC System
    let npcWanderTimers = {}; // Track wander timers for each NPC
    let npcCurrentRooms = {}; // Track current room for each wandering NPC
    
    /**
     * Load NPC conversation settings from localStorage
     */
    function loadNpcConversationSettings() {
        try {
            const savedEnabled = localStorage.getItem('npcConversationsEnabled');
            const savedThreshold = localStorage.getItem('npcChatPlayerThreshold');
            
            if (savedEnabled !== null) {
                npcConversationsEnabled = savedEnabled === 'true';
            }
            if (savedThreshold !== null) {
                npcChatPlayerThreshold = parseInt(savedThreshold, 10) || 0;
            }
            
            console.log('[NPC Conversations] Settings loaded:', { enabled: npcConversationsEnabled, threshold: npcChatPlayerThreshold });
        } catch (error) {
            console.error('[NPC Conversations] Error loading settings:', error);
        }
    }

    /**
     * Save NPC conversation settings to localStorage
     */
    function saveNpcConversationSettings() {
        try {
            localStorage.setItem('npcConversationsEnabled', npcConversationsEnabled.toString());
            localStorage.setItem('npcChatPlayerThreshold', npcChatPlayerThreshold.toString());
            console.log('[NPC Conversations] Settings saved');
        } catch (error) {
            console.error('[NPC Conversations] Error saving settings:', error);
        }
    }

    /**
     * Check if NPC conversations should be enabled based on player count
     */
    function checkNpcConversationPlayerThreshold() {
        if (npcChatPlayerThreshold === 0) {
            // No limit set
            if (npcConversationsAutoDisabled) {
                npcConversationsAutoDisabled = false;
                console.log('[NPC Conversations] Auto-disable threshold removed, conversations allowed');
            }
            return true;
        }

        const activePlayers = Object.keys(gamePlayers).length;
        const shouldDisable = activePlayers > npcChatPlayerThreshold;

        if (shouldDisable && !npcConversationsAutoDisabled) {
            npcConversationsAutoDisabled = true;
            // Stop all active conversations
            Object.keys(npcConversationTimers).forEach(roomId => {
                stopNpcConversationsInRoom(roomId);
            });
            console.log(`[NPC Conversations] Auto-disabled: ${activePlayers} players exceeds threshold of ${npcChatPlayerThreshold}`);
            if (logToTerminal) {
                logToTerminal(`🔇 NPC conversations auto-disabled (${activePlayers} players > ${npcChatPlayerThreshold} threshold)`, "system");
            }
        } else if (!shouldDisable && npcConversationsAutoDisabled) {
            npcConversationsAutoDisabled = false;
            console.log(`[NPC Conversations] Auto-enabled: ${activePlayers} players within threshold of ${npcChatPlayerThreshold}`);
            if (logToTerminal) {
                logToTerminal(`💬 NPC conversations auto-enabled (${activePlayers} players ≤ ${npcChatPlayerThreshold} threshold)`, "system");
            }
            // Restart conversations in current room if applicable
            const currentPlayer = gamePlayers[userId];
            if (currentPlayer?.roomId && npcConversationsEnabled) {
                startNpcConversationsInRoom(currentPlayer.roomId);
            }
        }

        return !shouldDisable;
    }

    /**
     * Load NPC conversation history from Firebase
     */
    async function loadNpcConversationHistory(roomId, npc1Id, npc2Id) {
        const conversationKey = [npc1Id, npc2Id].sort().join('-') + '-' + roomId;
        
        try {
            const conversationDoc = await getDoc(doc(db, `/artifacts/${appId}/public/data/mud-npc-conversations/${conversationKey}`));
            
            if (conversationDoc.exists()) {
                const data = conversationDoc.data();
                npcConversationStates[conversationKey] = {
                    exchanges: data.exchanges || 0,
                    history: data.history || []
                };
                console.log('[NPC Conversations] Loaded', data.history?.length || 0, 'messages from Firebase for', conversationKey);
            } else {
                npcConversationStates[conversationKey] = {
                    exchanges: 0,
                    history: []
                };
                console.log('[NPC Conversations] No previous conversation found, starting fresh');
            }
        } catch (error) {
            console.error('[NPC Conversations] Error loading conversation history:', error);
            npcConversationStates[conversationKey] = {
                exchanges: 0,
                history: []
            };
        }
    }
    
    /**
     * Save NPC conversation history to Firebase
     */
    async function saveNpcConversationHistory(conversationKey, state) {
        try {
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-npc-conversations/${conversationKey}`), {
                exchanges: state.exchanges,
                history: state.history,
                lastUpdated: serverTimestamp()
            });
            console.log('[NPC Conversations] Saved conversation history to Firebase');
        } catch (error) {
            console.error('[NPC Conversations] Error saving conversation history:', error);
        }
    }
    
    /**
     * Start NPC conversations in a room if there are 2+ AI NPCs
     */
    async function startNpcConversationsInRoom(roomId) {
        // Check if NPC conversations are enabled
        if (!npcConversationsEnabled || quotaExhausted) {
            console.log('[NPC Conversations] Disabled or quota exhausted');
            return;
        }

        // Check player count threshold
        if (!checkNpcConversationPlayerThreshold()) {
            console.log('[NPC Conversations] Disabled due to player count threshold');
            return;
        }
        
        // Check if conversations are already running in this room
        if (npcConversationTimers[roomId]) {
            console.log('[NPC Conversations] Already running in room:', roomId);
            return;
        }
        
        const room = gameWorld[roomId];
        if (!room || !room.npcs || room.npcs.length < 2) {
            console.log('[NPC Conversations] Not starting - need 2+ NPCs in room');
            return;
        }
        
        console.log('[NPC Conversations] Checking NPCs in room:', roomId);
        
        // Find AI NPCs in the room
        const aiNpcs = room.npcs
            .map(npcId => {
                const npc = gameNpcs[npcId];
                if (!npc) {
                    console.warn('[NPC Conversations] NPC', npcId, 'not found in gameNpcs');
                    return null;
                }
                if (!npc.name && !npc.shortName) {
                    console.warn('[NPC Conversations] NPC', npcId, 'has no name property:', npc);
                    return null;
                }
                console.log('[NPC Conversations] Checking NPC:', npcId, 'name:', npc.name, 'dialogue:', npc?.dialogue);
                return { id: npcId, ...npc };
            })
            .filter(npc => {
                // Skip null NPCs
                if (!npc) return false;
                
                // AI NPCs have dialogue (either string or array with personality prompt)
                // Traditional NPCs with random dialogue arrays usually have multiple short phrases
                if (!npc.dialogue) return false;
                
                // If it's a string, it's a personality prompt (AI NPC)
                if (typeof npc.dialogue === 'string' && npc.dialogue.length > 20) {
                    console.log('[NPC Conversations] NPC', npc.id, 'is AI NPC: true (string personality)');
                    return true;
                }
                
                // If it's an array with one long element, it's a personality prompt (AI NPC)
                if (Array.isArray(npc.dialogue) && npc.dialogue.length === 1 && npc.dialogue[0].length > 20) {
                    console.log('[NPC Conversations] NPC', npc.id, 'is AI NPC: true (array personality)');
                    return true;
                }
                
                // Arrays with multiple short phrases are traditional random dialogue NPCs
                console.log('[NPC Conversations] NPC', npc.id, 'is AI NPC: false (traditional NPC)');
                return false;
            });
        
        console.log('[NPC Conversations] Found AI NPCs:', aiNpcs.length);
        
        if (aiNpcs.length < 2) {
            console.log('[NPC Conversations] Not enough AI NPCs for conversation');
            return;
        }
        
        console.log('[NPC Conversations] Starting conversations with NPCs:', aiNpcs.map(n => n.name));
        
        // Clear existing timer if any
        if (npcConversationTimers[roomId]) {
            clearInterval(npcConversationTimers[roomId]);
        }
        
        // IMPORTANT: Only the first player in alphabetical order (by userId) should control NPC conversations
        // This prevents multiple clients from generating different conversations
        const playersInRoom = Object.entries(gamePlayers)
            .filter(([id, player]) => player.currentRoom === roomId)
            .map(([id]) => id)
            .sort();
        
        const isConversationController = playersInRoom.length === 0 || playersInRoom[0] === userId;
        
        if (!isConversationController) {
            console.log('[NPC Conversations] Not the conversation controller for this room - skipping timer setup');
            console.log('[NPC Conversations] Controller is:', playersInRoom[0], 'I am:', userId);
            return;
        }
        
        console.log('[NPC Conversations] I am the conversation controller for this room');
        
        // Start conversation cycle (every 60-120 seconds to avoid rate limits)
        const conversationInterval = 60000 + Math.random() * 60000;
        npcConversationTimers[roomId] = setInterval(() => {
            triggerNpcConversation(roomId, aiNpcs);
        }, conversationInterval);
        
        // Trigger initial conversation after longer delay (20-40 seconds)
        const initialDelay = 20000 + Math.random() * 20000;
        console.log('[NPC Conversations] First conversation will trigger in', Math.round(initialDelay/1000), 'seconds');
        setTimeout(() => triggerNpcConversation(roomId, aiNpcs), initialDelay);
    }
    
    /**
     * Stop NPC conversations in a room
     */
    function stopNpcConversationsInRoom(roomId) {
        if (npcConversationTimers[roomId]) {
            clearInterval(npcConversationTimers[roomId]);
            delete npcConversationTimers[roomId];
        }
    }
    
    /**
     * Trigger a conversation between two random AI NPCs in a room
     */
    async function triggerNpcConversation(roomId, aiNpcs) {
        console.log('[NPC Conversations] Triggering conversation in room:', roomId);
        
        if (!aiNpcs || aiNpcs.length < 2) {
            console.log('[NPC Conversations] Not enough AI NPCs');
            return;
        }
        
        // Check if there are any players in the room
        const playersInRoom = Object.values(gamePlayers).filter(p => p.currentRoom === roomId);
        if (playersInRoom.length === 0) {
            console.log('[NPC Conversations] No players in room - skipping conversation');
            return;
        }
        
        // Pick two random NPCs
        const shuffled = [...aiNpcs].sort(() => Math.random() - 0.5);
        const npc1 = shuffled[0];
        const npc2 = shuffled[1];
        
        console.log('[NPC Conversations] Conversation between:', npc1.name, 'and', npc2.name);
        
        // Create consistent conversation key (sorted IDs to maintain history regardless of who speaks first)
        const conversationKey = [npc1.id, npc2.id].sort().join('-') + '-' + roomId;
        
        // Load conversation history from Firebase if not in memory
        if (!npcConversationStates[conversationKey]) {
            await loadNpcConversationHistory(roomId, npc1.id, npc2.id);
        }
        
        const state = npcConversationStates[conversationKey];
        
        console.log('[NPC Conversations] Conversation history has', state.history.length, 'previous messages');
        
        // Generate conversation (2-3 exchanges to reduce API calls and avoid rate limits)
        const maxExchanges = 2 + Math.floor(Math.random() * 2);
        
        console.log('[NPC Conversations] Generating', maxExchanges, 'exchanges');
        
        for (let i = 0; i < maxExchanges && i < 3; i++) {
            const speaker = i % 2 === 0 ? npc1 : npc2;
            const listener = i % 2 === 0 ? npc2 : npc1;
            
            console.log('[NPC Conversations] Exchange', i+1, '- Speaker:', speaker.name);
            
            const response = await generateNpcDialogue(speaker, listener, roomId, state.history);
            
            if (response) {
                console.log('[NPC Conversations]', speaker.name, 'says:', response);
                
                // Broadcast to all players in the room
                broadcastNpcConversation(roomId, speaker, response);
                
                // Update conversation history (PERSIST across conversation cycles)
                state.history.push({
                    speaker: speaker.shortName || speaker.name,
                    text: response
                });
                
                // Keep last 12 messages (6 exchanges) for better context persistence
                if (state.history.length > 12) {
                    state.history.shift();
                }
                
                state.exchanges++;
                
                // Add longer delay between exchanges (3-6 seconds) to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 3000));
            } else {
                console.log('[NPC Conversations] No response generated for', speaker.name);
                // If we failed to generate (possibly rate limit), stop this conversation cycle
                break;
            }
        }
        
        // Save conversation history to Firebase
        await saveNpcConversationHistory(conversationKey, state);
        
        console.log('[NPC Conversations] Conversation complete. Total history:', state.history.length, 'messages');
    }
    
    /**
     * Generate dialogue for an NPC talking to another NPC
     */
    async function generateNpcDialogue(speaker, listener, roomId, history) {
        const room = gameWorld[roomId];
        
        // Get personality prompts
        let speakerPersonality = 'You are a friendly character.';
        if (Array.isArray(speaker.dialogue)) {
            speakerPersonality = speaker.dialogue.join(' ');
        } else if (typeof speaker.dialogue === 'string') {
            speakerPersonality = speaker.dialogue;
        }
        
        let listenerPersonality = 'You are a friendly character.';
        if (Array.isArray(listener.dialogue)) {
            listenerPersonality = listener.dialogue.join(' ');
        } else if (typeof listener.dialogue === 'string') {
            listenerPersonality = listener.dialogue;
        }
        
        // Build conversation history
        let historyContext = "";
        if (history.length > 0) {
            historyContext = "\n\nCONVERSATION HISTORY (including past discussions):\n";
            history.slice(-10).forEach(msg => {
                historyContext += `${msg.speaker}: ${msg.text}\n`;
            });
        }
        
        // Check if last message was a question
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        const lastWasQuestion = lastMessage && (lastMessage.text.includes('?') || lastMessage.text.match(/\b(what|where|when|why|how|who|which|could|would|should|can|will|did|do|does|is|are)\b/i));
        
        // Build prompt
        const isFirstMessage = history.length === 0;
        const prompt = `CONTEXT: You are ${speaker.shortName || speaker.name}, an NPC in a fantasy game. You are in "${room.name}". You are having an ongoing casual conversation with ${listener.shortName || listener.name}, another character in this location.

YOUR PERSONALITY: ${speakerPersonality}

${listener.shortName || listener.name}'S PERSONALITY: ${listenerPersonality}
${historyContext}
TASK: ${isFirstMessage ? 
    `Start a natural conversation with ${listener.shortName || listener.name}. Maybe comment on the location, ask them a question, or mention something relevant to your personalities.` : 
    lastWasQuestion ?
    `${listener.shortName || listener.name} just asked you something. Answer their question naturally, staying in character. Keep it brief (1-2 sentences).` :
    `Continue the conversation naturally. You can respond to what was just said, bring up a related topic from your past discussions, or take the conversation in a new direction. Keep it brief (1-2 sentences).`}

IMPORTANT: 
- Keep your response SHORT (1-2 sentences maximum)
- Stay in character and maintain continuity with past conversations
- Respond ONLY with spoken dialogue - no actions, no "he/she says", no descriptions
- Don't use quotation marks or attribution (just the dialogue)
- If they asked a question, answer it before changing topics
- Reference past discussions naturally when relevant
- Be conversational and engaging`;

        try {
            const response = await callGeminiForText(prompt, logToTerminal);
            // Clean up the response
            let cleaned = response
                .replace(/^["']|["']$/g, '') // Remove quotes at start/end
                .replace(/^[^:]+:\s*/, '') // Remove "Speaker:" prefix if present
                .trim();
            
            return cleaned;
        } catch (error) {
            console.error('Error generating NPC dialogue:', error);
            // If it's a rate limit or quota error, disable NPC conversations
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                console.log('[NPC Conversations] API limit reached - disabling NPC conversations');
                quotaExhausted = true;
                // Stop all NPC conversation timers
                Object.keys(npcConversationTimers).forEach(roomId => {
                    stopNpcConversationsInRoom(roomId);
                });
                return null;
            }
            return null;
        }
    }
    
    /**
     * Generate NPC response to player's room chat
     */
    async function generateNpcRoomChatResponse(npc, playerName, playerSpeech) {
        if (quotaExhausted) {
            return null;
        }
        
        try {
            const personality = Array.isArray(npc.dialogue) ? npc.dialogue[0] : npc.dialogue;
            
            const prompt = `You are ${npc.shortName || npc.name}, an NPC in a fantasy game.
Your personality: ${personality}

${playerName} just said in the room: "${playerSpeech}"

Generate a SHORT, natural response (1-2 sentences max) as this character would react.
Only respond if what they said seems directed at you or is relevant to your character.
If it's not relevant to you, respond with something brief and in-character, or just acknowledge them.

IMPORTANT: Respond ONLY with spoken dialogue - no actions, no "he/she says", no descriptions or narrative.

Your response:`;

            const response = await callGeminiForText(prompt);
            
            if (!response || response === "The AI is silent for now." || response.includes("Error")) {
                return null;
            }
            
            // Clean up the response
            let cleaned = response
                .replace(/^["']|["']$/g, '')
                .replace(/^[^:]+:\s*/, '')
                .trim();
            
            return cleaned;
        } catch (error) {
            console.error('Error generating NPC room chat response:', error);
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                console.log('[NPC Room Chat] API limit reached');
                quotaExhausted = true;
            }
            return null;
        }
    }
    
    /**
     * Broadcast NPC conversation to all players in the room
     */
    function broadcastNpcConversation(roomId, npc, message) {
        if (!npc) {
            console.error('[NPC Conversations] Cannot broadcast - NPC is null/undefined');
            return;
        }
        
        if (!npc.name && !npc.shortName) {
            console.error('[NPC Conversations] Cannot broadcast - NPC has no name:', npc);
            return;
        }
        
        console.log('[NPC Conversations] Broadcasting to room:', roomId, 'NPC:', npc.name || npc.shortName, 'Message:', message);
        
        // Debug: Log all players
        console.log('[NPC Conversations] All players in gamePlayers:', Object.keys(gamePlayers).length);
        Object.values(gamePlayers).forEach(p => {
            console.log('[NPC Conversations] Player:', p.name, 'RoomId:', p.roomId);
        });
        
        // Find all players in this room
        const playersInRoom = Object.values(gamePlayers).filter(p => p.roomId === roomId);
        
        console.log('[NPC Conversations] Players in room:', playersInRoom.length);
        
        // If no players found, still send the message (it will be picked up by message listener)
        const messageRef = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
        
        // Create a unique message ID to prevent duplicates
        const messageId = `npc-conv-${npc.id || 'unknown'}-${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const username = npc.shortName || npc.name;
        console.log('[NPC Conversations] Creating message with username:', username, 'from NPC:', npc);
        
        addDoc(messageRef, {
            roomId: roomId,
            userId: 'npc-conversation',
            username: username,
            text: message,
            timestamp: serverTimestamp(),
            isNpcConversation: true,
            messageId: messageId  // Add unique ID for duplicate detection
        }).then(() => {
            console.log('[NPC Conversations] Message sent successfully with ID:', messageId, 'username:', username);
        }).catch(err => {
            console.error('[NPC Conversations] Error broadcasting:', err);
        });
    }
    
    // ========== WANDERING NPC SYSTEM ==========
    
    /**
     * Initialize wandering behavior for NPCs that have wandering enabled
     */
    function initializeWanderingNpcs() {
        console.log('[Wandering NPCs] Initializing wandering NPC system...');
        
        Object.entries(gameNpcs).forEach(([npcId, npc]) => {
            if (npc.wanders) {
                // Set initial room if not already set
                if (!npcCurrentRooms[npcId]) {
                    // Find NPC's starting room
                    const startingRoom = Object.values(gameWorld).find(room => 
                        room.npcs && room.npcs.includes(npcId)
                    );
                    if (startingRoom) {
                        npcCurrentRooms[npcId] = startingRoom.id;
                        console.log(`[Wandering NPCs] ${npc.name} starts in room: ${startingRoom.id}`);
                    }
                }
                
                // Start wandering timer
                startNpcWandering(npcId, npc);
            }
        });
    }
    
    /**
     * Start wandering behavior for a specific NPC
     */
    function startNpcWandering(npcId, npc) {
        // Stop any existing timer
        if (npcWanderTimers[npcId]) {
            clearInterval(npcWanderTimers[npcId]);
        }
        
        // Default wander interval: 60-180 seconds (1-3 minutes)
        const minInterval = (npc.wanderInterval?.min || 60) * 1000;
        const maxInterval = (npc.wanderInterval?.max || 180) * 1000;
        
        const scheduleNextMove = () => {
            const interval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
            
            npcWanderTimers[npcId] = setTimeout(() => {
                moveNpcToRandomRoom(npcId, npc);
                scheduleNextMove(); // Schedule next move
            }, interval);
            
            console.log(`[Wandering NPCs] ${npc.name} will move in ${Math.floor(interval/1000)} seconds`);
        };
        
        scheduleNextMove();
    }
    
    /**
     * Stop wandering for a specific NPC
     */
    function stopNpcWandering(npcId) {
        if (npcWanderTimers[npcId]) {
            clearTimeout(npcWanderTimers[npcId]);
            delete npcWanderTimers[npcId];
            console.log(`[Wandering NPCs] Stopped wandering for NPC: ${npcId}`);
        }
    }
    
    /**
     * Move an NPC to a random connected room
     */
    async function moveNpcToRandomRoom(npcId, npc) {
        const currentRoomId = npcCurrentRooms[npcId];
        if (!currentRoomId) {
            console.log(`[Wandering NPCs] ${npc.name} has no current room`);
            return;
        }
        
        const currentRoom = gameWorld[currentRoomId];
        if (!currentRoom || !currentRoom.exits) {
            console.log(`[Wandering NPCs] ${npc.name} in room with no exits`);
            return;
        }
        
        // Get list of valid exits
        let exits = [];
        try {
            exits = typeof currentRoom.exits === 'string' 
                ? JSON.parse(currentRoom.exits) 
                : currentRoom.exits;
        } catch (e) {
            console.error(`[Wandering NPCs] Error parsing exits for room ${currentRoomId}:`, e);
            return;
        }
        
        const exitDirections = Object.keys(exits);
        if (exitDirections.length === 0) {
            console.log(`[Wandering NPCs] ${npc.name} in room with no valid exits`);
            return;
        }
        
        // Choose random exit
        const randomDirection = exitDirections[Math.floor(Math.random() * exitDirections.length)];
        const newRoomId = exits[randomDirection];
        
        if (!gameWorld[newRoomId]) {
            console.log(`[Wandering NPCs] Invalid destination room: ${newRoomId}`);
            return;
        }
        
        // Update room data in Firebase
        try {
            // Remove NPC from old room
            const oldRoomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${currentRoomId}`);
            const oldRoomDoc = await getDoc(oldRoomRef);
            if (oldRoomDoc.exists()) {
                const oldRoomData = oldRoomDoc.data();
                const updatedNpcs = (oldRoomData.npcs || []).filter(id => id !== npcId);
                await updateDoc(oldRoomRef, { npcs: updatedNpcs });
            }
            
            // Add NPC to new room
            const newRoomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${newRoomId}`);
            const newRoomDoc = await getDoc(newRoomRef);
            if (newRoomDoc.exists()) {
                const newRoomData = newRoomDoc.data();
                const updatedNpcs = [...(newRoomData.npcs || []), npcId];
                await updateDoc(newRoomRef, { npcs: updatedNpcs });
            }
            
            // Update local state
            npcCurrentRooms[npcId] = newRoomId;
            
            // Broadcast movement to players in both rooms
            await broadcastNpcMovement(npcId, npc, currentRoomId, newRoomId, randomDirection);
            
            console.log(`[Wandering NPCs] ${npc.name} moved from ${currentRoomId} to ${newRoomId} (${randomDirection})`);
            
        } catch (error) {
            console.error(`[Wandering NPCs] Error moving ${npc.name}:`, error);
        }
    }
    
    /**
     * Broadcast NPC movement to players in affected rooms
     */
    async function broadcastNpcMovement(npcId, npc, fromRoomId, toRoomId, direction) {
        const npcName = npc.shortName || npc.name;
        
        // Message to players in the room the NPC is leaving
        const leaveMessage = `${npcName} leaves ${direction}.`;
        const messageRef1 = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
        await addDoc(messageRef1, {
            roomId: fromRoomId,
            userId: 'system',
            username: 'System',
            text: leaveMessage,
            timestamp: serverTimestamp(),
            isSystem: true
        });
        
        // Message to players in the room the NPC is entering
        const arriveMessage = `${npcName} arrives.`;
        const messageRef2 = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
        await addDoc(messageRef2, {
            roomId: toRoomId,
            userId: 'system',
            username: 'System',
            text: arriveMessage,
            timestamp: serverTimestamp(),
            isSystem: true
        });
        
        // If current player is in either room, refresh their view
        const currentPlayer = gamePlayers[userId];
        if (currentPlayer && (currentPlayer.roomId === fromRoomId || currentPlayer.roomId === toRoomId)) {
            // Give a slight delay to let Firebase sync
            setTimeout(() => {
                showRoom(currentPlayer.roomId);
            }, 500);
        }
    }
    
    // ========== PROACTIVE NPC SYSTEM ==========
    
    let npcGreetingTimers = {}; // Track greeting timers by NPC ID
    let npcLastGreeting = {}; // Track last greeting time to avoid spam
    
    /**
     * Check for proactive AI NPCs in the room and potentially trigger greeting/ambient dialogue
     */
    function checkProactiveNpcs(roomId) {
        const room = gameWorld[roomId];
        if (!room || !room.npcs) return;
        
        // Find AI NPCs in the room
        const aiNpcs = room.npcs.filter(npcId => {
            const npc = gameNpcs[npcId];
            if (!npc) return false;
            
            // Check if NPC uses AI (string dialogue >20 chars OR array with 1 element >20 chars)
            const isAiNpc = typeof npc.dialogue === 'string' && npc.dialogue.length > 20 ||
                           (Array.isArray(npc.dialogue) && npc.dialogue.length === 1 && npc.dialogue[0].length > 20);
            
            return isAiNpc && npc.proactiveGreeting;
        });
        
        if (aiNpcs.length === 0) return;
        
        // Schedule proactive greetings for each AI NPC
        aiNpcs.forEach(npcId => {
            scheduleProactiveGreeting(npcId, roomId);
        });
    }
    
    /**
     * Schedule a proactive greeting from an NPC
     */
    function scheduleProactiveGreeting(npcId, roomId) {
        const npc = gameNpcs[npcId];
        if (!npc) return;
        
        // Don't greet too frequently - check last greeting time
        const now = Date.now();
        const lastGreeting = npcLastGreeting[npcId] || 0;
        const minTimeBetweenGreetings = (npc.greetingInterval?.min || 120) * 1000; // Default 2 minutes
        
        if (now - lastGreeting < minTimeBetweenGreetings) {
            console.log(`[Proactive NPCs] ${npc.name} greeted recently, skipping`);
            return;
        }
        
        // Clear any existing timer for this NPC
        if (npcGreetingTimers[npcId]) {
            clearTimeout(npcGreetingTimers[npcId]);
        }
        
        // Random delay before greeting (5-30 seconds after player enters)
        const minDelay = (npc.greetingDelay?.min || 5) * 1000;
        const maxDelay = (npc.greetingDelay?.max || 30) * 1000;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
        
        npcGreetingTimers[npcId] = setTimeout(async () => {
            await triggerProactiveGreeting(npcId, roomId);
        }, delay);
        
        console.log(`[Proactive NPCs] ${npc.name} will greet in ${Math.floor(delay/1000)} seconds`);
    }
    
    /**
     * Trigger a proactive greeting from an NPC
     */
    async function triggerProactiveGreeting(npcId, roomId) {
        const npc = gameNpcs[npcId];
        if (!npc) return;
        
        // Check if NPC is still in the room (could have wandered away)
        const room = gameWorld[roomId];
        if (!room || !room.npcs || !room.npcs.includes(npcId)) {
            console.log(`[Proactive NPCs] ${npc.name} no longer in room ${roomId}`);
            return;
        }
        
        // Check if there are still players in the room
        const playersInRoom = Object.values(gamePlayers).filter(p => p.roomId === roomId);
        if (playersInRoom.length === 0) {
            console.log(`[Proactive NPCs] No players in room ${roomId}`);
            return;
        }
        
        // Generate greeting using AI
        try {
            const greeting = await generateProactiveGreeting(npc, playersInRoom);
            
            if (greeting) {
                // Broadcast greeting to room
                const messageRef = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
                await addDoc(messageRef, {
                    roomId: roomId,
                    userId: `npc-${npcId}`,
                    username: npc.shortName || npc.name,
                    text: greeting,
                    timestamp: serverTimestamp(),
                    isNpcGreeting: true
                });
                
                // Update last greeting time
                npcLastGreeting[npcId] = Date.now();
                
                console.log(`[Proactive NPCs] ${npc.name} greeted players: "${greeting}"`);
                
                // Schedule next ambient dialogue
                scheduleAmbientDialogue(npcId, roomId);
            } else {
                console.log(`[Proactive NPCs] ${npc.name} greeting generation failed (AI unavailable)`);
            }
        } catch (error) {
            console.log(`[Proactive NPCs] ${npc.name} greeting skipped due to AI error:`, error.message);
        }
    }
    
    /**
     * Generate proactive greeting text using AI
     */
    async function generateProactiveGreeting(npc, playersInRoom) {
        const playerCount = playersInRoom.length;
        const playerNames = playersInRoom.map(p => p.name).join(', ');
        
        const prompt = `You are ${npc.shortName || npc.name}, an NPC in a fantasy game.
Your personality: ${npc.dialogue}

${playerCount} player${playerCount > 1 ? 's have' : ' has'} just entered your location: ${playerNames}.

Generate a SHORT proactive greeting, action, or ambient dialogue (1-2 sentences max).
This could be:
- A friendly greeting
- A song or poem (if you're a bard/minstrel)
- An observation or comment
- An action you're performing
- Something related to your role/personality

IMPORTANT FORMATTING RULES:
- For dialogue/speech: Use first-person ("I", "me", "my")
- For actions/emotes: Use third-person ("he", "she", "they") referring to yourself
- Keep it very brief (1-2 sentences)
- Don't use quotation marks around dialogue
- Don't include your name
- Be in character
- Make it feel natural and spontaneous
- Match your personality from above

Examples of CORRECT formatting:
- "Well, well, look what we have here," he says while polishing his spectacles.
- She looks up from her book. "I wasn't expecting visitors."
- "Greetings, traveler!" He waves enthusiastically from behind the counter.
- She strums her lute and begins singing a ballad about ancient heroes.
- "Ah, fresh faces," he mutters while continuing to sharpen his blade.

Examples of INCORRECT formatting (DO NOT DO THIS):
- "I look up and wave" (actions should be third-person)
- I greet the newcomers warmly (dialogue should be in quotes)`;

        try {
            const response = await Promise.race([
                callGeminiForText(prompt, logToTerminal),
                new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 5000))
            ]);
            return response.replace(/^["']|["']$/g, '').trim();
        } catch (error) {
            // Silently fail for AI errors - this is a nice-to-have feature
            console.log('[Proactive NPCs] AI greeting unavailable:', error.message);
            return null;
        }
    }
    
    /**
     * Schedule periodic ambient dialogue from an NPC
     */
    function scheduleAmbientDialogue(npcId, roomId) {
        const npc = gameNpcs[npcId];
        if (!npc || !npc.ambientDialogue) return;
        
        // Clear any existing timer
        if (npcGreetingTimers[`${npcId}-ambient`]) {
            clearTimeout(npcGreetingTimers[`${npcId}-ambient`]);
        }
        
        // Random interval for ambient dialogue (2-10 minutes)
        const minInterval = (npc.ambientInterval?.min || 120) * 1000;
        const maxInterval = (npc.ambientInterval?.max || 600) * 1000;
        const interval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
        
        npcGreetingTimers[`${npcId}-ambient`] = setTimeout(async () => {
            await triggerAmbientDialogue(npcId, roomId);
            // Reschedule
            scheduleAmbientDialogue(npcId, roomId);
        }, interval);
        
        console.log(`[Proactive NPCs] ${npc.name} will perform ambient action in ${Math.floor(interval/1000)} seconds`);
    }
    
    /**
     * Trigger ambient dialogue/action from an NPC
     */
    async function triggerAmbientDialogue(npcId, roomId) {
        const npc = gameNpcs[npcId];
        if (!npc) return;
        
        // Check if NPC is still in the room
        const room = gameWorld[roomId];
        if (!room || !room.npcs || !room.npcs.includes(npcId)) {
            console.log(`[Proactive NPCs] ${npc.name} no longer in room for ambient dialogue`);
            return;
        }
        
        // Check if there are players in the room
        const playersInRoom = Object.values(gamePlayers).filter(p => p.roomId === roomId);
        if (playersInRoom.length === 0) {
            console.log(`[Proactive NPCs] No players in room for ambient dialogue`);
            return;
        }
        
        // Generate ambient dialogue
        const dialogue = await generateAmbientDialogue(npc);
        
        if (dialogue) {
            // Broadcast to room
            const messageRef = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
            await addDoc(messageRef, {
                roomId: roomId,
                userId: `npc-${npcId}`,
                username: npc.shortName || npc.name,
                text: dialogue,
                timestamp: serverTimestamp(),
                isNpcAmbient: true
            });
            
            console.log(`[Proactive NPCs] ${npc.name} ambient: "${dialogue}"`);
        }
    }
    
    /**
     * Generate ambient dialogue/action using AI
     */
    async function generateAmbientDialogue(npc) {
        const prompt = `You are ${npc.shortName || npc.name}, an NPC in a fantasy game.
Your personality: ${npc.dialogue}

Generate a SHORT ambient action or dialogue (1 sentence max) that you might do while going about your business.
This should be something natural that doesn't require player response:
- Humming a tune
- Polishing equipment
- Making an observation
- Performing your craft
- A brief comment about the weather/location

IMPORTANT:
- ONE sentence maximum
- Don't use quotation marks
- Don't include your name
- Be in character
- Don't directly address players
- Make it atmospheric

Examples:
- A minstrel: "hums a cheerful melody while tuning the lute"
- A blacksmith: "wipes sweat from brow and examines a freshly forged blade"
- A merchant: "rearranges some items on the counter, muttering about inventory"
- A wizard: "traces glowing runes in the air absentmindedly"`;

        try {
            const response = await callGeminiForText(prompt, logToTerminal);
            return response.replace(/^["']|["']$/g, '').trim();
        } catch (error) {
            console.error('[Proactive NPCs] Error generating ambient dialogue:', error);
            return null;
        }
    }
    
    /**
     * Stop all proactive behavior for NPCs in a room
     */
    function stopProactiveNpcsInRoom(roomId) {
        const room = gameWorld[roomId];
        if (!room || !room.npcs) return;
        
        room.npcs.forEach(npcId => {
            if (npcGreetingTimers[npcId]) {
                clearTimeout(npcGreetingTimers[npcId]);
                delete npcGreetingTimers[npcId];
            }
            if (npcGreetingTimers[`${npcId}-ambient`]) {
                clearTimeout(npcGreetingTimers[`${npcId}-ambient`]);
                delete npcGreetingTimers[`${npcId}-ambient`];
            }
        });
    }
    
    async function executeParsedCommand(parsedCommand, cmdText) {
        const { action, target, npc_target, topic, verb } = parsedCommand;
        
        // Debug logging for attack commands
        if (action === 'attack') {
            console.log('Attack command parsed:', { action, target, verb, fullCommand: cmdText });
        }

        // Don't clear lastNpcInteraction for unknown commands - they might be conversation continuations
        if (action !== 'talk' && action !== 'ask_npc' && action !== 'reply_npc' && action !== 'unknown' && action !== 'say') {
            lastNpcInteraction = null;
            conversationHistory = []; // Clear conversation history when ending conversation
        }

        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
        const currentRoom = gameWorld[currentPlayerRoomId];
        const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${currentPlayerRoomId}`);

        const findNpcInRoom = (targetName) => {
            if (!targetName || !currentRoom.npcs) return null;
            const lowerTarget = targetName.toLowerCase();
            const roomNpcIds = currentRoom.npcs || [];
            const npcId = roomNpcIds.find(id => {
                const npc = gameNpcs[id];
                if (!npc) return false;
                const shortNameMatch = npc.shortName && npc.shortName.toLowerCase() === lowerTarget;
                const descriptiveNameMatch = npc.name.toLowerCase().includes(lowerTarget);
                return shortNameMatch || descriptiveNameMatch;
            });
            return npcId ? { id: npcId, ...gameNpcs[npcId] } : null;
        };
        
        const findItemByName = (itemName) => {
            if (!itemName) return null;
            const lowerItemName = itemName.toLowerCase();
            for (const id in gameItems) {
                const item = gameItems[id];
                // Check item name
                if(item.name.toLowerCase().includes(lowerItemName)) {
                    return {id, ...item};
                }
                // Check aliases
                if (item.aliases && Array.isArray(item.aliases)) {
                    for (const alias of item.aliases) {
                        if (alias.toLowerCase().includes(lowerItemName)) {
                            return {id, ...item};
                        }
                    }
                }
            }
            return null;
        };

        // ========== RANGE CHECKING SYSTEM ==========
        
        // Get all rooms within specified range of a starting room
        // Range 0 = same room only, 1 = adjacent rooms, 2 = two rooms away
        const getRoomsInRange = (startRoomId, range) => {
            if (range === 0) {
                return [startRoomId];
            }
            
            const visited = new Set([startRoomId]);
            const rooms = [startRoomId];
            let currentLevel = [startRoomId];
            
            for (let depth = 0; depth < range; depth++) {
                const nextLevel = [];
                for (const roomId of currentLevel) {
                    const room = gameWorld[roomId];
                    if (!room || !room.exits) continue;
                    
                    // Check all exits from this room
                    for (const [direction, neighborRoomId] of Object.entries(room.exits)) {
                        if (!visited.has(neighborRoomId)) {
                            visited.add(neighborRoomId);
                            rooms.push(neighborRoomId);
                            nextLevel.push(neighborRoomId);
                        }
                    }
                }
                currentLevel = nextLevel;
            }
            
            return rooms;
        };
        
        // Find a target (player or monster) in range
        const findTargetInRange = (targetName, currentRoomId, range) => {
            const roomsInRange = getRoomsInRange(currentRoomId, range);
            
            // Look for player first
            for (const roomId of roomsInRange) {
                const targetPlayerEntry = Object.entries(gamePlayers).find(([playerId, player]) => 
                    playerId !== userId && 
                    player.roomId === roomId && 
                    player.name.toLowerCase().includes(targetName.toLowerCase())
                );
                
                if (targetPlayerEntry) {
                    const [targetPlayerId, targetPlayerData] = targetPlayerEntry;
                    return {
                        type: 'player',
                        id: targetPlayerId,
                        data: targetPlayerData,
                        roomId: roomId,
                        distance: roomsInRange.indexOf(roomId)
                    };
                }
            }
            
            // Look for monster
            for (const roomId of roomsInRange) {
                const monsterEntry = Object.entries(activeMonsters).find(([id, m]) => 
                    m.roomId === roomId && 
                    targetName && 
                    (m.monsterId.toLowerCase().includes(targetName.toLowerCase()) || 
                     m.name.toLowerCase().includes(targetName.toLowerCase()))
                );
                
                if (monsterEntry) {
                    const [monsterInstanceId, monsterInstanceData] = monsterEntry;
                    return {
                        type: 'monster',
                        id: monsterInstanceId,
                        data: monsterInstanceData,
                        roomId: roomId,
                        distance: roomsInRange.indexOf(roomId)
                    };
                }
            }
            
            return null;
        };

        // ========== VERBOSE COMBAT DESCRIPTION SYSTEM ==========
        
        // Get dodge description based on defender's DEX
        const getDodgeDescription = (defenderName, defenderDex, isPlayer = true) => {
            const dex = defenderDex || 10;
            const pronoun = isPlayer ? 'You' : defenderName;
            const verb = isPlayer ? 'dodge' : 'dodges';
            const possessive = isPlayer ? 'your' : 'the';
            
            if (dex >= 18) {
                // High DEX - graceful, acrobatic dodges
                const descriptions = [
                    `${pronoun} ${verb} with lightning reflexes!`,
                    `${pronoun} effortlessly sidestep${isPlayer ? '' : 's'} the attack!`,
                    `${pronoun} ${verb} the blow with incredible agility!`,
                    `${pronoun} duck${isPlayer ? '' : 's'} and weave${isPlayer ? '' : 's'}, avoiding the attack completely!`,
                    `${pronoun} spin${isPlayer ? '' : 's'} away gracefully, the attack missing by mere inches!`
                ];
                return descriptions[Math.floor(Math.random() * descriptions.length)];
            } else if (dex >= 14) {
                // Medium DEX - competent dodges
                const descriptions = [
                    `${pronoun} ${verb} the attack!`,
                    `${pronoun} quickly step${isPlayer ? '' : 's'} aside!`,
                    `${pronoun} ${verb} out of the way!`,
                    `${pronoun} lean${isPlayer ? '' : 's'} back, avoiding the strike!`,
                    `${pronoun} nimbly avoid${isPlayer ? '' : 's'} the blow!`
                ];
                return descriptions[Math.floor(Math.random() * descriptions.length)];
            } else {
                // Low DEX - barely dodges
                const descriptions = [
                    `${pronoun} barely ${verb} the attack!`,
                    `${pronoun} clumsily stumble${isPlayer ? '' : 's'} out of the way!`,
                    `${pronoun} manage${isPlayer ? '' : 's'} to avoid the blow!`,
                    `By luck, the attack misses ${isPlayer ? 'you' : defenderName}!`,
                    `${pronoun} awkwardly ${verb} aside!`
                ];
                return descriptions[Math.floor(Math.random() * descriptions.length)];
            }
        };
        
        // Get block description (for shields or armor)
        const getBlockDescription = (defenderName, blockType, itemName, isPlayer = true) => {
            const pronoun = isPlayer ? 'You' : defenderName;
            const verb = isPlayer ? 'raise' : 'raises';
            const possessive = isPlayer ? 'your' : 'their';
            
            if (blockType === 'shield') {
                const descriptions = [
                    `${pronoun} ${verb} ${possessive} ${itemName} and block${isPlayer ? '' : 's'} the attack!`,
                    `${pronoun} intercept${isPlayer ? '' : 's'} the blow with ${possessive} ${itemName}!`,
                    `${possessive.charAt(0).toUpperCase() + possessive.slice(1)} ${itemName} absorbs the impact!`,
                    `The attack strikes ${possessive} ${itemName} with a resounding CLANG!`,
                    `${pronoun} deflect${isPlayer ? '' : 's'} the strike with ${possessive} ${itemName}!`
                ];
                return descriptions[Math.floor(Math.random() * descriptions.length)];
            } else if (blockType === 'armor') {
                const descriptions = [
                    `The blow glances off ${possessive} ${itemName}!`,
                    `${possessive.charAt(0).toUpperCase() + possessive.slice(1)} ${itemName} absorbs most of the impact!`,
                    `The attack deflects off ${possessive} ${itemName}!`,
                    `${possessive.charAt(0).toUpperCase() + possessive.slice(1)} ${itemName} protects ${isPlayer ? 'you' : 'them'} from the worst of it!`,
                    `The strike clangs harmlessly against ${possessive} ${itemName}!`
                ];
                return descriptions[Math.floor(Math.random() * descriptions.length)];
            }
        };
        
        // Get damage severity level
        const getDamageSeverity = (damage) => {
            if (damage <= 3) return 'light';
            if (damage <= 7) return 'moderate';
            if (damage <= 12) return 'heavy';
            if (damage <= 20) return 'severe';
            return 'devastating';
        };
        
        // Generate verbose combat description based on verb, damage, and context
        const getVerboseCombatDescription = (verb, attacker, target, damage, weaponName = null, isCritical = false) => {
            const defaultVerb = 'hit';
            const actionVerb = verb || defaultVerb;
            const severity = getDamageSeverity(damage);
            
            // Weapon integration
            const weaponPhrase = weaponName ? ` with ${weaponName}` : '';
            const useWeapon = weaponName && Math.random() < 0.7; // 70% chance to mention weapon
            
            // Severity modifiers
            const severityPhrases = {
                'light': ['grazes', 'scratches', 'clips', 'nicks'],
                'moderate': ['strikes', 'hits', 'wounds'],
                'heavy': ['smashes', 'pounds', 'batters', 'crushes'],
                'severe': ['devastates', 'pummels', 'savages', 'mauls'],
                'devastating': ['annihilates', 'obliterates', 'decimates', 'pulverizes']
            };
            
            // Build descriptions based on verb and severity
            let description = '';
            
            switch(actionVerb.toLowerCase()) {
                case 'kick':
                    if (severity === 'light') {
                        description = `${attacker} delivers a glancing kick to ${target}`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} kicks ${target} solidly`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} delivers a crushing kick to ${target}`;
                    } else {
                        description = `${attacker} lands a bone-shattering kick on ${target}`;
                    }
                    break;
                    
                case 'punch':
                    if (severity === 'light') {
                        description = `${attacker} grazes ${target} with a quick jab`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} lands a solid punch on ${target}`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} drives a powerful fist into ${target}`;
                    } else {
                        description = `${attacker} unleashes a devastating haymaker on ${target}`;
                    }
                    break;
                    
                case 'slash':
                case 'cut':
                    const slashWeapon = useWeapon ? weaponPhrase : '';
                    if (severity === 'light') {
                        description = `${attacker} nicks ${target}${slashWeapon}, drawing a thin line of blood`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} slashes across ${target}${slashWeapon}, opening a wound`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} carves a deep gash in ${target}${slashWeapon}`;
                    } else {
                        description = `${attacker} cleaves into ${target}${slashWeapon} with tremendous force`;
                    }
                    break;
                    
                case 'stab':
                case 'pierce':
                    const stabWeapon = useWeapon ? weaponPhrase : '';
                    if (severity === 'light') {
                        description = `${attacker} scratches ${target}${stabWeapon}`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} pierces ${target}${stabWeapon}`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} drives${stabWeapon} deep into ${target}`;
                    } else {
                        description = `${attacker} impales ${target}${stabWeapon}, blood spraying from the wound`;
                    }
                    break;
                    
                case 'bite':
                    if (severity === 'light') {
                        description = `${attacker} nips at ${target}`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} sinks teeth into ${target}`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} savagely bites ${target}`;
                    } else {
                        description = `${attacker} clamps powerful jaws on ${target}, tearing flesh`;
                    }
                    break;
                    
                case 'claw':
                    if (severity === 'light') {
                        description = `${attacker} scratches ${target} lightly`;
                    } else if (severity === 'moderate') {
                        description = `${attacker} rakes sharp claws across ${target}`;
                    } else if (severity === 'heavy') {
                        description = `${attacker} shreds ${target} with vicious claws`;
                    } else {
                        description = `${attacker} tears into ${target} with razor-sharp talons`;
                    }
                    break;
                    
                case 'swing':
                case 'hit':
                case 'attack':
                default:
                    const hitWeapon = useWeapon ? weaponPhrase : '';
                    if (severity === 'light') {
                        const lightVerbs = ['taps', 'grazes', 'clips'];
                        const lightVerb = lightVerbs[Math.floor(Math.random() * lightVerbs.length)];
                        description = `${attacker} ${lightVerb} ${target}${hitWeapon}`;
                    } else if (severity === 'moderate') {
                        const modVerbs = ['strikes', 'hits', 'connects with'];
                        const modVerb = modVerbs[Math.floor(Math.random() * modVerbs.length)];
                        description = `${attacker} ${modVerb} ${target}${hitWeapon}`;
                    } else if (severity === 'heavy') {
                        const heavyVerbs = ['smashes', 'pounds', 'hammers'];
                        const heavyVerb = heavyVerbs[Math.floor(Math.random() * heavyVerbs.length)];
                        description = `${attacker} ${heavyVerb} ${target}${hitWeapon}`;
                    } else {
                        const devVerbs = ['crushes', 'devastates', 'obliterates'];
                        const devVerb = devVerbs[Math.floor(Math.random() * devVerbs.length)];
                        description = `${attacker} ${devVerb} ${target}${hitWeapon}`;
                    }
                    break;
            }
            
            // Add critical hit flair
            if (isCritical) {
                const critPhrases = [
                    ' in a masterful strike',
                    ' with perfect precision',
                    ' finding a vulnerable spot',
                    ' in a devastating blow',
                    ' with lethal accuracy'
                ];
                description += critPhrases[Math.floor(Math.random() * critPhrases.length)];
            }
            
            // Add damage amount with appropriate flair
            if (isCritical) {
                return `${description} for <span class="critical-damage">${damage} damage</span>! ⚡ <span class="critical-text">CRITICAL HIT!</span>`;
            } else {
                return `${description} for ${damage} damage!`;
            }
        };
        
        // Generate verbose enemy counter-attack description
        const getVerboseEnemyAttackDescription = (enemyName, damage, attackType = 'standard', isCritical = false) => {
            const severity = getDamageSeverity(damage);
            const article = ['a', 'e', 'i', 'o', 'u'].includes(enemyName[0].toLowerCase()) ? 'an' : 'a';
            
            let description = '';
            
            // Varied attack descriptions based on severity
            if (severity === 'light') {
                const lightAttacks = [
                    `The ${enemyName} lashes out weakly`,
                    `The ${enemyName} strikes with a glancing blow`,
                    `The ${enemyName} delivers a light attack`,
                    `The ${enemyName} scratches you`
                ];
                description = lightAttacks[Math.floor(Math.random() * lightAttacks.length)];
            } else if (severity === 'moderate') {
                const modAttacks = [
                    `The ${enemyName} counter-attacks`,
                    `The ${enemyName} strikes back`,
                    `The ${enemyName} retaliates`,
                    `The ${enemyName} lands a solid hit`
                ];
                description = modAttacks[Math.floor(Math.random() * modAttacks.length)];
            } else if (severity === 'heavy') {
                const heavyAttacks = [
                    `The ${enemyName} savagely counter-attacks`,
                    `The ${enemyName} strikes with brutal force`,
                    `The ${enemyName} delivers a crushing blow`,
                    `The ${enemyName} hammers you with a powerful strike`
                ];
                description = heavyAttacks[Math.floor(Math.random() * heavyAttacks.length)];
            } else {
                const devAttacks = [
                    `The ${enemyName} unleashes a devastating assault`,
                    `The ${enemyName} attacks with terrifying power`,
                    `The ${enemyName} delivers a bone-crushing strike`,
                    `The ${enemyName} strikes with overwhelming force`
                ];
                description = devAttacks[Math.floor(Math.random() * devAttacks.length)];
            }
            
            // Add damage
            const damageText = isCritical ? 
                `<span class="critical-damage">${damage} damage</span>! ⚡ <span class="critical-text">CRITICAL HIT!</span>` : 
                `${damage} damage!`;
                
            return `${description}, hitting you for ${damageText}`;
        };

        // ========== ENHANCED COMBAT SYSTEM ==========
        // Calculate damage output based on all relevant attributes
        // Helper function to get effective attributes including guild bonuses
        const getEffectiveAttributes = (entity) => {
            const baseAttrs = entity.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            
            // Check if entity is a player with a guild
            if (entity.guildId && gameGuilds[entity.guildId]) {
                const guild = gameGuilds[entity.guildId];
                if (guild.perks && guild.perks.statBonus) {
                    const bonuses = guild.perks.statBonus;
                    const effectiveAttrs = { ...baseAttrs };
                    
                    // Apply guild stat bonuses
                    Object.keys(baseAttrs).forEach(stat => {
                        if (bonuses[stat]) {
                            effectiveAttrs[stat] = baseAttrs[stat] + bonuses[stat];
                        }
                    });
                    
                    return effectiveAttrs;
                }
            }
            
            return baseAttrs;
        };
        
        const calculateDamage = (attacker, defender, weaponBonus = 0, isMagical = false) => {
            const attackerAttrs = getEffectiveAttributes(attacker);
            const defenderAttrs = getEffectiveAttributes(defender);
            
            // Base damage: 1-6 + stat modifier
            let baseDamage = Math.ceil(Math.random() * 6);
            
            // Physical attacks: STR bonus
            // Magical attacks: INT bonus
            const attackStat = isMagical ? attackerAttrs.int : attackerAttrs.str;
            const attackBonus = Math.floor((attackStat - 10) / 2); // D&D style modifier
            baseDamage += attackBonus;
            
            // DEX affects accuracy - adds to damage on higher DEX
            const dexBonus = Math.floor((attackerAttrs.dex - 10) / 4); // Smaller bonus
            baseDamage += dexBonus;
            
            // Add weapon bonus
            baseDamage += weaponBonus;
            
            // Critical hit chance based on DEX (5% base + 1% per 2 DEX above 10)
            const critChance = 0.05 + Math.max(0, (attackerAttrs.dex - 10) * 0.005);
            const isCritical = Math.random() < critChance;
            if (isCritical) {
                baseDamage = Math.floor(baseDamage * 2); // Double damage on crit
            }
            
            // Defender's CON reduces damage (damage reduction)
            const conReduction = Math.floor((defenderAttrs.con - 10) / 3);
            baseDamage = Math.max(1, baseDamage - conReduction); // Minimum 1 damage
            
            // Ensure minimum damage
            baseDamage = Math.max(1, baseDamage);
            
            return {
                damage: baseDamage,
                isCritical,
                attackBonus,
                dexBonus,
                conReduction,
                weaponBonus
            };
        };
        
        // Calculate dodge chance based on DEX and WIS
        const calculateDodge = (defender) => {
            const defenderAttrs = getEffectiveAttributes(defender);
            
            // Base dodge: 5% + DEX modifier + WIS modifier
            const dexMod = Math.floor((defenderAttrs.dex - 10) / 2);
            const wisMod = Math.floor((defenderAttrs.wis - 10) / 4); // Smaller contribution
            const dodgeChance = 0.05 + (dexMod * 0.02) + (wisMod * 0.01);
            
            return Math.min(0.50, Math.max(0, dodgeChance)); // Cap at 50%
        };
        
        // Calculate shield block chance (if equipped)
        const calculateShieldBlock = (defender) => {
            // Check if defender has a shield equipped
            if (!defender.equippedShield) return 0;
            
            const shield = gameItems[defender.equippedShield];
            if (!shield || shield.type !== 'shield') return 0;
            
            // Base block chance: 15% + DEX modifier
            const defenderAttrs = getEffectiveAttributes(defender);
            const dexMod = Math.floor((defenderAttrs.dex - 10) / 2);
            const blockChance = 0.15 + (dexMod * 0.02);
            
            return Math.min(0.40, Math.max(0, blockChance)); // Cap at 40%
        };
        
        // Calculate armor damage reduction
        const calculateArmorReduction = (defender, incomingDamage) => {
            if (!defender.equippedArmor) return { reduction: 0, armorName: null };
            
            const armor = gameItems[defender.equippedArmor];
            if (!armor || armor.type !== 'armor') return { reduction: 0, armorName: null };
            
            // Armor reduces damage by its damageReduction value (or defaults based on subtype)
            let reduction = armor.damageReduction || 0;
            
            // Default reduction based on armor type if not specified
            if (reduction === 0 && armor.subtype) {
                const armorReductions = {
                    'leather': 2,
                    'chainmail': 3,
                    'plate': 5,
                    'cloth': 1
                };
                reduction = armorReductions[armor.subtype.toLowerCase()] || 0;
            }
            
            // Random chance for armor to fully deflect weak attacks (10% for light damage)
            const severity = getDamageSeverity(incomingDamage);
            if (severity === 'light' && Math.random() < 0.10) {
                return { reduction: incomingDamage, armorName: armor.name, fullDeflect: true };
            }
            
            return { reduction, armorName: armor.name, fullDeflect: false };
        };
        
        // Enhanced combat result application with verbose descriptions
        const applyVerboseCombatResult = (result, attackerName, defenderName, combatMessages, defenderData = null, verb = 'hit', weaponName = null) => {
            const defenderAttrs = defenderData ? getEffectiveAttributes(defenderData) : { dex: 10 };
            
            // Handle dodge
            if (result.dodged) {
                const dodgeMsg = getDodgeDescription(defenderName, defenderAttrs.dex, attackerName === 'You');
                combatMessages.push({ 
                    msg: dodgeMsg, 
                    type: 'combat-log' 
                });
                return { finalDamage: 0, blocked: false, dodged: true };
            }
            
            // Handle shield block
            if (result.blocked) {
                const shieldName = defenderData?.equippedShield ? gameItems[defenderData.equippedShield]?.name : 'shield';
                const blockMsg = getBlockDescription(defenderName, 'shield', shieldName, attackerName === 'You');
                combatMessages.push({ 
                    msg: blockMsg, 
                    type: 'combat-log' 
                });
                
                // Shield blocks reduce damage by 50-100%
                const blockReduction = Math.floor(result.damage * (0.5 + Math.random() * 0.5));
                const finalDamage = Math.max(0, result.damage - blockReduction);
                
                if (finalDamage > 0) {
                    combatMessages.push({ 
                        msg: `Some of the impact gets through for ${finalDamage} damage!`, 
                        type: 'combat-log' 
                    });
                }
                
                return { finalDamage, blocked: true, dodged: false };
            }
            
            // Handle armor reduction
            let finalDamage = result.damage;
            let armorReduction = 0;
            let armorName = null;
            let fullDeflect = false;
            
            if (defenderData && defenderData.equippedArmor) {
                const armorResult = calculateArmorReduction(defenderData, result.damage);
                armorReduction = armorResult.reduction;
                armorName = armorResult.armorName;
                fullDeflect = armorResult.fullDeflect;
                finalDamage = Math.max(0, finalDamage - armorReduction);
            }
            
            // Use verbose combat description
            const combatMsg = getVerboseCombatDescription(
                verb, 
                attackerName, 
                defenderName, 
                finalDamage, 
                weaponName, 
                result.isCritical
            );
            
            combatMessages.push({ msg: combatMsg, type: 'combat-log' });
            
            // Show armor deflection/reduction if applicable
            if (fullDeflect && armorName) {
                const deflectMsg = getBlockDescription(defenderName, 'armor', armorName, attackerName === 'You');
                combatMessages.push({ msg: deflectMsg, type: 'game' });
            } else if (armorReduction > 0 && armorName) {
                combatMessages.push({ 
                    msg: `(${armorName} absorbed ${armorReduction} damage)`, 
                    type: 'game' 
                });
            }
            
            // Show combat breakdown if significant bonuses
            const bonusDetails = [];
            if (result.attackBonus > 0) bonusDetails.push(`+${result.attackBonus} STR`);
            if (result.dexBonus > 0) bonusDetails.push(`+${result.dexBonus} DEX`);
            if (result.weaponBonus > 0) bonusDetails.push(`+${result.weaponBonus} weapon`);
            if (result.conReduction > 0) bonusDetails.push(`-${result.conReduction} target CON`);
            if (armorReduction > 0) bonusDetails.push(`-${armorReduction} armor`);
            
            if (bonusDetails.length > 0 && !result.isCritical) {
                combatMessages.push({ 
                    msg: `(${bonusDetails.join(', ')})`, 
                    type: 'game' 
                });
            }
            
            return { finalDamage, blocked: false, dodged: false };
        };

        // Calculate total weight of items in inventory
        const calculateInventoryWeight = (inventory) => {
            let totalWeight = 0;
            for (const item of inventory) {
                const itemData = gameItems[item.id];
                if (itemData) {
                    const itemWeight = itemData.weight || 0;
                    const quantity = item.quantity || 1;
                    totalWeight += itemWeight * quantity;
                }
            }
            return totalWeight;
        };

        // Calculate maximum carrying capacity based on strength
        const calculateMaxCarryWeight = (playerData) => {
            const strength = playerData.strength || 10;
            const baseCapacity = 50; // Base capacity
            const strengthBonus = strength * 5; // 5 lbs per point of strength
            
            // Check for equipped bags/backpacks that increase capacity
            let bagBonus = 0;
            const inventory = playerData.inventory || [];
            for (const item of inventory) {
                const itemData = gameItems[item.id];
                if (itemData && itemData.itemType === 'container' && item.equipped) {
                    bagBonus += itemData.specialData?.capacityBonus || 0;
                }
            }
            
            return baseCapacity + strengthBonus + bagBonus;
        };

        // Check if player can carry an item
        const canCarryItem = (playerData, itemId, quantity = 1) => {
            const itemData = gameItems[itemId];
            if (!itemData) return false;
            
            const itemWeight = (itemData.weight || 0) * quantity;
            const currentWeight = calculateInventoryWeight(playerData.inventory || []);
            const maxWeight = calculateMaxCarryWeight(playerData);
            
            return (currentWeight + itemWeight) <= maxWeight;
        };

        // Handle special item types (keys, teleport devices, etc.)
        const handleSpecialItem = async (itemType, itemData, inventoryItem, playerData) => {
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            const specialData = itemData.specialData || {};

            switch(itemType) {
                case 'key':
                    // Keys unlock doors/exits in the current room
                    const unlocks = specialData.unlocks || specialData.direction; // e.g., "north", "gate", or specific exit
                    const consumeOnUse = specialData.consumeOnUse !== false; // Default: true (key is consumed)
                    
                    if (!unlocks) {
                        logToTerminal(`${itemData.name} doesn't seem to fit any lock here.`, 'error');
                        break;
                    }
                    
                    // Get current room
                    const currentRoomForKey = gameWorld[playerData.roomId];
                    if (!currentRoomForKey || !currentRoomForKey.lockedExits) {
                        logToTerminal(`There's nothing to unlock here.`, 'error');
                        break;
                    }
                    
                    // Find matching locked exit
                    let unlockedDirection = null;
                    let lockInfo = null;
                    
                    // Try direct match first (e.g., "north")
                    if (currentRoomForKey.lockedExits[unlocks]) {
                        unlockedDirection = unlocks;
                        lockInfo = currentRoomForKey.lockedExits[unlocks];
                    } else {
                        // Try to match by keyId
                        for (const [dir, lock] of Object.entries(currentRoomForKey.lockedExits)) {
                            if (lock.keyId === itemData.id || lock.key === itemData.id) {
                                unlockedDirection = dir;
                                lockInfo = lock;
                                break;
                            }
                        }
                    }
                    
                    if (!unlockedDirection) {
                        logToTerminal(`${itemData.name} doesn't fit any lock in this room.`, 'error');
                        break;
                    }
                    
                    // Unlock the exit permanently
                    const exitKey = `${playerData.roomId}:${unlockedDirection}`;
                    const currentUnlockedExits = playerData.unlockedExits || [];
                    
                    if (currentUnlockedExits.includes(exitKey)) {
                        logToTerminal(`The way ${unlockedDirection} is already unlocked.`, 'game');
                        break;
                    }
                    
                    // Add to unlocked exits
                    await updateDoc(playerRef, {
                        unlockedExits: arrayUnion(exitKey)
                    });
                    
                    // Show unlock message
                    const unlockMessage = lockInfo.unlockMessage || 
                                        lockInfo.unlocked || 
                                        `You use ${itemData.name} to unlock the way ${unlockedDirection}. *Click*`;
                    logToTerminal(unlockMessage, 'success');
                    
                    // Remove key from inventory if consumable
                    if (consumeOnUse) {
                        const updatedInv = playerData.inventory.filter(item => 
                            item.id !== inventoryItem.id || item.name !== inventoryItem.name
                        );
                        // Phase 3: Inventory is permanent data
                        await playerPersistence.syncToMySQL(userId, { inventory: updatedInv });
                        logToTerminal(`${itemData.name} crumbles to dust after use.`, 'system');
                    } else {
                        logToTerminal(`You can use ${itemData.name} again if needed.`, 'system');
                    }
                    
                    break;

                case 'teleport':
                    // Teleportation device - show available destinations
                    const destinations = specialData.destinations || Object.keys(gameWorld);
                    logToTerminal(`${itemData.name} begins to glow...`, 'system');
                    logToTerminal(`Available destinations:`, 'game');
                    destinations.forEach(roomId => {
                        const room = gameWorld[roomId];
                        if (room) logToTerminal(`- ${room.name} (${roomId})`, 'game');
                    });
                    logToTerminal(`(Teleportation not yet implemented - will allow instant travel in future updates)`, 'game');
                    break;

                case 'light':
                    // Light source - reveals dark areas
                    logToTerminal(`You activate ${itemData.name}. It illuminates the area around you.`, 'system');
                    logToTerminal(`(Light system not yet implemented - will reveal hidden areas in future updates)`, 'game');
                    break;

                case 'container':
                    // Container - can hold items
                    // Initialize contents if not exists
                    if (!inventoryItem.contents) {
                        inventoryItem.contents = [];
                    }
                    
                    // Show container contents
                    logToTerminal(`You open ${itemData.name}.`, 'system');
                    
                    if (inventoryItem.contents.length === 0) {
                        logToTerminal(`The ${itemData.name} is empty.`, 'game');
                    } else {
                        logToTerminal(`It contains:`, 'game');
                        inventoryItem.contents.forEach(containedItem => {
                            const containedItemData = gameItems[containedItem.id];
                            if (containedItemData) {
                                const qty = containedItem.quantity || 1;
                                const weight = containedItemData.weight || 0;
                                logToTerminal(`- ${containedItemData.name}${qty > 1 ? ` (x${qty})` : ''} [${weight * qty} lbs]`, 'game');
                            }
                        });
                    }
                    
                    // Show capacity info
                    const maxCapacity = specialData.capacity || 50;
                    let currentContentsWeight = 0;
                    for (const item of inventoryItem.contents) {
                        const itemData = gameItems[item.id];
                        if (itemData) {
                            currentContentsWeight += (itemData.weight || 0) * (item.quantity || 1);
                        }
                    }
                    logToTerminal(`Capacity: ${currentContentsWeight.toFixed(1)}/${maxCapacity} lbs`, 'info');
                    logToTerminal(`Use 'put [item] in ${itemData.name}' to store items.`, 'hint');
                    logToTerminal(`Use 'take [item] from ${itemData.name}' to retrieve items.`, 'hint');
                    break;

                case 'spellbook':
                    // Spellbook - teaches one or more spells when used
                    // Support both single spell (teachSpell) and multiple spells (teachSpells array)
                    let spellsToTeach = [];
                    
                    if (specialData.teachSpells && Array.isArray(specialData.teachSpells)) {
                        spellsToTeach = specialData.teachSpells;
                    } else if (specialData.teachSpell) {
                        spellsToTeach = [specialData.teachSpell];
                    }
                    
                    if (spellsToTeach.length === 0) {
                        logToTerminal(`${itemData.name} appears to be blank.`, 'error');
                        break;
                    }

                    // Get current known spells
                    const currentKnownSpells = playerData.knownSpells || [];
                    
                    // Check which spells the player doesn't know yet
                    const newSpells = [];
                    const alreadyKnown = [];
                    const unknownSpells = [];
                    
                    for (const spellId of spellsToTeach) {
                        const spell = gameSpells[spellId];
                        if (!spell) {
                            unknownSpells.push(spellId);
                        } else if (currentKnownSpells.includes(spellId)) {
                            alreadyKnown.push(spell.name);
                        } else {
                            newSpells.push({ id: spellId, data: spell });
                        }
                    }

                    // If no new spells to learn
                    if (newSpells.length === 0) {
                        if (unknownSpells.length > 0) {
                            logToTerminal(`${itemData.name} contains unknown or corrupted magic.`, 'error');
                        } else {
                            logToTerminal(`You already know all the spells in ${itemData.name}. The book's magic fades.`, 'game');
                        }
                        // Still consume the item
                        const updatedInv = playerData.inventory.filter(item => 
                            item.id !== inventoryItem.id || item.name !== inventoryItem.name
                        );
                        // Phase 3: Inventory is permanent data
                        await playerPersistence.syncToMySQL(userId, { inventory: updatedInv });
                        break;
                    }

                    // Teach all new spells
                    const spellIdsToAdd = newSpells.map(s => s.id);
                    // Phase 3: Known spells and inventory are permanent data
                    await playerPersistence.syncToMySQL(userId, {
                        knownSpells: [...currentKnownSpells, ...spellIdsToAdd],
                        inventory: playerData.inventory.filter(item => 
                            item.id !== inventoryItem.id || item.name !== inventoryItem.name
                        )
                    });

                    logToTerminal(`You study ${itemData.name} intently. The magical words burn themselves into your mind!`, 'system');
                    
                    // Show what was learned
                    if (newSpells.length === 1) {
                        const spell = newSpells[0].data;
                        logToTerminal(`You have learned ${spell.name}!`, 'success');
                        logToTerminal(`${spell.description}`, 'game');
                        logToTerminal(`MP Cost: ${spell.mpCost} | Target: ${spell.targetType}`, 'game');
                    } else {
                        logToTerminal(`You have learned ${newSpells.length} new spells!`, 'success');
                        newSpells.forEach(({ data: spell }) => {
                            logToTerminal(`• ${spell.name} (${spell.mpCost} MP, ${spell.targetType})`, 'game');
                        });
                    }
                    
                    // Show which spells were already known
                    if (alreadyKnown.length > 0) {
                        logToTerminal(`You already knew: ${alreadyKnown.join(', ')}`, 'game');
                    }
                    
                    // The book is consumed after learning
                    logToTerminal(`The book crumbles to dust as its knowledge transfers to you.`, 'system');
                    break;

                case 'scroll':
                case 'wand':
                case 'magical':
                    // Magical item that casts a spell when used (one-time consumable)
                    const castSpellId = specialData.castSpell;
                    if (!castSpellId) {
                        logToTerminal(`${itemData.name} appears to be inert.`, 'error');
                        break;
                    }

                    // Check if spell exists
                    const spellToCast = gameSpells[castSpellId];
                    if (!spellToCast) {
                        logToTerminal(`${itemData.name} contains corrupted magic and fizzles.`, 'error');
                        // Still consume the broken item
                        const brokenInv = playerData.inventory.filter(item => 
                            item.id !== inventoryItem.id || item.name !== inventoryItem.name
                        );
                        // Phase 3: Inventory is permanent data
                        await playerPersistence.syncToMySQL(userId, { inventory: brokenInv });
                        break;
                    }

                    // Get current player stats
                    const currentHp = playerData.hp || 0;
                    const maxHp = playerData.maxHp || 100;

                    // Handle different target types
                    let scrollSuccess = false;
                    let scrollTargetName = parsedCommand.npc_target || "";

                    logToTerminal(`You activate ${itemData.name}!`, 'system');

                    switch (spellToCast.targetType) {
                        case 'self':
                            // Apply spell effects to self
                            if (spellToCast.healing > 0) {
                                const newHp = Math.min(currentHp + spellToCast.healing, maxHp);
                                const healAmount = newHp - currentHp;
                                
                                if (healAmount > 0) {
                                    // Phase 3: HP is session data
                                    await playerPersistence.updateSession(userId, { hp: newHp });
                                    logToTerminal(`${spellToCast.name} heals you for ${healAmount} HP!`, 'success');
                                    logToTerminal(`Current HP: ${newHp}/${maxHp}`, 'game');
                                } else {
                                    logToTerminal(`You're already at full health.`, 'game');
                                }
                            }
                            
                            if (spellToCast.damage > 0) {
                                logToTerminal(`The magic backfires! You take ${spellToCast.damage} damage!`, 'error');
                                const newHp = Math.max(0, currentHp - spellToCast.damage);
                                // Phase 3: HP is session data
                                await playerPersistence.updateSession(userId, { hp: newHp });
                                if (newHp <= 0) {
                                    logToTerminal("You have died from the magical backlash!", 'error');
                                }
                            }
                            
                            scrollSuccess = true;
                            break;

                        case 'single-enemy':
                        case 'single-ally':
                            if (!scrollTargetName) {
                                logToTerminal(`You need to specify a target. Try: use ${itemData.name} at <target>`, 'error');
                                return; // Don't consume the item
                            }

                            // Try to find target player
                            const targetPlayerForScroll = Object.entries(gamePlayers).find(([id, player]) => 
                                player.roomId === currentPlayerRoomId && 
                                player.name.toLowerCase() === scrollTargetName.toLowerCase()
                            );

                            if (targetPlayerForScroll) {
                                const [targetPlayerId, targetPlayerData] = targetPlayerForScroll;
                                const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${targetPlayerId}`);

                                if (spellToCast.healing > 0) {
                                    const targetCurrentHp = targetPlayerData.hp || 0;
                                    const targetMaxHp = targetPlayerData.maxHp || 100;
                                    const newTargetHp = Math.min(targetCurrentHp + spellToCast.healing, targetMaxHp);
                                    const healAmount = newTargetHp - targetCurrentHp;

                                    if (healAmount > 0) {
                                        await updateDoc(targetPlayerRef, { hp: newTargetHp });
                                        logToTerminal(`${spellToCast.name} heals ${targetPlayerData.name} for ${healAmount} HP!`, 'success');
                                        
                                        // Notify the healed player
                                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                            senderId: userId,
                                            senderName: playerName,
                                            roomId: currentPlayerRoomId,
                                            text: `${playerName} uses ${itemData.name} on you! You are healed for ${healAmount} HP.`,
                                            recipientId: targetPlayerId,
                                            timestamp: serverTimestamp()
                                        });
                                    } else {
                                        logToTerminal(`${targetPlayerData.name} is already at full health.`, 'game');
                                    }
                                }

                                if (spellToCast.damage > 0) {
                                    const targetCurrentHp = targetPlayerData.hp || 0;
                                    const newTargetHp = Math.max(0, targetCurrentHp - spellToCast.damage);
                                    
                                    await updateDoc(targetPlayerRef, { hp: newTargetHp });
                                    logToTerminal(`${spellToCast.name} hits ${targetPlayerData.name} for ${spellToCast.damage} damage!`, 'combat');
                                    
                                    // Notify the target
                                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                        senderId: userId,
                                        senderName: playerName,
                                        roomId: currentPlayerRoomId,
                                        text: `${playerName} uses ${itemData.name} on you! You take ${spellToCast.damage} damage.`,
                                        recipientId: targetPlayerId,
                                        timestamp: serverTimestamp()
                                    });
                                }

                                scrollSuccess = true;
                            } else {
                                logToTerminal(`You can't find ${scrollTargetName} here.`, 'error');
                                return; // Don't consume the item
                            }
                            break;

                        case 'all-enemies':
                        case 'all-allies':
                            logToTerminal(`${spellToCast.name} affects everyone in the room!`, 'system');
                            
                            const affectedPlayers = Object.entries(gamePlayers).filter(([id, player]) => 
                                player.roomId === currentPlayerRoomId && id !== userId
                            );

                            for (const [targetId, targetData] of affectedPlayers) {
                                const targetRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${targetId}`);
                                
                                if (spellToCast.healing > 0) {
                                    const targetHp = targetData.hp || 0;
                                    const targetMax = targetData.maxHp || 100;
                                    const newHp = Math.min(targetHp + spellToCast.healing, targetMax);
                                    
                                    if (newHp > targetHp) {
                                        // Phase 3: HP is session data
                                        await playerPersistence.updateSession(targetId, { hp: newHp });
                                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                            senderId: userId,
                                            senderName: playerName,
                                            roomId: currentPlayerRoomId,
                                            text: `${playerName} uses ${itemData.name}! You are healed for ${newHp - targetHp} HP.`,
                                            recipientId: targetId,
                                            timestamp: serverTimestamp()
                                        });
                                    }
                                }

                                if (spellToCast.damage > 0) {
                                    const targetHp = targetData.hp || 0;
                                    const newHp = Math.max(0, targetHp - spellToCast.damage);
                                    
                                    // Phase 3: HP is session data
                                    await playerPersistence.updateSession(targetId, { hp: newHp });
                                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                        senderId: userId,
                                        senderName: playerName,
                                        roomId: currentPlayerRoomId,
                                        text: `${playerName} uses ${itemData.name}! You take ${spellToCast.damage} damage.`,
                                        recipientId: targetId,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            }

                            logToTerminal(`${affectedPlayers.length} players affected by ${spellToCast.name}!`, 'success');
                            scrollSuccess = true;
                            break;

                        default:
                            logToTerminal(`The magic activates but has no effect.`, 'game');
                            scrollSuccess = true;
                    }

                    if (scrollSuccess) {
                        // Remove the consumed magical item
                        const consumedInv = playerData.inventory.filter(item => 
                            item.id !== inventoryItem.id || item.name !== inventoryItem.name
                        );
                        // Phase 3: Inventory is permanent data
                        await playerPersistence.syncToMySQL(userId, { inventory: consumedInv });
                        
                        // Show a message based on item type
                        if (itemType === 'scroll') {
                            logToTerminal(`The scroll crumbles to ash.`, 'system');
                        } else if (itemType === 'wand') {
                            logToTerminal(`The wand shatters into pieces.`, 'system');
                        } else {
                            logToTerminal(`${itemData.name} disintegrates after use.`, 'system');
                        }
                    }
                    break;

                default:
                    logToTerminal(`You're not sure how to use ${itemData.name}.`, 'error');
            }
        };

        console.log(`[ExecuteCommand] Action: "${action}", Target: "${target}", CurrentRoom:`, currentPlayerRoomId);
        
        switch(action) {
            case 'logout':
                await signOut(auth);
                break;
            
            case 'screenreader':
                // Toggle screen reader mode
                const currentMode = localStorage.getItem('screenReaderMode') === 'true';
                const newMode = !currentMode;
                localStorage.setItem('screenReaderMode', newMode.toString());
                
                if (newMode) {
                    // Enable screen reader mode
                    const terminalOutput = document.getElementById('terminal-output');
                    terminalOutput.setAttribute('role', 'log');
                    terminalOutput.setAttribute('aria-live', 'polite');
                    terminalOutput.setAttribute('aria-atomic', 'false');
                    terminalOutput.setAttribute('aria-relevant', 'additions');
                    
                    const commandInput = document.getElementById('command-input');
                    commandInput.setAttribute('aria-label', 'Game command input');
                    commandInput.setAttribute('aria-describedby', 'terminal-output');
                    
                    logToTerminal("✓ Screen reader mode ENABLED. New game messages will be announced automatically.", "success");
                    logToTerminal("Combat and urgent messages will interrupt for immediate reading.", "system");
                    logToTerminal("Type 'screenreader' again to disable.", "system");
                } else {
                    // Disable screen reader mode
                    const terminalOutput = document.getElementById('terminal-output');
                    terminalOutput.removeAttribute('role');
                    terminalOutput.removeAttribute('aria-live');
                    terminalOutput.removeAttribute('aria-atomic');
                    terminalOutput.removeAttribute('aria-relevant');
                    
                    const commandInput = document.getElementById('command-input');
                    commandInput.removeAttribute('aria-label');
                    commandInput.removeAttribute('aria-describedby');
                    
                    logToTerminal("✓ Screen reader mode DISABLED.", "system");
                }
                break;
            
            case 'weather':
                // Display current weather and player status
                if (typeof weatherSystem !== 'undefined') {
                    const weather = weatherSystem.getCurrentWeather();
                    const room = gameWorld[currentPlayerRoomId];
                    
                    logToTerminal("--- Weather Report ---", "system");
                    logToTerminal(`Current weather: <span class="text-yellow-400">${weather.type}</span>`, "system");
                    logToTerminal(`${weather.description}`, "game");
                    
                    if (room && room.isIndoor) {
                        logToTerminal(`<span class="text-green-400">You are safely indoors.</span>`, "system");
                    } else {
                        logToTerminal(`<span class="text-cyan-400">You are exposed to the elements.</span>`, "system");
                        
                        // Show protection level
                        const pDoc = await getDoc(playerRef);
                        const pData = pDoc.data();
                        if (pData.inventory && pData.inventory.length > 0) {
                            const hasProtection = pData.inventory.some(itemId => {
                                const item = gameItems[itemId];
                                return item && item.weatherProtection;
                            });
                            
                            if (hasProtection) {
                                logToTerminal(`<span class="text-green-400">You have some weather protection.</span>`, "system");
                            } else {
                                logToTerminal(`<span class="text-red-400">You have no weather protection!</span>`, "system");
                            }
                        }
                        
                        // Show active status effects
                        if (pData.statusEffects) {
                            const effects = Object.keys(pData.statusEffects);
                            if (effects.length > 0) {
                                logToTerminal(`<span class="text-red-400">Active conditions:</span>`, "system");
                                for (const effect of effects) {
                                    const effectData = weatherSystem.STATUS_EFFECTS[effect];
                                    if (effectData) {
                                        logToTerminal(`  ${effectData.icon} ${effectData.description}`, "system");
                                    }
                                }
                            }
                        }
                    }
                } else {
                    logToTerminal("Weather system is not initialized.", "error");
                }
                break;
            
            case 'look': await showRoom(currentPlayerRoomId); break;
            case 'go':
                 console.log(`[Movement] Attempting to go ${target}`);
                 const direction = target.toLowerCase();
                 console.log(`[Movement] Direction: ${direction}, Current room exits:`, currentRoom.exits);
                 if (currentRoom.exits && currentRoom.exits[direction]) {
                    const destinationRoomId = currentRoom.exits[direction];
                    const destinationRoom = gameWorld[destinationRoomId];
                    const playerDoc = await getDoc(playerRef);
                    const playerData = playerDoc.data();
                    
                    // Stop NPC conversations and proactive NPCs in the old room
                    stopNpcConversationsInRoom(currentPlayerRoomId);
                    stopProactiveNpcsInRoom(currentPlayerRoomId);
                    
                    // Check if destination is a guild hall
                    const guildHallGuild = Object.values(gameGuilds).find(g => g.guildHallRoomId === destinationRoomId);
                    
                    if (guildHallGuild) {
                        // Check if player is a member of this guild
                        const playerGuildId = playerData.guildId;
                        
                        if (playerGuildId !== guildHallGuild.id && !playerData.isAdmin) {
                            logToTerminal(`The entrance to ${guildHallGuild.name}'s guild hall is restricted to members only.`, 'error');
                            break;
                        }
                    }
                    
                    // Check weather movement restrictions
                    if (typeof weatherSystem !== 'undefined' && !weatherSystem.canMove(userId)) {
                        const weather = weatherSystem.getCurrentWeather();
                        logToTerminal(`<span class="text-yellow-400">The ${weather.type} weather makes it difficult to move. You struggle against the elements but can't make progress.</span>`, 'game');
                        break;
                    }
                    
                    // Check if exit is locked
                    if (currentRoom.lockedExits && currentRoom.lockedExits[direction]) {
                        const lockInfo = currentRoom.lockedExits[direction];
                        const requiredKey = lockInfo.keyId || lockInfo.key;
                        
                        // Check if player has unlocked this exit before (persistent unlock)
                        const unlockedExits = playerData.unlockedExits || [];
                        const exitKey = `${currentPlayerRoomId}:${direction}`;
                        
                        if (!unlockedExits.includes(exitKey)) {
                            // Exit is still locked - show locked message
                            const lockMessage = lockInfo.lockedMessage || 
                                              lockInfo.message || 
                                              `The way ${direction} is locked. You need ${requiredKey ? 'a key' : 'to unlock it somehow'}.`;
                            logToTerminal(lockMessage, 'error');
                            
                            // Hint about the key if specified
                            if (requiredKey) {
                                const keyItem = gameItems[requiredKey];
                                const keyName = keyItem ? keyItem.name : requiredKey;
                                logToTerminal(`(You need to use ${keyName} to unlock this exit)`, 'system');
                            }
                            break;
                        }
                        // If we get here, the exit was previously unlocked - allow passage
                    }
                    
                    const updates = { roomId: destinationRoomId };
                    
                    // Direction names for messages
                    const directionNames = {
                        'north': 'the north', 'south': 'the south', 'east': 'the east', 'west': 'the west',
                        'up': 'above', 'down': 'below', 'northeast': 'the northeast', 'northwest': 'the northwest',
                        'southeast': 'the southeast', 'southwest': 'the southwest'
                    };
                    
                    const oppositeDirections = {
                        'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east',
                        'up': 'down', 'down': 'up', 'northeast': 'southwest', 'northwest': 'southeast',
                        'southeast': 'northwest', 'southwest': 'northeast'
                    };
                    
                    // Send exit message to current room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: `${playerName} leaves ${directionNames[direction] || direction}.`,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    
                    if (!playerData.visitedRooms || !playerData.visitedRooms.includes(destinationRoomId)) {
                        updates.score = (playerData.score || 0) + 25;
                        updates.visitedRooms = arrayUnion(destinationRoomId);
                        logToTerminal("You discovered a new area! +25 XP", "system");

                        const newLevel = getLevelFromXp(updates.score);
                        if (newLevel > (playerData.level || 1)) {
                            updates.level = newLevel;
                            await checkLevelUp(playerRef, updates.score, playerData.level || 1);
                        }
                    }
                    
                    await updateDoc(playerRef, updates);
                    
                    // Update local current room
                    currentPlayerRoomId = destinationRoomId;
                    
                    // Send entry message to destination room
                    const fromDirection = oppositeDirections[direction] || 'somewhere';
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: destinationRoomId,
                        text: `${playerName} arrives from ${directionNames[fromDirection] || fromDirection}.`,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    
                    // Check quest progress for visiting room
                    const completedQuests = await updateQuestProgress(userId, 'visit', destinationRoomId, 1);
                    for (const completed of completedQuests) {
                        const quest = gameQuests[completed.questId];
                        if (quest) {
                            logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                            logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                        }
                    }
                    
                    // Show the new room
                    await showRoom(destinationRoomId);
                } else { logToTerminal("You can't go that way.", "error"); }
                break;
            
            // Shorthand direction commands
            case 'north':
            case 'n':
                {
                    const moveTarget = 'north';
                    console.log(`[Movement] Attempting to go ${moveTarget}`);
                    const direction = moveTarget.toLowerCase();
                    console.log(`[Movement] Direction: ${direction}, Current room exits:`, currentRoom.exits);
                    if (currentRoom.exits && currentRoom.exits[direction]) {
                        const destinationRoomId = currentRoom.exits[direction];
                        const destinationRoom = gameWorld[destinationRoomId];
                        const playerDoc = await getDoc(playerRef);
                        const playerData = playerDoc.data();
                        
                        stopNpcConversationsInRoom(currentPlayerRoomId);
                        stopProactiveNpcsInRoom(currentPlayerRoomId);
                        
                        const guildHallGuild = Object.values(gameGuilds).find(g => g.guildHallRoomId === destinationRoomId);
                        if (guildHallGuild) {
                            const playerGuildId = playerData.guildId;
                            if (playerGuildId !== guildHallGuild.id && !playerData.isAdmin) {
                                logToTerminal(`The entrance to ${guildHallGuild.name}'s guild hall is restricted to members only.`, 'error');
                                break;
                            }
                        }
                        
                        if (typeof weatherSystem !== 'undefined' && !weatherSystem.canMove(userId)) {
                            const weather = weatherSystem.getCurrentWeather();
                            logToTerminal(`<span class="text-yellow-400">The ${weather.type} weather makes it difficult to move. You struggle against the elements but can't make progress.</span>`, 'game');
                            break;
                        }
                        
                        if (currentRoom.lockedExits && currentRoom.lockedExits[direction]) {
                            const lockInfo = currentRoom.lockedExits[direction];
                            const requiredKey = lockInfo.keyId || lockInfo.key;
                            const unlockedExits = playerData.unlockedExits || [];
                            const exitKey = `${currentPlayerRoomId}:${direction}`;
                            
                            if (!unlockedExits.includes(exitKey)) {
                                const lockMessage = lockInfo.lockedMessage || lockInfo.message || `The way ${direction} is locked. You need ${requiredKey ? 'a key' : 'to unlock it somehow'}.`;
                                logToTerminal(lockMessage, 'error');
                                if (requiredKey) {
                                    const keyItem = gameItems[requiredKey];
                                    const keyName = keyItem ? keyItem.name : requiredKey;
                                    logToTerminal(`(You need to use ${keyName} to unlock this exit)`, 'system');
                                }
                                break;
                            }
                        }
                        
                        const directionNames = {'north': 'the north', 'south': 'the south', 'east': 'the east', 'west': 'the west', 'up': 'above', 'down': 'below', 'northeast': 'the northeast', 'northwest': 'the northwest', 'southeast': 'the southeast', 'southwest': 'the southwest'};
                        const oppositeDirections = {'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east', 'up': 'down', 'down': 'up', 'northeast': 'southwest', 'northwest': 'southeast', 'southeast': 'northwest', 'southwest': 'northeast'};
                        
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {senderId: userId, senderName: playerName, roomId: currentPlayerRoomId, text: `${playerName} leaves ${directionNames[direction] || direction}.`, isEmote: true, timestamp: serverTimestamp()});
                        
                        // Phase 3: Update roomId in session (fast, real-time)
                        await playerPersistence.updateSession(userId, { roomId: destinationRoomId });
                        
                        // Check for new room discovery (permanent data)
                        if (!playerData.visitedRooms || !playerData.visitedRooms.includes(destinationRoomId)) {
                            const newScore = (playerData.score || 0) + 25;
                            const permanentUpdates = {
                                score: newScore,
                                visitedRooms: [...(playerData.visitedRooms || []), destinationRoomId]
                            };
                            
                            logToTerminal("You discovered a new area! +25 XP", "system");
                            
                            const newLevel = getLevelFromXp(newScore);
                            if (newLevel > (playerData.level || 1)) {
                                permanentUpdates.level = newLevel;
                                await checkLevelUp(playerRef, newScore, playerData.level || 1);
                                
                                // Update maxHp/maxMp in session when leveling up
                                const levelConfig = await loadLevelConfig();
                                const classData = gameClasses[playerData.class];
                                const newMaxHp = calculateMaxHp(newLevel, playerData.con || 10, classData);
                                const newMaxMp = calculateMaxMp(newLevel, playerData.int || 10, classData);
                                await playerPersistence.updateSession(userId, { maxHp: newMaxHp, maxMp: newMaxMp });
                            }
                            
                            // Save permanent data to MySQL
                            await playerPersistence.syncToMySQL(userId, permanentUpdates);
                        }
                        
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {senderId: userId, senderName: playerName, roomId: destinationRoomId, text: `${playerName} arrives from ${directionNames[oppositeDirections[direction]] || oppositeDirections[direction] || 'somewhere'}.`, isEmote: true, timestamp: serverTimestamp()});
                        
                        const completedQuests = await updateQuestProgress(userId, 'visit', destinationRoomId, 1);
                        for (const completed of completedQuests) {
                            const quest = gameQuests[completed.questId];
                            if (quest) {
                                logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                            }
                        }
                        
                        await showRoom(destinationRoomId);
                    } else { logToTerminal("You can't go that way.", "error"); }
                }
                break;
            
            case 'south':
            case 's':
            case 'east':
            case 'e':
            case 'west':
            case 'w':
            case 'northeast':
            case 'ne':
            case 'northwest':
            case 'nw':
            case 'southeast':
            case 'se':
            case 'southwest':
            case 'sw':
            case 'up':
            case 'u':
            case 'down':
            case 'd':
                {
                    // Map shorthand to full direction name
                    const directionMap = {'s': 'south', 'e': 'east', 'w': 'west', 'ne': 'northeast', 'nw': 'northwest', 'se': 'southeast', 'sw': 'southwest', 'u': 'up', 'd': 'down'};
                    const moveTarget = directionMap[action] || action; // Use mapping or keep original if it's already full name
                    
                    console.log(`[Movement] Attempting to go ${moveTarget}`);
                    const direction = moveTarget.toLowerCase();
                    console.log(`[Movement] Direction: ${direction}, Current room exits:`, currentRoom.exits);
                    if (currentRoom.exits && currentRoom.exits[direction]) {
                        const destinationRoomId = currentRoom.exits[direction];
                        const destinationRoom = gameWorld[destinationRoomId];
                        const playerDoc = await getDoc(playerRef);
                        const playerData = playerDoc.data();
                        
                        stopNpcConversationsInRoom(currentPlayerRoomId);
                        stopProactiveNpcsInRoom(currentPlayerRoomId);
                        
                        const guildHallGuild = Object.values(gameGuilds).find(g => g.guildHallRoomId === destinationRoomId);
                        if (guildHallGuild) {
                            const playerGuildId = playerData.guildId;
                            if (playerGuildId !== guildHallGuild.id && !playerData.isAdmin) {
                                logToTerminal(`The entrance to ${guildHallGuild.name}'s guild hall is restricted to members only.`, 'error');
                                break;
                            }
                        }
                        
                        if (typeof weatherSystem !== 'undefined' && !weatherSystem.canMove(userId)) {
                            const weather = weatherSystem.getCurrentWeather();
                            logToTerminal(`<span class="text-yellow-400">The ${weather.type} weather makes it difficult to move. You struggle against the elements but can't make progress.</span>`, 'game');
                            break;
                        }
                        
                        if (currentRoom.lockedExits && currentRoom.lockedExits[direction]) {
                            const lockInfo = currentRoom.lockedExits[direction];
                            const requiredKey = lockInfo.keyId || lockInfo.key;
                            const unlockedExits = playerData.unlockedExits || [];
                            const exitKey = `${currentPlayerRoomId}:${direction}`;
                            
                            if (!unlockedExits.includes(exitKey)) {
                                const lockMessage = lockInfo.lockedMessage || lockInfo.message || `The way ${direction} is locked. You need ${requiredKey ? 'a key' : 'to unlock it somehow'}.`;
                                logToTerminal(lockMessage, 'error');
                                if (requiredKey) {
                                    const keyItem = gameItems[requiredKey];
                                    const keyName = keyItem ? keyItem.name : requiredKey;
                                    logToTerminal(`(You need to use ${keyName} to unlock this exit)`, 'system');
                                }
                                break;
                            }
                        }
                        
                        const directionNames = {'north': 'the north', 'south': 'the south', 'east': 'the east', 'west': 'the west', 'up': 'above', 'down': 'below', 'northeast': 'the northeast', 'northwest': 'the northwest', 'southeast': 'the southeast', 'southwest': 'the southwest'};
                        const oppositeDirections = {'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east', 'up': 'down', 'down': 'up', 'northeast': 'southwest', 'northwest': 'southeast', 'southeast': 'northwest', 'southwest': 'northeast'};
                        
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {senderId: userId, senderName: playerName, roomId: currentPlayerRoomId, text: `${playerName} leaves ${directionNames[direction] || direction}.`, isEmote: true, timestamp: serverTimestamp()});
                        
                        // Phase 3: Update roomId in session (fast, real-time)
                        await playerPersistence.updateSession(userId, { roomId: destinationRoomId });
                        
                        // Check for new room discovery (permanent data)
                        if (!playerData.visitedRooms || !playerData.visitedRooms.includes(destinationRoomId)) {
                            const newScore = (playerData.score || 0) + 25;
                            const permanentUpdates = {
                                score: newScore,
                                visitedRooms: [...(playerData.visitedRooms || []), destinationRoomId]
                            };
                            
                            logToTerminal("You discovered a new area! +25 XP", "system");
                            
                            const newLevel = getLevelFromXp(newScore);
                            if (newLevel > (playerData.level || 1)) {
                                permanentUpdates.level = newLevel;
                                await checkLevelUp(playerRef, newScore, playerData.level || 1);
                                
                                // Update maxHp/maxMp in session when leveling up
                                const levelConfig = await loadLevelConfig();
                                const classData = gameClasses[playerData.class];
                                const newMaxHp = calculateMaxHp(newLevel, playerData.con || 10, classData);
                                const newMaxMp = calculateMaxMp(newLevel, playerData.int || 10, classData);
                                await playerPersistence.updateSession(userId, { maxHp: newMaxHp, maxMp: newMaxMp });
                            }
                            
                            // Save permanent data to MySQL
                            await playerPersistence.syncToMySQL(userId, permanentUpdates);
                        }
                        
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {senderId: userId, senderName: playerName, roomId: destinationRoomId, text: `${playerName} arrives from ${directionNames[oppositeDirections[direction]] || oppositeDirections[direction] || 'somewhere'}.`, isEmote: true, timestamp: serverTimestamp()});
                        
                        const completedQuests = await updateQuestProgress(userId, 'visit', destinationRoomId, 1);
                        for (const completed of completedQuests) {
                            const quest = gameQuests[completed.questId];
                            if (quest) {
                                logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                            }
                        }
                        
                        await showRoom(destinationRoomId);
                    } else { logToTerminal("You can't go that way.", "error"); }
                }
                break;
            
            case 'get':
                const roomItemIds = currentRoom.items || [];
                const itemEntryToGet = roomItemIds.find(itemEntry => {
                    // Support both old format (string) and new format ({id, quantity})
                    const itemId = typeof itemEntry === 'string' ? itemEntry : itemEntry.id;
                    const item = gameItems[itemId];
                    if (!item) return false;
                    
                    // Check ID match
                    if (itemId.toLowerCase() === target) return true;
                    
                    // Check name match
                    if (item.name.toLowerCase().includes(target)) return true;
                    
                    // Check aliases
                    if (item.aliases && Array.isArray(item.aliases)) {
                        return item.aliases.some(alias => alias.toLowerCase().includes(target));
                    }
                    
                    return false;
                });
                
                if (itemEntryToGet) {
                    // Handle both formats
                    const itemIdToGet = typeof itemEntryToGet === 'string' ? itemEntryToGet : itemEntryToGet.id;
                    const itemQuantityInRoom = typeof itemEntryToGet === 'string' ? 1 : (itemEntryToGet.quantity || 1);
                    
                    const item = gameItems[itemIdToGet];
                    if (item.movable === false) {
                        logToTerminal("You can't take that.", "error"); 
                        break;
                    }
                    
                    // Check weight limit
                    const playerDocGet = await getDoc(playerRef);
                    const playerGetData = playerDocGet.data();
                    if (!canCarryItem(playerGetData, itemIdToGet, 1)) {
                        const currentWeight = calculateInventoryWeight(playerGetData.inventory || []);
                        const maxWeight = calculateMaxCarryWeight(playerGetData);
                        const itemWeight = item.weight || 0;
                        logToTerminal(`You can't carry that! (Current: ${currentWeight.toFixed(1)}/${maxWeight} lbs, item weighs ${itemWeight} lbs)`, "error");
                        logToTerminal(`Try dropping some items first, or store items in a container.`, "hint");
                        break;
                    }
                    
                    const fullItemObject = { id: itemIdToGet, ...item };
                    // Use manual array update instead of arrayUnion to allow duplicate items
                    const currentInventory = playerGetData.inventory || [];
                    const newInventory = [...currentInventory, fullItemObject];
                    
                    // Phase 3: Inventory is permanent data - save to both MySQL and Firebase
                    await playerPersistence.syncToMySQL(userId, { inventory: newInventory });
                    await updateDoc(playerRef, { inventory: newInventory });
                    
                    // Update room: decrease quantity or remove item
                    if (itemQuantityInRoom > 1) {
                        // Decrease quantity
                        const updatedItems = roomItemIds.map(entry => {
                            if (typeof entry === 'object' && entry.id === itemIdToGet) {
                                return { ...entry, quantity: entry.quantity - 1 };
                            }
                            return entry;
                        });
                        await updateDoc(roomRef, { items: updatedItems });
                    } else {
                        // Remove item completely (works for both formats)
                        await updateDoc(roomRef, { items: arrayRemove(itemEntryToGet) });
                    }
                    
                    logToTerminal(`You take ${addArticle(item.name)}.`, 'game');
                    
                    // Refresh room display to show updated item quantities
                    await showRoom(currentPlayerRoomId);
                    
                    // Check quest progress for item collection
                    console.log(`[GET] Calling updateQuestProgress for collect ${itemIdToGet}`);
                    const completedQuests = await updateQuestProgress(userId, 'collect', itemIdToGet, 1);
                    console.log(`[GET] Quest update returned:`, completedQuests);
                    for (const completed of completedQuests) {
                        const quest = gameQuests[completed.questId];
                        if (quest) {
                            logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                            logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                        }
                    }
                    
                    // Log to news if item is newsworthy
                    if (item.newsworthy) {
                        await logNews('found', playerName, `found the ${item.name}!`);
                    }
                } else { logToTerminal("You don't see that here.", 'error'); }
                break;
            case 'drop':
                const playerDocDrop = await getDoc(playerRef);
                const inventoryDrop = playerDocDrop.data().inventory || [];
                const itemToDrop = inventoryDrop.find(i => 
                    i && i.id && i.name && (i.id.toLowerCase() === target || i.name.toLowerCase().includes(target))
                );

                if (itemToDrop) {
                    // Phase 3: Inventory is permanent data - save to both MySQL and Firebase
                    const newInventory = inventoryDrop.filter(i => i !== itemToDrop);
                    await playerPersistence.syncToMySQL(userId, { inventory: newInventory });
                    await updateDoc(playerRef, { inventory: newInventory });
                    
                    // Add to room using new format with quantity
                    const currentRoomItems = currentRoom.items || [];
                    const existingItemEntry = currentRoomItems.find(entry => {
                        const entryId = typeof entry === 'string' ? entry : entry.id;
                        return entryId === itemToDrop.id;
                    });
                    
                    if (existingItemEntry && typeof existingItemEntry === 'object') {
                        // Item already exists in room with quantity, increase it
                        const updatedItems = currentRoomItems.map(entry => {
                            if (typeof entry === 'object' && entry.id === itemToDrop.id) {
                                return { ...entry, quantity: (entry.quantity || 1) + 1 };
                            }
                            return entry;
                        });
                        await updateDoc(roomRef, { items: updatedItems });
                    } else {
                        // Add new item entry with quantity 1
                        await updateDoc(roomRef, { items: arrayUnion({ id: itemToDrop.id, quantity: 1 }) });
                    }
                    
                    logToTerminal(`You drop ${addArticle(itemToDrop.name)}.`, 'game');
                } else { logToTerminal("You aren't carrying that.", 'error'); }
                break;
            
            case 'equip':
            case 'wear':
            case 'wield':
                if (!target) {
                    logToTerminal("What do you want to equip?", 'error');
                    break;
                }
                
                const playerDocEquip = await getDoc(playerRef);
                const playerDataEquip = playerDocEquip.data();
                const inventoryEquip = playerDataEquip.inventory || [];
                
                // Find item in inventory
                const itemToEquip = inventoryEquip.find(i => 
                    i && i.id && i.name && 
                    (i.id.toLowerCase() === target || i.name.toLowerCase().includes(target))
                );
                
                if (!itemToEquip) {
                    logToTerminal("You aren't carrying that item.", 'error');
                    break;
                }
                
                const itemDataEquip = gameItems[itemToEquip.id];
                if (!itemDataEquip) {
                    logToTerminal("Item data not found.", 'error');
                    break;
                }
                
                // Determine equipment type and slot
                let equipSlot = null;
                let equipField = null;
                const updates = {};
                
                // Weapon
                if (itemDataEquip.isWeapon || itemDataEquip.itemType === 'weapon') {
                    equipSlot = 'weapon';
                    equipField = 'equippedWeapon';
                    
                    // Unequip current weapon if any
                    if (playerDataEquip.equippedWeapon) {
                        const oldWeapon = inventoryEquip.find(i => i.id === playerDataEquip.equippedWeapon);
                        if (oldWeapon && oldWeapon.equipped) {
                            oldWeapon.equipped = false;
                        }
                    }
                    
                    updates.equippedWeapon = itemToEquip.id;
                }
                // Shield
                else if (itemDataEquip.type === 'shield' || itemDataEquip.itemType === 'shield') {
                    equipSlot = 'shield';
                    equipField = 'equippedShield';
                    
                    // Unequip current shield if any
                    if (playerDataEquip.equippedShield) {
                        const oldShield = inventoryEquip.find(i => i.id === playerDataEquip.equippedShield);
                        if (oldShield && oldShield.equipped) {
                            oldShield.equipped = false;
                        }
                    }
                    
                    updates.equippedShield = itemToEquip.id;
                }
                // Armor
                else if (itemDataEquip.type === 'armor' || itemDataEquip.itemType === 'armor') {
                    equipSlot = 'armor';
                    equipField = 'equippedArmor';
                    
                    // Unequip current armor if any
                    if (playerDataEquip.equippedArmor) {
                        const oldArmor = inventoryEquip.find(i => i.id === playerDataEquip.equippedArmor);
                        if (oldArmor && oldArmor.equipped) {
                            oldArmor.equipped = false;
                        }
                    }
                    
                    updates.equippedArmor = itemToEquip.id;
                }
                // Clothing and other wearables
                else if (itemDataEquip.itemType === 'clothing' || itemDataEquip.itemType === 'container') {
                    equipSlot = itemDataEquip.specialData?.slot || 'accessory';
                    
                    // For containers, just mark as equipped (for capacity bonus)
                    if (itemDataEquip.itemType === 'container') {
                        equipSlot = 'container';
                    }
                }
                else {
                    logToTerminal("That item cannot be equipped.", 'error');
                    break;
                }
                
                // Mark item as equipped
                itemToEquip.equipped = true;
                
                // Update inventory with modified items
                const updatedInventoryEquip = inventoryEquip.map(i => {
                    if (i.id === itemToEquip.id && i.name === itemToEquip.name) {
                        return itemToEquip;
                    }
                    return i;
                });
                
                updates.inventory = updatedInventoryEquip;
                
                // Phase 3: Equipment and inventory are permanent data
                await playerPersistence.syncToMySQL(userId, updates);
                
                // Show success message with stats if applicable
                let message = `You equip ${addArticle(itemDataEquip.name)}.`;
                
                if (itemDataEquip.weaponDamage) {
                    message += ` (+${itemDataEquip.weaponDamage} damage)`;
                }
                if (itemDataEquip.damageReduction) {
                    message += ` (+${itemDataEquip.damageReduction} armor)`;
                }
                if (itemDataEquip.specialData?.capacityBonus) {
                    message += ` (+${itemDataEquip.specialData.capacityBonus} lbs carrying capacity)`;
                }
                
                logToTerminal(message, 'success');
                break;
            
            case 'unequip':
            case 'remove':
                if (!target) {
                    logToTerminal("What do you want to unequip?", 'error');
                    break;
                }
                
                const playerDocUnequip = await getDoc(playerRef);
                const playerDataUnequip = playerDocUnequip.data();
                const inventoryUnequip = playerDataUnequip.inventory || [];
                
                // Find equipped item
                const itemToUnequip = inventoryUnequip.find(i => 
                    i && i.id && i.name && i.equipped &&
                    (i.id.toLowerCase() === target || i.name.toLowerCase().includes(target))
                );
                
                if (!itemToUnequip) {
                    logToTerminal("You don't have that item equipped.", 'error');
                    break;
                }
                
                const itemDataUnequip = gameItems[itemToUnequip.id];
                const updatesUnequip = {};
                
                // Unmark as equipped
                itemToUnequip.equipped = false;
                
                // Clear equipment slot references
                if (itemDataUnequip?.isWeapon || itemDataUnequip?.itemType === 'weapon') {
                    if (playerDataUnequip.equippedWeapon === itemToUnequip.id) {
                        updatesUnequip.equippedWeapon = null;
                    }
                }
                else if (itemDataUnequip?.type === 'shield' || itemDataUnequip?.itemType === 'shield') {
                    if (playerDataUnequip.equippedShield === itemToUnequip.id) {
                        updatesUnequip.equippedShield = null;
                    }
                }
                else if (itemDataUnequip?.type === 'armor' || itemDataUnequip?.itemType === 'armor') {
                    if (playerDataUnequip.equippedArmor === itemToUnequip.id) {
                        updatesUnequip.equippedArmor = null;
                    }
                }
                
                // Update inventory
                const updatedInventoryUnequip = inventoryUnequip.map(i => {
                    if (i.id === itemToUnequip.id && i.name === itemToUnequip.name) {
                        return itemToUnequip;
                    }
                    return i;
                });
                
                updatesUnequip.inventory = updatedInventoryUnequip;
                
                // Phase 3: Equipment and inventory are permanent data
                await playerPersistence.syncToMySQL(userId, updatesUnequip);
                logToTerminal(`You unequip ${addArticle(itemDataUnequip?.name || itemToUnequip.name)}.`, 'game');
                break;
            
            case 'equipment':
            case 'equipped':
                const playerDocEq = await getDoc(playerRef);
                const playerDataEq = playerDocEq.data();
                const inventoryEq = playerDataEq.inventory || [];
                
                logToTerminal("=== Equipped Items ===", 'system');
                
                let hasEquipped = false;
                
                // Show weapon
                if (playerDataEq.equippedWeapon) {
                    const weapon = inventoryEq.find(i => i.id === playerDataEq.equippedWeapon);
                    if (weapon) {
                        const weaponData = gameItems[weapon.id];
                        const dmg = weaponData?.weaponDamage || 0;
                        logToTerminal(`Weapon: ${weapon.name} (+${dmg} damage)`, 'game');
                        hasEquipped = true;
                    }
                }
                
                // Show shield
                if (playerDataEq.equippedShield) {
                    const shield = inventoryEq.find(i => i.id === playerDataEq.equippedShield);
                    if (shield) {
                        logToTerminal(`Shield: ${shield.name}`, 'game');
                        hasEquipped = true;
                    }
                }
                
                // Show armor
                if (playerDataEq.equippedArmor) {
                    const armor = inventoryEq.find(i => i.id === playerDataEq.equippedArmor);
                    if (armor) {
                        const armorData = gameItems[armor.id];
                        const reduction = armorData?.damageReduction || 0;
                        logToTerminal(`Armor: ${armor.name} (+${reduction} protection)`, 'game');
                        hasEquipped = true;
                    }
                }
                
                // Show other equipped items (containers, clothing, etc)
                const otherEquipped = inventoryEq.filter(i => 
                    i.equipped && 
                    i.id !== playerDataEq.equippedWeapon && 
                    i.id !== playerDataEq.equippedShield && 
                    i.id !== playerDataEq.equippedArmor
                );
                
                if (otherEquipped.length > 0) {
                    otherEquipped.forEach(item => {
                        const itemData = gameItems[item.id];
                        let info = '';
                        if (itemData?.specialData?.capacityBonus) {
                            info = ` (+${itemData.specialData.capacityBonus} lbs capacity)`;
                        }
                        logToTerminal(`${itemData?.itemType || 'Item'}: ${item.name}${info}`, 'game');
                    });
                    hasEquipped = true;
                }
                
                if (!hasEquipped) {
                    logToTerminal("You have nothing equipped.", 'system');
                } else {
                    // Show total bonuses
                    const totalDamage = playerDataEq.equippedWeapon ? 
                        (gameItems[playerDataEq.equippedWeapon]?.weaponDamage || 0) : 0;
                    const totalArmor = playerDataEq.equippedArmor ? 
                        (gameItems[playerDataEq.equippedArmor]?.damageReduction || 0) : 0;
                    
                    if (totalDamage > 0 || totalArmor > 0) {
                        logToTerminal(`\nTotal Bonuses: +${totalDamage} damage, +${totalArmor} armor`, 'info');
                    }
                }
                break;
            
            case 'say':
                // Check if player is muted
                const currentPlayerData = gamePlayers[userId];
                if (currentPlayerData?.muted) {
                    const mutedUntil = currentPlayerData.mutedUntil || 0;
                    if (mutedUntil > Date.now()) {
                        const minutesLeft = Math.ceil((mutedUntil - Date.now()) / 60000);
                        logToTerminal(`You are muted for ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''}.`, "error");
                        break;
                    } else {
                        // Mute expired, remove it
                        await updateDoc(playerRef, { muted: false, mutedUntil: null });
                    }
                }
                
                // Check if we're in an AI NPC conversation - if so, treat as reply instead
                if (lastNpcInteraction) {
                    const lastNpc = gameNpcs[lastNpcInteraction];
                    if (lastNpc && lastNpc.useAI) {
                        // Treat as conversation reply to AI NPC
                        const npcData = { id: lastNpcInteraction, ...lastNpc };
                        await handleAiNpcInteraction(npcData, 'reply', currentRoom, cmdText);
                        break;
                    }
                }
                
                // Otherwise, it's a regular say command (chat with other players)
                 if (cmdText) {
                     const speech = cmdText.substring(cmdText.indexOf(' ')).trim();
                     if (speech) {
                         logToTerminal(`You say, "${speech}"`, 'chat');
                         await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), { senderId: userId, senderName: playerName, roomId: currentPlayerRoomId, text: speech, timestamp: serverTimestamp() });
                         
                         // Check if there are any AI NPCs in the room that might respond
                         const room = gameWorld[currentPlayerRoomId];
                         if (room && room.npcs && room.npcs.length > 0) {
                             // Find AI NPCs in the room
                             const aiNpcsInRoom = room.npcs
                                 .map(npcId => ({ id: npcId, ...gameNpcs[npcId] }))
                                 .filter(npc => {
                                     if (!npc.dialogue) return false;
                                     // AI NPCs have a personality prompt (string or single-element array)
                                     if (typeof npc.dialogue === 'string' && npc.dialogue.length > 20) return true;
                                     if (Array.isArray(npc.dialogue) && npc.dialogue.length === 1 && npc.dialogue[0].length > 20) return true;
                                     return false;
                                 });
                             
                             // Have a random AI NPC respond (30% chance if there are AI NPCs)
                             if (aiNpcsInRoom.length > 0 && Math.random() < 0.3) {
                                 const respondingNpc = aiNpcsInRoom[Math.floor(Math.random() * aiNpcsInRoom.length)];
                                 
                                 // Generate a response from the NPC
                                 setTimeout(async () => {
                                     const npcResponse = await generateNpcRoomChatResponse(respondingNpc, playerName, speech);
                                     if (npcResponse) {
                                         await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                             roomId: currentPlayerRoomId,
                                             userId: `npc-${respondingNpc.id}`,
                                             username: respondingNpc.shortName || respondingNpc.name,
                                             text: npcResponse,
                                             timestamp: serverTimestamp(),
                                             isNpcResponse: true
                                         });
                                     }
                                 }, 1000 + Math.random() * 2000); // Wait 1-3 seconds before responding
                             }
                         }
                     } else {
                         logToTerminal("Say what?", "error");
                     }
                } else { logToTerminal("Say what?", "error"); }
                break;
            
            case 'whisper':
            case 'tell': {
                // Parse: whisper PlayerName message
                const whisperMatch = cmdText.match(/^(?:whisper|tell)\s+(\w+)\s+(.+)$/i);
                if (!whisperMatch) {
                    logToTerminal("Usage: whisper <player> <message>", "error");
                    break;
                }
                
                const targetPlayerName = whisperMatch[1];
                const message = whisperMatch[2];
                
                // Check if sender is muted
                const senderData = gamePlayers[userId];
                if (senderData?.muted) {
                    const mutedUntil = senderData.mutedUntil || 0;
                    if (mutedUntil > Date.now()) {
                        const minutesLeft = Math.ceil((mutedUntil - Date.now()) / 60000);
                        logToTerminal(`You are muted for ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''}.`, "error");
                        break;
                    } else {
                        // Mute expired, remove it
                        await updateDoc(playerRef, { muted: false, mutedUntil: null });
                    }
                }
                
                // Find the target player in the same room
                const targetPlayer = Object.entries(gamePlayers).find(([id, p]) => 
                    p.name.toLowerCase() === targetPlayerName.toLowerCase() && 
                    p.roomId === currentPlayerRoomId
                );
                
                if (!targetPlayer) {
                    logToTerminal(`${targetPlayerName} is not here.`, "error");
                    break;
                }
                
                const [targetPlayerId, targetPlayerData] = targetPlayer;
                
                // Can't whisper to yourself
                if (targetPlayerId === userId) {
                    logToTerminal("You can't whisper to yourself.", "error");
                    break;
                }
                
                // Send the whisper message
                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                    senderId: userId,
                    senderName: playerName,
                    recipientId: targetPlayerId,
                    recipientName: targetPlayerData.name,
                    roomId: currentPlayerRoomId,
                    text: message,
                    timestamp: serverTimestamp(),
                    isWhisper: true
                });
                
                // Show confirmation to sender
                logToTerminal(`You whisper to <span class="text-cyan-300">${targetPlayerData.name}</span>: "${message}"`, 'chat');
                break;
            }
            
            case 'epitaph':
                // Set gravestone epitaph (for players level 10+)
                const pDocEpitaph = await getDoc(playerRef);
                const pDataEpitaph = pDocEpitaph.data();
                const currentLevel = pDataEpitaph.level || 1;
                
                if (currentLevel < 10) {
                    logToTerminal("You must be at least level 10 to set an epitaph.", 'error');
                    break;
                }
                
                if (!target) {
                    // Show current epitaph
                    const currentEpitaph = pDataEpitaph.epitaph || null;
                    if (currentEpitaph) {
                        logToTerminal("Your current epitaph:", 'system');
                        logToTerminal(`"${currentEpitaph}"`, 'game');
                    } else {
                        logToTerminal("You haven't set an epitaph yet.", 'system');
                        logToTerminal("Usage: epitaph <your epitaph text>", 'system');
                        logToTerminal("Example: epitaph Here lies a brave warrior who faced death with honor", 'system');
                    }
                    break;
                }
                
                // Set new epitaph
                const newEpitaph = cmdText.substring(cmdText.indexOf(' ')).trim();
                if (newEpitaph.length > 200) {
                    logToTerminal("Epitaph too long! Maximum 200 characters.", 'error');
                    break;
                }
                
                await updateDoc(playerRef, { epitaph: newEpitaph });
                logToTerminal("Your epitaph has been set:", 'success');
                logToTerminal(`"${newEpitaph}"`, 'game');
                logToTerminal("This will appear on your gravestone if you die.", 'system');
                break;
            
            case 'respawn':
                if (!pendingDeathChoice) {
                    logToTerminal("You're not dead yet!", 'error');
                    break;
                }
                await handleRespawn();
                break;
            
            case 'permadeath':
                if (!pendingDeathChoice) {
                    logToTerminal("You're not dead yet!", 'error');
                    break;
                }
                
                // Confirm the choice
                logToTerminal("Are you sure? This will PERMANENTLY DELETE your character!", 'error');
                logToTerminal("Type 'permadeath confirm' to proceed, or 'respawn' to choose respawn instead.", 'system');
                
                if (cmdText.toLowerCase().includes('confirm')) {
                    await handlePermadeath();
                }
                break;
            
            case 'inventory':
                const pDocInv = await getDoc(playerRef);
                const playerDataInv = pDocInv.data();
                const inv = playerDataInv.inventory || [];
                
                if (inv.length > 0) {
                    logToTerminal("You are carrying:", 'system');
                    
                    // Show each item with weight
                    inv.forEach(item => {
                        const itemData = gameItems[item.id];
                        const weight = itemData?.weight || 0;
                        const equipped = item.equipped ? ' (equipped)' : '';
                        
                        // Show container contents count if applicable
                        if (itemData?.itemType === 'container' && item.contents && item.contents.length > 0) {
                            logToTerminal(`- ${item.name}${equipped} [${weight} lbs] (contains ${item.contents.length} item${item.contents.length !== 1 ? 's' : ''})`, 'game');
                        } else {
                            logToTerminal(`- ${item.name}${equipped} [${weight} lbs]`, 'game');
                        }
                    });
                    
                    // Show total weight and capacity
                    const currentWeight = calculateInventoryWeight(inv);
                    const maxWeight = calculateMaxCarryWeight(playerDataInv);
                    const percentUsed = (currentWeight / maxWeight * 100).toFixed(0);
                    
                    logToTerminal(`\nCarrying: ${currentWeight.toFixed(1)}/${maxWeight} lbs (${percentUsed}%)`, 'info');
                    
                    if (percentUsed >= 90) {
                        logToTerminal(`⚠️ You're heavily encumbered! Consider dropping items or storing them in a container.`, 'warning');
                    } else if (percentUsed >= 75) {
                        logToTerminal(`You're carrying a heavy load.`, 'hint');
                    }
                    
                } else { 
                    logToTerminal("You are not carrying anything.", 'system');
                    const maxWeight = calculateMaxCarryWeight(playerDataInv);
                    logToTerminal(`Carrying capacity: 0/${maxWeight} lbs`, 'info');
                }
                break;
            case 'examine':
                // Special case: leaderboard frame
                if (target && (target.toLowerCase() === 'frame' || target.toLowerCase() === 'leaderboard' || target.toLowerCase() === 'board')) {
                    await displayLeaderboard();
                    break;
                }
                
                // Check if examining another player
                const targetPlayer = Object.values(gamePlayers).find(p => 
                    p.roomId === currentPlayerRoomId && 
                    p.name !== playerName && 
                    p.name.toLowerCase() === target.toLowerCase()
                );
                
                if (targetPlayer) {
                    // Show player information (without sensitive stats)
                    logToTerminal(`=== ${targetPlayer.name} ===`, 'system');
                    logToTerminal(`Level ${targetPlayer.level || 1} ${targetPlayer.class || 'Adventurer'}`, 'game');
                    
                    // Show guild if in one
                    if (targetPlayer.guildId && gameGuilds[targetPlayer.guildId]) {
                        const playerGuild = gameGuilds[targetPlayer.guildId];
                        const guildRank = playerGuild.members[Object.keys(gamePlayers).find(id => gamePlayers[id].name === targetPlayer.name)]?.rank || 'member';
                        logToTerminal(`Guild: ${playerGuild.name} (${guildRank})`, 'game');
                    }
                    
                    // Show HP status
                    const hpPercent = ((targetPlayer.hp || 0) / (targetPlayer.maxHp || 100)) * 100;
                    let healthStatus = 'Healthy';
                    if (hpPercent < 25) healthStatus = 'Critically wounded';
                    else if (hpPercent < 50) healthStatus = 'Badly hurt';
                    else if (hpPercent < 75) healthStatus = 'Slightly injured';
                    logToTerminal(`Health: ${healthStatus}`, 'game');
                    
                    // Show equipped weapon if any
                    if (targetPlayer.equippedWeapon) {
                        const weapon = gameItems[targetPlayer.equippedWeapon];
                        if (weapon) {
                            logToTerminal(`Wielding: ${weapon.name}`, 'game');
                        }
                    }
                    
                    // Show title or achievement if any
                    if (targetPlayer.title) {
                        logToTerminal(`Title: ${targetPlayer.title}`, 'game');
                    }
                    
                    break;
                }
                
                const npcToExamine = findNpcInRoom(target);
                if (npcToExamine) {
                    logToTerminal(npcToExamine.description, 'game');
                    if (npcToExamine.sells && npcToExamine.sells.length > 0) {
                        logToTerminal(`${npcToExamine.shortName || npcToExamine.name} is selling:`, 'system');
                        npcToExamine.sells.forEach(itemId => {
                            const item = gameItems[itemId];
                            if(item) {
                                logToTerminal(`- ${item.name} (${item.cost} gold)`, 'game');
                            }
                        });
                    }
                } else {
                    // Check if examining an item in the room or inventory
                    const itemInRoom = currentRoom.items?.find(itemId => {
                        const item = gameItems[itemId];
                        return item && (item.name.toLowerCase() === target.toLowerCase() || 
                                      item.aliases?.some(alias => alias.toLowerCase() === target.toLowerCase()));
                    });
                    
                    if (itemInRoom) {
                        const item = gameItems[itemInRoom];
                        if (item.description) {
                            logToTerminal(item.description, 'game');
                        } else {
                            logToTerminal(`It's ${item.name}.`, 'game');
                        }
                        break;
                    }
                    
                    // Check inventory
                    const pDocExamine = await getDoc(playerRef);
                    const playerInv = pDocExamine.data().inventory || [];
                    const itemInInventory = playerInv.find(invItem => 
                        invItem.name.toLowerCase() === target.toLowerCase() || 
                        invItem.aliases?.some(alias => alias.toLowerCase() === target.toLowerCase())
                    );
                    
                    if (itemInInventory) {
                        if (itemInInventory.description) {
                            logToTerminal(itemInInventory.description, 'game');
                        } else {
                            logToTerminal(`It's ${itemInInventory.name}.`, 'game');
                        }
                        break;
                    }
                    
                    // Check room details
                    if (currentRoom.details && currentRoom.details[target]) {
                        logToTerminal(currentRoom.details[target], 'game');
                    } else { 
                        logToTerminal("You see nothing special about that.", 'game'); 
                    }
                }
                break;
            case 'buy':
                // ENHANCED: Now supports haggling and reputation system
                const vendor = findNpcInRoom(npc_target);
                if (!vendor) { 
                    logToTerminal("There's no one here by that name to buy from.", "error"); 
                    break; 
                }
                
                const itemToBuy = findItemByName(target);
                if (!itemToBuy) {
                    logToTerminal(`Item "${target}" not found.`, "error"); 
                    break;
                }
                
                // Use trading module for advanced purchase
                const { acceptHagglePrice, buyFromNPC } = await import('./trading.js?v=056');
                await acceptHagglePrice(auth.currentUser.uid, vendor, itemToBuy);
                break;
            
            case 'sell':
                // NEW: Sell items to NPCs
                const buyer = findNpcInRoom(npc_target);
                if (!buyer) {
                    logToTerminal("There's no one here by that name to sell to.", "error");
                    break;
                }
                
                // Get player's current inventory
                const playerDocSell = await getDoc(playerRef);
                const sellInv = playerDocSell.data().inventory || [];
                
                // Find the item in inventory by name/alias
                const itemToSell = sellInv.find(invItem => {
                    const item = gameItems[invItem.id];
                    if (!item) return false;
                    const lowerTarget = target.toLowerCase();
                    if (item.name.toLowerCase().includes(lowerTarget)) return true;
                    if (item.aliases && item.aliases.some(alias => alias.toLowerCase().includes(lowerTarget))) return true;
                    return false;
                });
                
                if (!itemToSell) {
                    logToTerminal(`You don't have ${target}.`, "error");
                    break;
                }
                
                const { sellToNPC } = await import('./trading.js?v=056');
                await sellToNPC(auth.currentUser.uid, buyer, itemToSell, playerDocSell.data());
                break;
            
            case 'give':
                // Give items or money to NPCs or players
                if (!target) {
                    logToTerminal("Usage: give <amount> gold to <name> OR give <item> to <name>", "error");
                    break;
                }
                
                // Check if giving money (e.g., "give 10 gold to barman" or "give 10 gold to Player")
                const moneyMatch = cmdText.match(/give\s+(\d+)\s+(?:gold|coins?)\s+to\s+(.+)/i);
                if (moneyMatch) {
                    const amount = parseInt(moneyMatch[1]);
                    const recipientName = moneyMatch[2].trim();
                    
                    // Try to find player first
                    const recipientPlayer = Object.entries(gamePlayers).find(([id, p]) => 
                        p.name.toLowerCase() === recipientName.toLowerCase() && 
                        p.roomId === currentPlayerRoomId &&
                        id !== userId
                    );
                    
                    if (recipientPlayer) {
                        const [recipientId, recipientData] = recipientPlayer;
                        
                        // Check if giver has enough money
                        const playerDocGive = await getDoc(playerRef);
                        const playerDataGive = playerDocGive.data();
                        
                        if ((playerDataGive.money || 0) < amount) {
                            logToTerminal(`You don't have ${amount} gold.`, "error");
                            break;
                        }
                        
                        // Phase 3: Money is permanent data
                        // Transfer money
                        await playerPersistence.syncToMySQL(userId, {
                            money: (playerDataGive.money || 0) - amount
                        });
                        
                        await playerPersistence.syncToMySQL(recipientId, {
                            money: (recipientData.money || 0) + amount
                        });
                        
                        logToTerminal(`You give ${amount} gold to ${recipientData.name}.`, "success");
                        
                        // Notify recipient
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: userId,
                            senderName: playerName,
                            roomId: currentPlayerRoomId,
                            text: `${playerName} gives you ${amount} gold!`,
                            recipientId: recipientId,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                        
                        // Broadcast to room
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: userId,
                            senderName: playerName,
                            roomId: currentPlayerRoomId,
                            text: `${playerName} gives ${amount} gold to ${recipientData.name}.`,
                            isEmote: true,
                            timestamp: serverTimestamp()
                        });
                        
                        break;
                    }
                    
                    // If not a player, try to find NPC in room
                    const recipientNpc = findNpcInRoom(recipientName);
                    if (!recipientNpc) {
                        logToTerminal(`${recipientName} is not here.`, "error");
                        break;
                    }
                    
                    // Check if player has enough money
                    const playerDocGive = await getDoc(playerRef);
                    const playerDataGive = playerDocGive.data();
                    
                    if ((playerDataGive.money || 0) < amount) {
                        logToTerminal(`You don't have ${amount} gold.`, "error");
                        break;
                    }
                    
                    // Deduct money from player
                    await updateDoc(playerRef, {
                        money: (playerDataGive.money || 0) - amount
                    });
                    
                    logToTerminal(`You give ${amount} gold to ${recipientNpc.name}.`, "game");
                    
                    // Check if NPC has a special response for receiving money
                    if (recipientNpc.moneyResponse) {
                        logToTerminal(`${recipientNpc.name} says, "${recipientNpc.moneyResponse}"`, "game");
                    } else {
                        const responses = [
                            `${recipientNpc.name} accepts your gold with a nod.`,
                            `${recipientNpc.name} pockets the coins gratefully.`,
                            `${recipientNpc.name} thanks you for the gold.`,
                            `${recipientNpc.name} smiles and takes the money.`
                        ];
                        logToTerminal(responses[Math.floor(Math.random() * responses.length)], "game");
                    }
                    
                    // Broadcast to room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: `${playerName} gives ${amount} gold to ${recipientNpc.name}.`,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    
                    break;
                }
                
                // Otherwise, assume giving an item
                if (!npc_target) {
                    logToTerminal("Give to whom? Usage: give <item> to <name>", "error");
                    break;
                }
                
                // Try to find player first
                const itemRecipientPlayer = Object.entries(gamePlayers).find(([id, p]) => 
                    p.name.toLowerCase() === npc_target.toLowerCase() && 
                    p.roomId === currentPlayerRoomId &&
                    id !== userId
                );
                
                if (itemRecipientPlayer) {
                    const [recipientId, recipientData] = itemRecipientPlayer;
                    
                    // Get player's current inventory
                    const playerDocGiveItem = await getDoc(playerRef);
                    const playerInv = playerDocGiveItem.data().inventory || [];
                    
                    // Find the item in inventory by name/alias
                    const itemIndex = playerInv.findIndex(invItem => {
                        const item = gameItems[invItem.id];
                        if (!item) return false;
                        const lowerTarget = target.toLowerCase();
                        if (item.name.toLowerCase().includes(lowerTarget)) return true;
                        if (item.aliases && item.aliases.some(alias => alias.toLowerCase().includes(lowerTarget))) return true;
                        return false;
                    });
                    
                    if (itemIndex === -1) {
                        logToTerminal(`You don't have ${target}.`, "error");
                        break;
                    }
                    
                    const itemToGivePlayer = playerInv[itemIndex];
                    
                    // Remove item from giver's inventory
                    playerInv.splice(itemIndex, 1);
                    await updateDoc(playerRef, { inventory: playerInv });
                    
                    // Add item to recipient's inventory
                    const recipientRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${recipientId}`);
                    await updateDoc(recipientRef, {
                        inventory: arrayUnion(itemToGivePlayer)
                    });
                    
                    logToTerminal(`You give ${itemToGivePlayer.name} to ${recipientData.name}.`, "success");
                    
                    // Notify recipient
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: `${playerName} gives you ${itemToGivePlayer.name}!`,
                        recipientId: recipientId,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    // Broadcast to room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: `${playerName} gives ${itemToGivePlayer.name} to ${recipientData.name}.`,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    
                    break;
                }
                
                // If not a player, try NPC
                const recipientForItem = findNpcInRoom(npc_target);
                if (!recipientForItem) {
                    logToTerminal(`${npc_target} is not here.`, "error");
                    break;
                }
                
                // Get player's current inventory
                const playerDocGiveItem = await getDoc(playerRef);
                const playerInv = playerDocGiveItem.data().inventory || [];
                
                // Find the item in inventory by name/alias
                const itemIndex = playerInv.findIndex(invItem => {
                    const item = gameItems[invItem.id];
                    if (!item) return false;
                    const lowerTarget = target.toLowerCase();
                    if (item.name.toLowerCase().includes(lowerTarget)) return true;
                    if (item.aliases && item.aliases.some(alias => alias.toLowerCase().includes(lowerTarget))) return true;
                    return false;
                });
                
                if (itemIndex === -1) {
                    logToTerminal(`You don't have ${target}.`, "error");
                    break;
                }
                
                const itemToGive = playerInv[itemIndex];
                
                // Remove item from player inventory
                playerInv.splice(itemIndex, 1);
                await updateDoc(playerRef, { inventory: playerInv });
                
                logToTerminal(`You give ${itemToGive.name} to ${recipientForItem.name}.`, "game");
                
                // Check if NPC has a special response for this item
                if (recipientForItem.itemResponses && recipientForItem.itemResponses[itemToGive.id]) {
                    logToTerminal(`${recipientForItem.name} says, "${recipientForItem.itemResponses[itemToGive.id]}"`, "game");
                } else {
                    logToTerminal(`${recipientForItem.name} accepts the ${itemToGive.name}.`, "game");
                }
                
                // Broadcast to room
                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                    senderId: userId,
                    senderName: playerName,
                    roomId: currentPlayerRoomId,
                    text: `${playerName} gives ${itemToGive.name} to ${recipientForItem.name}.`,
                    isEmote: true,
                    timestamp: serverTimestamp()
                });
                
                break;
            
            case 'haggle':
                // Haggle with merchants - expects target=item, topic=price, npc_target=merchant
                try {
                    if (!npc_target) {
                        logToTerminal("Haggle with whom?", "error");
                        break;
                    }
                    
                    if (!target) {
                        logToTerminal("Haggle for what item?", "error");
                        break;
                    }
                    
                    const merchant = findNpcInRoom(npc_target);
                    if (!merchant) {
                        logToTerminal(`${npc_target} is not here.`, "error");
                        break;
                    }
                    
                    if (!merchant.sells || merchant.sells.length === 0) {
                        logToTerminal(`${merchant.shortName || merchant.name} doesn't sell anything.`, "error");
                        break;
                    }
                    
                    // Find item in merchant's inventory
                    let itemToHaggle = null;
                    const targetLower = target.toLowerCase();
                    
                    for (const itemId of merchant.sells) {
                        const item = gameItems[itemId];
                        if (item && (
                            item.id.toLowerCase() === targetLower ||
                            item.name.toLowerCase().includes(targetLower) ||
                            (item.aliases && item.aliases.some(alias => alias.toLowerCase() === targetLower))
                        )) {
                            itemToHaggle = item;
                            break;
                        }
                    }
                    
                    if (!itemToHaggle) {
                        logToTerminal(`${merchant.shortName || merchant.name} doesn't sell "${target}".`, "error");
                        break;
                    }
                    
                    // If topic is provided, use it as the offered price, otherwise let haggleWithNPC handle it
                    const offeredPrice = topic ? parseInt(topic) : null;
                    
                    if (topic && isNaN(offeredPrice)) {
                        logToTerminal("Invalid price. Please specify a number.", "error");
                        break;
                    }
                    
                    const { haggleWithNPC } = await import('./trading.js?v=056');
                    const playerDocHaggle = await getDoc(playerRef);
                    await haggleWithNPC(auth.currentUser.uid, merchant, itemToHaggle, offeredPrice, playerDocHaggle.data());
                } catch (error) {
                    console.error('Error in haggle command:', error);
                    logToTerminal('An error occurred while haggling. Please try again.', 'error');
                }
                break;
            
            case 'list':
                // NEW: List merchant inventory with prices
                // Try to find NPC by target or npc_target
                const merchantName = target || npc_target;
                console.log('[List Command] Searching for merchant:', merchantName);
                console.log('[List Command] Current room NPCs:', currentRoom?.npcs);
                
                const shopkeeper = merchantName ? findNpcInRoom(merchantName) : findNpcInRoom('');
                console.log('[List Command] Found shopkeeper:', shopkeeper);
                
                if (!shopkeeper) {
                    // Find any NPC with sells array in the room
                    const currentRoom = gameWorld[currentPlayerRoomId];
                    const roomNpcIds = currentRoom?.npcs || [];
                    console.log('[List Command] Checking all NPCs in room:', roomNpcIds);
                    const npcsInRoom = roomNpcIds
                        .map(npcId => {
                            const npc = gameNpcs[npcId];
                            console.log('[List Command] NPC:', npcId, npc);
                            return npc;
                        })
                        .filter(npc => {
                            const hasSells = npc && npc.sells && npc.sells.length > 0;
                            console.log('[List Command] Has sells?', hasSells, npc?.sells);
                            return hasSells;
                        });
                    
                    console.log('[List Command] Merchants found:', npcsInRoom);
                    
                    if (npcsInRoom.length === 0) {
                        logToTerminal("There are no merchants here.", "error");
                        break;
                    }
                    
                    if (npcsInRoom.length > 1) {
                        logToTerminal("Which merchant? " + npcsInRoom.map(n => n.shortName || n.name).join(', '), "error");
                        break;
                    }
                    
                    try {
                        const { listMerchantInventory } = await import('./trading.js?v=056');
                        console.log('[List Command] Calling listMerchantInventory with:', npcsInRoom[0]);
                        listMerchantInventory(npcsInRoom[0], auth.currentUser.uid, gameItems);
                    } catch (error) {
                        console.error('[List Command] Error:', error);
                        logToTerminal(`Error listing inventory: ${error.message}`, 'error');
                    }
                } else {
                    console.log('[List Command] Entering ELSE block for shopkeeper');
                    try {
                        console.log('[List Command] About to import trading.js');
                        const tradingModule = await import('./trading.js?v=056');
                        console.log('[List Command] Trading module imported:', tradingModule);
                        const { listMerchantInventory } = tradingModule;
                        console.log('[List Command] listMerchantInventory function:', listMerchantInventory);
                        console.log('[List Command] Calling listMerchantInventory with:', shopkeeper, auth.currentUser.uid, 'gameItems:', gameItems);
                        await listMerchantInventory(shopkeeper, auth.currentUser.uid, gameItems);
                        console.log('[List Command] listMerchantInventory completed');
                    } catch (error) {
                        console.error('[List Command] Error:', error);
                        logToTerminal(`Error listing inventory: ${error.message}`, 'error');
                    }
                }
                break;
            
            case 'appraise':
            case 'value':
                // NEW: Check item value and what merchants will pay
                const itemToAppraise = findItemByName(target);
                if (!itemToAppraise) {
                    logToTerminal(`Item "${target}" not found.`, "error");
                    break;
                }
                
                const { appraiseItem } = await import('./trading.js?v=056');
                await appraiseItem(auth.currentUser.uid, itemToAppraise);
                break;
            
            case 'reputation':
                // NEW: Check reputation with merchant
                if (!npc_target) {
                    logToTerminal("Check reputation with whom?", "error");
                    break;
                }
                
                const repMerchant = findNpcInRoom(npc_target);
                if (!repMerchant) {
                    logToTerminal(`${npc_target} is not here.`, "error");
                    break;
                }
                
                const { getMerchantReputation, getReputationLevel, REP_LEVELS } = await import('./trading.js?v=056');
                const reputation = await getMerchantReputation(auth.currentUser.uid, repMerchant.id);
                const repLevel = getReputationLevel(reputation);
                
                logToTerminal(`<span class="text-cyan-400">═══ Reputation with ${repMerchant.shortName || repMerchant.name} ═══</span>`, 'system');
                logToTerminal(`Status: ${repLevel.name}`, 'system');
                logToTerminal(`Points: ${reputation}/${repLevel.max}`, 'system');
                logToTerminal(`Discount: ${Math.round(repLevel.discount * 100)}%`, 'system');
                
                if (reputation < REP_LEVELS.PARTNER.min) {
                    const nextLevel = Object.values(REP_LEVELS).find(l => l.min > reputation);
                    if (nextLevel) {
                        const pointsNeeded = nextLevel.min - reputation;
                        logToTerminal(`Next level (${nextLevel.name}): ${pointsNeeded} points needed`, 'info');
                    }
                }
                break;
            
            case 'merchants':
                // NEW: List all known merchants and reputations
                logToTerminal(`<span class="text-cyan-400">═══ Known Merchants ═══</span>`, 'system');
                
                const merchantNpcs = Object.values(gameNpcs).filter(npc => 
                    npc.sells && npc.sells.length > 0
                );
                
                if (merchantNpcs.length === 0) {
                    logToTerminal("You haven't met any merchants yet.", 'info');
                    break;
                }
                
                const { getMerchantReputation: getRepForList, getReputationLevel: getRepLevelForList } = await import('./trading.js?v=056');
                
                for (const npc of merchantNpcs) {
                    const rep = await getRepForList(auth.currentUser.uid, npc.id);
                    const level = getRepLevelForList(rep);
                    logToTerminal(`${npc.shortName || npc.name}: ${level.name} (${rep} points)`, 'system');
                }
                break;
            
            // ===== PLAYER-TO-PLAYER TRADING =====
            
            case 'trade':
                // NEW: Initiate player trade
                if (!target) {
                    logToTerminal("Trade with whom? Usage: trade with <player>", "error");
                    break;
                }
                
                const { initiatePlayerTrade } = await import('./player-trading.js?v=056');
                await initiatePlayerTrade(auth.currentUser.uid, target, currentPlayerRoomId);
                break;
            
            case 'accept':
                // Check if accepting trade or something else
                if (target === 'trade' || cmdText.toLowerCase().includes('accept trade')) {
                    const { acceptTradeRequest } = await import('./player-trading.js?v=056');
                    await acceptTradeRequest(auth.currentUser.uid);
                } else {
                    logToTerminal("Accept what?", "error");
                }
                break;
            
            case 'decline':
                if (target === 'trade' || cmdText.toLowerCase().includes('decline trade')) {
                    const { declineTradeRequest } = await import('./player-trading.js?v=056');
                    await declineTradeRequest(auth.currentUser.uid);
                } else {
                    logToTerminal("Decline what?", "error");
                }
                break;
            
            case 'push':
            case 'pull':
            case 'move':
                if (!target) {
                    logToTerminal(`${action.charAt(0).toUpperCase() + action.slice(1)} what?`, "error");
                    break;
                }
                
                // Check if room has pushable objects defined
                if (!currentRoom.pushables || typeof currentRoom.pushables !== 'object') {
                    logToTerminal(`You can't ${action} that.`, "game");
                    break;
                }
                
                const pushableKey = target.toLowerCase();
                const pushable = currentRoom.pushables[pushableKey];
                
                if (!pushable) {
                    logToTerminal(`You can't ${action} that.`, "game");
                    break;
                }
                
                // Check if already pushed/activated
                const roomStateRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${currentPlayerRoomId}`);
                const roomStateSnap = await getDoc(roomStateRef);
                const roomState = roomStateSnap.exists() ? roomStateSnap.data() : {};
                const pushableStates = roomState.pushableStates || {};
                
                if (pushableStates[pushableKey]) {
                    logToTerminal(pushable.alreadyPushedMessage || `The ${target} has already been moved.`, "game");
                    break;
                }
                
                // Check if requires party members
                const requiredPeople = pushable.requiredPeople || 1;
                
                if (requiredPeople > 1) {
                    // Count party members in the same room
                    const playerParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(userId)
                    );
                    
                    if (!playerParty) {
                        logToTerminal(pushable.needHelpMessage || `You need help to ${action} this. It's too heavy for one person.`, "error");
                        break;
                    }
                    
                    // Count how many party members are in the same room
                    const partyMembersInRoom = Object.keys(playerParty.members).filter(memberId => {
                        const member = gamePlayers[memberId];
                        return member && member.roomId === currentPlayerRoomId;
                    });
                    
                    if (partyMembersInRoom.length < requiredPeople) {
                        logToTerminal(pushable.needHelpMessage || `You need at least ${requiredPeople} people to ${action} this. Currently ${partyMembersInRoom.length} party member(s) are here.`, "error");
                        break;
                    }
                }
                
                // Success! Mark as pushed and apply effects
                pushableStates[pushableKey] = true;
                await setDoc(roomStateRef, { pushableStates }, { merge: true });
                
                // Show success message
                logToTerminal(pushable.successMessage || `You ${action} the ${target}.`, "success");
                
                // Reveal items if specified
                if (pushable.revealsItems && Array.isArray(pushable.revealsItems)) {
                    const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${currentPlayerRoomId}`);
                    const roomSnap = await getDoc(roomRef);
                    const existingItems = roomSnap.exists() ? (roomSnap.data().revealedItems || []) : [];
                    const newRevealedItems = [...existingItems, ...pushable.revealsItems];
                    
                    await setDoc(roomRef, { revealedItems: newRevealedItems }, { merge: true });
                    
                    logToTerminal(pushable.revealMessage || "You discover something hidden!", "game");
                }
                
                // Update room description if specified
                if (pushable.newRoomDescription) {
                    logToTerminal(pushable.newRoomDescription, "game");
                }
                
                // Broadcast to other players in room
                const otherPlayersInRoom = Object.values(gamePlayers).filter(p => 
                    p.roomId === currentPlayerRoomId && p.name !== playerName
                );
                
                if (otherPlayersInRoom.length > 0) {
                    const broadcastMessage = pushable.broadcastMessage || `${playerName} pushes the ${target}.`;
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        text: broadcastMessage,
                        roomId: currentPlayerRoomId,
                        timestamp: Date.now(),
                        isSystem: true
                    });
                }
                
                // Refresh room display for everyone
                await showRoom(currentPlayerRoomId);
                break;
            
            case 'offer':
                // NEW: Offer item or gold in trade
                if (!target) {
                    logToTerminal("Offer what? Usage: offer <item> or offer <amount> gold", "error");
                    break;
                }
                
                const { offerTradeItem, offerTradeGold } = await import('./player-trading.js?v=056');
                
                // Check if offering gold
                if (target.match(/^\d+$/) || cmdText.toLowerCase().includes('gold')) {
                    const goldMatch = cmdText.match(/(\d+)/);
                    if (goldMatch) {
                        await offerTradeGold(auth.currentUser.uid, parseInt(goldMatch[1]));
                    } else {
                        logToTerminal("How much gold? Usage: offer <amount> gold", "error");
                    }
                } else {
                    await offerTradeItem(auth.currentUser.uid, target);
                }
                break;
            
            case 'remove':
                // NEW: Remove item from trade offer
                // Check if in context of trade
                const { getPlayerTradeSession, removeTradeItem } = await import('./player-trading.js?v=056');
                const tradeSession = getPlayerTradeSession(auth.currentUser.uid);
                
                if (tradeSession) {
                    await removeTradeItem(auth.currentUser.uid, target);
                } else {
                    logToTerminal("You're not currently in a trade.", "error");
                }
                break;
            
            case 'confirm':
                if (target === 'trade' || cmdText.toLowerCase().includes('confirm trade')) {
                    const { confirmTrade } = await import('./player-trading.js?v=056');
                    await confirmTrade(auth.currentUser.uid);
                } else {
                    logToTerminal("Confirm what?", "error");
                }
                break;
            
            case 'cancel':
                if (target === 'trade' || cmdText.toLowerCase().includes('cancel trade')) {
                    const { cancelPlayerTrade } = await import('./player-trading.js?v=056');
                    await cancelPlayerTrade(auth.currentUser.uid, 'cancelled');
                } else {
                    logToTerminal("Cancel what?", "error");
                }
                break;

            case 'unlock':
                // Unlock command - alias for using a key
                if (!target) {
                    logToTerminal("Unlock what? Try 'unlock door' or 'unlock north'", 'error');
                    break;
                }
                
                // Get player's current inventory
                const playerDocUnlock = await getDoc(playerRef);
                const playerDataUnlock = playerDocUnlock.data();
                const inventoryUnlock = playerDataUnlock.inventory || [];
                
                // Get current room
                const currentRoomUnlock = gameWorld[playerDataUnlock.roomId];
                if (!currentRoomUnlock || !currentRoomUnlock.lockedExits) {
                    logToTerminal("There's nothing to unlock here.", 'error');
                    break;
                }
                
                // Determine which direction to unlock
                let directionToUnlock = target.toLowerCase();
                
                // Check if it's a valid direction
                const validDirections = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'];
                if (!validDirections.includes(directionToUnlock)) {
                    // Try to find a locked exit that matches keywords like "door", "gate", etc.
                    const lockedExits = Object.entries(currentRoomUnlock.lockedExits);
                    const matchingExit = lockedExits.find(([dir, lock]) => {
                        const lockName = lock.name || lock.description || '';
                        return lockName.toLowerCase().includes(target.toLowerCase());
                    });
                    
                    if (matchingExit) {
                        directionToUnlock = matchingExit[0];
                    } else {
                        logToTerminal(`There's no "${target}" to unlock here.`, 'error');
                        break;
                    }
                }
                
                // Check if that direction is locked
                const lockToOpen = currentRoomUnlock.lockedExits[directionToUnlock];
                if (!lockToOpen) {
                    logToTerminal(`The way ${directionToUnlock} isn't locked.`, 'error');
                    break;
                }
                
                // Find the correct key in inventory
                const requiredKeyId = lockToOpen.keyId || lockToOpen.key;
                const keyToUse = inventoryUnlock.find(item => 
                    item.id === requiredKeyId || 
                    (gameItems[item.id]?.itemType === 'key' && 
                     gameItems[item.id]?.specialData?.unlocks === directionToUnlock)
                );
                
                if (!keyToUse) {
                    logToTerminal(`You don't have the right key to unlock this.`, 'error');
                    if (requiredKeyId) {
                        const keyItem = gameItems[requiredKeyId];
                        logToTerminal(`You need: ${keyItem?.name || requiredKeyId}`, 'system');
                    }
                    break;
                }
                
                // Use the key
                const keyData = gameItems[keyToUse.id];
                await handleSpecialItem('key', keyData, keyToUse, playerDataUnlock);
                break;

            case 'lock':
                // Lock command - re-locks a previously unlocked door
                if (!target) {
                    logToTerminal("Lock what? Try 'lock door' or 'lock north'", 'error');
                    break;
                }
                
                // Get player's current inventory
                const playerDocLock = await getDoc(playerRef);
                const playerDataLock = playerDocLock.data();
                const inventoryLock = playerDataLock.inventory || [];
                
                // Get current room
                const currentRoomLock = gameWorld[playerDataLock.roomId];
                if (!currentRoomLock || !currentRoomLock.lockedExits) {
                    logToTerminal("There's nothing to lock here.", 'error');
                    break;
                }
                
                // Determine which direction to lock
                let directionToLock = target.toLowerCase();
                
                // Check if it's a valid direction
                const validDirectionsLock = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'];
                if (!validDirectionsLock.includes(directionToLock)) {
                    // Try to find a lockable exit that matches keywords
                    const lockedExitsLock = Object.entries(currentRoomLock.lockedExits);
                    const matchingExitLock = lockedExitsLock.find(([dir, lock]) => {
                        const lockName = lock.name || lock.description || '';
                        return lockName.toLowerCase().includes(target.toLowerCase());
                    });
                    
                    if (matchingExitLock) {
                        directionToLock = matchingExitLock[0];
                    } else {
                        logToTerminal(`There's no "${target}" to lock here.`, 'error');
                        break;
                    }
                }
                
                // Check if that direction has a lockable exit
                const lockToClose = currentRoomLock.lockedExits[directionToLock];
                if (!lockToClose) {
                    logToTerminal(`The way ${directionToLock} can't be locked.`, 'error');
                    break;
                }
                
                // Check if it's not already locked
                const exitKeyLock = `${playerDataLock.roomId}:${directionToLock}`;
                const currentUnlockedExitsLock = playerDataLock.unlockedExits || [];
                
                if (!currentUnlockedExitsLock.includes(exitKeyLock)) {
                    logToTerminal(`The way ${directionToLock} is already locked.`, 'game');
                    break;
                }
                
                // Check if lock allows re-locking
                const allowRelocking = lockToClose.relockable !== false; // Default: true
                if (!allowRelocking) {
                    logToTerminal(`Once unlocked, this cannot be locked again.`, 'error');
                    break;
                }
                
                // Find the correct key in inventory
                const requiredKeyIdLock = lockToClose.keyId || lockToClose.key;
                const keyToUseLock = inventoryLock.find(item => 
                    item.id === requiredKeyIdLock || 
                    (gameItems[item.id]?.itemType === 'key' && 
                     gameItems[item.id]?.specialData?.unlocks === directionToLock)
                );
                
                if (!keyToUseLock) {
                    logToTerminal(`You don't have the right key to lock this.`, 'error');
                    if (requiredKeyIdLock) {
                        const keyItemLock = gameItems[requiredKeyIdLock];
                        logToTerminal(`You need: ${keyItemLock?.name || requiredKeyIdLock}`, 'system');
                    }
                    break;
                }
                
                // Re-lock the exit by removing from unlocked list
                const updatedUnlockedExits = currentUnlockedExitsLock.filter(key => key !== exitKeyLock);
                await updateDoc(playerRef, {
                    unlockedExits: updatedUnlockedExits
                });
                
                // Show lock message
                const lockMessage = lockToClose.lockMessage || 
                                  lockToClose.relock || 
                                  `You use ${gameItems[keyToUseLock.id]?.name || 'the key'} to lock the way ${directionToLock}. *Click*`;
                logToTerminal(lockMessage, 'success');
                
                break;

            case 'put':
                // Put item in container: "put sword in backpack"
                if (!cmdText.includes(' in ')) {
                    logToTerminal("Usage: put [item] in [container]", 'error');
                    break;
                }
                
                const [itemPart, containerPart] = cmdText.split(' in ').map(s => s.trim());
                const itemToPut = itemPart.replace(/^put\s+/i, '').trim().toLowerCase();
                const containerTarget = containerPart.toLowerCase();
                
                // Find item in inventory
                const playerDocPut = await getDoc(playerRef);
                const inventoryPut = playerDocPut.data().inventory || [];
                const foundItemToPut = inventoryPut.find(i => 
                    i && i.id && i.name && 
                    (i.id.toLowerCase() === itemToPut || i.name.toLowerCase().includes(itemToPut))
                );
                
                if (!foundItemToPut) {
                    logToTerminal("You aren't carrying that item.", 'error');
                    break;
                }
                
                // Find container in inventory
                const foundContainer = inventoryPut.find(i => 
                    i && i.id && i.name && 
                    (i.id.toLowerCase() === containerTarget || i.name.toLowerCase().includes(containerTarget))
                );
                
                if (!foundContainer) {
                    logToTerminal("You aren't carrying that container.", 'error');
                    break;
                }
                
                const containerData = gameItems[foundContainer.id];
                if (!containerData || containerData.itemType !== 'container') {
                    logToTerminal("That's not a container.", 'error');
                    break;
                }
                
                // Check if trying to put container in itself
                if (foundItemToPut.id === foundContainer.id) {
                    logToTerminal("You can't put a container inside itself!", 'error');
                    break;
                }
                
                // Initialize contents array if needed
                if (!foundContainer.contents) {
                    foundContainer.contents = [];
                }
                
                // Check container capacity
                const maxCapacity = containerData.specialData?.capacity || 50;
                const itemData = gameItems[foundItemToPut.id];
                const itemWeight = itemData?.weight || 0;
                
                let currentContentsWeight = 0;
                for (const item of foundContainer.contents) {
                    const itemData = gameItems[item.id];
                    if (itemData) {
                        currentContentsWeight += (itemData.weight || 0) * (item.quantity || 1);
                    }
                }
                
                if (currentContentsWeight + itemWeight > maxCapacity) {
                    logToTerminal(`The ${containerData.name} is too full! (${currentContentsWeight.toFixed(1)}/${maxCapacity} lbs)`, 'error');
                    break;
                }
                
                // Add item to container contents
                foundContainer.contents.push(foundItemToPut);
                
                // Remove from main inventory and update container
                const updatedInventoryPut = inventoryPut.filter(i => i !== foundItemToPut);
                const containerIndex = updatedInventoryPut.findIndex(i => i === foundContainer);
                if (containerIndex >= 0) {
                    updatedInventoryPut[containerIndex] = foundContainer;
                }
                
                // Phase 3: Inventory is permanent data
                await playerPersistence.syncToMySQL(userId, { inventory: updatedInventoryPut });
                logToTerminal(`You put ${addArticle(itemData?.name || 'the item')} in ${addArticle(containerData.name)}.`, 'game');
                break;

            case 'take':
                // Take item from container: "take sword from backpack"
                // If no "from" keyword, treat as "get" command from room
                if (!cmdText.includes(' from ')) {
                    // Redirect to get command for picking up from ground
                    // Include both regular room items AND revealed items from pushables
                    const roomItemIdsTake = [...(currentRoom.items || [])];
                    
                    // Add revealed items from room state
                    const roomStateTakeRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${currentPlayerRoomId}`);
                    const roomStateTakeSnap = await getDoc(roomStateTakeRef);
                    if (roomStateTakeSnap.exists()) {
                        const revealedItemsTake = roomStateTakeSnap.data().revealedItems || [];
                        roomItemIdsTake.push(...revealedItemsTake);
                    }
                    
                    const itemEntryToTake = roomItemIdsTake.find(itemEntry => {
                        // Support both old format (string) and new format ({id, quantity})
                        const itemId = typeof itemEntry === 'string' ? itemEntry : itemEntry.id;
                        const item = gameItems[itemId];
                        if (!item) return false;
                        
                        // Check ID match
                        if (itemId.toLowerCase() === target) return true;
                        
                        // Check name match
                        if (item.name.toLowerCase().includes(target)) return true;
                        
                        // Check aliases
                        if (item.aliases && Array.isArray(item.aliases)) {
                            return item.aliases.some(alias => alias.toLowerCase().includes(target));
                        }
                        
                        return false;
                    });
                    
                    if (itemEntryToTake) {
                        // Handle both formats
                        const itemIdToTake = typeof itemEntryToTake === 'string' ? itemEntryToTake : itemEntryToTake.id;
                        const itemQuantityInRoom = typeof itemEntryToTake === 'string' ? 1 : (itemEntryToTake.quantity || 1);
                        
                        const item = gameItems[itemIdToTake];
                        if (item.movable === false) {
                            logToTerminal("You can't take that.", "error");
                            break;
                        }
                        
                        // Check weight limit
                        const playerDocTake2 = await getDoc(playerRef);
                        const playerTakeData = playerDocTake2.data();
                        if (!canCarryItem(playerTakeData, itemIdToTake, 1)) {
                            const currentWeight = calculateInventoryWeight(playerTakeData.inventory || []);
                            const maxWeight = calculateMaxCarryWeight(playerTakeData);
                            const itemWeight = item.weight || 0;
                            logToTerminal(`You can't carry that! (Current: ${currentWeight.toFixed(1)}/${maxWeight} lbs, item weighs ${itemWeight} lbs)`, "error");
                            logToTerminal(`Try dropping some items first, or store items in a container.`, "hint");
                            break;
                        }
                        
                        const fullItemObject = { id: itemIdToTake, ...item };
                        // Use manual array update instead of arrayUnion to allow duplicate items
                        const currentInventoryTake = playerTakeData.inventory || [];
                        // Phase 3: Inventory is permanent data
                        await playerPersistence.syncToMySQL(userId, { inventory: [...currentInventoryTake, fullItemObject] });
                        
                        // Check if this item is in revealed items (from pushables)
                        const isRevealedItem = roomStateTakeSnap.exists() && 
                            (roomStateTakeSnap.data().revealedItems || []).some(entry => {
                                const id = typeof entry === 'string' ? entry : entry.id;
                                return id === itemIdToTake;
                            });
                        
                        if (isRevealedItem) {
                            // Remove from revealed items in room state
                            const currentRevealedItems = roomStateTakeSnap.data().revealedItems || [];
                            const updatedRevealedItems = currentRevealedItems.filter(entry => {
                                const id = typeof entry === 'string' ? entry : entry.id;
                                return id !== itemIdToTake;
                            });
                            await updateDoc(roomStateTakeRef, { revealedItems: updatedRevealedItems });
                        } else {
                            // Update regular room items: decrease quantity or remove item
                            if (itemQuantityInRoom > 1) {
                                // Decrease quantity
                                const updatedItems = (currentRoom.items || []).map(entry => {
                                    if (typeof entry === 'object' && entry.id === itemIdToTake) {
                                        return { ...entry, quantity: entry.quantity - 1 };
                                    }
                                    return entry;
                                });
                                await updateDoc(roomRef, { items: updatedItems });
                            } else {
                                // Remove item completely (works for both formats)
                                await updateDoc(roomRef, { items: arrayRemove(itemEntryToTake) });
                            }
                        }
                        
                        logToTerminal(`You take ${addArticle(item.name)}.`, 'game');
                        
                        // Refresh room display to show updated item quantities
                        await showRoom(currentPlayerRoomId);
                        
                        // Check quest progress for item collection
                        const completedQuests = await updateQuestProgress(userId, 'collect', itemIdToTake, 1);
                        for (const completed of completedQuests) {
                            const quest = gameQuests[completed.questId];
                            if (quest) {
                                logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                            }
                        }
                        
                        // Log to news if item is newsworthy
                        if (item.newsworthy) {
                            await logNews('found', playerName, `found the ${item.name}!`);
                        }
                    } else { 
                        logToTerminal("You don't see that here.", 'error'); 
                    }
                    break;
                }
                
                const [itemPartTake, containerPartTake] = cmdText.split(' from ').map(s => s.trim());
                const itemToTake = itemPartTake.replace(/^take\s+/i, '').trim().toLowerCase();
                const containerTargetTake = containerPartTake.toLowerCase();
                
                // Find container in inventory
                const playerDocTake = await getDoc(playerRef);
                const inventoryTake = playerDocTake.data().inventory || [];
                const foundContainerTake = inventoryTake.find(i => 
                    i && i.id && i.name && 
                    (i.id.toLowerCase() === containerTargetTake || i.name.toLowerCase().includes(containerTargetTake))
                );
                
                if (!foundContainerTake) {
                    logToTerminal("You aren't carrying that container.", 'error');
                    break;
                }
                
                const containerDataTake = gameItems[foundContainerTake.id];
                if (!containerDataTake || containerDataTake.itemType !== 'container') {
                    logToTerminal("That's not a container.", 'error');
                    break;
                }
                
                if (!foundContainerTake.contents || foundContainerTake.contents.length === 0) {
                    logToTerminal(`The ${containerDataTake.name} is empty.`, 'error');
                    break;
                }
                
                // Find item in container contents
                const foundItemToTake = foundContainerTake.contents.find(i => 
                    i && i.id && i.name && 
                    (i.id.toLowerCase() === itemToTake || i.name.toLowerCase().includes(itemToTake))
                );
                
                if (!foundItemToTake) {
                    logToTerminal(`There's no ${itemToTake} in the ${containerDataTake.name}.`, 'error');
                    break;
                }
                
                // Check weight limit for taking item out
                const playerDataTake = playerDocTake.data();
                const itemDataTake = gameItems[foundItemToTake.id];
                if (!canCarryItem(playerDataTake, foundItemToTake.id, 1)) {
                    const currentWeight = calculateInventoryWeight(playerDataTake.inventory || []);
                    const maxWeight = calculateMaxCarryWeight(playerDataTake);
                    const itemWeight = itemDataTake?.weight || 0;
                    logToTerminal(`You can't carry that! (Current: ${currentWeight.toFixed(1)}/${maxWeight} lbs, item weighs ${itemWeight} lbs)`, "error");
                    logToTerminal(`The ${containerDataTake.name} already reduces your carrying weight, but you're still at capacity.`, "hint");
                    break;
                }
                
                // Remove item from container contents
                foundContainerTake.contents = foundContainerTake.contents.filter(i => i !== foundItemToTake);
                
                // Update container and add item to main inventory
                const updatedInventoryTake = [...inventoryTake];
                const containerIndexTake = updatedInventoryTake.findIndex(i => 
                    i.id === foundContainerTake.id && i.name === foundContainerTake.name
                );
                if (containerIndexTake >= 0) {
                    updatedInventoryTake[containerIndexTake] = foundContainerTake;
                }
                updatedInventoryTake.push(foundItemToTake);
                
                await updateDoc(playerRef, { inventory: updatedInventoryTake });
                logToTerminal(`You take ${addArticle(itemDataTake?.name || 'the item')} from ${addArticle(containerDataTake.name)}.`, 'game');
                break;

            case 'use':
            case 'drink':
            case 'consume':
            case 'eat':
                const itemNameToUse = target;
                if (!itemNameToUse) {
                    logToTerminal(`${action.charAt(0).toUpperCase() + action.slice(1)} what?`, 'error');
                    break;
                }

                // Get player's current inventory
                const playerDocUse = await getDoc(playerRef);
                const playerDataUse = playerDocUse.data();
                const currentInventory = playerDataUse.inventory || [];

                // Find the item in inventory (with safety checks)
                const itemInInventory = currentInventory.find(item => {
                    if (!item || !item.name || !item.id) return false;
                    const itemName = item.name.toLowerCase();
                    const itemId = item.id.toLowerCase();
                    const searchTerm = itemNameToUse.toLowerCase();
                    return itemName.includes(searchTerm) || itemId.includes(searchTerm);
                });

                if (!itemInInventory) {
                    logToTerminal("You don't have that item.", 'error');
                    break;
                }

                // Get the full item data
                const fullItemData = gameItems[itemInInventory.id];
                if (!fullItemData) {
                    logToTerminal("That item doesn't exist.", 'error');
                    break;
                }

                // Check if it's a special item (key, teleport, etc.)
                const itemType = fullItemData.itemType || 'normal';
                
                if (itemType !== 'normal' && action === 'use') {
                    // Handle special item types
                    await handleSpecialItem(itemType, fullItemData, itemInInventory, playerDataUse);
                    break;
                }

                // Handle consumable items (drink, eat, consume)
                if (!fullItemData.consumable) {
                    logToTerminal(`You can't ${action} that.`, 'error');
                    break;
                }

                // Remove the item from inventory
                const updatedInventory = currentInventory.filter(item => item.id !== itemInInventory.id || item.name !== itemInInventory.name);
                
                // Calculate HP restoration (can be negative for poison/damage)
                let newHp = playerDataUse.hp || 10;
                const maxHp = playerDataUse.maxHp || 100;
                const hpChange = fullItemData.hpRestore || 0;
                
                if (hpChange !== 0) {
                    newHp = Math.max(0, Math.min(maxHp, newHp + hpChange));
                }

                // Check for special effects from special data
                const specialData = fullItemData.specialData || {};
                let parsedSpecialData = specialData;
                if (typeof specialData === 'string') {
                    try {
                        parsedSpecialData = JSON.parse(specialData);
                    } catch (e) {
                        parsedSpecialData = {};
                    }
                }

                const playerUpdates = {
                    inventory: updatedInventory,
                    hp: newHp
                };

                // Handle poison effects
                if (parsedSpecialData.onUseEffect === 'poison' || parsedSpecialData.onUseEffect === 'damage') {
                    const effectPower = parsedSpecialData.effectPower || 5;
                    const buffDuration = parsedSpecialData.buffDuration || 60; // seconds
                    const damagePerTick = parsedSpecialData.damagePerTick || effectPower;
                    const tickInterval = parsedSpecialData.tickInterval || 10; // seconds
                    
                    if (parsedSpecialData.onUseEffect === 'poison') {
                        // Apply poison status effect
                        playerUpdates.poisonedUntil = Date.now() + (buffDuration * 1000);
                        playerUpdates.poisonDamage = damagePerTick;
                        playerUpdates.poisonInterval = tickInterval;
                        playerUpdates.lastPoisonTick = Date.now();
                    } else if (parsedSpecialData.onUseEffect === 'damage') {
                        // Immediate damage
                        playerUpdates.hp = Math.max(0, newHp - effectPower);
                        newHp = playerUpdates.hp;
                    }
                }

                // Update player data
                await updateDoc(playerRef, playerUpdates);

                // Show consumption message
                let consumeMessage = `You ${action} ${itemInInventory.name}.`;
                
                if (hpChange > 0) {
                    consumeMessage += ` It restores ${hpChange} HP!`;
                } else if (hpChange < 0) {
                    consumeMessage += ` It damages you for ${Math.abs(hpChange)} HP!`;
                }
                
                if (fullItemData.effect) {
                    consumeMessage += ` ${fullItemData.effect}`;
                }
                
                // Add poison warning
                if (parsedSpecialData.onUseEffect === 'poison') {
                    consumeMessage += ` 💀 You've been poisoned!`;
                }
                
                logToTerminal(consumeMessage, 'system');
                
                // Show current HP
                if (hpChange !== 0 || parsedSpecialData.onUseEffect === 'damage') {
                    logToTerminal(`Current HP: ${newHp}/${maxHp}`, 'game');
                }
                
                // Check if player died from consumption
                if (newHp <= 0) {
                    logToTerminal("💀 You have died from consuming a deadly item!", 'error');
                    await handlePlayerDeath(playerRef, playerDataUse, "poisoning");
                }
                break;

            case 'read':
                // Check if reading an item in inventory or room
                const playerDocRead = await getDoc(playerRef);
                if (!playerDocRead.exists()) {
                    logToTerminal(`Player data not found!`, 'error');
                    break;
                }
                
                const playerDataRead = playerDocRead.data();
                const inventoryRead = playerDataRead.inventory || [];
                const itemToRead = findItemByName(target);
                
                if (!itemToRead) {
                    logToTerminal(`There is no "${target}" to read.`, 'error');
                    break;
                }
                
                // Check if item is in inventory
                const itemInInventoryRead = inventoryRead.find(item => item && item.id === itemToRead.id);
                
                // Check if item is in the room
                const roomItemsRead = currentRoom.items || [];
                const itemInRoomRead = roomItemsRead.find(item => {
                    if (typeof item === 'string') return item === itemToRead.id;
                    return item?.id === itemToRead.id;
                });
                
                if (itemInInventoryRead || itemInRoomRead) {
                    // Reading an item from inventory or room
                    const fullItemData = gameItems[itemToRead.id];
                    if (!fullItemData || !fullItemData.isReadable) {
                        logToTerminal(`There is nothing to read on ${itemToRead.name}.`, 'error');
                        break;
                    }
                    
                    const itemData = itemInInventoryRead || (typeof itemInRoomRead === 'object' ? itemInRoomRead : null);
                    
                    logToTerminal(`You read ${itemToRead.name}:`, 'system');
                    
                    // Check if item has custom entries (writable items)
                    if (itemData?.entries && itemData.entries.length > 0) {
                        logToTerminal(`\n=== Entries in ${itemToRead.name} ===`, 'system');
                        
                        for (let i = 0; i < itemData.entries.length; i++) {
                            const entry = itemData.entries[i];
                            const date = new Date(entry.timestamp);
                            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                            
                            logToTerminal(`\nEntry ${i + 1} - ${entry.author} (${dateStr}):`, 'quest');
                            logToTerminal(`"${entry.text}"`, 'game');
                        }
                        
                        logToTerminal(`\n=== End of Entries ===`, 'system');
                    } else {
                        // Show default readable text if no custom entries
                        logToTerminal(fullItemData.readableText || "The pages are blank.", 'game');
                    }
                } else {
                    // Check if it's a room detail that can be read
                    const roomDetails = currentRoom.details || {};
                    const detailKey = target ? Object.keys(roomDetails).find(key => key.toLowerCase() === target.toLowerCase()) : null;
                    
                    if (detailKey) {
                        const detailText = roomDetails[detailKey];
                        // Check if this detail mentions it has text/writing
                        logToTerminal(`You read the ${target}:`, 'system');
                        logToTerminal(detailText, 'game');
                    } else {
                        logToTerminal(`You don't see "${target}" here.`, 'error');
                    }
                }
                break;
            
            case 'write':
                // Write on an item (book, scroll, sign, etc.) in inventory or room
                if (!target) {
                    logToTerminal("What do you want to write on?", 'error');
                    break;
                }
                
                if (!parsedCommand.topic) {
                    logToTerminal("What do you want to write? Use: write [item] [your message]", 'error');
                    break;
                }
                
                const playerDocWrite = await getDoc(playerRef);
                if (!playerDocWrite.exists()) {
                    logToTerminal(`Player data not found!`, 'error');
                    break;
                }
                
                const playerDataWrite = playerDocWrite.data();
                const inventoryWrite = playerDataWrite.inventory || [];
                const itemToWrite = findItemByName(target);
                
                if (!itemToWrite) {
                    logToTerminal(`You don't see "${target}" here.`, 'error');
                    break;
                }
                
                // Check if item is writable
                const fullItemDataWrite = gameItems[itemToWrite.id];
                const isWritable = fullItemDataWrite?.isWritable || fullItemDataWrite?.specialData?.isWritable;
                if (!fullItemDataWrite || !isWritable) {
                    logToTerminal(`You can't write on ${itemToWrite.name}.`, 'error');
                    break;
                }
                
                // Check character limit
                const maxLength = fullItemDataWrite.maxWriteLength || fullItemDataWrite?.specialData?.maxWriteLength || 500;
                const messageToWrite = parsedCommand.topic.substring(0, maxLength);
                
                if (parsedCommand.topic.length > maxLength) {
                    logToTerminal(`Your message was truncated to ${maxLength} characters.`, 'system');
                }
                
                // Create entry with timestamp and author
                const entry = {
                    author: playerName,
                    authorId: userId,
                    text: messageToWrite,
                    timestamp: Date.now()
                };
                
                // Check if item is in inventory
                const itemInInventoryWrite = inventoryWrite.find(item => item && item.id === itemToWrite.id);
                
                if (itemInInventoryWrite) {
                    // Writing to item in inventory
                    const updatedInventoryWrite = inventoryWrite.map(item => {
                        if (item && item.id === itemToWrite.id) {
                            const entries = item.entries || [];
                            const maxEntries = fullItemDataWrite.maxEntries || fullItemDataWrite?.specialData?.maxEntries || 50;
                            const updatedEntries = [...entries, entry];
                            
                            if (updatedEntries.length > maxEntries) {
                                updatedEntries.shift();
                                logToTerminal(`The oldest entry has been removed to make room.`, 'system');
                            }
                            
                            return { ...item, entries: updatedEntries };
                        }
                        return item;
                    });
                    
                    await updateDoc(playerRef, { inventory: updatedInventoryWrite });
                    logToTerminal(`You write in ${itemToWrite.name}: "${messageToWrite}"`, 'game');
                    logToTerminal(`Your message has been recorded.`, 'success');
                } else {
                    // Check if item is in the room
                    const roomItemsWrite = currentRoom.items || [];
                    const itemIndexInRoom = roomItemsWrite.findIndex(item => {
                        if (typeof item === 'string') return item === itemToWrite.id;
                        return item?.id === itemToWrite.id;
                    });
                    
                    if (itemIndexInRoom >= 0) {
                        // Writing to item in room
                        const roomItem = roomItemsWrite[itemIndexInRoom];
                        const itemData = typeof roomItem === 'object' ? roomItem : { id: roomItem };
                        
                        const entries = itemData.entries || [];
                        const maxEntries = fullItemDataWrite.maxEntries || fullItemDataWrite?.specialData?.maxEntries || 50;
                        const updatedEntries = [...entries, entry];
                        
                        if (updatedEntries.length > maxEntries) {
                            updatedEntries.shift();
                            logToTerminal(`The oldest entry has been removed to make room.`, 'system');
                        }
                        
                        // Update the room item with new entry
                        const updatedRoomItems = [...roomItemsWrite];
                        updatedRoomItems[itemIndexInRoom] = {
                            ...itemData,
                            id: itemToWrite.id,
                            entries: updatedEntries
                        };
                        
                        // Update room in Firebase
                        const currentRoomId = currentRoom.id;
                        const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${currentRoomId}`);
                        await updateDoc(roomRef, { items: updatedRoomItems });
                        
                        // Update local room state immediately so changes appear without refresh
                        currentRoom.items = updatedRoomItems;
                        if (gameWorld[currentRoomId]) {
                            gameWorld[currentRoomId].items = updatedRoomItems;
                        }
                        
                        logToTerminal(`You write in ${itemToWrite.name}: "${messageToWrite}"`, 'game');
                        logToTerminal(`Your message has been recorded.`, 'success');
                    } else {
                        logToTerminal(`You don't see "${target}" here.`, 'error');
                    }
                }
                break;

             case 'attack':
                const targetName = target;
                
                if (!targetName) {
                    logToTerminal("Attack who? Try 'attack [name]'", "error");
                    break;
                }
                
                // First check if targeting another player
                const targetPlayerEntry = Object.entries(gamePlayers).find(([playerId, player]) => 
                    playerId !== userId && 
                    player.roomId === currentPlayerRoomId && 
                    player.name.toLowerCase().includes(targetName.toLowerCase())
                );
                
                if (targetPlayerEntry) {
                    const [targetPlayerId, targetPlayerData] = targetPlayerEntry;
                    const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${targetPlayerId}`);
                    const attackerRef = playerRef;
                    
                    // PvP Combat
                    const combatMessages = [];
                    
                    try {
                        await runTransaction(db, async (transaction) => {
                            const attackerDoc = await transaction.get(attackerRef);
                            const defenderDoc = await transaction.get(targetPlayerRef);
                            
                            if (!attackerDoc.exists() || !defenderDoc.exists()) {
                                throw new Error("Player vanished during combat!");
                            }
                            
                            const attackerData = attackerDoc.data();
                            const defenderData = defenderDoc.data();
                            
                            // Prevent attacking bots if you want, or allow it
                            // if (defenderData.isBot) {
                            //     throw new Error("You cannot attack bots!");
                            // }
                            
                            // Calculate attacker damage with enhanced system
                            let weaponBonus = 0;
                            let bestWeapon = null;
                            const inventory = attackerData.inventory || [];
                            inventory.forEach(item => {
                                const fullItem = gameItems[item.id];
                                if (fullItem && fullItem.isWeapon) {
                                    const weaponDamage = fullItem.weaponDamage || 0;
                                    if (weaponDamage > weaponBonus) {
                                        weaponBonus = weaponDamage;
                                        bestWeapon = fullItem;
                                    }
                                }
                            });
                            
                            combatMessages.length = 0;
                            
                            // Check if defender dodges
                            const dodgeChance = calculateDodge(defenderData);
                            const didDodge = Math.random() < dodgeChance;
                            
                            let attackerDamage = 0;
                            let newDefenderHp = defenderData.hp || defenderData.maxHp;
                            
                            if (didDodge) {
                                combatMessages.push({ msg: `${defenderData.name} dodges your attack!`, type: 'combat-log' });
                            } else {
                                // Calculate damage with all attributes
                                const attackResult = calculateDamage(attackerData, defenderData, weaponBonus, false);
                                attackerDamage = attackResult.damage;
                                newDefenderHp = (defenderData.hp || defenderData.maxHp) - attackerDamage;
                                
                                // Apply combat result with detailed logging
                                applyCombatResult(
                                    { ...attackResult, dodged: false },
                                    'You',
                                    defenderData.name,
                                    combatMessages
                                );
                            }
                            
                            // Broadcast to room
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} attacks ${defenderData.name}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            if (!didDodge && newDefenderHp <= 0) {
                                // Defender defeated
                                combatMessages.push({ msg: `You have defeated ${defenderData.name}!`, type: 'system' });
                                
                                // Attacker gains small XP reward and gold
                                const xpGain = Math.floor(defenderData.level * 10);
                                const goldGain = Math.floor(defenderData.money * 0.1) || 10;
                                
                                transaction.update(attackerRef, {
                                    xp: (attackerData.xp || 0) + xpGain,
                                    score: (attackerData.score || 0) + xpGain,
                                    money: (attackerData.money || 0) + goldGain
                                });
                                
                                combatMessages.push({ msg: `You gain ${xpGain} XP and ${goldGain} gold!`, type: 'loot-log' });
                                
                                // Defender dies - mark as dead in transaction
                                transaction.update(targetPlayerRef, {
                                    isDead: true,
                                    deathCause: `${playerName} in combat`,
                                    deathTimestamp: Date.now()
                                });
                                
                                // Notify defender of death (they'll see death choice on their screen)
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: defenderData.roomId,
                                    text: `DEATH_NOTICE:${playerName} in combat`,
                                    timestamp: serverTimestamp(),
                                    targetUserId: defenderData.userId
                                });
                                
                            } else if (!didDodge) {
                                // Defender survives, counter-attacks
                                transaction.update(targetPlayerRef, { hp: newDefenderHp });
                                
                                // Defender counter-attack with enhanced system
                                let defenderWeaponBonus = 0;
                                const defenderInventory = defenderData.inventory || [];
                                defenderInventory.forEach(item => {
                                    const fullItem = gameItems[item.id];
                                    if (fullItem && fullItem.isWeapon) {
                                        const weaponDamage = fullItem.weaponDamage || 0;
                                        if (weaponDamage > defenderWeaponBonus) {
                                            defenderWeaponBonus = weaponDamage;
                                        }
                                    }
                                });
                                
                                // Check if attacker dodges counter-attack
                                const attackerDodgeChance = calculateDodge(attackerData);
                                const attackerDodged = Math.random() < attackerDodgeChance;
                                
                                let defenderDamage = 0;
                                let newAttackerHp = attackerData.hp || attackerData.maxHp;
                                
                                if (attackerDodged) {
                                    combatMessages.push({ msg: `You dodge ${defenderData.name}'s counter-attack!`, type: 'combat-log' });
                                } else {
                                    // Calculate counter-attack damage
                                    const counterResult = calculateDamage(defenderData, attackerData, defenderWeaponBonus, false);
                                    defenderDamage = counterResult.damage;
                                    newAttackerHp = (attackerData.hp || attackerData.maxHp) - defenderDamage;
                                    
                                    let counterMsg = `${defenderData.name} counter-attacks for ${defenderDamage} damage`;
                                    if (counterResult.isCritical) {
                                        counterMsg += ` (Critical Hit!)`;
                                    }
                                    combatMessages.push({ msg: counterMsg + '!', type: 'combat-log' });
                                }
                                
                                if (!attackerDodged && newAttackerHp <= 0) {
                                    combatMessages.push({ msg: `You have been defeated by ${defenderData.name}!`, type: 'error' });
                                    transaction.update(attackerRef, {
                                        isDead: true,
                                        deathCause: `${defenderData.name} in combat`,
                                        deathTimestamp: Date.now()
                                    });
                                } else {
                                    transaction.update(attackerRef, { hp: newAttackerHp });
                                }
                                
                                // Notify defender they were attacked
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: currentPlayerRoomId,
                                    text: `${playerName} hit you for ${attackerDamage} damage! You counter-attacked for ${defenderDamage} damage.`,
                                    timestamp: serverTimestamp()
                                });
                            }
                        });
                        
                        // Log combat messages
                        for (const { msg, type } of combatMessages) {
                            logToTerminal(msg, type);
                        }
                        
                        // Check for level up
                        const attackerDocAfter = await getDoc(attackerRef);
                        if (attackerDocAfter.exists()) {
                            const attackerDataAfter = attackerDocAfter.data();
                            await checkLevelUp(attackerRef, attackerDataAfter.xp || 0, attackerDataAfter.level || 1);
                        }
                        
                    } catch (error) {
                        logToTerminal(`Combat failed: ${error.message}`, 'error');
                    }
                    break;
                }
                
                // Check for NPCs that can fight
                const npcToAttack = findNpcInRoom(targetName);
                if (npcToAttack && npcToAttack.canFight) {
                    // NPC combat - simpler than monster combat, no DB tracking needed
                    logToTerminal(`(Combat-capable NPCs are a work in progress. For now, use regular monsters for combat.)`, 'game');
                    logToTerminal(`${npcToAttack.shortName || npcToAttack.name} would fight back if combat was fully implemented!`, 'system');
                    break;
                }
                
                // Check for monsters
                const monsterToAttack = Object.entries(activeMonsters).find(([id, m]) => 
                    m.roomId === currentPlayerRoomId && 
                    !m.isDead &&  // Don't allow attacking corpses
                    targetName && 
                    (m.monsterId.toLowerCase().includes(targetName.toLowerCase()) || m.name.toLowerCase().includes(targetName.toLowerCase()))
                );

                if (!monsterToAttack) {
                    // Check if they're trying to attack a corpse
                    const deadMonster = Object.entries(activeMonsters).find(([id, m]) => 
                        m.roomId === currentPlayerRoomId && 
                        m.isDead &&
                        targetName && 
                        (m.monsterId.toLowerCase().includes(targetName.toLowerCase()) || m.name.toLowerCase().includes(targetName.toLowerCase()))
                    );
                    
                    if (deadMonster) {
                        logToTerminal(`The ${deadMonster[1].name} is already dead. Its corpse lies here.`, "error");
                        break;
                    }
                    
                    logToTerminal(`There's nothing here by the name "${targetName}" to attack.`, "error");
                    logToTerminal(`Available targets: Use 'who' to see players, 'look' to see monsters.`, "game");
                    break;
                }

                const [monsterInstanceId, monsterInstanceData] = monsterToAttack;
                const monsterRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${monsterInstanceId}`);
                
                // Collect combat messages to log after transaction
                const combatMessages = [];
                
                try {
                    await runTransaction(db, async (transaction) => {
                        const playerDoc = await transaction.get(playerRef);
                        const roomDoc = await transaction.get(roomRef);
                        const monsterDoc = await transaction.get(monsterRef);

                        if (!playerDoc.exists()) {
                            throw new Error("Your character data could not be found!");
                        }
                        
                        if (!monsterDoc.exists()) {
                            throw new Error("The monster has already been defeated or fled!");
                        }

                    const playerData = playerDoc.data();
                    const monsterData = monsterDoc.data();
                    const roomData = roomDoc.data();
                    const monsterTemplate = gameMonsters[monsterData.monsterId];
                    
                    // Add weapon damage bonus from inventory
                    let weaponBonus = 0;
                    let bestWeapon = null;
                    const inventory = playerData.inventory || [];
                    inventory.forEach(item => {
                        const fullItem = gameItems[item.id];
                        if (fullItem && fullItem.isWeapon) {
                            const weaponDamage = fullItem.weaponDamage || 0;
                            if (weaponDamage > weaponBonus) {
                                weaponBonus = weaponDamage;
                                bestWeapon = fullItem;
                            }
                        }
                    });
                    
                    // Clear messages array on each transaction retry
                    combatMessages.length = 0;
                    
                    // Create fake attributes for monster (they don't have full attribute system)
                    const monsterAsEntity = {
                        attributes: {
                            str: 10 + (monsterTemplate.maxAtk || 5),
                            dex: 10,
                            con: 10 + Math.floor((monsterTemplate.maxHp || 30) / 10),
                            int: 10,
                            wis: 10,
                            cha: 10
                        }
                    };
                    
                    // Check if monster dodges (monsters have basic dodge based on their difficulty)
                    const monsterDodgeChance = 0.05; // 5% base dodge for monsters
                    const monsterDodged = Math.random() < monsterDodgeChance;
                    
                    let playerDamage = 0;
                    let newMonsterHp = monsterData.hp;
                    
                    if (monsterDodged) {
                        // Use verbose dodge description for monster
                        const monsterDodgeMsg = getDodgeDescription(`the ${monsterData.name}`, 10, false);
                        combatMessages.push({ msg: monsterDodgeMsg, type: 'combat-log' });
                    } else {
                        // Calculate damage with enhanced combat system
                        const attackResult = calculateDamage(playerData, monsterAsEntity, weaponBonus, false);
                        
                        // Get weapon name for description
                        const weaponName = bestWeapon ? bestWeapon.name : null;
                        const attackVerb = parsedCommand.verb || 'attack';
                        
                        // Apply verbose combat result
                        const combatResult = applyVerboseCombatResult(
                            { ...attackResult, dodged: false, blocked: false },
                            'You',
                            `the ${monsterData.name}`,
                            combatMessages,
                            null, // monster doesn't have equipment
                            attackVerb,
                            weaponName
                        );
                        
                        playerDamage = combatResult.finalDamage;
                        newMonsterHp = monsterData.hp - playerDamage;
                    }
                    
                    if (newMonsterHp <= 0) {
                        combatMessages.push({ msg: `You have defeated the ${monsterData.name}!`, type: 'system' });
                        
                        // Don't delete - mark as dead corpse for 5000 seconds
                        transaction.update(monsterRef, {
                            isDead: true,
                            deathTimestamp: Date.now(),
                            hp: 0
                        });

                        const updates = {};
                        let xpGain = monsterTemplate.xp;
                        
                        // Track quest progress for monster kill
                        combatMessages.push({ 
                            msg: 'QUEST_PROGRESS', 
                            type: 'quest-check',
                            progressType: 'kill',
                            target: monsterData.monsterId
                        });
                        
                        // Apply guild experience bonus if in a guild
                        if (playerData.guildId && gameGuilds[playerData.guildId]) {
                            const guild = gameGuilds[playerData.guildId];
                            if (guild.perks && guild.perks.expBonus) {
                                const bonusPercent = guild.perks.expBonus;
                                const bonusXp = Math.floor(xpGain * (bonusPercent / 100));
                                xpGain += bonusXp;
                                combatMessages.push({ msg: `Guild bonus: +${bonusXp} XP (+${bonusPercent}%)`, type: 'system' });
                            }
                        }
                        
                        const newXp = (playerData.xp || 0) + xpGain;
                        const currentLevel = playerData.level || 1;
                        
                        updates.xp = newXp;
                        updates.score = (playerData.score || 0) + xpGain;
                        updates.money = (playerData.money || 0) + monsterTemplate.gold;
                        updates.monstersKilled = (playerData.monstersKilled || 0) + 1;

                        combatMessages.push({ msg: `You gain ${xpGain} XP and ${monsterTemplate.gold} gold.`, type: 'loot-log' });
                        
                        // Award guild experience
                        if (playerData.guildId && gameGuilds[playerData.guildId]) {
                            const guildExpGain = Math.floor(xpGain * 0.1); // Guild gets 10% of player XP
                            combatMessages.push({
                                msg: 'ADD_GUILD_EXP',
                                type: 'guild-exp',
                                guildId: playerData.guildId,
                                expGain: guildExpGain
                            });
                        }
                        
                        // Log to news if monster is newsworthy
                        if (monsterTemplate.newsworthy) {
                            // Store for logging after transaction
                            combatMessages.push({ 
                                msg: 'LOG_NEWS', 
                                type: 'news',
                                newsData: { type: 'kill', playerName, event: `defeated the ${monsterData.name}!` }
                            });
                        }
                        
                        // Handle old single itemDrop field (backwards compatibility)
                        if (monsterTemplate.itemDrop && gameItems[monsterTemplate.itemDrop]) {
                            const item = gameItems[monsterTemplate.itemDrop];
                            const droppedItem = { id: monsterTemplate.itemDrop, ...item };
                            updates.inventory = arrayUnion(droppedItem);
                            combatMessages.push({ msg: `The ${monsterData.name} dropped ${item.name}!`, type: 'loot-log' });
                        }
                        
                        // Handle new loot array with multiple items and quantities
                        let loot = monsterTemplate.loot;
                        if (typeof loot === 'string') {
                            try {
                                loot = JSON.parse(loot);
                            } catch (e) {
                                console.error('Failed to parse monster loot:', e);
                                loot = null;
                            }
                        }
                        
                        if (loot && Array.isArray(loot)) {
                            for (const lootEntry of loot) {
                                const { itemId, quantity = 1, dropRate = 100 } = lootEntry;
                                
                                // Check drop rate (0-100)
                                if (Math.random() * 100 <= dropRate && gameItems[itemId]) {
                                    const item = gameItems[itemId];
                                    
                                    // Add multiple copies if quantity > 1
                                    for (let i = 0; i < quantity; i++) {
                                        const droppedItem = { id: itemId, ...item };
                                        updates.inventory = arrayUnion(droppedItem);
                                    }
                                    
                                    const qtyText = quantity > 1 ? ` x${quantity}` : '';
                                    combatMessages.push({ msg: `The ${monsterData.name} dropped ${item.name}${qtyText}!`, type: 'loot-log' });
                                }
                            }
                        }
                        
                        // Mark spawn as defeated with timestamp - prevents immediate respawn
                        if (roomData.monsterSpawns) {
                            const spawnIndex = roomData.monsterSpawns.findIndex(s => s.monsterId === monsterData.monsterId);
                            if(spawnIndex > -1) {
                                const newSpawns = [...roomData.monsterSpawns];
                                newSpawns[spawnIndex].lastDefeated = Date.now();
                                transaction.update(roomRef, { monsterSpawns: newSpawns });
                                
                                combatMessages.push({ msg: `The ${monsterData.name}'s corpse lies at your feet.`, type: 'game' });
                            }
                        }
                        transaction.update(playerRef, updates);
                    } else if (!monsterDodged) {
                        // Monster survives and counter-attacks
                        transaction.update(monsterRef, { hp: newMonsterHp });
                        
                        // Check if player dodges monster's counter-attack
                        const playerDodgeChance = calculateDodge(playerData);
                        const playerDodged = Math.random() < playerDodgeChance;
                        
                        // Check if player blocks with shield
                        const playerBlockChance = calculateShieldBlock(playerData);
                        const playerBlocked = !playerDodged && Math.random() < playerBlockChance;
                        
                        let monsterDamage = 0;
                        let finalMonsterDamage = 0;
                        let newPlayerHp = playerData.hp || playerData.maxHp;
                        
                        if (playerDodged) {
                            // Player dodges - use verbose dodge description
                            const playerAttrs = getEffectiveAttributes(playerData);
                            const dodgeMsg = getDodgeDescription('You', playerAttrs.dex, true);
                            combatMessages.push({ msg: dodgeMsg, type: 'combat-log' });
                        } else {
                            // Calculate monster's counter-attack damage
                            const monsterCounterResult = calculateDamage(monsterAsEntity, playerData, 0, false);
                            monsterDamage = monsterCounterResult.damage;
                            
                            // Apply shield block if successful
                            if (playerBlocked) {
                                const shieldName = playerData.equippedShield ? gameItems[playerData.equippedShield]?.name : 'shield';
                                const blockMsg = getBlockDescription('You', 'shield', shieldName, true);
                                combatMessages.push({ msg: blockMsg, type: 'combat-log' });
                                
                                // Shield blocks reduce damage by 50-100%
                                const blockReduction = Math.floor(monsterDamage * (0.5 + Math.random() * 0.5));
                                finalMonsterDamage = Math.max(0, monsterDamage - blockReduction);
                                
                                if (finalMonsterDamage > 0) {
                                    combatMessages.push({ 
                                        msg: `Some of the impact gets through for ${finalMonsterDamage} damage!`, 
                                        type: 'combat-log' 
                                    });
                                } else {
                                    combatMessages.push({ 
                                        msg: `You completely block the attack!`, 
                                        type: 'combat-log' 
                                    });
                                }
                            } else {
                                // No block - apply armor reduction
                                const armorResult = calculateArmorReduction(playerData, monsterDamage);
                                finalMonsterDamage = Math.max(0, monsterDamage - armorResult.reduction);
                                
                                // Use verbose enemy attack description
                                const counterMsg = getVerboseEnemyAttackDescription(
                                    monsterData.name, 
                                    finalMonsterDamage, 
                                    'standard', 
                                    monsterCounterResult.isCritical
                                );
                                combatMessages.push({ msg: counterMsg, type: 'combat-log' });
                                
                                // Show armor deflection/reduction if applicable
                                if (armorResult.fullDeflect && armorResult.armorName) {
                                    const deflectMsg = getBlockDescription('You', 'armor', armorResult.armorName, true);
                                    combatMessages.push({ msg: deflectMsg, type: 'game' });
                                } else if (armorResult.reduction > 0 && armorResult.armorName) {
                                    combatMessages.push({ 
                                        msg: `(Your ${armorResult.armorName} absorbed ${armorResult.reduction} damage)`, 
                                        type: 'game' 
                                    });
                                }
                            }
                            
                            newPlayerHp = (playerData.hp || playerData.maxHp) - finalMonsterDamage;
                        }

                        if (!playerDodged && newPlayerHp <= 0) {
                            combatMessages.push({ msg: `You have been defeated by the ${monsterData.name}!`, type: 'error' });
                            transaction.update(playerRef, {
                                isDead: true,
                                deathCause: monsterData.name,
                                deathTimestamp: Date.now()
                            });
                        } else if (!playerDodged) {
                            transaction.update(playerRef, { hp: newPlayerHp });
                        }
                    }
                });
                
                    // Log all messages after transaction completes
                    for (const { msg, type, newsData, guildId, expGain, progressType, target } of combatMessages) {
                    if (type === 'news' && newsData) {
                        // Log news entry
                        await logNews(newsData.type, newsData.playerName, newsData.event);
                    } else if (type === 'guild-exp' && guildId && expGain) {
                        // Add guild experience
                        const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`);
                        await updateDoc(guildRef, {
                            exp: increment(expGain)
                        });
                        
                        // Check for guild level up
                        const guildDoc = await getDoc(guildRef);
                        if (guildDoc.exists()) {
                            const guildData = guildDoc.data();
                            const currentGuildLevel = guildData.level || 1;
                            const currentGuildExp = guildData.exp || 0;
                            const expNeeded = currentGuildLevel * 1000; // 1000 exp per level
                            
                            if (currentGuildExp >= expNeeded && currentGuildLevel < 10) {
                                await updateDoc(guildRef, {
                                    level: currentGuildLevel + 1,
                                    exp: currentGuildExp - expNeeded
                                });
                                logToTerminal(`🎉 Your guild "${guildData.name}" has reached level ${currentGuildLevel + 1}!`, 'success');
                            }
                        }
                    } else if (type === 'quest-check' && progressType && target) {
                        // Update quest progress
                        const completedQuests = await updateQuestProgress(userId, progressType, target, 1);
                        
                        // Notify player of completed quests
                        for (const completed of completedQuests) {
                            const quest = gameQuests[completed.questId];
                            if (quest) {
                                logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                            }
                        }
                    } else if (msg !== 'LOG_NEWS' && msg !== 'ADD_GUILD_EXP' && msg !== 'QUEST_PROGRESS') {
                        logToTerminal(msg, type);
                    }
                }
                
                    // Check for level up after combat
                    const playerDocAfterCombat = await getDoc(playerRef);
                    if (playerDocAfterCombat.exists()) {
                        const playerDataAfter = playerDocAfterCombat.data();
                        await checkLevelUp(playerRef, playerDataAfter.xp || 0, playerDataAfter.level || 1);
                    }
                } catch (error) {
                    logToTerminal(error.message || 'Combat failed due to an unexpected error.', 'error');
                    console.error('[Combat Error]', error);
                }
                break;
            
            case 'shoot':
                const shootTargetName = target;
                
                if (!shootTargetName) {
                    logToTerminal("Shoot who? Try 'shoot [name]' or 'shoot [name] with [weapon]'", "error");
                    break;
                }
                
                // Get player data to check inventory
                const shooterDoc = await getDoc(playerRef);
                if (!shooterDoc.exists()) {
                    logToTerminal("Error: Player data not found.", "error");
                    break;
                }
                const shooterData = shooterDoc.data();
                const inventory = shooterData.inventory || [];
                
                // Find ranged weapon in inventory
                let rangedWeapon = null;
                let ammunition = null;
                
                for (const invItem of inventory) {
                    const item = gameItems[invItem.id];
                    if (!item) continue;
                    
                    // Find a ranged weapon
                    if (item.isRanged && !rangedWeapon) {
                        rangedWeapon = { ...invItem, ...item };
                    }
                    
                    // Find matching ammunition
                    if (rangedWeapon && item.isAmmunition && item.ammoFor === rangedWeapon.id) {
                        ammunition = { ...invItem, ...item };
                        break; // Found both weapon and ammo
                    }
                }
                
                if (!rangedWeapon) {
                    logToTerminal("You don't have a ranged weapon equipped. Try 'get bow' or similar.", "error");
                    break;
                }
                
                if (!ammunition) {
                    logToTerminal(`You need ${rangedWeapon.ammoType || 'ammunition'} to use your ${rangedWeapon.name}.`, "error");
                    break;
                }
                
                // Check target is in range
                const weaponRange = rangedWeapon.range || 0;
                const shootTarget = findTargetInRange(shootTargetName, currentPlayerRoomId, weaponRange);
                
                if (!shootTarget) {
                    logToTerminal(`You don't see "${shootTargetName}" within range of your ${rangedWeapon.name}.`, "error");
                    break;
                }
                
                const isSameRoom = shootTarget.roomId === currentPlayerRoomId;
                const rangeDescription = isSameRoom ? 'at close range' : 'from a distance';
                
                // Handle player vs player ranged combat
                if (shootTarget.type === 'player') {
                    const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${shootTarget.id}`);
                    const shootCombatMessages = [];
                    
                    try {
                        await runTransaction(db, async (transaction) => {
                            const attackerDoc = await transaction.get(playerRef);
                            const defenderDoc = await transaction.get(targetPlayerRef);
                            
                            if (!attackerDoc.exists() || !defenderDoc.exists()) {
                                throw new Error("Player vanished during combat!");
                            }
                            
                            const attackerData = attackerDoc.data();
                            const defenderData = defenderDoc.data();
                            
                            // Calculate damage with ranged weapon bonus
                            const weaponBonus = rangedWeapon.weaponDamage || rangedWeapon.damage || 0;
                            
                            shootCombatMessages.length = 0;
                            
                            // Check if defender dodges
                            const dodgeChance = calculateDodge(defenderData);
                            const didDodge = Math.random() < dodgeChance;
                            
                            let attackerDamage = 0;
                            let newDefenderHp = defenderData.hp || defenderData.maxHp;
                            
                            if (didDodge) {
                                shootCombatMessages.push({ msg: `${defenderData.name} dodges your shot!`, type: 'combat-log' });
                            } else {
                                // Calculate ranged damage
                                const attackResult = calculateDamage(attackerData, defenderData, weaponBonus, false);
                                attackerDamage = attackResult.damage;
                                newDefenderHp = (defenderData.hp || defenderData.maxHp) - attackerDamage;
                                
                                let shootMsg = `You shoot ${defenderData.name} ${rangeDescription} with your ${rangedWeapon.name} for ${attackerDamage} damage`;
                                if (attackResult.isCritical) {
                                    shootMsg += ` (Critical Hit!)`;
                                }
                                shootCombatMessages.push({ msg: shootMsg + '!', type: 'combat-log' });
                            }
                            
                            // Consume 1 ammunition
                            const updatedInventory = attackerData.inventory.filter(item => {
                                if (item.id === ammunition.id) {
                                    // Remove one ammunition
                                    if (item.quantity && item.quantity > 1) {
                                        item.quantity -= 1;
                                        return true; // Keep in inventory with reduced quantity
                                    }
                                    return false; // Remove completely
                                }
                                return true;
                            });
                            transaction.update(playerRef, { inventory: updatedInventory });
                            
                            shootCombatMessages.push({ msg: `You used 1 ${ammunition.name}.`, type: 'game' });
                            
                            // Broadcast to current room
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} shoots ${isSameRoom ? '' : 'towards ' + gameWorld[shootTarget.roomId]?.title || 'another room'}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            // Broadcast to target room if different
                            if (!isSameRoom) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: shootTarget.roomId,
                                    text: `An arrow flies in and hits ${defenderData.name}!`,
                                    isEmote: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                            
                            if (!didDodge && newDefenderHp <= 0) {
                                // Defender defeated
                                shootCombatMessages.push({ msg: `You have defeated ${defenderData.name}!`, type: 'system' });
                                
                                const xpGain = Math.floor(defenderData.level * 10);
                                const goldGain = Math.floor(defenderData.money * 0.1) || 10;
                                
                                transaction.update(playerRef, {
                                    xp: (attackerData.xp || 0) + xpGain,
                                    score: (attackerData.score || 0) + xpGain,
                                    money: (attackerData.money || 0) + goldGain
                                });
                                
                                shootCombatMessages.push({ msg: `You gain ${xpGain} XP and ${goldGain} gold!`, type: 'loot-log' });
                                
                                transaction.update(targetPlayerRef, {
                                    isDead: true,
                                    deathCause: `${playerName} (ranged attack)`,
                                    deathTimestamp: Date.now()
                                });
                                
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: defenderData.roomId,
                                    text: `DEATH_NOTICE:${playerName} (ranged attack)`,
                                    timestamp: serverTimestamp(),
                                    targetUserId: defenderData.userId
                                });
                            } else if (!didDodge) {
                                transaction.update(targetPlayerRef, { hp: newDefenderHp });
                                
                                // Notify defender
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: shootTarget.roomId,
                                    text: `${playerName} shot you with a ${rangedWeapon.name} for ${attackerDamage} damage!`,
                                    timestamp: serverTimestamp()
                                });
                            }
                        });
                        
                        for (const { msg, type } of shootCombatMessages) {
                            logToTerminal(msg, type);
                        }
                        
                        // Check for level up
                        const attackerDocAfter = await getDoc(playerRef);
                        if (attackerDocAfter.exists()) {
                            const attackerDataAfter = attackerDocAfter.data();
                            await checkLevelUp(playerRef, attackerDataAfter.xp || 0, attackerDataAfter.level || 1);
                        }
                    } catch (error) {
                        logToTerminal(`Ranged combat failed: ${error.message}`, 'error');
                    }
                    break;
                }
                
                // Handle ranged combat with monsters
                if (shootTarget.type === 'monster') {
                    const monsterRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${shootTarget.id}`);
                    const monsterData = shootTarget.data;
                    const monsterTemplate = gameMonsters[monsterData.monsterId];
                    const shootMonsterMessages = [];
                    
                    try {
                        await runTransaction(db, async (transaction) => {
                            const playerDoc = await transaction.get(playerRef);
                            const monsterDoc = await transaction.get(monsterRef);
                            const roomDoc = await transaction.get(roomRef);
                            
                            if (!playerDoc.exists() || !monsterDoc.exists()) {
                                throw "Player or Monster vanished during the transaction!";
                            }
                            
                            const playerData = playerDoc.data();
                            const currentMonsterData = monsterDoc.data();
                            const roomData = roomDoc.data();
                            
                            const weaponBonus = rangedWeapon.weaponDamage || rangedWeapon.damage || 0;
                            
                            shootMonsterMessages.length = 0;
                            
                            // Monster dodge check
                            const monsterDodgeChance = 0.05;
                            const monsterDodged = Math.random() < monsterDodgeChance;
                            
                            let playerDamage = 0;
                            let newMonsterHp = currentMonsterData.hp;
                            
                            if (monsterDodged) {
                                const monsterDodgeMsg = getDodgeDescription(`the ${currentMonsterData.name}`, 10, false);
                                shootMonsterMessages.push({ msg: monsterDodgeMsg, type: 'combat-log' });
                            } else {
                                // Create fake attributes for monster
                                const monsterAsEntity = {
                                    attributes: {
                                        str: 10 + (monsterTemplate.maxAtk || 5),
                                        dex: 10,
                                        con: 10 + Math.floor((monsterTemplate.maxHp || 30) / 10),
                                        int: 10,
                                        wis: 10,
                                        cha: 10
                                    }
                                };
                                
                                const attackResult = calculateDamage(playerData, monsterAsEntity, weaponBonus, false);
                                playerDamage = attackResult.damage;
                                newMonsterHp = currentMonsterData.hp - playerDamage;
                                
                                let shootMsg = `You shoot the ${currentMonsterData.name} ${rangeDescription} with your ${rangedWeapon.name} for ${playerDamage} damage`;
                                if (attackResult.isCritical) {
                                    shootMsg += ` (Critical Hit!)`;
                                }
                                shootMonsterMessages.push({ msg: shootMsg + '!', type: 'combat-log' });
                            }
                            
                            // Consume ammunition
                            const updatedInventory = playerData.inventory.filter(item => {
                                if (item.id === ammunition.id) {
                                    if (item.quantity && item.quantity > 1) {
                                        item.quantity -= 1;
                                        return true;
                                    }
                                    return false;
                                }
                                return true;
                            });
                            transaction.update(playerRef, { inventory: updatedInventory });
                            
                            shootMonsterMessages.push({ msg: `You used 1 ${ammunition.name}.`, type: 'game' });
                            
                            // Broadcast to rooms
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} shoots ${isSameRoom ? 'at the ' + currentMonsterData.name : 'towards ' + (gameWorld[shootTarget.roomId]?.title || 'another room')}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            if (!isSameRoom) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: shootTarget.roomId,
                                    text: `An arrow flies in and strikes the ${currentMonsterData.name}!`,
                                    isEmote: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                            
                            if (newMonsterHp <= 0) {
                                // Monster defeated
                                shootMonsterMessages.push({ msg: `You have defeated the ${currentMonsterData.name}!`, type: 'system' });
                                transaction.delete(monsterRef);
                                
                                let xpGain = monsterTemplate.xp;
                                
                                // Quest progress
                                shootMonsterMessages.push({
                                    msg: 'QUEST_PROGRESS',
                                    type: 'quest-check',
                                    progressType: 'kill',
                                    target: currentMonsterData.monsterId
                                });
                                
                                // Guild bonus
                                if (playerData.guildId && gameGuilds[playerData.guildId]) {
                                    const guild = gameGuilds[playerData.guildId];
                                    if (guild.perks && guild.perks.expBonus) {
                                        const bonusPercent = guild.perks.expBonus;
                                        const bonusXp = Math.floor(xpGain * (bonusPercent / 100));
                                        xpGain += bonusXp;
                                        shootMonsterMessages.push({ msg: `Guild bonus: +${bonusXp} XP (+${bonusPercent}%)`, type: 'system' });
                                    }
                                }
                                
                                const updates = {
                                    xp: (playerData.xp || 0) + xpGain,
                                    score: (playerData.score || 0) + xpGain,
                                    money: (playerData.money || 0) + monsterTemplate.gold,
                                    monstersKilled: (playerData.monstersKilled || 0) + 1
                                };
                                
                                shootMonsterMessages.push({ msg: `You gain ${xpGain} XP and ${monsterTemplate.gold} gold.`, type: 'loot-log' });
                                
                                // Guild experience
                                if (playerData.guildId && gameGuilds[playerData.guildId]) {
                                    const guildExpGain = Math.floor(xpGain * 0.1);
                                    shootMonsterMessages.push({
                                        msg: 'ADD_GUILD_EXP',
                                        type: 'guild-exp',
                                        guildId: playerData.guildId,
                                        expGain: guildExpGain
                                    });
                                }
                                
                                // Handle old single itemDrop field (backwards compatibility)
                                if (monsterTemplate.itemDrop && gameItems[monsterTemplate.itemDrop]) {
                                    const item = gameItems[monsterTemplate.itemDrop];
                                    const droppedItem = { id: monsterTemplate.itemDrop, ...item };
                                    updates.inventory = arrayUnion(droppedItem);
                                    shootMonsterMessages.push({ msg: `The ${currentMonsterData.name} dropped ${item.name}!`, type: 'loot-log' });
                                }
                                
                                // Handle new loot array with multiple items and quantities
                                let loot = monsterTemplate.loot;
                                if (typeof loot === 'string') {
                                    try {
                                        loot = JSON.parse(loot);
                                    } catch (e) {
                                        console.error('Failed to parse monster loot:', e);
                                        loot = null;
                                    }
                                }
                                
                                if (loot && Array.isArray(loot)) {
                                    for (const lootEntry of loot) {
                                        const { itemId, quantity = 1, dropRate = 100 } = lootEntry;
                                        
                                        // Check drop rate (0-100)
                                        if (Math.random() * 100 <= dropRate && gameItems[itemId]) {
                                            const item = gameItems[itemId];
                                            
                                            // Add multiple copies if quantity > 1
                                            for (let i = 0; i < quantity; i++) {
                                                const droppedItem = { id: itemId, ...item };
                                                updates.inventory = arrayUnion(droppedItem);
                                            }
                                            
                                            const qtyText = quantity > 1 ? ` x${quantity}` : '';
                                            shootMonsterMessages.push({ msg: `The ${currentMonsterData.name} dropped ${item.name}${qtyText}!`, type: 'loot-log' });
                                        }
                                    }
                                }
                                
                                // Update spawn
                                if (roomData.monsterSpawns) {
                                    const spawnIndex = roomData.monsterSpawns.findIndex(s => s.monsterId === currentMonsterData.monsterId);
                                    if (spawnIndex > -1) {
                                        const newSpawns = [...roomData.monsterSpawns];
                                        newSpawns[spawnIndex].lastDefeated = Date.now();
                                        transaction.update(roomRef, { monsterSpawns: newSpawns });
                                        
                                        const corpseDescription = `The lifeless body of a ${currentMonsterData.name} lies here.`;
                                        const currentDetails = roomData.details || {};
                                        const newDetails = {
                                            ...currentDetails,
                                            [`${currentMonsterData.name.toLowerCase()} corpse`]: corpseDescription,
                                            corpse: corpseDescription
                                        };
                                        transaction.update(roomRef, { details: newDetails });
                                        
                                        shootMonsterMessages.push({ msg: `The ${currentMonsterData.name}'s corpse lies at your feet.`, type: 'game' });
                                    }
                                }
                                
                                transaction.update(playerRef, updates);
                            } else if (!monsterDodged) {
                                // Monster survives - update HP only (no counter-attack from range)
                                transaction.update(monsterRef, { hp: newMonsterHp });
                                shootMonsterMessages.push({ msg: `The ${currentMonsterData.name} is wounded but still alive.`, type: 'combat-log' });
                            }
                        });
                        
                        // Log messages
                        for (const { msg, type, guildId, expGain, progressType, target } of shootMonsterMessages) {
                            if (type === 'guild-exp' && guildId && expGain) {
                                const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`);
                                await updateDoc(guildRef, {
                                    exp: increment(expGain)
                                });
                                
                                const guildDoc = await getDoc(guildRef);
                                if (guildDoc.exists()) {
                                    const guildData = guildDoc.data();
                                    const currentGuildLevel = guildData.level || 1;
                                    const currentGuildExp = guildData.exp || 0;
                                    const expNeeded = currentGuildLevel * 1000;
                                    
                                    if (currentGuildExp >= expNeeded && currentGuildLevel < 10) {
                                        await updateDoc(guildRef, {
                                            level: currentGuildLevel + 1,
                                            exp: currentGuildExp - expNeeded
                                        });
                                        logToTerminal(`🎉 Your guild "${guildData.name}" has reached level ${currentGuildLevel + 1}!`, 'success');
                                    }
                                }
                            } else if (type === 'quest-check' && progressType && target) {
                                const completedQuests = await updateQuestProgress(userId, progressType, target, 1);
                                for (const completed of completedQuests) {
                                    const quest = gameQuests[completed.questId];
                                    if (quest) {
                                        logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                        logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                                    }
                                }
                            } else if (msg !== 'ADD_GUILD_EXP' && msg !== 'QUEST_PROGRESS') {
                                logToTerminal(msg, type);
                            }
                        }
                        
                        // Check for level up
                        const playerDocAfterCombat = await getDoc(playerRef);
                        if (playerDocAfterCombat.exists()) {
                            const playerDataAfter = playerDocAfterCombat.data();
                            await checkLevelUp(playerRef, playerDataAfter.xp || 0, playerDataAfter.level || 1);
                        }
                    } catch (error) {
                        logToTerminal(`Ranged combat failed: ${error.message}`, 'error');
                    }
                }
                break;
            
            case 'throw':
                // Parse: "throw <item> at <target>"
                // The target should be in parsedCommand.target
                // We need to extract the item name from the original command
                const throwMatch = parsedCommand.verb?.match(/throw\s+(.+?)\s+(?:at|to)\s+(.+)/i);
                let itemToThrowName = throwMatch ? throwMatch[1] : target; // Fallback to target if parsing fails
                const throwTargetName = throwMatch ? throwMatch[2] : null;
                
                if (!itemToThrowName || !throwTargetName) {
                    logToTerminal("Throw what at who? Try 'throw [item] at [target]'", "error");
                    break;
                }
                
                // Get player data
                const throwerDoc = await getDoc(playerRef);
                if (!throwerDoc.exists()) {
                    logToTerminal("Error: Player data not found.", "error");
                    break;
                }
                const throwerData = throwerDoc.data();
                const throwerInventory = throwerData.inventory || [];
                
                // Find item in inventory
                const itemToThrow = throwerInventory.find(invItem => {
                    const item = gameItems[invItem.id];
                    if (!item) return false;
                    return item.name.toLowerCase().includes(itemToThrowName.toLowerCase()) ||
                           invItem.id.toLowerCase().includes(itemToThrowName.toLowerCase());
                });
                
                if (!itemToThrow) {
                    logToTerminal(`You don't have "${itemToThrowName}" in your inventory.`, "error");
                    break;
                }
                
                const fullItemToThrow = { ...itemToThrow, ...gameItems[itemToThrow.id] };
                
                // Find target within throw range (range 1 = adjacent room)
                const throwRange = 1; // Throwing has fixed range of adjacent rooms
                const throwTarget = findTargetInRange(throwTargetName, currentPlayerRoomId, throwRange);
                
                if (!throwTarget) {
                    logToTerminal(`You don't see "${throwTargetName}" within throwing distance.`, "error");
                    break;
                }
                
                const isTargetInSameRoom = throwTarget.roomId === currentPlayerRoomId;
                
                // Calculate throw damage based on item
                // Base damage = weaponDamage if weapon, otherwise weight-based
                const throwBaseDamage = fullItemToThrow.weaponDamage || 
                                       (fullItemToThrow.isWeapon ? 5 : 2); // Non-weapons do minimal damage
                
                // Handle throwing at player
                if (throwTarget.type === 'player') {
                    const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${throwTarget.id}`);
                    const throwMessages = [];
                    
                    try {
                        await runTransaction(db, async (transaction) => {
                            const attackerDoc = await transaction.get(playerRef);
                            const defenderDoc = await transaction.get(targetPlayerRef);
                            const targetRoomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${throwTarget.roomId}`);
                            
                            if (!attackerDoc.exists() || !defenderDoc.exists()) {
                                throw new Error("Player vanished during throw!");
                            }
                            
                            const attackerData = attackerDoc.data();
                            const defenderData = defenderDoc.data();
                            
                            throwMessages.length = 0;
                            
                            // Check if defender dodges thrown item
                            const dodgeChance = calculateDodge(defenderData);
                            const didDodge = Math.random() < dodgeChance;
                            
                            let throwDamage = 0;
                            let newDefenderHp = defenderData.hp || defenderData.maxHp;
                            
                            if (didDodge) {
                                throwMessages.push({ msg: `${defenderData.name} dodges your thrown ${fullItemToThrow.name}!`, type: 'combat-log' });
                            } else {
                                // Calculate throw damage (DEX-based attack)
                                const attackerAttrs = getEffectiveAttributes(attackerData);
                                const defenderAttrs = getEffectiveAttributes(defenderData);
                                
                                // Throw attack uses DEX instead of STR
                                const attackRoll = Math.floor(Math.random() * 20) + 1;
                                const attackBonus = Math.floor((attackerAttrs.dex - 10) / 2);
                                const totalAttack = attackRoll + attackBonus;
                                
                                const defenseBonus = Math.floor((defenderAttrs.dex - 10) / 2);
                                
                                if (totalAttack > (10 + defenseBonus)) {
                                    // Hit!
                                    const damageRoll = Math.floor(Math.random() * throwBaseDamage) + 1;
                                    const dexBonus = Math.max(1, Math.floor((attackerAttrs.dex - 10) / 2));
                                    throwDamage = damageRoll + dexBonus;
                                    
                                    // Critical hit on attack roll 20
                                    if (attackRoll === 20) {
                                        throwDamage *= 2;
                                        throwMessages.push({ msg: `Critical Hit! You threw ${fullItemToThrow.name} for ${throwDamage} damage!`, type: 'combat-log' });
                                    } else {
                                        throwMessages.push({ msg: `You threw ${fullItemToThrow.name} at ${defenderData.name} for ${throwDamage} damage!`, type: 'combat-log' });
                                    }
                                    
                                    newDefenderHp = (defenderData.hp || defenderData.maxHp) - throwDamage;
                                } else {
                                    throwMessages.push({ msg: `Your thrown ${fullItemToThrow.name} misses ${defenderData.name}!`, type: 'combat-log' });
                                }
                            }
                            
                            // Remove item from thrower's inventory
                            const updatedInventory = attackerData.inventory.filter(item => {
                                if (item.id === itemToThrow.id) {
                                    // If stacked, reduce quantity
                                    if (item.quantity && item.quantity > 1) {
                                        item.quantity -= 1;
                                        return true;
                                    }
                                    return false; // Remove completely
                                }
                                return true;
                            });
                            transaction.update(playerRef, { inventory: updatedInventory });
                            
                            // Add item to target room floor
                            transaction.update(targetRoomRef, {
                                items: arrayUnion(itemToThrow.id)
                            });
                            
                            // Broadcast to current room
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} throws ${addArticle(fullItemToThrow.name)} ${isTargetInSameRoom ? 'at ' + defenderData.name : 'towards ' + (gameWorld[throwTarget.roomId]?.title || 'another room')}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            // Broadcast to target room if different
                            if (!isTargetInSameRoom) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: throwTarget.roomId,
                                    text: `${addArticle(fullItemToThrow.name, true)} flies in and ${didDodge || throwDamage === 0 ? 'misses' : 'hits'} ${defenderData.name}!`,
                                    isEmote: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                            
                            if (!didDodge && throwDamage > 0 && newDefenderHp <= 0) {
                                // Defender defeated
                                throwMessages.push({ msg: `You have defeated ${defenderData.name}!`, type: 'system' });
                                
                                const xpGain = Math.floor(defenderData.level * 5); // Less XP than melee
                                const goldGain = Math.floor(defenderData.money * 0.05) || 5;
                                
                                transaction.update(playerRef, {
                                    xp: (attackerData.xp || 0) + xpGain,
                                    score: (attackerData.score || 0) + xpGain,
                                    money: (attackerData.money || 0) + goldGain
                                });
                                
                                throwMessages.push({ msg: `You gain ${xpGain} XP and ${goldGain} gold!`, type: 'loot-log' });
                                
                                transaction.update(targetPlayerRef, {
                                    isDead: true,
                                    deathCause: `${playerName} (thrown ${fullItemToThrow.name})`,
                                    deathTimestamp: Date.now()
                                });
                                
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: defenderData.roomId,
                                    text: `DEATH_NOTICE:${playerName} (thrown weapon)`,
                                    timestamp: serverTimestamp(),
                                    targetUserId: defenderData.userId
                                });
                            } else if (!didDodge && throwDamage > 0) {
                                transaction.update(targetPlayerRef, { hp: newDefenderHp });
                                
                                // Notify defender
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: throwTarget.roomId,
                                    text: `${playerName} threw ${addArticle(fullItemToThrow.name)} at you for ${throwDamage} damage!`,
                                    timestamp: serverTimestamp()
                                });
                            }
                        });
                        
                        for (const { msg, type } of throwMessages) {
                            logToTerminal(msg, type);
                        }
                        
                        logToTerminal(`${fullItemToThrow.name} lands in ${gameWorld[throwTarget.roomId]?.title || 'the target room'}.`, 'game');
                    } catch (error) {
                        logToTerminal(`Throw failed: ${error.message}`, 'error');
                    }
                    break;
                }
                
                // Handle throwing at monster
                if (throwTarget.type === 'monster') {
                    const monsterRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${throwTarget.id}`);
                    const monsterData = throwTarget.data;
                    const monsterTemplate = gameMonsters[monsterData.monsterId];
                    const throwMonsterMessages = [];
                    
                    try {
                        await runTransaction(db, async (transaction) => {
                            const playerDoc = await transaction.get(playerRef);
                            const monsterDoc = await transaction.get(monsterRef);
                            const targetRoomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${throwTarget.roomId}`);
                            
                            if (!playerDoc.exists() || !monsterDoc.exists()) {
                                throw "Player or Monster vanished during throw!";
                            }
                            
                            const playerData = playerDoc.data();
                            const currentMonsterData = monsterDoc.data();
                            
                            throwMonsterMessages.length = 0;
                            
                            // Monster dodge check
                            const monsterDodgeChance = 0.05;
                            const monsterDodged = Math.random() < monsterDodgeChance;
                            
                            let throwDamage = 0;
                            let newMonsterHp = currentMonsterData.hp;
                            
                            if (monsterDodged) {
                                const monsterDodgeMsg = getDodgeDescription(`the ${currentMonsterData.name}`, 10, false);
                                throwMonsterMessages.push({ msg: monsterDodgeMsg, type: 'combat-log' });
                            } else {
                                // Calculate throw damage
                                const playerAttrs = getEffectiveAttributes(playerData);
                                const attackRoll = Math.floor(Math.random() * 20) + 1;
                                const attackBonus = Math.floor((playerAttrs.dex - 10) / 2);
                                
                                if ((attackRoll + attackBonus) > 10) {
                                    const damageRoll = Math.floor(Math.random() * throwBaseDamage) + 1;
                                    const dexBonus = Math.max(1, Math.floor((playerAttrs.dex - 10) / 2));
                                    throwDamage = damageRoll + dexBonus;
                                    
                                    if (attackRoll === 20) {
                                        throwDamage *= 2;
                                        throwMonsterMessages.push({ msg: `Critical Hit! You threw ${fullItemToThrow.name} at the ${currentMonsterData.name} for ${throwDamage} damage!`, type: 'combat-log' });
                                    } else {
                                        throwMonsterMessages.push({ msg: `You threw ${fullItemToThrow.name} at the ${currentMonsterData.name} for ${throwDamage} damage!`, type: 'combat-log' });
                                    }
                                    
                                    newMonsterHp = currentMonsterData.hp - throwDamage;
                                } else {
                                    throwMonsterMessages.push({ msg: `Your thrown ${fullItemToThrow.name} misses the ${currentMonsterData.name}!`, type: 'combat-log' });
                                }
                            }
                            
                            // Remove item from inventory
                            const updatedInventory = playerData.inventory.filter(item => {
                                if (item.id === itemToThrow.id) {
                                    if (item.quantity && item.quantity > 1) {
                                        item.quantity -= 1;
                                        return true;
                                    }
                                    return false;
                                }
                                return true;
                            });
                            transaction.update(playerRef, { inventory: updatedInventory });
                            
                            // Add item to target room floor
                            transaction.update(targetRoomRef, {
                                items: arrayUnion(itemToThrow.id)
                            });
                            
                            // Broadcast to rooms
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} throws ${addArticle(fullItemToThrow.name)} ${isTargetInSameRoom ? 'at the ' + currentMonsterData.name : 'towards ' + (gameWorld[throwTarget.roomId]?.title || 'another room')}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            if (!isTargetInSameRoom) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: userId,
                                    senderName: playerName,
                                    roomId: throwTarget.roomId,
                                    text: `${addArticle(fullItemToThrow.name, true)} flies in and ${monsterDodged || throwDamage === 0 ? 'misses' : 'strikes'} the ${currentMonsterData.name}!`,
                                    isEmote: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                            
                            if (!monsterDodged && throwDamage > 0 && newMonsterHp <= 0) {
                                // Monster defeated
                                throwMonsterMessages.push({ msg: `You have defeated the ${currentMonsterData.name}!`, type: 'system' });
                                transaction.delete(monsterRef);
                                
                                let xpGain = Math.floor(monsterTemplate.xp * 0.8); // 80% XP for throwing
                                
                                // Quest progress
                                throwMonsterMessages.push({
                                    msg: 'QUEST_PROGRESS',
                                    type: 'quest-check',
                                    progressType: 'kill',
                                    target: currentMonsterData.monsterId
                                });
                                
                                // Guild bonus
                                if (playerData.guildId && gameGuilds[playerData.guildId]) {
                                    const guild = gameGuilds[playerData.guildId];
                                    if (guild.perks && guild.perks.expBonus) {
                                        const bonusPercent = guild.perks.expBonus;
                                        const bonusXp = Math.floor(xpGain * (bonusPercent / 100));
                                        xpGain += bonusXp;
                                        throwMonsterMessages.push({ msg: `Guild bonus: +${bonusXp} XP (+${bonusPercent}%)`, type: 'system' });
                                    }
                                }
                                
                                const updates = {
                                    xp: (playerData.xp || 0) + xpGain,
                                    score: (playerData.score || 0) + xpGain,
                                    money: (playerData.money || 0) + monsterTemplate.gold,
                                    monstersKilled: (playerData.monstersKilled || 0) + 1
                                };
                                
                                throwMonsterMessages.push({ msg: `You gain ${xpGain} XP and ${monsterTemplate.gold} gold.`, type: 'loot-log' });
                                
                                // Guild experience
                                if (playerData.guildId && gameGuilds[playerData.guildId]) {
                                    const guildExpGain = Math.floor(xpGain * 0.1);
                                    throwMonsterMessages.push({
                                        msg: 'ADD_GUILD_EXP',
                                        type: 'guild-exp',
                                        guildId: playerData.guildId,
                                        expGain: guildExpGain
                                    });
                                }
                                
                                // Handle old single itemDrop field (backwards compatibility)
                                if (monsterTemplate.itemDrop && gameItems[monsterTemplate.itemDrop]) {
                                    const item = gameItems[monsterTemplate.itemDrop];
                                    const droppedItem = { id: monsterTemplate.itemDrop, ...item };
                                    updates.inventory = arrayUnion(droppedItem);
                                    throwMonsterMessages.push({ msg: `The ${currentMonsterData.name} dropped ${item.name}!`, type: 'loot-log' });
                                }
                                
                                // Handle new loot array with multiple items and quantities
                                let loot = monsterTemplate.loot;
                                if (typeof loot === 'string') {
                                    try {
                                        loot = JSON.parse(loot);
                                    } catch (e) {
                                        console.error('Failed to parse monster loot:', e);
                                        loot = null;
                                    }
                                }
                                
                                if (loot && Array.isArray(loot)) {
                                    for (const lootEntry of loot) {
                                        const { itemId, quantity = 1, dropRate = 100 } = lootEntry;
                                        
                                        // Check drop rate (0-100)
                                        if (Math.random() * 100 <= dropRate && gameItems[itemId]) {
                                            const item = gameItems[itemId];
                                            
                                            // Add multiple copies if quantity > 1
                                            for (let i = 0; i < quantity; i++) {
                                                const droppedItem = { id: itemId, ...item };
                                                updates.inventory = arrayUnion(droppedItem);
                                            }
                                            
                                            const qtyText = quantity > 1 ? ` x${quantity}` : '';
                                            throwMonsterMessages.push({ msg: `The ${currentMonsterData.name} dropped ${item.name}${qtyText}!`, type: 'loot-log' });
                                        }
                                    }
                                }
                                
                                transaction.update(playerRef, updates);
                            } else if (!monsterDodged && throwDamage > 0) {
                                // Monster survives
                                transaction.update(monsterRef, { hp: newMonsterHp });
                                throwMonsterMessages.push({ msg: `The ${currentMonsterData.name} is wounded but still alive.`, type: 'combat-log' });
                            }
                        });
                        
                        // Log messages
                        for (const { msg, type, guildId, expGain, progressType, target } of throwMonsterMessages) {
                            if (type === 'guild-exp' && guildId && expGain) {
                                const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`);
                                await updateDoc(guildRef, {
                                    exp: increment(expGain)
                                });
                                
                                const guildDoc = await getDoc(guildRef);
                                if (guildDoc.exists()) {
                                    const guildData = guildDoc.data();
                                    const currentGuildLevel = guildData.level || 1;
                                    const currentGuildExp = guildData.exp || 0;
                                    const expNeeded = currentGuildLevel * 1000;
                                    
                                    if (currentGuildExp >= expNeeded && currentGuildLevel < 10) {
                                        await updateDoc(guildRef, {
                                            level: currentGuildLevel + 1,
                                            exp: currentGuildExp - expNeeded
                                        });
                                        logToTerminal(`🎉 Your guild "${guildData.name}" has reached level ${currentGuildLevel + 1}!`, 'success');
                                    }
                                }
                            } else if (type === 'quest-check' && progressType && target) {
                                const completedQuests = await updateQuestProgress(userId, progressType, target, 1);
                                for (const completed of completedQuests) {
                                    const quest = gameQuests[completed.questId];
                                    if (quest) {
                                        logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                                        logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                                    }
                                }
                            } else if (msg !== 'ADD_GUILD_EXP' && msg !== 'QUEST_PROGRESS') {
                                logToTerminal(msg, type);
                            }
                        }
                        
                        logToTerminal(`${fullItemToThrow.name} lands in ${gameWorld[throwTarget.roomId]?.title || 'the target room'}.`, 'game');
                    } catch (error) {
                        logToTerminal(`Throw failed: ${error.message}`, 'error');
                    }
                }
                break;
            
            case 'talk':
                const npcToTalkTo = findNpcInRoom(npc_target);
                if(npcToTalkTo) {
                    // Check if player has completed quests to turn in to this NPC
                    const playerData = gamePlayers[userId];
                    const activeQuests = playerData.activeQuests || [];
                    const completedQuests = playerData.completedQuests || [];
                    
                    console.log(`[QUEST DEBUG] Talking to NPC:`, npcToTalkTo.id, `Active quests:`, activeQuests.length);
                    
                    // Find quests that are ready to turn in to this NPC
                    const readyToTurnIn = activeQuests.filter(aq => {
                        const quest = gameQuests[aq.questId];
                        if (!quest) {
                            console.log(`[QUEST DEBUG] Quest ${aq.questId} not found in gameQuests`);
                            return false;
                        }
                        
                        console.log(`[QUEST DEBUG] Checking quest ${quest.title}:`);
                        console.log(`  - Quest giver: ${quest.giverNpcId}, Turn-in: ${quest.turninNpcId || quest.giverNpcId}`);
                        console.log(`  - Current NPC: ${npcToTalkTo.id}`);
                        console.log(`  - Objectives:`, aq.objectives);
                        
                        // Check if this is the turn-in NPC
                        const turninNpc = quest.turninNpcId || quest.giverNpcId;
                        if (turninNpc !== npcToTalkTo.id) {
                            console.log(`  - NPC mismatch: ${turninNpc} !== ${npcToTalkTo.id}`);
                            return false;
                        }
                        
                        // Check if all objectives are complete - COUNT items for collect quests
                        const allComplete = aq.objectives.every(obj => {
                            if (obj.type === 'collect' && obj.itemId) {
                                // For collect quests, COUNT actual items in inventory AND inside containers
                                const playerInv = playerData.inventory || [];
                                let actualCount = playerInv.filter(i => i.id === obj.itemId).length;
                                
                                // Also count items inside containers
                                for (const invItem of playerInv) {
                                    if (invItem.contents && Array.isArray(invItem.contents)) {
                                        actualCount += invItem.contents.filter(i => i.id === obj.itemId).length;
                                    }
                                }
                                
                                console.log(`  - Collect objective: Need ${obj.count} ${obj.itemId}, have ${actualCount} in inventory`);
                                return actualCount >= obj.count;
                            } else {
                                // For other quest types, use stored progress
                                return obj.current >= obj.count;
                            }
                        });
                        console.log(`  - All objectives complete: ${allComplete}`);
                        return allComplete;
                    });
                    
                    // Auto turn-in completed quests
                    for (const questToTurnIn of readyToTurnIn) {
                        const quest = gameQuests[questToTurnIn.questId];
                        
                        // Remove collected items from player's inventory for collect objectives
                        for (const obj of questToTurnIn.objectives) {
                            if (obj.type === 'collect' && obj.itemId) {
                                const playerInv = playerData.inventory || [];
                                let itemsToRemove = obj.count;
                                const updatedInventory = [];
                                
                                // Remove items from main inventory and containers
                                for (const invItem of playerInv) {
                                    if (invItem.id === obj.itemId && itemsToRemove > 0) {
                                        // Skip this item (remove it)
                                        itemsToRemove--;
                                        continue;
                                    }
                                    
                                    // Check if item is a container with the quest items inside
                                    if (invItem.contents && Array.isArray(invItem.contents) && itemsToRemove > 0) {
                                        const updatedContents = [];
                                        for (const containedItem of invItem.contents) {
                                            if (containedItem.id === obj.itemId && itemsToRemove > 0) {
                                                // Skip this item (remove it from container)
                                                itemsToRemove--;
                                                continue;
                                            }
                                            updatedContents.push(containedItem);
                                        }
                                        // Keep the container with updated contents
                                        updatedInventory.push({ ...invItem, contents: updatedContents });
                                    } else {
                                        // Keep this item
                                        updatedInventory.push(invItem);
                                    }
                                }
                                
                                // Update player's inventory with items removed
                                const playerRefRemove = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
                                await updateDoc(playerRefRemove, { inventory: updatedInventory });
                                
                                console.log(`[QUEST] Removed ${obj.count} ${obj.itemId} from inventory`);
                            }
                        }
                        
                        // Check if this is a party quest
                        const playerParty = Object.values(gameParties).find(p => 
                            p.members && Object.keys(p.members).includes(userId)
                        );
                        
                        const isPartyQuest = quest.isPartyQuest && playerParty;
                        const rewardRecipients = isPartyQuest 
                            ? Object.keys(playerParty.members) 
                            : [userId];
                        
                        // Award rewards to all recipients (player or party members)
                        for (const recipientId of rewardRecipients) {
                            const recipientData = gamePlayers[recipientId];
                            if (!recipientData) continue;
                            
                            const recipientActiveQuests = recipientData.activeQuests || [];
                            const recipientCompletedQuests = recipientData.completedQuests || [];
                            
                            // Remove from active quests
                            const newActiveQuests = recipientActiveQuests.filter(aq => aq.questId !== questToTurnIn.questId);
                            
                            // Add to completed quests (unless repeatable)
                            const newCompletedQuests = quest.isRepeatable 
                                ? recipientCompletedQuests 
                                : [...recipientCompletedQuests, questToTurnIn.questId];
                            
                            // Award rewards - parse if string
                            let rewards = quest.rewards || {};
                            if (typeof rewards === 'string') {
                                try {
                                    rewards = JSON.parse(rewards);
                                } catch (e) {
                                    console.error('Failed to parse quest rewards:', e);
                                    rewards = {};
                                }
                            }
                            const updates = {
                                activeQuests: newActiveQuests,
                                completedQuests: newCompletedQuests
                            };
                            
                            if (rewards.xp) {
                                updates.xp = (recipientData.xp || 0) + rewards.xp;
                                updates.score = (recipientData.score || 0) + rewards.xp;
                            }
                            
                            if (rewards.gold) {
                                updates.money = (recipientData.money || 0) + rewards.gold;
                            }
                            
                            // Handle reward items - add them to inventory properly
                            if (rewards.items && Array.isArray(rewards.items)) {
                                const currentInventory = recipientData.inventory || [];
                                const newInventory = [...currentInventory];
                                
                                for (const itemId of rewards.items) {
                                    const item = gameItems[itemId];
                                    if (item) {
                                        const fullItemObject = { id: itemId, ...item };
                                        newInventory.push(fullItemObject);
                                    }
                                }
                                
                                updates.inventory = newInventory;
                            }
                            
                            const recipientRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${recipientId}`);
                            await updateDoc(recipientRef, updates);
                            
                            // Check for level up
                            if (rewards.xp) {
                                await checkLevelUp(recipientRef, updates.xp, recipientData.level || 1);
                            }
                            
                            // Notify recipient if not the current player
                            if (recipientId !== userId && recipientData.roomId) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: recipientData.roomId,
                                    text: `🎉 Party Quest Complete: ${quest.title}! You received ${rewards.xp || 0} XP and ${rewards.gold || 0} gold.`,
                                    isSystem: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                        }
                        
                        // Display quest completion to current player
                        logToTerminal(`\n🎉 Quest Complete: ${quest.title}!`, 'quest');
                        if (isPartyQuest) {
                            logToTerminal(`All party members have been rewarded!`, 'success');
                        }
                        logToTerminal(`${npcToTalkTo.shortName || npcToTalkTo.name} thanks you for your help.`, 'npc');
                        
                        // Reset room states if specified (for repeatable quests with pushables)
                        if (quest.resetsRoomStates && Array.isArray(quest.resetsRoomStates)) {
                            for (const roomId of quest.resetsRoomStates) {
                                const roomStateRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${roomId}`);
                                const roomStateSnap = await getDoc(roomStateRef);
                                if (roomStateSnap.exists()) {
                                    // Clear pushable states and revealed items
                                    await updateDoc(roomStateRef, {
                                        pushableStates: {},
                                        revealedItems: []
                                    });
                                    console.log(`[QUEST] Reset room state for ${roomId}`);
                                }
                            }
                        }
                        
                        // Parse rewards if it's a JSON string
                        let rewards = quest.rewards || {};
                        if (typeof rewards === 'string') {
                            try {
                                rewards = JSON.parse(rewards);
                            } catch (e) {
                                console.error('Failed to parse quest rewards:', e);
                                rewards = {};
                            }
                        }
                        if (rewards.xp) logToTerminal(`  Reward: +${rewards.xp} XP`, 'success');
                        if (rewards.gold) logToTerminal(`  Reward: +${rewards.gold} gold`, 'success');
                        if (rewards.items && rewards.items.length > 0) {
                            for (const itemId of rewards.items) {
                                const item = gameItems[itemId];
                                if (item) logToTerminal(`  Reward: ${item.name}`, 'success');
                            }
                        }
                    }
                    
                    // Check quest progress for talking to NPC
                    const talkCompletedQuests = await updateQuestProgress(userId, 'talk', npcToTalkTo.id, 1);
                    for (const completed of talkCompletedQuests) {
                        const quest = gameQuests[completed.questId];
                        if (quest) {
                            logToTerminal(`🎉 Quest Objectives Complete: ${quest.title}!`, 'quest');
                            logToTerminal(`Return to ${quest.turninNpcId || quest.giverNpcId} to claim your reward.`, 'quest');
                        }
                    }
                    
                    // Check for available quests from this NPC
                    const activeQuestsCheck = playerData.activeQuests || [];
                    const completedQuestsCheck = playerData.completedQuests || [];
                    const availableQuestsFromNpc = Object.values(gameQuests).filter(quest => {
                        if (quest.giverNpcId !== npcToTalkTo.id) return false;
                        if (quest.levelRequired && playerData.level < quest.levelRequired) return false;
                        if (activeQuestsCheck.some(aq => aq.questId === quest.id)) return false;
                        if (completedQuestsCheck.includes(quest.id) && !quest.isRepeatable) return false;
                        
                        // Check prerequisites
                        let prerequisites = quest.prerequisites;
                        if (typeof prerequisites === 'string') {
                            try {
                                prerequisites = JSON.parse(prerequisites);
                            } catch (e) {
                                prerequisites = [];
                            }
                        }
                        if (prerequisites && prerequisites.length > 0) {
                            if (!prerequisites.every(prereq => completedQuestsCheck.includes(prereq))) return false;
                        }
                        return true;
                    });
                    
                    // Show quest info for non-AI NPCs only
                    if (availableQuestsFromNpc.length > 0 && !npcToTalkTo.useAI) {
                        logToTerminal(`\n${npcToTalkTo.shortName || npcToTalkTo.name} has a quest for you!`, 'quest');
                        for (const quest of availableQuestsFromNpc) {
                            logToTerminal(`📜 ${quest.title}`, 'quest');
                            logToTerminal(`  ${quest.description}`, 'system');
                            logToTerminal(`  Type 'quest accept ${quest.title.toLowerCase()}' to accept this quest.`, 'hint');
                        }
                    }
                    
                    if (npcToTalkTo.useAI) {
                        await handleAiNpcInteraction(npcToTalkTo, 'talk', currentRoom, null, availableQuestsFromNpc);
                    } else {
                        lastNpcInteraction = null;
                        if (npcToTalkTo.dialogue && npcToTalkTo.dialogue.length > 0) {
                            const randomLine = npcToTalkTo.dialogue[Math.floor(Math.random() * npcToTalkTo.dialogue.length)];
                            logToTerminal(`${npcToTalkTo.shortName || npcToTalkTo.name} says, "${randomLine}"`, 'npc');
                        } else {
                            logToTerminal(`${npcToTalkTo.shortName || npcToTalkTo.name} doesn't seem to have much to say.`, 'game');
                        }
                    }
                } else {
                    logToTerminal("There's no one here by that name.", 'error');
                }
                break;
            case 'ask_npc':
                const npcToAsk = findNpcInRoom(npc_target);
                if (npcToAsk) {
                    if (npcToAsk.useAI) {
                        await handleAiNpcInteraction(npcToAsk, 'ask_npc', currentRoom, topic);
                    } else {
                        lastNpcInteraction = null;
                        logToTerminal(`${npcToAsk.shortName || npcToAsk.name} doesn't seem to have an answer for that.`, 'game');
                    }
                } else {
                    logToTerminal("There is no one here by that name to ask.", 'error');
                }
                break;
            case 'reply_npc':
                const lastNpc = gameNpcs[lastNpcInteraction];
                if (lastNpc) {
                     const npcData = { id: lastNpcInteraction, ...lastNpc };
                     await handleAiNpcInteraction(npcData, 'reply', currentRoom, cmdText);
                } else {
                     logToTerminal("You're not talking to anyone right now.", "error");
                }
                break;
            case 'who':
                logToTerminal("--- Adventurers Online ---", 'system');
                Object.entries(gamePlayers).forEach(([playerId, player]) => {
                    // Hide invisible admins (unless you're also an admin)
                    if (player.invisible && !gamePlayers[userId]?.isAdmin) {
                        return;
                    }
                    
                    const hp = player.hp || player.maxHp || 100;
                    const maxHp = player.maxHp || 100;
                    const hpPercent = Math.round((hp / maxHp) * 100);
                    const playerClass = player.class || 'Adventurer';
                    const levelName = getLevelName(player.level || 1, playerClass);
                    const isBot = player.isBot ? ' 🤖' : '';
                    const isInvisible = player.invisible ? ' 👻' : '';
                    const room = gameWorld[player.roomId];
                    const roomName = room ? room.name : 'Unknown';
                    const playerRace = player.race || 'Human';
                    
                    // Show guild tag if in a guild
                    let guildTag = '';
                    if (player.guildId && gameGuilds[player.guildId]) {
                        guildTag = ` <${gameGuilds[player.guildId].name}>`;
                    }
                    
                    let hpColor = 'game';
                    if (hpPercent < 30) hpColor = 'error';
                    else if (hpPercent < 70) hpColor = 'combat-log';
                    
                    logToTerminal(`${player.name}${isBot}${isInvisible}${guildTag} - ${playerRace} ${playerClass} - Level ${player.level} ${levelName} - HP: ${hp}/${maxHp} - ${roomName}`, hpColor);
                });
                break;
            case 'ask_dm':
                if (cmdText) {
                    const question = cmdText.substring(cmdText.indexOf(' ')).trim();
                    logToTerminal("You pose your question to the unseen forces of the realm...", "system");
                    const prompt = `You are a creative Dungeon Master... A player is in a room called "${currentRoom.name}"... They ask you: "${question}". Respond creatively and in-character. Keep it brief.`;
                    const answer = await callGeminiForText(prompt);
                    logToTerminal(answer, "dm");
                } else { logToTerminal("Ask what?", "error"); }
                break;
            case 'score':
                const pDocScore = await getDoc(playerRef);
                const pData = pDocScore.data();
                const level = pData.level || 1;
                const xp = pData.xp || 0;
                const score = pData.score || 0;
                const money = pData.money || 0;
                const hp = pData.hp || 10;
                const playerMaxHp = pData.maxHp || 100;
                const mp = pData.mp || 100;
                const playerMaxMp = pData.maxMp || 100;
                const playerRace = pData.race || 'Human';
                const playerClass = pData.class || 'Adventurer';
                
                const currentLevelXp = getXpForLevel(level, playerClass);
                const nextLevelXp = getXpForLevel(level + 1, playerClass);
                const xpProgress = xp - currentLevelXp;
                const xpNeeded = nextLevelXp - currentLevelXp;
                
                logToTerminal("--- Player Status ---", 'system');
                logToTerminal(`Name: ${playerName}`, 'game');
                logToTerminal(`Race: ${playerRace} | Class: ${playerClass}`, 'game');
                const levelName = getLevelName(level, playerClass);
                logToTerminal(`Level: ${level} - ${levelName}${level >= MAX_LEVEL ? ' (MAX)' : ''}`, 'game');
                logToTerminal(`HP: ${hp} / ${playerMaxHp}`, 'game');
                logToTerminal(`MP: ${mp} / ${playerMaxMp}`, 'game');
                
                // Show poison status if poisoned
                if (pData.poisonedUntil && pData.poisonedUntil > Date.now()) {
                    const timeLeft = Math.ceil((pData.poisonedUntil - Date.now()) / 1000);
                    logToTerminal(`💀 Status: POISONED (${timeLeft}s remaining, ${pData.poisonDamage || 5} damage per tick)`, 'error');
                }
                
                if (level < MAX_LEVEL) {
                    logToTerminal(`XP: ${xp} (${xpProgress} / ${xpNeeded} to level ${level + 1})`, 'game');
                    logToTerminal(`${nextLevelXp - xp} XP needed for next level`, 'game');
                } else {
                    logToTerminal(`XP: ${xp} (Maximum level reached!)`, 'game');
                }
                
                logToTerminal(`Gold: ${money}`, 'game');
                logToTerminal(`Score: ${score}`, 'game');
                break;
            case 'spells':
            case 'spell':
            case 'magic':
                const pDocSpells = await getDoc(playerRef);
                const pDataSpells = pDocSpells.data();
                const knownSpells = pDataSpells.knownSpells || [];
                
                if (knownSpells.length === 0) {
                    logToTerminal("You don't know any spells yet.", 'game');
                    logToTerminal("Spells can be learned from NPCs, found in books, or gained by leveling up.", 'system');
                } else {
                    logToTerminal("--- Your Spells ---", 'system');
                    logToTerminal(`MP: ${pDataSpells.mp || 0} / ${pDataSpells.maxMp || 0}`, 'game');
                    logToTerminal("", 'game');
                    
                    knownSpells.forEach(spellId => {
                        const spell = gameSpells[spellId];
                        if (spell) {
                            const costStr = `${spell.mpCost} MP`;
                            const targetStr = spell.targetType ? ` [${spell.targetType}]` : '';
                            
                            // Add level and class requirements to display
                            let reqStr = '';
                            if (spell.levelRequired && spell.levelRequired > 1) {
                                reqStr += ` (Lvl ${spell.levelRequired}+`;
                            }
                            if (spell.classRequired && spell.classRequired !== 'any') {
                                if (reqStr) {
                                    reqStr += `, ${spell.classRequired})`;
                                } else {
                                    reqStr += ` (${spell.classRequired})`;
                                }
                            } else if (reqStr) {
                                reqStr += ')';
                            }
                            
                            logToTerminal(`✨ ${spell.name} - ${costStr}${targetStr}${reqStr}`, 'game');
                            logToTerminal(`   ${spell.description}`, 'game');
                            if (spell.damage > 0) logToTerminal(`   Damage: ${spell.damage}`, 'game');
                            if (spell.healing > 0) logToTerminal(`   Healing: ${spell.healing}`, 'game');
                            if (spell.cooldown > 0) logToTerminal(`   Cooldown: ${spell.cooldown} turns`, 'game');
                        }
                    });
                    
                    logToTerminal("", 'game');
                    logToTerminal("Cast a spell with: cast [spell name] [target]", 'system');
                }
                break;
            case 'cast':
                if (!parsedCommand.target) {
                    logToTerminal("Cast which spell? (Type 'spells' to see your known spells)", 'error');
                    break;
                }
                
                // Get player data
                const pDocCast = await getDoc(playerRef);
                const pDataCast = pDocCast.data();
                const knownSpellsCast = pDataCast.knownSpells || [];
                const currentMp = pDataCast.mp || 0;
                const currentHp = pDataCast.hp || 0;
                const maxHpCast = pDataCast.maxHp || 100;
                
                // Find the spell (match by name or id)
                const spellName = parsedCommand.target.toLowerCase();
                const spellId = knownSpellsCast.find(id => {
                    const spell = gameSpells[id];
                    return spell && (spell.name.toLowerCase() === spellName || id.toLowerCase() === spellName);
                });
                
                if (!spellId) {
                    logToTerminal(`You don't know the spell "${parsedCommand.target}".`, 'error');
                    break;
                }
                
                const spell = gameSpells[spellId];
                
                // Check level requirement
                const playerLevelCast = pDataCast.level || 1;
                const playerClassCast = pDataCast.class || 'Adventurer';
                
                if (spell.levelRequired && playerLevelCast < spell.levelRequired) {
                    logToTerminal(`You need to be level ${spell.levelRequired} to cast ${spell.name}. (You are level ${playerLevelCast})`, 'error');
                    break;
                }
                
                // Check class requirement
                if (spell.classRequired && spell.classRequired !== 'any') {
                    // Support multiple classes (comma-separated)
                    const allowedClasses = spell.classRequired.split(',').map(c => c.trim());
                    if (!allowedClasses.includes(playerClassCast)) {
                        logToTerminal(`${spell.name} can only be cast by: ${spell.classRequired}. (You are a ${playerClassCast})`, 'error');
                        break;
                    }
                }
                
                // Check MP cost
                if (currentMp < spell.mpCost) {
                    logToTerminal(`You don't have enough MP to cast ${spell.name}. (Need ${spell.mpCost}, have ${currentMp})`, 'error');
                    break;
                }
                
                // Handle different target types
                let spellTargetName = parsedCommand.npc_target || "";
                let castSuccess = false;
                
                // Validate target for self-only spells
                if (spell.targetType === 'self' && spellTargetName) {
                    logToTerminal(`${spell.name} can only be cast on yourself. Try: cast ${spell.name}`, 'error');
                    break;
                }
                
                switch (spell.targetType) {
                    case 'self':
                        // Apply spell effects to self
                        if (spell.healing > 0) {
                            const newHp = Math.min(currentHp + spell.healing, maxHpCast);
                            const healAmount = newHp - currentHp;
                            // Phase 3: HP and MP are session data
                            await playerPersistence.updateSession(userId, {
                                hp: newHp,
                                mp: currentMp - spell.mpCost
                            });
                            logToTerminal(`You cast ${spell.name}!`, 'magic');
                            logToTerminal(`You heal yourself for ${healAmount} HP!`, 'success');
                        } else if (spell.statEffects && Object.keys(spell.statEffects).length > 0) {
                            logToTerminal(`You cast ${spell.name}!`, 'magic');
                            logToTerminal(`${spell.description}`, 'game');
                            // TODO: Implement stat buff system with duration
                            // Phase 3: MP is session data
                            await playerPersistence.updateSession(userId, { mp: currentMp - spell.mpCost });
                        }
                        castSuccess = true;
                        break;
                        
                    case 'single-enemy':
                        // Find monster in room
                        const monstersInRoom = Object.values(activeMonsters).filter(m => m.roomId === currentPlayerRoomId);
                        let targetMonster = null;
                        
                        if (spellTargetName) {
                            targetMonster = monstersInRoom.find(m => 
                                gameMonsters[m.monsterId]?.name.toLowerCase().includes(spellTargetName.toLowerCase())
                            );
                        } else if (monstersInRoom.length > 0) {
                            targetMonster = monstersInRoom[0]; // Target first monster if no name given
                        }
                        
                        if (!targetMonster) {
                            logToTerminal("There is no such enemy here to target.", 'error');
                            break;
                        }
                        
                        // Apply damage
                        const monsterTemplate = gameMonsters[targetMonster.monsterId];
                        const newMonsterHp = targetMonster.hp - spell.damage;
                        
                        logToTerminal(`You cast ${spell.name} at ${monsterTemplate.name}!`, 'magic');
                        logToTerminal(`${spell.name} deals ${spell.damage} damage!`, 'combat');
                        
                        if (newMonsterHp <= 0) {
                            // Monster defeated
                            await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${targetMonster.id}`));
                            logToTerminal(`${monsterTemplate.name} is destroyed by your magic!`, 'success');
                            
                            // Grant XP
                            const xpGain = monsterTemplate.xpReward || 10;
                            // Phase 3: XP is permanent, MP is session
                            await playerPersistence.syncToMySQL(userId, {
                                score: (pDataCast.score || 0) + xpGain
                            });
                            await playerPersistence.updateSession(userId, { mp: currentMp - spell.mpCost });
                            logToTerminal(`You gained ${xpGain} XP!`, 'success');
                            
                            // Add corpse and mark spawn as defeated
                            const roomRefSpell = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${currentPlayerRoomId}`);
                            const roomDocSpell = await getDoc(roomRefSpell);
                            if (roomDocSpell.exists()) {
                                const roomDataSpell = roomDocSpell.data();
                                if (roomDataSpell.monsterSpawns) {
                                    const spawnIndex = roomDataSpell.monsterSpawns.findIndex(s => s.monsterId === targetMonster.monsterId);
                                    if (spawnIndex > -1) {
                                        const newSpawns = [...roomDataSpell.monsterSpawns];
                                        newSpawns[spawnIndex].lastDefeated = Date.now();
                                        
                                        // Add corpse detail
                                        const corpseDescription = `The lifeless body of a ${monsterTemplate.name} lies here.`;
                                        const currentDetails = roomDataSpell.details || {};
                                        const newDetails = {
                                            ...currentDetails,
                                            [`${monsterTemplate.name.toLowerCase()} corpse`]: corpseDescription,
                                            corpse: corpseDescription
                                        };
                                        
                                        await updateDoc(roomRefSpell, { 
                                            monsterSpawns: newSpawns,
                                            details: newDetails
                                        });
                                        
                                        logToTerminal(`The ${monsterTemplate.name}'s corpse lies smoldering on the ground.`, 'game');
                                    }
                                }
                            }
                            
                            await checkLevelUp();
                        } else {
                            // Monster survives
                            await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${targetMonster.id}`), {
                                hp: newMonsterHp
                            });
                            // Phase 3: MP is session data
                            await playerPersistence.updateSession(userId, { mp: currentMp - spell.mpCost });
                        }
                        castSuccess = true;
                        break;
                        
                    case 'single-ally':
                        // Find player in room to heal
                        if (!spellTargetName) {
                            // No target specified, heal self
                            const newHpAlly = Math.min(currentHp + spell.healing, maxHpCast);
                            const healAmountAlly = newHpAlly - currentHp;
                            // Phase 3: HP and MP are session data
                            await playerPersistence.updateSession(userId, {
                                hp: newHpAlly,
                                mp: currentMp - spell.mpCost
                            });
                            logToTerminal(`You cast ${spell.name} on yourself!`, 'magic');
                            logToTerminal(`You heal yourself for ${healAmountAlly} HP!`, 'success');
                            castSuccess = true;
                        } else {
                            // Find target player in the same room
                            const targetPlayerName = spellTargetName.toLowerCase();
                            const playersInRoom = Object.entries(gamePlayers).filter(([id, player]) => 
                                player.roomId === currentPlayerRoomId && 
                                player.name.toLowerCase().includes(targetPlayerName)
                            );
                            
                            if (playersInRoom.length === 0) {
                                logToTerminal(`There is no player named "${spellTargetName}" here.`, 'error');
                                castSuccess = false;
                                break;
                            }
                            
                            const [targetPlayerId, targetPlayerData] = playersInRoom[0];
                            const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${targetPlayerId}`);
                            
                            // Get target's current HP
                            const targetDoc = await getDoc(targetPlayerRef);
                            const targetData = targetDoc.data();
                            const targetCurrentHp = targetData.hp || 0;
                            const targetMaxHp = targetData.maxHp || 100;
                            
                            // Calculate healing
                            const newTargetHp = Math.min(targetCurrentHp + spell.healing, targetMaxHp);
                            const healAmountTarget = newTargetHp - targetCurrentHp;
                            
                            if (healAmountTarget <= 0) {
                                logToTerminal(`${targetPlayerData.name} is already at full health!`, 'error');
                                castSuccess = false;
                                break;
                            }
                            
                            // Phase 3: HP is session data for both players
                            // Update target's HP
                            await playerPersistence.updateSession(targetPlayerId, {
                                hp: newTargetHp
                            });
                            
                            // Deduct caster's MP
                            await playerPersistence.updateSession(userId, {
                                mp: currentMp - spell.mpCost
                            });
                            
                            // Messages for caster
                            logToTerminal(`You cast ${spell.name} on ${targetPlayerData.name}!`, 'magic');
                            logToTerminal(`${targetPlayerData.name} is healed for ${healAmountTarget} HP!`, 'success');
                            
                            // Send message to target player via room messages
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} casts ${spell.name} on you! You are healed for ${healAmountTarget} HP!`,
                                isEmote: false,
                                timestamp: serverTimestamp()
                            });
                            
                            // Send visible message to room
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: currentPlayerRoomId,
                                text: `${playerName} casts ${spell.name} on ${targetPlayerData.name}!`,
                                isEmote: true,
                                timestamp: serverTimestamp()
                            });
                            
                            castSuccess = true;
                        }
                        break;
                        
                    case 'all-enemies':
                        const allMonstersInRoom = Object.values(activeMonsters).filter(m => m.roomId === currentPlayerRoomId);
                        if (allMonstersInRoom.length === 0) {
                            logToTerminal("There are no enemies here to target.", 'error');
                            break;
                        }
                        
                        logToTerminal(`You cast ${spell.name}!`, 'magic');
                        logToTerminal(`${spell.description}`, 'game');
                        
                        for (const monster of allMonstersInRoom) {
                            const monsterTpl = gameMonsters[monster.monsterId];
                            const newHpAoE = monster.hp - spell.damage;
                            logToTerminal(`${monsterTpl.name} takes ${spell.damage} damage!`, 'combat');
                            
                            if (newHpAoE <= 0) {
                                await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${monster.id}`));
                                logToTerminal(`${monsterTpl.name} is destroyed!`, 'success');
                            } else {
                                await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${monster.id}`), {
                                    hp: newHpAoE
                                });
                            }
                        }
                        
                        // Phase 3: MP is session data
                        await playerPersistence.updateSession(userId, { mp: currentMp - spell.mpCost });
                        castSuccess = true;
                        break;
                        
                    case 'all-allies':
                        // Heal all players in the room (including self)
                        const allPlayersInRoom = Object.entries(gamePlayers).filter(([id, player]) => 
                            player.roomId === currentPlayerRoomId
                        );
                        
                        if (allPlayersInRoom.length === 0) {
                            logToTerminal("There are no allies here to heal.", 'error');
                            break;
                        }
                        
                        logToTerminal(`You cast ${spell.name}!`, 'magic');
                        logToTerminal(`${spell.description}`, 'game');
                        
                        let healedCount = 0;
                        for (const [allyId, allyData] of allPlayersInRoom) {
                            const allyRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${allyId}`);
                            const allyDoc = await getDoc(allyRef);
                            const allyCurrentData = allyDoc.data();
                            
                            const allyCurrentHp = allyCurrentData.hp || 0;
                            const allyMaxHp = allyCurrentData.maxHp || 100;
                            const newAllyHp = Math.min(allyCurrentHp + spell.healing, allyMaxHp);
                            const healAmount = newAllyHp - allyCurrentHp;
                            
                            if (healAmount > 0) {
                                await updateDoc(allyRef, { hp: newAllyHp });
                                logToTerminal(`${allyData.name} is healed for ${healAmount} HP!`, 'success');
                                healedCount++;
                                
                                // Notify the healed player (if not self)
                                if (allyId !== userId) {
                                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                        senderId: userId,
                                        senderName: playerName,
                                        roomId: currentPlayerRoomId,
                                        text: `${playerName}'s ${spell.name} heals you for ${healAmount} HP!`,
                                        isEmote: false,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            }
                        }
                        
                        // Send visible message to room
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: userId,
                            senderName: playerName,
                            roomId: currentPlayerRoomId,
                            text: `${playerName} casts ${spell.name}, healing everyone nearby!`,
                            isEmote: true,
                            timestamp: serverTimestamp()
                        });
                        
                        await updateDoc(playerRef, { mp: currentMp - spell.mpCost });
                        
                        if (healedCount === 0) {
                            logToTerminal("Everyone is already at full health!", 'game');
                        }
                        
                        castSuccess = true;
                        break;
                        
                    default:
                        logToTerminal("This spell type is not yet implemented.", 'error');
                        break;
                }
                
                if (castSuccess && spell.specialEffects) {
                    logToTerminal(spell.specialEffects, 'game');
                }
                break;
            case 'learn':
                if (!parsedCommand.target) {
                    logToTerminal("Learn which spell?", 'error');
                    break;
                }
                
                // Admin command to learn any spell
                const pDocLearn = await getDoc(playerRef);
                const pDataLearn = pDocLearn.data();
                
                if (!pDataLearn.isAdmin) {
                    logToTerminal("You can only learn spells from NPCs, books, or by leveling up.", 'error');
                    break;
                }
                
                const learnSpellName = parsedCommand.target.toLowerCase();
                const learnSpellId = Object.keys(gameSpells).find(id => 
                    gameSpells[id].name.toLowerCase() === learnSpellName || id.toLowerCase() === learnSpellName
                );
                
                if (!learnSpellId) {
                    logToTerminal(`Spell "${parsedCommand.target}" not found.`, 'error');
                    break;
                }
                
                const currentKnownSpells = pDataLearn.knownSpells || [];
                if (currentKnownSpells.includes(learnSpellId)) {
                    logToTerminal(`You already know ${gameSpells[learnSpellId].name}.`, 'error');
                    break;
                }
                
                // Phase 3: Known spells are permanent data
                await playerPersistence.syncToMySQL(userId, {
                    knownSpells: [...currentKnownSpells, learnSpellId]
                });
                
                logToTerminal(`You have learned ${gameSpells[learnSpellId].name}!`, 'success');
                logToTerminal(`${gameSpells[learnSpellId].description}`, 'game');
                break;
            case 'stats':
                const pDocStats = await getDoc(playerRef);
                const pDataStats = pDocStats.data();
                if (pDataStats && pDataStats.attributes) {
                    const statsLevel = pDataStats.level || 1;
                    const statsHp = pDataStats.hp || 10;
                    const statsMaxHp = pDataStats.maxHp || 100;
                    const statsClass = pDataStats.class || 'Adventurer';
                    
                    logToTerminal("--- Your Attributes ---", 'system');
                    logToTerminal(`Level: ${statsLevel} - ${getLevelName(statsLevel, statsClass)}`, 'game');
                    logToTerminal(`HP: ${statsHp} / ${statsMaxHp}`, 'game');
                    logToTerminal("", 'game'); // Blank line
                    
                    // Check for guild stat bonuses
                    let guildBonuses = {};
                    if (pDataStats.guildId && gameGuilds[pDataStats.guildId]) {
                        const guild = gameGuilds[pDataStats.guildId];
                        if (guild.perks && guild.perks.statBonus) {
                            guildBonuses = guild.perks.statBonus;
                        }
                    }
                    
                    Object.entries(pDataStats.attributes).forEach(([key, value]) => {
                        const bonus = guildBonuses[key] || 0;
                        const totalValue = value + bonus;
                        const bonusText = bonus > 0 ? ` (+${bonus} guild bonus)` : '';
                        logToTerminal(`${key.toUpperCase()}: ${totalValue}${bonusText}`, bonus > 0 ? 'success' : 'game');
                    });
                    
                    if (Object.keys(guildBonuses).length > 0) {
                        logToTerminal("", 'game');
                        logToTerminal(`Guild perks active!`, 'system');
                    }
                } else { logToTerminal("You have no attributes to display.", 'error'); }
                break;
            case 'news':
                try {
                    const newsRef = collection(db, `/artifacts/${appId}/public/data/mud-news`);
                    const newsQuery = query(newsRef, orderBy('timestamp', 'desc'), limit(20));
                    const newsSnapshot = await getDocs(newsQuery);
                    
                    if (newsSnapshot.empty) {
                        logToTerminal("No news to report yet!", 'game');
                    } else {
                        logToTerminal("--- Recent News ---", 'system');
                        newsSnapshot.forEach(doc => {
                            const newsItem = doc.data();
                            const timeAgo = getTimeAgo(newsItem.timestamp);
                            const icon = newsItem.icon || '📰';
                            logToTerminal(`${icon} ${newsItem.playerName} ${newsItem.event} (${timeAgo})`, 'game');
                        });
                    }
                } catch (error) {
                    console.error('Error fetching news:', error);
                    logToTerminal("Error loading news feed.", 'error');
                }
                break;
            
            // ===== GUILD COMMANDS =====
            case 'guild':
            case 'guilds':
                // Main guild command - show guild info or subcommands
                if (!target) {
                    // Show player's guild info or available commands
                    const pDocGuild = await getDoc(playerRef);
                    const pDataGuild = pDocGuild.data();
                    const playerGuildId = pDataGuild.guildId;
                    
                    if (playerGuildId) {
                        // Get guild data - fetch from Firebase if not in cache
                        let guild = gameGuilds[playerGuildId];
                        if (!guild) {
                            const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${playerGuildId}`);
                            const guildSnap = await getDoc(guildRef);
                            if (guildSnap.exists()) {
                                guild = guildSnap.data();
                            }
                        }
                        
                        if (guild) {
                            logToTerminal(`=== ${guild.name} ===`, 'system');
                            logToTerminal(`${guild.description || 'A mighty guild'}`, 'game');
                            logToTerminal(`Level: ${guild.level || 1} (${guild.exp || 0}/${(guild.level || 1) * 1000} XP)`, 'game');
                            logToTerminal(`Leader: ${guild.leader}`, 'game');
                            logToTerminal(`Members: ${Object.keys(guild.members || {}).length}`, 'game');
                            logToTerminal(`Treasury: ${guild.treasury || 0} gold`, 'game');
                            if (guild.motto) logToTerminal(`Motto: "${guild.motto}"`, 'game');
                            
                            // Show guild perks
                            if (guild.perks) {
                                logToTerminal(`\nGuild Perks:`, 'system');
                                if (guild.perks.expBonus) logToTerminal(`  +${guild.perks.expBonus}% Experience`, 'success');
                                if (guild.perks.statBonus) {
                                    const statBonuses = Object.entries(guild.perks.statBonus)
                                        .map(([stat, bonus]) => `${stat.toUpperCase()}: +${bonus}`)
                                        .join(', ');
                                    logToTerminal(`  Stat Bonuses: ${statBonuses}`, 'success');
                                }
                            }
                            
                            logToTerminal(`\nMembers:`, 'system');
                            Object.entries(guild.members || {}).forEach(([memberId, memberData]) => {
                                const rankSymbol = memberData.rank === 'leader' ? '👑' : memberData.rank === 'officer' ? '⭐' : '•';
                                logToTerminal(`${rankSymbol} ${memberData.name} (${memberData.rank})`, 'game');
                            });
                        } else {
                            logToTerminal("Your guild data seems corrupted.", 'error');
                        }
                    } else {
                        logToTerminal("You are not in a guild.", 'game');
                        logToTerminal("Commands: 'guild create [name]', 'guild list'", 'system');
                    }
                } else {
                    // Handle subcommands
                    const subCommand = target.toLowerCase();
                    const guildArg = npc_target || "";
                    
                    switch (subCommand) {
                        case 'create':
                            if (!guildArg) {
                                logToTerminal("Usage: guild create [guild name]", 'error');
                                break;
                            }
                            
                            const pDocCreate = await getDoc(playerRef);
                            const pDataCreate = pDocCreate.data();
                            
                            if (pDataCreate.guildId) {
                                logToTerminal("You're already in a guild. Leave it first with 'guild leave'.", 'error');
                                break;
                            }
                            
                            // Check if guild name is taken
                            const existingGuild = Object.values(gameGuilds).find(g => 
                                g.name.toLowerCase() === guildArg.toLowerCase()
                            );
                            
                            if (existingGuild) {
                                logToTerminal("A guild with that name already exists.", 'error');
                                break;
                            }
                            
                            // Create the guild
                            const guildId = `guild-${Date.now()}`;
                            const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`);
                            
                            await setDoc(guildRef, {
                                name: guildArg,
                                leader: playerName,
                                leaderId: userId,
                                members: {
                                    [userId]: {
                                        name: playerName,
                                        rank: 'leader',
                                        joinedAt: serverTimestamp()
                                    }
                                },
                                treasury: 0,
                                createdAt: serverTimestamp()
                            });
                            
                            // Update player's guild
                            await updateDoc(playerRef, { guildId: guildId });
                            
                            logToTerminal(`Guild "${guildArg}" has been created! You are the guild leader.`, 'success');
                            logToTerminal("Use 'guild invite [player]' to invite members.", 'system');
                            break;
                        
                        case 'list':
                            const allGuilds = Object.values(gameGuilds);
                            if (allGuilds.length === 0) {
                                logToTerminal("No guilds exist yet. Be the first! Use 'guild create [name]'", 'game');
                            } else {
                                logToTerminal("=== Active Guilds ===", 'system');
                                allGuilds.forEach(g => {
                                    const memberCount = Object.keys(g.members || {}).length;
                                    logToTerminal(`${g.name} - ${memberCount} members (Leader: ${g.leader})`, 'game');
                                });
                            }
                            break;
                        
                        case 'invite':
                            if (!guildArg) {
                                logToTerminal("Usage: guild invite [player name]", 'error');
                                break;
                            }
                            
                            const pDocInvite = await getDoc(playerRef);
                            const pDataInvite = pDocInvite.data();
                            const inviterGuildId = pDataInvite.guildId;
                            
                            if (!inviterGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            // Get guild data - fetch from Firebase if not in cache
                            let inviterGuild = gameGuilds[inviterGuildId];
                            if (!inviterGuild) {
                                const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${inviterGuildId}`);
                                const guildSnap = await getDoc(guildRef);
                                if (!guildSnap.exists()) {
                                    logToTerminal("Your guild no longer exists.", 'error');
                                    break;
                                }
                                inviterGuild = guildSnap.data();
                            }
                            
                            const inviterMember = inviterGuild.members?.[userId];
                            
                            if (!inviterMember || (inviterMember.rank !== 'leader' && inviterMember.rank !== 'officer')) {
                                logToTerminal("Only guild leaders and officers can invite members.", 'error');
                                break;
                            }
                            
                            // Find target player
                            const targetPlayerEntry = Object.entries(gamePlayers).find(([id, p]) => 
                                p.name.toLowerCase() === guildArg.toLowerCase()
                            );
                            
                            if (!targetPlayerEntry) {
                                logToTerminal(`Player "${guildArg}" not found.`, 'error');
                                break;
                            }
                            
                            const [targetPlayerId, targetPlayer] = targetPlayerEntry;
                            
                            if (targetPlayer.guildId) {
                                logToTerminal(`${targetPlayer.name} is already in a guild.`, 'error');
                                break;
                            }
                            
                            // Add invite to target player's pending invites
                            const targetPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${targetPlayerId}`);
                            await updateDoc(targetPlayerRef, {
                                guildInvites: arrayUnion({
                                    guildId: inviterGuildId,
                                    guildName: inviterGuild.name,
                                    invitedBy: playerName,
                                    timestamp: Date.now()
                                })
                            });
                            
                            logToTerminal(`Guild invitation sent to ${targetPlayer.name}.`, 'success');
                            
                            // Notify the target player
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                roomId: targetPlayer.roomId,
                                text: `You have been invited to join "${inviterGuild.name}" by ${playerName}. Use 'guild accept ${inviterGuild.name}' to join.`,
                                recipientId: targetPlayerId,
                                timestamp: serverTimestamp()
                            });
                            break;
                        
                        case 'accept':
                            if (!guildArg) {
                                logToTerminal("Usage: guild accept [guild name]", 'error');
                                break;
                            }
                            
                            const pDocAccept = await getDoc(playerRef);
                            const pDataAccept = pDocAccept.data();
                            const pendingInvites = pDataAccept.guildInvites || [];
                            
                            const matchingInvite = pendingInvites.find(inv => 
                                inv.guildName.toLowerCase() === guildArg.toLowerCase()
                            );
                            
                            if (!matchingInvite) {
                                logToTerminal(`You don't have an invitation from "${guildArg}".`, 'error');
                                break;
                            }
                            
                            if (pDataAccept.guildId) {
                                logToTerminal("You're already in a guild. Leave it first with 'guild leave'.", 'error');
                                break;
                            }
                            
                            // Add player to guild
                            const acceptGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${matchingInvite.guildId}`);
                            await updateDoc(acceptGuildRef, {
                                [`members.${userId}`]: {
                                    name: playerName,
                                    rank: 'member',
                                    joinedAt: serverTimestamp()
                                }
                            });
                            
                            // Update player
                            await updateDoc(playerRef, {
                                guildId: matchingInvite.guildId,
                                guildInvites: arrayRemove(matchingInvite)
                            });
                            
                            logToTerminal(`You have joined "${matchingInvite.guildName}"!`, 'success');
                            break;
                        
                        case 'leave':
                            const pDocLeave = await getDoc(playerRef);
                            const pDataLeave = pDocLeave.data();
                            const leaveGuildId = pDataLeave.guildId;
                            
                            if (!leaveGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            // Get guild data - fetch from Firebase if not in cache
                            let leaveGuild = gameGuilds[leaveGuildId];
                            if (!leaveGuild) {
                                const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${leaveGuildId}`);
                                const guildSnap = await getDoc(guildRef);
                                if (!guildSnap.exists()) {
                                    logToTerminal("Your guild no longer exists.", 'error');
                                    break;
                                }
                                leaveGuild = guildSnap.data();
                            }
                            
                            if (leaveGuild.leaderId === userId) {
                                logToTerminal("You're the guild leader. Use 'guild disband' to disband the guild, or promote another member first.", 'error');
                                break;
                            }
                            
                            // Remove from guild
                            const leaveGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${leaveGuildId}`);
                            await updateDoc(leaveGuildRef, {
                                [`members.${userId}`]: deleteDoc
                            });
                            
                            await updateDoc(playerRef, {
                                guildId: ""
                            });
                            
                            logToTerminal(`You have left "${leaveGuild.name}".`, 'system');
                            break;
                        
                        case 'chat':
                        case 'gc':
                            if (!guildArg) {
                                logToTerminal("Usage: guild chat [message] or gc [message]", 'error');
                                break;
                            }
                            
                            const pDocChat = await getDoc(playerRef);
                            const pDataChat = pDocChat.data();
                            const chatGuildId = pDataChat.guildId;
                            
                            if (!chatGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            // Get guild data - fetch from Firebase if not in cache
                            let chatGuild = gameGuilds[chatGuildId];
                            if (!chatGuild) {
                                const guildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${chatGuildId}`);
                                const guildSnap = await getDoc(guildRef);
                                if (!guildSnap.exists()) {
                                    logToTerminal("Your guild no longer exists.", 'error');
                                    break;
                                }
                                chatGuild = guildSnap.data();
                            }
                            
                            // Send ONE guild message that all members will see
                            // Use a special recipientId to indicate it's for all guild members
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: userId,
                                senderName: playerName,
                                guildId: chatGuildId,
                                // Store only the raw message; the display code will add the [Guild] prefix
                                text: guildArg,
                                isGuildChat: true,
                                timestamp: serverTimestamp()
                            });
                            
                            logToTerminal(`[Guild] You: ${guildArg}`, 'system');
                            break;
                        
                        case 'deposit':
                            if (!guildArg) {
                                logToTerminal("Usage: guild deposit [amount]", 'error');
                                break;
                            }
                            
                            const depositAmount = parseInt(guildArg);
                            if (isNaN(depositAmount) || depositAmount <= 0) {
                                logToTerminal("Please specify a valid amount to deposit.", 'error');
                                break;
                            }
                            
                            const pDocDeposit = await getDoc(playerRef);
                            const pDataDeposit = pDocDeposit.data();
                            const depositGuildId = pDataDeposit.guildId;
                            
                            if (!depositGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            if (pDataDeposit.gold < depositAmount) {
                                logToTerminal(`You don't have ${depositAmount} gold!`, 'error');
                                break;
                            }
                            
                            // Deduct from player
                            await updateDoc(playerRef, {
                                gold: increment(-depositAmount)
                            });
                            
                            // Add to guild treasury
                            const depositGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${depositGuildId}`);
                            await updateDoc(depositGuildRef, {
                                treasury: increment(depositAmount)
                            });
                            
                            logToTerminal(`You deposited ${depositAmount} gold into the guild treasury.`, 'success');
                            break;
                        
                        case 'withdraw':
                            if (!guildArg) {
                                logToTerminal("Usage: guild withdraw [amount]", 'error');
                                break;
                            }
                            
                            const withdrawAmount = parseInt(guildArg);
                            if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
                                logToTerminal("Please specify a valid amount to withdraw.", 'error');
                                break;
                            }
                            
                            const pDocWithdraw = await getDoc(playerRef);
                            const pDataWithdraw = pDocWithdraw.data();
                            const withdrawGuildId = pDataWithdraw.guildId;
                            
                            if (!withdrawGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            const withdrawGuild = gameGuilds[withdrawGuildId];
                            const withdrawMember = withdrawGuild.members[userId];
                            
                            if (!withdrawMember || (withdrawMember.rank !== 'leader' && withdrawMember.rank !== 'officer')) {
                                logToTerminal("Only guild leaders and officers can withdraw from the treasury.", 'error');
                                break;
                            }
                            
                            if ((withdrawGuild.treasury || 0) < withdrawAmount) {
                                logToTerminal(`The guild treasury doesn't have ${withdrawAmount} gold!`, 'error');
                                break;
                            }
                            
                            // Add to player
                            await updateDoc(playerRef, {
                                gold: increment(withdrawAmount)
                            });
                            
                            // Deduct from guild treasury
                            const withdrawGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${withdrawGuildId}`);
                            await updateDoc(withdrawGuildRef, {
                                treasury: increment(-withdrawAmount)
                            });
                            
                            logToTerminal(`You withdrew ${withdrawAmount} gold from the guild treasury.`, 'success');
                            break;
                        
                        case 'promote':
                            if (!guildArg) {
                                logToTerminal("Usage: guild promote [player name]", 'error');
                                break;
                            }
                            
                            const pDocPromote = await getDoc(playerRef);
                            const pDataPromote = pDocPromote.data();
                            const promoteGuildId = pDataPromote.guildId;
                            
                            if (!promoteGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            const promoteGuild = gameGuilds[promoteGuildId];
                            
                            if (promoteGuild.leaderId !== userId) {
                                logToTerminal("Only the guild leader can promote members.", 'error');
                                break;
                            }
                            
                            // Find target player
                            const promoteTargetEntry = Object.entries(gamePlayers).find(([id, p]) => 
                                p.name.toLowerCase() === guildArg.toLowerCase()
                            );
                            
                            if (!promoteTargetEntry) {
                                logToTerminal(`Player "${guildArg}" not found.`, 'error');
                                break;
                            }
                            
                            const [promoteTargetId, promoteTargetPlayer] = promoteTargetEntry;
                            
                            if (promoteTargetPlayer.guildId !== promoteGuildId) {
                                logToTerminal(`${promoteTargetPlayer.name} is not in your guild.`, 'error');
                                break;
                            }
                            
                            const currentRank = promoteGuild.members[promoteTargetId]?.rank || 'member';
                            
                            if (currentRank === 'leader') {
                                logToTerminal("Cannot promote the guild leader!", 'error');
                                break;
                            }
                            
                            const newRank = currentRank === 'member' ? 'officer' : 'officer';
                            
                            if (currentRank === 'officer') {
                                logToTerminal(`${promoteTargetPlayer.name} is already an officer.`, 'game');
                                break;
                            }
                            
                            const promoteGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${promoteGuildId}`);
                            await updateDoc(promoteGuildRef, {
                                [`members.${promoteTargetId}.rank`]: newRank
                            });
                            
                            logToTerminal(`${promoteTargetPlayer.name} has been promoted to ${newRank}!`, 'success');
                            break;
                        
                        case 'demote':
                            if (!guildArg) {
                                logToTerminal("Usage: guild demote [player name]", 'error');
                                break;
                            }
                            
                            const pDocDemote = await getDoc(playerRef);
                            const pDataDemote = pDocDemote.data();
                            const demoteGuildId = pDataDemote.guildId;
                            
                            if (!demoteGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            const demoteGuild = gameGuilds[demoteGuildId];
                            
                            if (demoteGuild.leaderId !== userId) {
                                logToTerminal("Only the guild leader can demote members.", 'error');
                                break;
                            }
                            
                            // Find target player
                            const demoteTargetEntry = Object.entries(gamePlayers).find(([id, p]) => 
                                p.name.toLowerCase() === guildArg.toLowerCase()
                            );
                            
                            if (!demoteTargetEntry) {
                                logToTerminal(`Player "${guildArg}" not found.`, 'error');
                                break;
                            }
                            
                            const [demoteTargetId, demoteTargetPlayer] = demoteTargetEntry;
                            
                            if (demoteTargetPlayer.guildId !== demoteGuildId) {
                                logToTerminal(`${demoteTargetPlayer.name} is not in your guild.`, 'error');
                                break;
                            }
                            
                            const demoteCurrentRank = demoteGuild.members[demoteTargetId]?.rank || 'member';
                            
                            if (demoteCurrentRank === 'leader') {
                                logToTerminal("Cannot demote the guild leader!", 'error');
                                break;
                            }
                            
                            if (demoteCurrentRank === 'member') {
                                logToTerminal(`${demoteTargetPlayer.name} is already a member (lowest rank).`, 'game');
                                break;
                            }
                            
                            const demoteGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${demoteGuildId}`);
                            await updateDoc(demoteGuildRef, {
                                [`members.${demoteTargetId}.rank`]: 'member'
                            });
                            
                            logToTerminal(`${demoteTargetPlayer.name} has been demoted to member.`, 'success');
                            break;
                        
                        case 'disband':
                            const pDocDisband = await getDoc(playerRef);
                            const pDataDisband = pDocDisband.data();
                            const disbandGuildId = pDataDisband.guildId;
                            
                            if (!disbandGuildId) {
                                logToTerminal("You're not in a guild.", 'error');
                                break;
                            }
                            
                            const disbandGuild = gameGuilds[disbandGuildId];
                            
                            if (disbandGuild.leaderId !== userId) {
                                logToTerminal("Only the guild leader can disband the guild.", 'error');
                                break;
                            }
                            
                            // Confirm disbanding
                            if (!guildArg || guildArg.toLowerCase() !== 'confirm') {
                                logToTerminal(`Are you sure you want to disband "${disbandGuild.name}"?`, 'system');
                                logToTerminal(`This will remove all members and delete the guild permanently!`, 'error');
                                logToTerminal(`Type 'guild disband confirm' to proceed.`, 'game');
                                break;
                            }
                            
                            // Remove guild from all members
                            const disbandMemberIds = Object.keys(disbandGuild.members || {});
                            for (const memberId of disbandMemberIds) {
                                const memberRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${memberId}`);
                                await updateDoc(memberRef, { guildId: "" });
                            }
                            
                            // Delete the guild
                            const disbandGuildRef = doc(db, `/artifacts/${appId}/public/data/mud-guilds/${disbandGuildId}`);
                            await deleteDoc(disbandGuildRef);
                            
                            logToTerminal(`Guild "${disbandGuild.name}" has been disbanded.`, 'system');
                            break;
                        
                        default:
                            logToTerminal("Guild commands: create, list, invite, accept, leave, chat (or gc)", 'system');
                            logToTerminal("Management: deposit, withdraw, promote, demote, disband", 'system');
                            logToTerminal("Usage examples:", 'game');
                            logToTerminal("  guild create My Awesome Guild", 'game');
                            logToTerminal("  guild list", 'game');
                            logToTerminal("  guild invite PlayerName", 'game');
                            logToTerminal("  guild deposit 100", 'game');
                            logToTerminal("  guild withdraw 50 (leader/officer only)", 'game');
                            logToTerminal("  guild promote PlayerName (leader only)", 'game');
                            logToTerminal("  guild chat Hello everyone!", 'game');
                            logToTerminal("  gc Quick message! (short for guild chat)", 'game');
                    }
                }
                break;
            
            case 'gc':
                // Shortcut for guild chat
                // Check if player is muted
                const gcPlayerData = gamePlayers[userId];
                if (gcPlayerData?.muted) {
                    const mutedUntil = gcPlayerData.mutedUntil || 0;
                    if (mutedUntil > Date.now()) {
                        const minutesLeft = Math.ceil((mutedUntil - Date.now()) / 60000);
                        logToTerminal(`You are muted for ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''}.`, "error");
                        break;
                    } else {
                        // Mute expired, remove it
                        await updateDoc(playerRef, { muted: false, mutedUntil: null });
                    }
                }
                
                if (!target) {
                    logToTerminal("Usage: gc [message]", 'error');
                    break;
                }
                
                const fullMessage = target + (npc_target ? " " + npc_target : "");
                
                const pDocGC = await getDoc(playerRef);
                const pDataGC = pDocGC.data();
                const gcGuildId = pDataGC.guildId;
                
                if (!gcGuildId) {
                    logToTerminal("You're not in a guild.", 'error');
                    break;
                }
                
                const gcGuild = gameGuilds[gcGuildId];
                
                // Send ONE guild message that all members will see
                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                    senderId: userId,
                    senderName: playerName,
                    guildId: gcGuildId,
                    // Store only the raw message; display adds the guild prefix
                    text: fullMessage,
                    isGuildChat: true,
                    timestamp: serverTimestamp()
                });
                
                logToTerminal(`[Guild] You: ${fullMessage}`, 'system');
                break;

            case 'quest':
            case 'quests':
                // Fetch current player data
                const playerDocQuest = await getDoc(playerRef);
                const playerDataQuest = playerDocQuest.data();
                
                if (!parsedCommand.target) {
                    // List available quests from NPCs in current room or show active quests
                    const activeQuests = playerDataQuest.activeQuests || [];
                    const completedQuests = playerDataQuest.completedQuests || [];
                    
                    if (activeQuests.length > 0) {
                        logToTerminal("=== Your Active Quests ===", "system");
                        for (const activeQuest of activeQuests) {
                            const quest = gameQuests[activeQuest.questId];
                            if (quest) {
                                logToTerminal(`📜 ${quest.title}`, "quest");
                                logToTerminal(`  ${quest.description}`, "system");
                                
                                // Show objective progress
                                if (activeQuest.objectives) {
                                    logToTerminal("  Objectives:", "system");
                                    for (const obj of activeQuest.objectives) {
                                        let displayCurrent = obj.current;
                                        
                                        // Build objective description - always look up for collect/kill/visit
                                        let objDesc;
                                        if (obj.type === 'collect' && obj.itemId) {
                                            const item = gameItems[obj.itemId];
                                            const itemName = item?.name || `[missing item: ${obj.itemId}]`;
                                            objDesc = `Collect ${obj.count} ${itemName}`;
                                            
                                            // For collect quests, COUNT actual items in inventory AND inside containers
                                            const playerInv = playerDataQuest.inventory || [];
                                            let actualCount = playerInv.filter(i => i.id === obj.itemId).length;
                                            
                                            // Also count items inside containers
                                            for (const invItem of playerInv) {
                                                if (invItem.contents && Array.isArray(invItem.contents)) {
                                                    actualCount += invItem.contents.filter(i => i.id === obj.itemId).length;
                                                }
                                            }
                                            
                                            displayCurrent = actualCount;
                                        } else if (obj.type === 'kill' && obj.monsterId) {
                                            const monster = gameMonsters[obj.monsterId];
                                            const monsterName = monster?.name || `[missing monster: ${obj.monsterId}]`;
                                            objDesc = `Kill ${obj.count} ${monsterName}`;
                                        } else if (obj.type === 'visit' && obj.roomId) {
                                            const room = gameWorld[obj.roomId];
                                            const roomName = room?.name || `[missing room: ${obj.roomId}]`;
                                            objDesc = `Visit ${roomName}`;
                                        } else {
                                            // Fall back to description or type
                                            objDesc = obj.description || obj.type;
                                        }
                                        
                                        const done = displayCurrent >= obj.count ? "✓" : " ";
                                        logToTerminal(`  [${done}] ${objDesc}: ${displayCurrent}/${obj.count}`, "system");
                                    }
                                }
                            }
                        }
                    } else {
                        logToTerminal("You have no active quests.", "system");
                    }
                    
                    // Show available quests from NPCs in the room
                    const currentRoom = gameWorld[playerDataQuest.roomId];
                    const npcIdsInRoom = currentRoom?.npcs || [];
                    console.log(`[QUESTS DEBUG] NPCs in room:`, npcIdsInRoom);
                    console.log(`[QUESTS DEBUG] All quests:`, Object.keys(gameQuests));
                    const availableQuests = Object.values(gameQuests).filter(quest => {
                        console.log(`[QUESTS DEBUG] Checking quest ${quest.title}, giverNpcId: ${quest.giverNpcId}, in room: ${npcIdsInRoom.includes(quest.giverNpcId)}`);
                        // Check if NPC is in room
                        if (!npcIdsInRoom.includes(quest.giverNpcId)) return false;
                        // Check level requirement
                        if (quest.levelRequired && playerDataQuest.level < quest.levelRequired) return false;
                        // Check if already active
                        if (activeQuests.some(aq => aq.questId === quest.id)) return false;
                        // Check if already completed and not repeatable
                        if (completedQuests.includes(quest.id) && !quest.isRepeatable) return false;
                        // Check prerequisites - parse if string
                        let prerequisites = quest.prerequisites;
                        if (typeof prerequisites === 'string') {
                            try {
                                prerequisites = JSON.parse(prerequisites);
                            } catch (e) {
                                console.error('Failed to parse quest prerequisites:', e);
                                prerequisites = [];
                            }
                        }
                        if (prerequisites && prerequisites.length > 0) {
                            if (!prerequisites.every(prereq => completedQuests.includes(prereq))) return false;
                        }
                        return true;
                    });
                    
                    if (availableQuests.length > 0) {
                        logToTerminal("\n=== Available Quests ===", "system");
                        for (const quest of availableQuests) {
                            const npc = gameNpcs[quest.giverNpcId];
                            logToTerminal(`📜 ${quest.title} (Level ${quest.levelRequired || 1})`, "quest");
                            logToTerminal(`  Talk to ${npc?.name || quest.giverNpcId} to accept`, "system");
                        }
                    }
                } else {
                    // Handle quest subcommands
                    const subcommand = parsedCommand.target?.toLowerCase() || '';
                    const questName = parsedCommand.topic || '';
                    
                    if (subcommand === 'accept') {
                        if (!questName) {
                            logToTerminal("Please specify a quest name: quest accept [quest name]", "error");
                            break;
                        }
                        
                        // Find quest by name
                        const quest = Object.values(gameQuests).find(q => 
                            q.title && q.title.toLowerCase().includes(questName.toLowerCase())
                        );
                        
                        if (!quest) {
                            logToTerminal("Quest not found.", "error");
                            break;
                        }
                        
                        // Check if quest giver NPC is in room
                        const currentRoomAccept = gameWorld[playerDataQuest.roomId];
                        const npcIdsInRoomAccept = currentRoomAccept?.npcs || [];
                        const npc = gameNpcs[quest.giverNpcId];
                        
                        if (!npc || !npcIdsInRoomAccept.includes(quest.giverNpcId)) {
                            logToTerminal(`You need to talk to ${npc?.name || quest.giverNpcId} to accept this quest.`, "error");
                            break;
                        }
                        
                        // Check level requirement
                        if (quest.levelRequired && playerDataQuest.level < quest.levelRequired) {
                            logToTerminal(`You must be level ${quest.levelRequired} to accept this quest.`, "error");
                            break;
                        }
                        
                        // Check prerequisites - parse if string
                        const completedQuests = playerDataQuest.completedQuests || [];
                        let prerequisitesAccept = quest.prerequisites;
                        if (typeof prerequisitesAccept === 'string') {
                            try {
                                prerequisitesAccept = JSON.parse(prerequisitesAccept);
                            } catch (e) {
                                console.error('Failed to parse quest prerequisites:', e);
                                prerequisitesAccept = [];
                            }
                        }
                        if (prerequisitesAccept && prerequisitesAccept.length > 0) {
                            if (!prerequisitesAccept.every(prereq => completedQuests.includes(prereq))) {
                                logToTerminal("You must complete prerequisite quests first.", "error");
                                break;
                            }
                        }
                        
                        // Check if already active
                        const activeQuests = playerDataQuest.activeQuests || [];
                        if (activeQuests.some(aq => aq.questId === quest.id)) {
                            logToTerminal("You already have this quest active.", "error");
                            break;
                        }
                        
                        // Check if already completed and not repeatable
                        if (completedQuests.includes(quest.id) && !quest.isRepeatable) {
                            logToTerminal("You have already completed this quest.", "error");
                            break;
                        }
                        
                        // Parse objectives if it's a JSON string
                        let objectives = quest.objectives;
                        
                        if (typeof objectives === 'string') {
                            try {
                                objectives = JSON.parse(objectives);
                            } catch (e) {
                                logToTerminal("This quest has invalid objectives data. Please contact an administrator.", "error");
                                console.error('Failed to parse quest objectives:', e, quest);
                                break;
                            }
                        }
                        
                        // If objectives is an object but not an array, wrap it in an array
                        if (objectives && typeof objectives === 'object' && !Array.isArray(objectives)) {
                            objectives = [objectives];
                        }
                        
                        // Check if objectives is properly formatted
                        if (!objectives || !Array.isArray(objectives) || objectives.length === 0) {
                            logToTerminal("This quest has no objectives configured. Please contact an administrator.", "error");
                            console.error('Quest objectives not properly configured:', quest);
                            break;
                        }
                        
                        // Initialize quest objectives
                        const questObjectives = objectives.map(obj => ({
                            ...obj,
                            current: 0,
                            description: getObjectiveDescription(obj)
                        }));
                        
                        // Reset room states for repeatable quests (if player has completed before)
                        if (quest.isRepeatable && completedQuests.includes(quest.id) && quest.resetsRoomStates && Array.isArray(quest.resetsRoomStates)) {
                            console.log(`[QUEST] Attempting to reset rooms for repeatable quest:`, quest.resetsRoomStates);
                            for (const roomId of quest.resetsRoomStates) {
                                const roomStateRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${roomId}`);
                                const roomStateSnap = await getDoc(roomStateRef);
                                const hadPreviousState = roomStateSnap.exists() && 
                                    (Object.keys(roomStateSnap.data().pushableStates || {}).length > 0 || 
                                     (roomStateSnap.data().revealedItems || []).length > 0);
                                
                                if (roomStateSnap.exists()) {
                                    const oldState = roomStateSnap.data();
                                    console.log(`[QUEST] Old room state for ${roomId}:`, oldState);
                                    // Clear pushable states and revealed items
                                    await updateDoc(roomStateRef, {
                                        pushableStates: {},
                                        revealedItems: []
                                    });
                                    console.log(`[QUEST] Reset room state for ${roomId} upon re-accepting repeatable quest`);
                                } else {
                                    console.log(`[QUEST] Room state document doesn't exist for ${roomId}, creating empty state`);
                                    // Create the document with empty states
                                    await setDoc(roomStateRef, {
                                        pushableStates: {},
                                        revealedItems: []
                                    });
                                }
                                
                                // Only show reset message if there was actually something to reset
                                if (hadPreviousState) {
                                    const roomName = gameWorld[roomId]?.name || 'area';
                                    logToTerminal(`✨ The ${roomName} has been reset - all puzzles and objects have returned to their original state.`, 'success');
                                }
                            }
                        }
                        
                        // Add quest to player's active quests
                        const newActiveQuest = {
                            questId: quest.id,
                            objectives: questObjectives,
                            acceptedAt: Date.now()
                        };
                        
                        await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`), {
                            activeQuests: arrayUnion(newActiveQuest)
                        });
                        
                        logToTerminal(`Quest accepted: ${quest.title}`, "success");
                        logToTerminal(quest.description, "system");
                        logToTerminal("Objectives:", "system");
                        for (const obj of questObjectives) {
                            logToTerminal(`  - ${obj.description}: 0/${obj.count}`, "system");
                        }
                        
                        // Refresh room display to show any changes from reset states
                        await showRoom(currentPlayerRoomId);
                        
                    } else if (subcommand === 'abandon') {
                        // Find and remove quest from active quests
                        const activeQuests = playerDataQuest.activeQuests || [];
                        const questIndex = activeQuests.findIndex(aq => {
                            const quest = gameQuests[aq.questId];
                            return quest && quest.title.toLowerCase().includes(questName.toLowerCase());
                        });
                        
                        if (questIndex === -1) {
                            logToTerminal("You don't have that quest active.", "error");
                            break;
                        }
                        
                        const abandonedQuest = gameQuests[activeQuests[questIndex].questId];
                        const newActiveQuests = activeQuests.filter((_, i) => i !== questIndex);
                        
                        await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`), {
                            activeQuests: newActiveQuests
                        });
                        
                        logToTerminal(`Quest abandoned: ${abandonedQuest.title}`, "system");
                        
                    } else if (subcommand === 'progress' || subcommand === 'log') {
                        // Show detailed progress for all active quests
                        const activeQuests = playerDataQuest.activeQuests || [];
                        
                        if (activeQuests.length === 0) {
                            logToTerminal("You have no active quests.", "system");
                            break;
                        }
                        
                        logToTerminal("=== Quest Progress ===", "system");
                        for (const activeQuest of activeQuests) {
                            const quest = gameQuests[activeQuest.questId];
                            if (quest) {
                                logToTerminal(`\n📜 ${quest.title}`, "quest");
                                logToTerminal(`  ${quest.description}`, "system");
                                
                                if (activeQuest.objectives) {
                                    logToTerminal("  Progress:", "system");
                                    for (const obj of activeQuest.objectives) {
                                        // Build objective description - same logic as main quest display
                                        let objDesc;
                                        let displayCurrent = obj.current;
                                        
                                        if (obj.type === 'collect' && obj.itemId) {
                                            const item = gameItems[obj.itemId];
                                            const itemName = item?.name || `[missing item: ${obj.itemId}]`;
                                            objDesc = `Collect ${obj.count} ${itemName}`;
                                            
                                            // For collect quests, COUNT actual items in inventory AND inside containers
                                            const playerInv = playerDataQuest.inventory || [];
                                            let actualCount = playerInv.filter(i => i.id === obj.itemId).length;
                                            
                                            // Also count items inside containers
                                            for (const invItem of playerInv) {
                                                if (invItem.contents && Array.isArray(invItem.contents)) {
                                                    actualCount += invItem.contents.filter(i => i.id === obj.itemId).length;
                                                }
                                            }
                                            
                                            displayCurrent = actualCount;
                                            console.log(`Quest tracking: Need ${obj.count} ${obj.itemId}, have ${actualCount} in inventory (including containers), quest shows ${obj.current}`);
                                        } else if (obj.type === 'kill' && obj.monsterId) {
                                            const monster = gameMonsters[obj.monsterId];
                                            const monsterName = monster?.name || `[missing monster: ${obj.monsterId}]`;
                                            objDesc = `Kill ${obj.count} ${monsterName}`;
                                        } else if (obj.type === 'visit' && obj.roomId) {
                                            const room = gameWorld[obj.roomId];
                                            const roomName = room?.name || `[missing room: ${obj.roomId}]`;
                                            objDesc = `Visit ${roomName}`;
                                        } else {
                                            objDesc = obj.description || obj.type;
                                        }
                                        
                                        const progress = Math.min(100, Math.floor((displayCurrent / obj.count) * 100));
                                        const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
                                        logToTerminal(`  ${objDesc}: [${bar}] ${displayCurrent}/${obj.count}`, "system");
                                    }
                                }
                            }
                        }
                    } else {
                        logToTerminal("Unknown quest command. Try 'quest accept [name]', 'quest abandon [name]', or 'quest progress'.", "error");
                    }
                }
                break;

            case 'party':
                const partySubcommand = parsedCommand.target?.toLowerCase() || '';
                const partyTarget = parsedCommand.npc_target || parsedCommand.topic || '';
                
                if (!partySubcommand) {
                    // Show current party info
                    const playerParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(userId)
                    );
                    
                    if (playerParty) {
                        logToTerminal("=== Your Party ===", "system");
                        logToTerminal(`Leader: ${playerParty.leaderName}`, "system");
                        logToTerminal(`Members (${Object.keys(playerParty.members).length}):`, "system");
                        for (const [memberId, member] of Object.entries(playerParty.members)) {
                            const statusIcon = member.isLeader ? "👑" : "⚔️";
                            const levelInfo = gamePlayers[memberId] ? ` (Level ${gamePlayers[memberId].level || 1})` : '';
                            logToTerminal(`  ${statusIcon} ${member.name}${levelInfo}`, "system");
                        }
                    } else {
                        logToTerminal("You are not in a party.", "system");
                        logToTerminal("Use 'party create' to form a new party, or wait for an invitation.", "system");
                    }
                } else if (partySubcommand === 'create') {
                    // Check if already in a party
                    const existingParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(userId)
                    );
                    
                    if (existingParty) {
                        logToTerminal("You are already in a party. Leave your current party first.", "error");
                        break;
                    }
                    
                    // Create new party
                    const partyId = `party-${Date.now()}`;
                    const partyRef = doc(db, `/artifacts/${appId}/public/data/mud-parties/${partyId}`);
                    
                    await setDoc(partyRef, {
                        leaderId: userId,
                        leaderName: playerName,
                        members: {
                            [userId]: {
                                name: playerName,
                                isLeader: true,
                                joinedAt: serverTimestamp()
                            }
                        },
                        invitations: {},
                        createdAt: serverTimestamp()
                    });
                    
                    logToTerminal("You have formed a new party!", "success");
                    logToTerminal("Use 'party invite [player name]' to invite others.", "system");
                    
                } else if (partySubcommand === 'invite') {
                    if (!partyTarget) {
                        logToTerminal("Who do you want to invite? Use 'party invite [player name]'.", "error");
                        break;
                    }
                    
                    // Find party where player is leader - check both cache and Firebase
                    let playerParty = Object.values(gameParties).find(p => p.leaderId === userId);
                    
                    // If not in cache, query Firebase directly (handles newly created parties)
                    if (!playerParty) {
                        const partiesQuery = query(
                            collection(db, `/artifacts/${appId}/public/data/mud-parties`),
                            where('leaderId', '==', userId)
                        );
                        const partiesSnapshot = await getDocs(partiesQuery);
                        if (!partiesSnapshot.empty) {
                            const partyDoc = partiesSnapshot.docs[0];
                            playerParty = { id: partyDoc.id, ...partyDoc.data() };
                        }
                    }
                    
                    if (!playerParty) {
                        logToTerminal("You must be a party leader to invite others. Use 'party create' first.", "error");
                        break;
                    }
                    
                    // Find target player
                    const targetPlayer = Object.values(gamePlayers).find(p => 
                        p.name && p.name.toLowerCase() === partyTarget.toLowerCase()
                    );
                    
                    if (!targetPlayer) {
                        logToTerminal("Player not found.", "error");
                        break;
                    }
                    
                    if (Object.keys(playerParty.members).includes(targetPlayer.id)) {
                        logToTerminal("That player is already in your party.", "error");
                        break;
                    }
                    
                    // Check if target is already in another party
                    const targetInParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(targetPlayer.id)
                    );
                    
                    if (targetInParty) {
                        logToTerminal("That player is already in another party.", "error");
                        break;
                    }
                    
                    // Add invitation
                    const partyRef = doc(db, `/artifacts/${appId}/public/data/mud-parties/${playerParty.id}`);
                    await updateDoc(partyRef, {
                        [`invitations.${targetPlayer.id}`]: {
                            name: targetPlayer.name,
                            invitedAt: serverTimestamp(),
                            invitedBy: playerName
                        }
                    });
                    
                    logToTerminal(`Party invitation sent to ${targetPlayer.name}!`, "success");
                    
                    // Notify target player if online
                    if (targetPlayer.roomId) {
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: 'system',
                            senderName: 'System',
                            roomId: targetPlayer.roomId,
                            text: `${playerName} has invited you to join their party! Type 'party join ${playerName}' to accept.`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    }
                    
                } else if (partySubcommand === 'join') {
                    if (!partyTarget) {
                        logToTerminal("Whose party do you want to join? Use 'party join [leader name]'.", "error");
                        break;
                    }
                    
                    // Check if already in a party
                    const existingParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(userId)
                    );
                    
                    if (existingParty) {
                        logToTerminal("You are already in a party. Leave your current party first.", "error");
                        break;
                    }
                    
                    // Find party with invitation
                    const invitingParty = Object.values(gameParties).find(p => 
                        p.leaderName.toLowerCase() === partyTarget.toLowerCase() &&
                        p.invitations && p.invitations[userId]
                    );
                    
                    if (!invitingParty) {
                        logToTerminal("No pending invitation from that player.", "error");
                        break;
                    }
                    
                    // Join party
                    const partyRef = doc(db, `/artifacts/${appId}/public/data/mud-parties/${invitingParty.id}`);
                    const newInvitations = { ...invitingParty.invitations };
                    delete newInvitations[userId];
                    
                    await updateDoc(partyRef, {
                        [`members.${userId}`]: {
                            name: playerName,
                            isLeader: false,
                            joinedAt: serverTimestamp()
                        },
                        invitations: newInvitations
                    });
                    
                    logToTerminal(`You have joined ${invitingParty.leaderName}'s party!`, "success");
                    
                    // Notify party members
                    for (const memberId of Object.keys(invitingParty.members)) {
                        const member = gamePlayers[memberId];
                        if (member && member.roomId) {
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: 'system',
                                senderName: 'System',
                                roomId: member.roomId,
                                text: `${playerName} has joined the party!`,
                                isSystem: true,
                                timestamp: serverTimestamp()
                            });
                        }
                    }
                    
                } else if (partySubcommand === 'leave') {
                    const playerParty = Object.values(gameParties).find(p => 
                        p.members && Object.keys(p.members).includes(userId)
                    );
                    
                    if (!playerParty) {
                        logToTerminal("You are not in a party.", "error");
                        break;
                    }
                    
                    const partyRef = doc(db, `/artifacts/${appId}/public/data/mud-parties/${playerParty.id}`);
                    
                    if (playerParty.leaderId === userId) {
                        // Leader leaving - disband party
                        await deleteDoc(partyRef);
                        logToTerminal("You have disbanded the party.", "system");
                        
                        // Notify all members
                        for (const memberId of Object.keys(playerParty.members)) {
                            if (memberId !== userId) {
                                const member = gamePlayers[memberId];
                                if (member && member.roomId) {
                                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                        senderId: 'system',
                                        senderName: 'System',
                                        roomId: member.roomId,
                                        text: `The party has been disbanded by the leader.`,
                                        isSystem: true,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            }
                        }
                    } else {
                        // Member leaving
                        const newMembers = { ...playerParty.members };
                        delete newMembers[userId];
                        
                        await updateDoc(partyRef, {
                            members: newMembers
                        });
                        
                        logToTerminal("You have left the party.", "system");
                        
                        // Notify remaining members
                        for (const memberId of Object.keys(newMembers)) {
                            const member = gamePlayers[memberId];
                            if (member && member.roomId) {
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: member.roomId,
                                    text: `${playerName} has left the party.`,
                                    isSystem: true,
                                    timestamp: serverTimestamp()
                                });
                            }
                        }
                    }
                    
                } else if (partySubcommand === 'kick') {
                    if (!partyTarget) {
                        logToTerminal("Who do you want to kick? Use 'party kick [player name]'.", "error");
                        break;
                    }
                    
                    const playerParty = Object.values(gameParties).find(p => p.leaderId === userId);
                    
                    if (!playerParty) {
                        logToTerminal("You must be the party leader to kick members.", "error");
                        break;
                    }
                    
                    // Find target member
                    const targetMemberId = Object.keys(playerParty.members).find(id => {
                        const member = playerParty.members[id];
                        return member.name.toLowerCase() === partyTarget.toLowerCase();
                    });
                    
                    if (!targetMemberId) {
                        logToTerminal("That player is not in your party.", "error");
                        break;
                    }
                    
                    if (targetMemberId === userId) {
                        logToTerminal("You can't kick yourself. Use 'party leave' to disband.", "error");
                        break;
                    }
                    
                    const newMembers = { ...playerParty.members };
                    const kickedName = newMembers[targetMemberId].name;
                    delete newMembers[targetMemberId];
                    
                    const partyRef = doc(db, `/artifacts/${appId}/public/data/mud-parties/${playerParty.id}`);
                    await updateDoc(partyRef, {
                        members: newMembers
                    });
                    
                    logToTerminal(`${kickedName} has been removed from the party.`, "system");
                    
                    // Notify kicked player
                    const kickedPlayer = gamePlayers[targetMemberId];
                    if (kickedPlayer && kickedPlayer.roomId) {
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: 'system',
                            senderName: 'System',
                            roomId: kickedPlayer.roomId,
                            text: `You have been removed from the party.`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    }
                    
                } else if (partySubcommand === 'list') {
                    const parties = Object.values(gameParties);
                    if (parties.length === 0) {
                        logToTerminal("There are no active parties.", "system");
                    } else {
                        logToTerminal("=== Active Parties ===", "system");
                        for (const party of parties) {
                            const memberCount = Object.keys(party.members).length;
                            logToTerminal(`${party.leaderName}'s party (${memberCount} members)`, "system");
                        }
                    }
                } else {
                    logToTerminal("Unknown party command. Try 'party', 'party create', 'party invite [name]', 'party join [name]', 'party leave', 'party kick [name]', or 'party list'.", "error");
                }
                break;

            case 'pc':
                // Party chat
                // Check if player is muted
                const pcPlayerData = gamePlayers[userId];
                if (pcPlayerData?.muted) {
                    const mutedUntil = pcPlayerData.mutedUntil || 0;
                    if (mutedUntil > Date.now()) {
                        const minutesLeft = Math.ceil((mutedUntil - Date.now()) / 60000);
                        logToTerminal(`You are muted for ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''}.`, "error");
                        break;
                    } else {
                        // Mute expired, remove it
                        await updateDoc(playerRef, { muted: false, mutedUntil: null });
                    }
                }
                
                const playerPartyChat = Object.values(gameParties).find(p => 
                    p.members && Object.keys(p.members).includes(userId)
                );
                
                if (!playerPartyChat) {
                    logToTerminal("You are not in a party.", "error");
                    break;
                }
                
                const partyMessage = parsedCommand.target || '';
                if (!partyMessage) {
                    logToTerminal("What do you want to say to your party? Use 'pc [message]'.", "error");
                    break;
                }
                
                // Send message to all party members' rooms
                for (const memberId of Object.keys(playerPartyChat.members)) {
                    const member = gamePlayers[memberId];
                    if (member && member.roomId) {
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: userId,
                            senderName: playerName,
                            roomId: member.roomId,
                            text: partyMessage,
                            isPartyChat: true,
                            timestamp: serverTimestamp()
                        });
                    }
                }
                
                logToTerminal(`[Party] You: ${partyMessage}`, 'system');
                break;
            
            case 'help':
                logToTerminal("--- Help ---", "system");
                logToTerminal("You can now type commands in natural language!", "system");
                logToTerminal("After talking to an AI character, you can reply just by typing.", "system");
                logToTerminal("Core commands: look, go, get, drop, inventory (i/inv), examine, talk to, ask...about, buy...from, attack, who, say, score, stats, logout.", "system");
                logToTerminal("Interaction: 'push/pull/move [object]' to interact with objects in the room (may require party members for heavy objects).", "system");
                logToTerminal("Combat: 'attack [monster]' or 'attack [player]' - Fight monsters or other players! PvP combat is active.", "system");
                logToTerminal("Magic: 'spells' to view your spells, 'cast [spell name] [target]' to cast spells.", "system");
                logToTerminal("Communication: 'say [message]' for local chat, 'whisper/tell [player] [message]' for private chat, 'shout [message]' to nearby rooms, 'gc [message]' for guild chat, 'pc [message]' for party chat.", "system");
                logToTerminal("Trading: 'list' to see merchant inventory, 'buy [item]' to purchase, 'haggle [amount] for [item]' to negotiate, 'sell [item]' to sell, 'trade [player]' for player trading.", "system");
                logToTerminal("Giving: 'give [amount] gold to [npc]' to give money, 'give [item] to [npc]' to give items.", "system");
                logToTerminal("Guilds: 'guild' to view your guild, 'guild create [name]' to make one, 'guild list' to see all guilds.", "system");
                logToTerminal("Quests: 'quests' to see active and available quests, 'quest accept [name]' to accept, 'quest progress' to view details, 'quest abandon [name]' to drop.", "system");
                logToTerminal("Parties: 'party create' to form a party, 'party invite [name]' to invite, 'party join [name]' to join, 'party leave' to leave.", "system");
                logToTerminal("Emotes: wave, dance, laugh, smile, nod, bow, clap, cheer, cry, sigh, shrug, grin, frown, wink, yawn, stretch, jump, sit, stand, kneel, salute, think, ponder, scratch.", "system");
                logToTerminal("Or use 'emote [action]' for custom actions!", "system");
                logToTerminal("Special: 'examine frame' to view the leaderboard!", "system");
                logToTerminal("Weather: 'weather' to check current conditions and your status.", "system");
                logToTerminal("Accessibility: Type 'screenreader' to enable/disable screen reader mode for visually impaired players.", "system");
                logToTerminal("Test AI: Type 'test ai' to check if AI is working.", "system");
                if (gamePlayers[userId]?.isAdmin) {
                    logToTerminal("--- Admin Commands ---", "system");
                    logToTerminal("learn [spell name] - Learn any spell instantly", "system");
                    logToTerminal("startbots [count] - Start bot system (default: 3 bots)", "system");
                    logToTerminal("stopbots - Stop bot system", "system");
                    logToTerminal("spawnbot - Manually spawn one bot", "system");
                    logToTerminal("listbots - List all active bots", "system");
                    logToTerminal("killbots - Remove all bots from the game", "system");
                    logToTerminal("npcchats [on/off] - Enable/disable NPC conversations", "system");
                    logToTerminal("--- Moderation Commands ---", "system");
                    logToTerminal("kick [player name] - Kick a player from the game", "system");
                    logToTerminal("mute [player name] [minutes] - Mute a player (default: 60 min)", "system");
                    logToTerminal("unmute [player name] - Remove mute from a player", "system");
                    logToTerminal("--- Transportation Commands ---", "system");
                    logToTerminal("goto/tp [room id or name] - Teleport to any room", "system");
                    logToTerminal("rooms - List all rooms in the game", "system");
                    logToTerminal("summon [player name] - Teleport a player to you", "system");
                    logToTerminal("invis - Toggle invisibility (hidden from 'who' list)", "system");
                    logToTerminal("--- Communication Commands ---", "system");
                    logToTerminal("announce/broadcast [message] - Send message to all rooms", "system");
                    logToTerminal("--- Weather Commands ---", "system");
                    logToTerminal("setweather [type] - Change weather (sunny/rainy/snowy/stormy/foggy/hot/cold/cloudy)", "system");
                    logToTerminal("resetroom [room id] - Reset a room's pushable objects and revealed items", "system");
                    logToTerminal("refreshcache [collection] - Reload game data from MySQL (all or specific: rooms, items, npcs, monsters, classes, spells, quests)", "system");
                }
                break;
            
            case 'resetroom':
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Admin only command.", "error");
                    break;
                }
                
                const roomToReset = target || currentPlayerRoomId;
                
                if (!gameWorld[roomToReset]) {
                    logToTerminal(`Room "${roomToReset}" not found.`, "error");
                    break;
                }
                
                try {
                    const resetRoomStateRef = doc(db, `/artifacts/${appId}/public/data/mud-room-states/${roomToReset}`);
                    const resetRoomStateSnap = await getDoc(resetRoomStateRef);
                    
                    if (resetRoomStateSnap.exists()) {
                        const oldState = resetRoomStateSnap.data();
                        console.log(`[ADMIN] Resetting room ${roomToReset}, old state:`, oldState);
                        
                        await updateDoc(resetRoomStateRef, {
                            pushableStates: {},
                            revealedItems: []
                        });
                        
                        logToTerminal(`✅ Room "${gameWorld[roomToReset].name}" (${roomToReset}) has been reset.`, "success");
                        logToTerminal(`Cleared ${Object.keys(oldState.pushableStates || {}).length} pushable states and ${(oldState.revealedItems || []).length} revealed items.`, "system");
                    } else {
                        // Create empty state
                        await setDoc(resetRoomStateRef, {
                            pushableStates: {},
                            revealedItems: []
                        });
                        logToTerminal(`✅ Room "${gameWorld[roomToReset].name}" (${roomToReset}) state has been initialized.`, "success");
                    }
                    
                    // Refresh the room display
                    if (roomToReset === currentPlayerRoomId) {
                        await showRoom(currentPlayerRoomId);
                    }
                } catch (error) {
                    console.error('[ADMIN] Error resetting room:', error);
                    logToTerminal(`Error resetting room: ${error.message}`, "error");
                }
                break;
            
            case 'refreshcache':
            case 'refresh':
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Admin only command.", "error");
                    break;
                }
                
                try {
                    logToTerminal("🔄 Refreshing game data cache from MySQL...", "system");
                    
                    // Get the refresh function from the data loader
                    // This assumes the data loader was passed in dependencies
                    if (window.gameDataLoader && window.gameDataLoader.refreshCache) {
                        const collections = target ? [target] : null; // If target specified, refresh only that collection
                        const success = await window.gameDataLoader.refreshCache(collections);
                        
                        if (success) {
                            if (target) {
                                logToTerminal(`✅ Cache refreshed for: ${target}`, "success");
                            } else {
                                logToTerminal(`✅ All game data cache refreshed successfully!`, "success");
                                logToTerminal(`Updated: rooms, items, NPCs, monsters, classes, spells, quests`, "system");
                            }
                            
                            // Refresh current room display to show any changes
                            if (currentPlayerRoomId) {
                                await showRoom(currentPlayerRoomId);
                            }
                        } else {
                            logToTerminal(`❌ Cache refresh failed. Check console for errors.`, "error");
                        }
                    } else {
                        logToTerminal(`❌ Cache refresh not available (MySQL mode not enabled)`, "error");
                    }
                } catch (error) {
                    console.error('[ADMIN] Error refreshing cache:', error);
                    logToTerminal(`Error: ${error.message}`, "error");
                }
                break;
            
            case 'npcchats':
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Admin only command.", "error");
                    break;
                }
                const setting = target?.toLowerCase();
                if (setting === 'on') {
                    npcConversationsEnabled = true;
                    quotaExhausted = false;
                    saveNpcConversationSettings();
                    logToTerminal("✅ NPC conversations enabled. NPCs will start chatting when you enter rooms.", "system");
                    // Restart conversations in current room if applicable
                    const currentPlayer = gamePlayers[userId];
                    if (currentPlayer?.roomId) {
                        startNpcConversationsInRoom(currentPlayer.roomId);
                    }
                } else if (setting === 'off') {
                    npcConversationsEnabled = false;
                    saveNpcConversationSettings();
                    // Stop all active conversations
                    Object.keys(npcConversationTimers).forEach(roomId => {
                        stopNpcConversationsInRoom(roomId);
                    });
                    logToTerminal("🔇 NPC conversations disabled.", "system");
                } else {
                    const status = npcConversationsEnabled ? 'ENABLED' : 'DISABLED';
                    const quotaStatus = quotaExhausted ? ' (QUOTA EXHAUSTED)' : '';
                    const autoStatus = npcConversationsAutoDisabled ? ' (AUTO-DISABLED DUE TO PLAYER COUNT)' : '';
                    const activePlayers = Object.keys(gamePlayers).length;
                    logToTerminal(`NPC conversations: ${status}${quotaStatus}${autoStatus}`, "system");
                    logToTerminal(`Active players: ${activePlayers}`, "system");
                    if (npcChatPlayerThreshold > 0) {
                        logToTerminal(`Player threshold: ${npcChatPlayerThreshold}`, "system");
                    }
                    logToTerminal("Usage: npcchats on/off", "system");
                }
                break;
            case 'listmodels':
            case 'list models':
                logToTerminal("Fetching available Gemini models...", "system");
                try {
                    const GEMINI_API_KEY = dependencies.GEMINI_API_KEY;
                    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
                    const response = await fetch(listUrl);
                    if (!response.ok) {
                        logToTerminal(`Error: ${response.status}`, "error");
                        break;
                    }
                    const data = await response.json();
                    logToTerminal("Available models:", "system");
                    data.models.forEach(model => {
                        if (model.supportedGenerationMethods?.includes('generateContent')) {
                            logToTerminal(`- ${model.name}`, "game");
                        }
                    });
                    console.log("Full model data:", data);
                } catch (error) {
                    logToTerminal("Failed to fetch models", "error");
                    console.error(error);
                }
                break;
            case 'testai':
            case 'test ai':
                logToTerminal("Testing AI connection...", "system");
                logToTerminal("Trying multiple model versions...", "system");
                
                // Try current model
                let testResult = await callGeminiForText("Say 'Hello adventurer!' in a friendly tone.");
                logToTerminal(`AI Response: ${testResult}`, "system");
                
                if (testResult === "The AI is silent for now." || testResult.includes("Error")) {
                    logToTerminal("⚠️ AI test failed. Check browser console (F12) for error details.", "error");
                    logToTerminal("Type 'list models' to see available models.", "system");
                    logToTerminal("Common issues:", "error");
                    logToTerminal("1. API key may be invalid or expired", "error");
                    logToTerminal("2. Generative Language API not enabled in Google Cloud", "error");
                    logToTerminal("3. API key has domain/IP restrictions", "error");
                    logToTerminal("4. Free quota exceeded", "error");
                } else {
                    logToTerminal("✅ AI is working correctly!", "system");
                }
                break;
            case 'forceadmin':
                logToTerminal("Forcing admin panel visibility.", "system");
                const adminToggleBtn = document.getElementById('admin-toggle-btn');
                const appContainer = document.getElementById('app-container');
                const adminPanel = document.getElementById('admin-panel');
                adminToggleBtn.classList.remove('hidden');
                appContainer.classList.add('hidden');
                adminPanel.classList.remove('hidden');
                adminPanel.classList.add('flex');
                break;
            case 'spawnbot':
                // Admin command to spawn a bot
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can spawn bots.", "error");
                    break;
                }
                if (window.botSystem) {
                    try {
                        const botId = await window.botSystem.createBot();
                        logToTerminal(`✅ Bot spawned successfully (ID: ${botId})`, "system");
                    } catch (error) {
                        logToTerminal(`❌ Failed to spawn bot: ${error.message}`, "error");
                    }
                } else {
                    logToTerminal("❌ Bot system not initialized", "error");
                }
                break;
            case 'killbots':
                // Admin command to despawn all bots
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can remove bots.", "error");
                    break;
                }
                if (window.botSystem) {
                    try {
                        await window.botSystem.removeAllBots();
                        logToTerminal(`✅ All bots removed`, "system");
                    } catch (error) {
                        logToTerminal(`❌ Failed to remove bots: ${error.message}`, "error");
                    }
                } else {
                    logToTerminal("❌ Bot system not initialized", "error");
                }
                break;
            case 'listbots':
                // Admin command to list all active bots
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can list bots.", "error");
                    break;
                }
                if (window.botSystem) {
                    try {
                        const activeBotIds = window.botSystem.getActiveBots();
                        const totalBots = await window.botSystem.getBotCount();
                        logToTerminal(`Active bots in memory: ${activeBotIds.length}`, "system");
                        logToTerminal(`Total bots in database: ${totalBots}`, "system");
                        if (activeBotIds.length > 0) {
                            activeBotIds.forEach(botId => {
                                logToTerminal(`  • ${botId}`, "system");
                            });
                        }
                    } catch (error) {
                        logToTerminal(`❌ Failed to list bots: ${error.message}`, "error");
                    }
                } else {
                    logToTerminal("❌ Bot system not initialized", "error");
                }
                break;
            case 'startbots':
                // Admin command to start the bot system
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can start bots.", "error");
                    break;
                }
                if (window.botSystem) {
                    const botCount = target ? parseInt(target) : 3;
                    if (isNaN(botCount) || botCount < 1 || botCount > 20) {
                        logToTerminal("Please specify a number between 1 and 20.", "error");
                        break;
                    }
                    window.botSystem.startBotSystem(botCount, 8000);
                    logToTerminal(`🤖 Starting bot system with ${botCount} bots...`, "system");
                    logToTerminal(`Bots will spawn over the next few seconds.`, "system");
                } else {
                    logToTerminal("❌ Bot system not initialized", "error");
                }
                break;
            case 'stopbots':
                // Admin command to stop the bot system
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can stop bots.", "error");
                    break;
                }
                if (window.botSystem) {
                    window.botSystem.stopBotSystem();
                    logToTerminal(`✅ Bot system stopped`, "system");
                } else {
                    logToTerminal("❌ Bot system not initialized", "error");
                }
                break;
            
            case 'kick':
                // Admin command to kick a player from the game
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can kick players.", "error");
                    break;
                }
                if (!target) {
                    logToTerminal("Usage: kick [player name]", "error");
                    break;
                }
                
                // Find the target player
                const kickTarget = Object.entries(gamePlayers).find(([id, player]) => 
                    player.name.toLowerCase() === target.toLowerCase()
                );
                
                if (!kickTarget) {
                    logToTerminal(`Player '${target}' not found.`, "error");
                    break;
                }
                
                const [kickTargetId, kickTargetData] = kickTarget;
                
                // Can't kick yourself
                if (kickTargetId === userId) {
                    logToTerminal("You can't kick yourself!", "error");
                    break;
                }
                
                // Can't kick other admins
                if (kickTargetData.isAdmin) {
                    logToTerminal("You can't kick other administrators.", "error");
                    break;
                }
                
                try {
                    // Send a system message to the kicked player
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: kickTargetData.roomId,
                        text: `⚠️ You have been kicked from the game by an administrator.`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    // Set player as offline and kicked (client will detect this and force logout)
                    const kickPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players`, kickTargetId);
                    await updateDoc(kickPlayerRef, {
                        online: false,
                        kicked: true,
                        kickedAt: serverTimestamp(),
                        lastSeen: serverTimestamp()
                    });
                    
                    logToTerminal(`✅ ${kickTargetData.name} has been kicked from the game.`, "system");
                    
                    // Announce to all players
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: 'global',
                        text: `${kickTargetData.name} has been kicked from the game.`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                } catch (error) {
                    logToTerminal(`Failed to kick player: ${error.message}`, "error");
                    console.error("Kick error:", error);
                }
                break;
            
            case 'mute':
                // Admin command to mute a player
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can mute players.", "error");
                    break;
                }
                if (!target) {
                    logToTerminal("Usage: mute [player name] [duration in minutes, optional]", "error");
                    break;
                }
                
                // Parse target and duration
                const muteParts = cmdText.split(' ');
                const muteTargetName = muteParts[1];
                const muteDuration = muteParts[2] ? parseInt(muteParts[2]) : 60; // Default 60 minutes
                
                // Find the target player
                const muteTarget = Object.entries(gamePlayers).find(([id, player]) => 
                    player.name.toLowerCase() === muteTargetName.toLowerCase()
                );
                
                if (!muteTarget) {
                    logToTerminal(`Player '${muteTargetName}' not found.`, "error");
                    break;
                }
                
                const [muteTargetId, muteTargetData] = muteTarget;
                
                // Can't mute yourself
                if (muteTargetId === userId) {
                    logToTerminal("You can't mute yourself!", "error");
                    break;
                }
                
                // Can't mute other admins
                if (muteTargetData.isAdmin) {
                    logToTerminal("You can't mute other administrators.", "error");
                    break;
                }
                
                try {
                    const muteUntil = Date.now() + (muteDuration * 60 * 1000);
                    const mutePlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players`, muteTargetId);
                    await updateDoc(mutePlayerRef, {
                        muted: true,
                        mutedUntil: muteUntil
                    });
                    
                    // Notify the muted player
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: muteTargetData.roomId,
                        text: `⚠️ You have been muted for ${muteDuration} minutes.`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    logToTerminal(`✅ ${muteTargetData.name} has been muted for ${muteDuration} minutes.`, "system");
                } catch (error) {
                    logToTerminal(`Failed to mute player: ${error.message}`, "error");
                    console.error("Mute error:", error);
                }
                break;
            
            case 'unmute':
                // Admin command to unmute a player
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can unmute players.", "error");
                    break;
                }
                if (!target) {
                    logToTerminal("Usage: unmute [player name]", "error");
                    break;
                }
                
                // Find the target player
                const unmuteTarget = Object.entries(gamePlayers).find(([id, player]) => 
                    player.name.toLowerCase() === target.toLowerCase()
                );
                
                if (!unmuteTarget) {
                    logToTerminal(`Player '${target}' not found.`, "error");
                    break;
                }
                
                const [unmuteTargetId, unmuteTargetData] = unmuteTarget;
                
                try {
                    const unmutePlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players`, unmuteTargetId);
                    await updateDoc(unmutePlayerRef, {
                        muted: false,
                        mutedUntil: null
                    });
                    
                    // Notify the unmuted player
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: unmuteTargetData.roomId,
                        text: `✅ You have been unmuted.`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    logToTerminal(`✅ ${unmuteTargetData.name} has been unmuted.`, "system");
                } catch (error) {
                    logToTerminal(`Failed to unmute player: ${error.message}`, "error");
                    console.error("Unmute error:", error);
                }
                break;
            
            case 'goto':
            case 'teleport':
            case 'tp':
                // Admin command to teleport to any room
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can teleport.", "error");
                    break;
                }
                
                if (!target) {
                    logToTerminal("Usage: goto [room id or name]", "error");
                    logToTerminal("Try 'rooms' to see a list of all rooms.", "system");
                    break;
                }
                
                // Find room by ID or name
                let targetRoomId = null;
                const targetLower = target.toLowerCase();
                
                // First try exact ID match
                if (gameWorld[target]) {
                    targetRoomId = target;
                } else if (gameWorld[targetLower]) {
                    targetRoomId = targetLower;
                } else {
                    // Try to find by room name
                    targetRoomId = Object.keys(gameWorld).find(roomId => {
                        const room = gameWorld[roomId];
                        return room.name && room.name.toLowerCase().includes(targetLower);
                    });
                }
                
                if (!targetRoomId) {
                    logToTerminal(`Room '${target}' not found.`, "error");
                    logToTerminal("Try 'rooms' to see available rooms.", "system");
                    break;
                }
                
                const targetRoom = gameWorld[targetRoomId];
                const oldRoomId = currentPlayerRoomId;
                
                try {
                    // Update player's room
                    await updateDoc(playerRef, { roomId: targetRoomId });
                    
                    // Announce departure in old room
                    if (oldRoomId && oldRoomId !== targetRoomId) {
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: oldRoomId,
                            text: `${playerName} vanishes in a flash of light!`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    }
                    
                    // Announce arrival in new room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: targetRoomId,
                        text: `${playerName} appears in a flash of light!`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    logToTerminal(`✨ You teleport to ${targetRoom.name}!`, "system");
                    
                    // Show the new room
                    await showRoom(targetRoomId);
                } catch (error) {
                    logToTerminal(`Teleport failed: ${error.message}`, "error");
                    console.error("Teleport error:", error);
                }
                break;
            
            case 'rooms':
                // Admin command to list all rooms
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can view the room list.", "error");
                    break;
                }
                
                logToTerminal("=== All Rooms ===", "system");
                const roomList = Object.entries(gameWorld)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .slice(0, 50); // Limit to first 50 to avoid spam
                
                for (const [roomId, room] of roomList) {
                    logToTerminal(`${roomId}: ${room.name || 'Unnamed Room'}`, "game");
                }
                
                if (Object.keys(gameWorld).length > 50) {
                    logToTerminal(`... and ${Object.keys(gameWorld).length - 50} more rooms`, "system");
                }
                logToTerminal(`Total: ${Object.keys(gameWorld).length} rooms`, "system");
                break;
            
            case 'summon':
                // Admin command to teleport a player to you
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can summon players.", "error");
                    break;
                }
                
                if (!target) {
                    logToTerminal("Usage: summon [player name]", "error");
                    break;
                }
                
                // Find the target player
                const summonTarget = Object.entries(gamePlayers).find(([id, player]) => 
                    player.name.toLowerCase() === target.toLowerCase()
                );
                
                if (!summonTarget) {
                    logToTerminal(`Player '${target}' not found.`, "error");
                    break;
                }
                
                const [summonTargetId, summonTargetData] = summonTarget;
                
                if (summonTargetId === userId) {
                    logToTerminal("You can't summon yourself!", "error");
                    break;
                }
                
                try {
                    const summonPlayerRef = doc(db, `/artifacts/${appId}/public/data/mud-players`, summonTargetId);
                    const oldSummonRoom = summonTargetData.roomId;
                    
                    // Update target player's room
                    await updateDoc(summonPlayerRef, { roomId: currentPlayerRoomId });
                    
                    // Announce departure in old room
                    if (oldSummonRoom && oldSummonRoom !== currentPlayerRoomId) {
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: oldSummonRoom,
                            text: `${summonTargetData.name} vanishes in a flash of light!`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    }
                    
                    // Announce arrival in your room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: currentPlayerRoomId,
                        text: `${summonTargetData.name} appears in a flash of light!`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    // Notify the summoned player
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        roomId: currentPlayerRoomId,
                        text: `You have been summoned by ${playerName}!`,
                        isSystem: true,
                        timestamp: serverTimestamp()
                    });
                    
                    logToTerminal(`✨ ${summonTargetData.name} has been summoned!`, "system");
                } catch (error) {
                    logToTerminal(`Summon failed: ${error.message}`, "error");
                    console.error("Summon error:", error);
                }
                break;
            
            case 'invis':
            case 'invisible':
                // Admin command to toggle invisibility
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can become invisible.", "error");
                    break;
                }
                
                const currentInvisState = gamePlayers[userId]?.invisible || false;
                
                try {
                    await updateDoc(playerRef, { invisible: !currentInvisState });
                    
                    if (!currentInvisState) {
                        logToTerminal("👻 You fade from sight...", "system");
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: currentPlayerRoomId,
                            text: `${playerName} fades from sight.`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    } else {
                        logToTerminal("✨ You become visible again.", "system");
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: currentPlayerRoomId,
                            text: `${playerName} fades into view.`,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        });
                    }
                } catch (error) {
                    logToTerminal(`Failed to toggle invisibility: ${error.message}`, "error");
                    console.error("Invisibility error:", error);
                }
                break;
            
            case 'announce':
            case 'broadcast':
                // Admin command to send a message to all rooms
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can make announcements.", "error");
                    break;
                }
                
                if (!target) {
                    logToTerminal("Usage: announce [message]", "error");
                    break;
                }
                
                // Get the full announcement text (including npc_target if it exists)
                const announcementParts = cmdText.split(' ').slice(1);
                const announcementText = announcementParts.join(' ');
                
                if (!announcementText) {
                    logToTerminal("Usage: announce [message]", "error");
                    break;
                }
                
                try {
                    // Send announcement to all rooms
                    const allRoomIds = Object.keys(gameWorld);
                    const announcementPromises = allRoomIds.map(roomId => 
                        addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: roomId,
                            text: `📢 ANNOUNCEMENT: ${announcementText}`,
                            isAnnouncement: true,
                            isSystem: true,
                            timestamp: serverTimestamp()
                        })
                    );
                    
                    await Promise.all(announcementPromises);
                    logToTerminal(`✅ Announcement sent to all ${allRoomIds.length} rooms.`, "system");
                } catch (error) {
                    logToTerminal(`Failed to send announcement: ${error.message}`, "error");
                    console.error("Announcement error:", error);
                }
                break;
            
            case 'setweather':
                // Admin command to change weather
                if (!gamePlayers[userId]?.isAdmin) {
                    logToTerminal("Only admins can change the weather.", "error");
                    break;
                }
                
                if (!target) {
                    logToTerminal("Usage: setweather [sunny/rainy/snowy/stormy/foggy/hot/cold/cloudy]", "error");
                    break;
                }
                
                const weatherType = target.toLowerCase();
                if (typeof weatherSystem !== 'undefined') {
                    const validWeathers = Object.keys(weatherSystem.WEATHER_TYPES);
                    if (!validWeathers.includes(weatherType)) {
                        logToTerminal(`Invalid weather type. Valid options: ${validWeathers.join(', ')}`, "error");
                        break;
                    }
                    
                    try {
                        await weatherSystem.setWeatherState(weatherType);
                        logToTerminal(`✅ Weather changed to: ${weatherType}`, "success");
                        
                        // Announce to all outdoor rooms
                        const weatherDesc = weatherSystem.WEATHER_TYPES[weatherType].description;
                        const outdoorRoomIds = Object.entries(gameWorld)
                            .filter(([id, room]) => !room.isIndoor)
                            .map(([id]) => id);
                        
                        const announcements = outdoorRoomIds.map(roomId =>
                            addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                roomId: roomId,
                                text: `⛅ ${weatherDesc}`,
                                isSystem: true,
                                timestamp: serverTimestamp()
                            })
                        );
                        
                        await Promise.all(announcements);
                    } catch (error) {
                        logToTerminal(`Failed to change weather: ${error.message}`, "error");
                    }
                } else {
                    logToTerminal("Weather system is not initialized.", "error");
                }
                break;
            
            case 'shout':
                // Player command to send a message to all nearby rooms (limited range)
                const shoutText = cmdText.substring(cmdText.indexOf(' ') + 1).trim();
                
                if (!shoutText || shoutText === 'shout') {
                    logToTerminal("Usage: shout [message]", "error");
                    break;
                }
                
                try {
                    // Get current room and all connected rooms
                    const currentRoom = gameWorld[currentPlayerRoomId];
                    const nearbyRoomIds = [currentPlayerRoomId];
                    
                    // Add all rooms connected to current room
                    if (currentRoom.exits) {
                        Object.values(currentRoom.exits).forEach(exitRoomId => {
                            if (gameWorld[exitRoomId]) {
                                nearbyRoomIds.push(exitRoomId);
                            }
                        });
                    }
                    
                    // Send shout to current room and adjacent rooms
                    const shoutPromises = nearbyRoomIds.map(roomId => 
                        addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            roomId: roomId,
                            text: roomId === currentPlayerRoomId 
                                ? `${playerName} shouts, "${shoutText}"`
                                : `You hear ${playerName} shout from nearby, "${shoutText}"`,
                            isShout: true,
                            timestamp: serverTimestamp()
                        })
                    );
                    
                    await Promise.all(shoutPromises);
                    logToTerminal(`You shout, "${shoutText}"`, "action");
                } catch (error) {
                    logToTerminal(`Failed to shout: ${error.message}`, "error");
                    console.error("Shout error:", error);
                }
                break;
            
            default:
                // Check if this is a custom emote/action from Firebase
                if (gameActions[action]) {
                    const emoteText = gameActions[action].replace('{player}', playerName);
                    logToTerminal(emoteText, 'action');
                    
                    // Broadcast to other players in the room
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: emoteText,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    return; // Exit early after handling emote
                }
                
                // Special case for 'emote' command with custom text
                if (action === 'emote' && (target || topic)) {
                    // Combine target and topic for full emote text
                    // Example: "emote looks at Barbarelle thoughtfully" 
                    // might parse as target="Barbarelle" topic="looks at Barbarelle thoughtfully"
                    // We want the full original text after "emote"
                    let emoteAction = target || '';
                    if (topic && topic !== target) {
                        // If topic is different from target, use topic (it usually has the full text)
                        emoteAction = topic;
                    }
                    
                    const emoteText = `${playerName} ${emoteAction}`;
                    logToTerminal(emoteText, 'action');
                    
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: userId,
                        senderName: playerName,
                        roomId: currentPlayerRoomId,
                        text: emoteText,
                        isEmote: true,
                        timestamp: serverTimestamp()
                    });
                    return; // Exit early after handling custom emote
                }
                
                // Fallback: Check if original command starts with "emote" but wasn't parsed correctly
                if (action === 'unknown' && cmdText.toLowerCase().trim().startsWith('emote ')) {
                    const emoteAction = cmdText.substring(6).trim(); // Remove "emote " prefix
                    if (emoteAction) {
                        const emoteText = `${playerName} ${emoteAction}`;
                        logToTerminal(emoteText, 'action');
                        
                        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                            senderId: userId,
                            senderName: playerName,
                            roomId: currentPlayerRoomId,
                            text: emoteText,
                            isEmote: true,
                            timestamp: serverTimestamp()
                        });
                        return; // Exit early after handling emote
                    }
                }
                
                // If the AI couldn't parse it, check if we're in a conversation with an AI NPC
                if (action === 'unknown' && lastNpcInteraction) {
                    const lastNpc = gameNpcs[lastNpcInteraction];
                    if (lastNpc && lastNpc.useAI) {
                        // Treat as conversation reply to AI NPC
                        const npcData = { id: lastNpcInteraction, ...lastNpc };
                        await handleAiNpcInteraction(npcData, 'reply', currentRoom, cmdText);
                        // Keep lastNpcInteraction active for continued conversation
                    } else {
                        // No AI NPC conversation active
                        lastNpcInteraction = null;
                        logToTerminal(`You try to ${cmdText.toLowerCase()}, but nothing happens.`, "action");
                        logToTerminal("Type 'help' for available commands.", "error");
                    }
                } else if (action === 'unknown') {
                    // No AI NPC conversation active
                    lastNpcInteraction = null;
                    logToTerminal(`You try to ${cmdText.toLowerCase()}, but nothing happens.`, "action");
                    logToTerminal("Type 'help' for available commands.", "error");
                } else {
                    logToTerminal(`I don't understand the action '${action}'. Type 'help' for ideas.`, "error");
                }
        }
    }

    // Return public functions
    // Load settings on initialization
    loadNpcConversationSettings();
    
    // Initialize wandering NPCs after a short delay to ensure data is loaded
    setTimeout(() => {
        initializeWanderingNpcs();
    }, 2000);

    return {
        setPlayerInfo,
        setCurrentRoom,
        getCurrentRoom,
        getLastNpcResponseTime: () => lastNpcResponseTime,
        showRoom,
        spawnMonster,
        handleAiNpcInteraction,
        executeParsedCommand,
        logNpcResponse,
        loadLevelConfig,
        loadActions,
        // Player data access
        getPlayerData: () => gamePlayers[userId],
        // NPC Conversation Settings
        getNpcConversationSettings: () => ({
            enabled: npcConversationsEnabled,
            threshold: npcChatPlayerThreshold,
            autoDisabled: npcConversationsAutoDisabled,
            quotaExhausted
        }),
        setNpcConversationSettings: (enabled, threshold) => {
            npcConversationsEnabled = enabled;
            npcChatPlayerThreshold = threshold;
            saveNpcConversationSettings();
            checkNpcConversationPlayerThreshold();
        },
        checkNpcConversationPlayerThreshold,
        // Wandering NPC System
        initializeWanderingNpcs,
        stopNpcWandering,
        getNpcCurrentRoom: (npcId) => npcCurrentRooms[npcId],
        // Death System
        offerDeathChoice,
        handleRespawn,
        handlePermadeath,
        // Corpse Cleanup System
        startCorpseCleanup,
        stopCorpseCleanup,
        // Poison System
        startPoisonTicks,
        stopPoisonTicks
    };
}






