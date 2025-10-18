// game.js - Core game logic and command execution
// This module contains all game functions including combat, movement, item handling, NPC interaction, etc.

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
        logToTerminal,
        callGeminiForText,
        parseCommandWithGemini,
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
        orderBy,
        limit,
        getDocs,
        arrayUnion, 
        arrayRemove,
        serverTimestamp,
        runTransaction,
        signOut
    } = firestoreFunctions;

    let userId = null;
    let playerName = null;
    let currentPlayerRoomId = null;
    let lastNpcInteraction = null;
    let conversationHistory = []; // Track conversation with AI NPCs
    let gameActions = {}; // Store custom actions/emotes
    
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
    
    function getLevelName(level) {
        return LEVEL_NAMES[level] || `Level ${level}`;
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
            const newLevelName = getLevelName(newLevel);
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
            
            // Query top 20 players by XP
            const playersCollection = collection(db, `/artifacts/${appId}/public/data/mud-players`);
            const leaderboardQuery = query(playersCollection, orderBy('xp', 'desc'), limit(20));
            const querySnapshot = await getDocs(leaderboardQuery);
            
            if (querySnapshot.empty) {
                logToTerminal("The leaderboard is empty.", 'game');
                return;
            }
            
            logToTerminal("═══════════════════════════════════════════════", 'system');
            logToTerminal("           🏆 HALL OF CHAMPIONS 🏆", 'system');
            logToTerminal("═══════════════════════════════════════════════", 'system');
            logToTerminal("", 'game');
            
            let rank = 1;
            querySnapshot.forEach((doc) => {
                const player = doc.data();
                const playerLevel = player.level || 1;
                const playerXp = player.xp || 0;
                const playerName = player.name || "Unknown";
                
                // Format rank with medal emojis for top 3
                let rankDisplay = `${rank}.`;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";
                else rankDisplay = `${rank}.`.padEnd(3);
                
                // Format the line with proper spacing
                const nameDisplay = playerName.padEnd(20);
                const levelName = getLevelName(playerLevel);
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

        currentPlayerRoomId = roomId;

        logToTerminal(`\n<span class="text-white text-xl font-bold">${room.name}</span>`, 'game');
        logToTerminal(room.description, 'game');
        
        if (room.items && room.items.length > 0) {
            const itemNames = room.items.map(itemId => gameItems[itemId]?.name || 'an unknown object').join(', ');
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
                const description = monsterTemplate?.description || 'A fearsome creature stands before you.';
                logToTerminal(`<span class="combat-log">${monster.name}</span> is here. ${description}`, 'game');
                logToTerminal(`HP: ${monster.hp}/${monster.maxHp}`, 'system');
            });
        }
        
        // Show other players in the room
        const playersInRoom = Object.values(gamePlayers).filter(p => p.roomId === roomId && p.name !== playerName);
        if (playersInRoom.length > 0) {
            const playerNames = playersInRoom.map(p => p.name).join(', ');
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
    }
    
    async function spawnMonster(monsterId, roomId) {
        const monsterTemplate = gameMonsters[monsterId];
        if (!monsterTemplate) return;

        await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), {
            monsterId: monsterId,
            roomId: roomId,
            name: monsterTemplate.name,
            hp: monsterTemplate.hp,
            maxHp: monsterTemplate.hp
        });
        logToTerminal(`A ${monsterTemplate.name} appears!`, 'combat-log');
    }
    
    async function handleAiNpcInteraction(npc, interactionType, currentRoom, topicOrSpeech = null) {
        // If starting a new conversation with a different NPC, clear history
        if (lastNpcInteraction !== npc.id) {
            conversationHistory = [];
        }
        
        lastNpcInteraction = npc.id;
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
        ${triggerInstructions}${historyContext}
        TASK: ${taskPrompt}
        
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

        // Generate combat description based on verb and damage
        const getCombatDescription = (verb, attacker, target, damage, weaponName = null) => {
            const defaultVerb = 'hit';
            const actionVerb = verb || defaultVerb;
            
            // If we have a weapon, sometimes include it in the description (50% chance)
            const useWeaponInDesc = weaponName && Math.random() < 0.5;
            const weaponPhrase = useWeaponInDesc ? ` with ${weaponName}` : '';
            
            const descriptions = {
                'kick': [
                    `${attacker} kicks ${target}`,
                    `${attacker} delivers a powerful kick to ${target}`,
                    `${attacker} boots ${target}`
                ],
                'punch': [
                    `${attacker} punches ${target}`,
                    `${attacker} lands a solid punch on ${target}`,
                    `${attacker} strikes ${target} with a fist`
                ],
                'slash': [
                    `${attacker} slashes at ${target}${weaponPhrase}`,
                    `${attacker} cuts ${target}${weaponPhrase}`,
                    `${attacker} swipes at ${target}${weaponPhrase}`
                ],
                'stab': [
                    `${attacker} stabs ${target}${weaponPhrase}`,
                    `${attacker} thrusts${weaponPhrase} into ${target}`,
                    `${attacker} pierces ${target}${weaponPhrase}`
                ],
                'bite': [
                    `${attacker} bites ${target}`,
                    `${attacker} sinks teeth into ${target}`,
                    `${attacker} snaps at ${target}`
                ],
                'headbutt': [
                    `${attacker} headbutts ${target}`,
                    `${attacker} rams their head into ${target}`,
                    `${attacker} delivers a crushing headbutt to ${target}`
                ],
                'claw': [
                    `${attacker} claws at ${target}`,
                    `${attacker} rakes ${target} with sharp claws`,
                    `${attacker} scratches ${target}`
                ],
                'hit': [
                    `${attacker} hits ${target}${weaponPhrase}`,
                    `${attacker} strikes ${target}${weaponPhrase}`,
                    `${attacker} attacks ${target}${weaponPhrase}`
                ],
                'attack': [
                    `${attacker} attacks ${target}${weaponPhrase}`,
                    `${attacker} strikes ${target}${weaponPhrase}`,
                    `${attacker} hits ${target}${weaponPhrase}`
                ],
                'swing': [
                    `${attacker} swings${weaponPhrase} at ${target}`,
                    `${attacker} takes a swing at ${target}${weaponPhrase}`,
                    `${attacker} swings wildly at ${target}${weaponPhrase}`
                ]
            };
            
            const verbList = descriptions[actionVerb.toLowerCase()] || descriptions['hit'];
            const description = verbList[Math.floor(Math.random() * verbList.length)];
            return `${description} for ${damage} damage!`;
        };

        // Generate enemy counter-attack description
        const getEnemyAttackDescription = (enemyName, damage) => {
            const actions = [
                `The ${enemyName} strikes back`,
                `The ${enemyName} retaliates`,
                `The ${enemyName} attacks`,
                `The ${enemyName} lashes out`,
                `The ${enemyName} counter-attacks`
            ];
            const action = actions[Math.floor(Math.random() * actions.length)];
            return `${action}, hitting you for ${damage} damage!`;
        };

        // ========== ENHANCED COMBAT SYSTEM ==========
        // Calculate damage output based on all relevant attributes
        const calculateDamage = (attacker, defender, weaponBonus = 0, isMagical = false) => {
            const attackerAttrs = attacker.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            const defenderAttrs = defender.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            
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
            const defenderAttrs = defender.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            
            // Base dodge: 5% + DEX modifier + WIS modifier
            const dexMod = Math.floor((defenderAttrs.dex - 10) / 2);
            const wisMod = Math.floor((defenderAttrs.wis - 10) / 4); // Smaller contribution
            const dodgeChance = 0.05 + (dexMod * 0.02) + (wisMod * 0.01);
            
            return Math.min(0.50, Math.max(0, dodgeChance)); // Cap at 50%
        };
        
        // Apply combat result with detailed logging
        const applyCombatResult = (result, attackerName, defenderName, combatMessages) => {
            if (result.dodged) {
                combatMessages.push({ 
                    msg: `${defenderName} dodges your attack!`, 
                    type: 'combat-log' 
                });
                return;
            }
            
            let damageMsg = `${attackerName} hit ${defenderName} for ${result.damage} damage`;
            
            if (result.isCritical) {
                damageMsg += ` (Critical Hit!)`;
            }
            
            combatMessages.push({ msg: damageMsg + '!', type: 'combat-log' });
            
            // Show combat breakdown if significant bonuses
            const bonusDetails = [];
            if (result.attackBonus > 0) bonusDetails.push(`+${result.attackBonus} STR`);
            if (result.dexBonus > 0) bonusDetails.push(`+${result.dexBonus} DEX`);
            if (result.weaponBonus > 0) bonusDetails.push(`+${result.weaponBonus} weapon`);
            if (result.conReduction > 0) bonusDetails.push(`-${result.conReduction} target CON`);
            
            if (bonusDetails.length > 0) {
                combatMessages.push({ 
                    msg: `(${bonusDetails.join(', ')})`, 
                    type: 'game' 
                });
            }
        };

        // Handle special item types (keys, teleport devices, etc.)
        const handleSpecialItem = async (itemType, itemData, inventoryItem, playerData) => {
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            const specialData = itemData.specialData || {};

            switch(itemType) {
                case 'key':
                    // Keys can unlock doors - future feature
                    // Check if current room has a locked exit that this key unlocks
                    const unlocks = specialData.unlocks; // e.g., "gate", "door"
                    logToTerminal(`You hold up ${itemData.name}. It might unlock something nearby.`, 'system');
                    logToTerminal(`(Key system not yet implemented - keys will unlock doors in future updates)`, 'game');
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
                    logToTerminal(`You open ${itemData.name}. It could store items.`, 'system');
                    logToTerminal(`(Container system not yet implemented - will allow item storage in future updates)`, 'game');
                    break;

                default:
                    logToTerminal(`You're not sure how to use ${itemData.name}.`, 'error');
            }
        };

        switch(action) {
            case 'logout':
                await signOut(auth);
                break;
            case 'look': await showRoom(currentPlayerRoomId); break;
            case 'go':
                 const direction = target.toLowerCase();
                 if (currentRoom.exits && currentRoom.exits[direction]) {
                    const destinationRoomId = currentRoom.exits[direction];
                    const destinationRoom = gameWorld[destinationRoomId];
                    const playerDoc = await getDoc(playerRef);
                    const playerData = playerDoc.data();
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
                            await checkLevelUp(playerData.score, playerData.level || 1);
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
                    
                    // Show the new room
                    await showRoom(destinationRoomId);
                } else { logToTerminal("You can't go that way.", "error"); }
                break;
            case 'get':
                const roomItemIds = currentRoom.items || [];
                const itemIdToGet = roomItemIds.find(id => {
                    const item = gameItems[id];
                    if (!item) return false;
                    
                    // Check ID match
                    if (id.toLowerCase() === target) return true;
                    
                    // Check name match
                    if (item.name.toLowerCase().includes(target)) return true;
                    
                    // Check aliases
                    if (item.aliases && Array.isArray(item.aliases)) {
                        return item.aliases.some(alias => alias.toLowerCase().includes(target));
                    }
                    
                    return false;
                });
                
                if (itemIdToGet) {
                    const item = gameItems[itemIdToGet];
                    if (item.movable === false) {
                        logToTerminal("You can't take that.", "error"); return;
                    }
                    const fullItemObject = { id: itemIdToGet, ...item };
                    await updateDoc(playerRef, { inventory: arrayUnion(fullItemObject) });
                    await updateDoc(roomRef, { items: arrayRemove(itemIdToGet) });
                    logToTerminal(`You take the ${item.name}.`, 'game');
                    
                    // Log to news if item is newsworthy
                    if (item.newsworthy) {
                        await logNews('found', playerName, `found the ${item.name}!`);
                    }
                } else { logToTerminal("You don't see that here.", 'error'); }
                break;
            case 'drop':
                const playerDocDrop = await getDoc(playerRef);
                const inventoryDrop = playerDocDrop.data().inventory || [];
                const itemToDrop = inventoryDrop.find(i => i.id.toLowerCase() === target || i.name.toLowerCase().includes(target));

                if (itemToDrop) {
                    await updateDoc(playerRef, { inventory: arrayRemove(itemToDrop) });
                    await updateDoc(roomRef, { items: arrayUnion(itemToDrop.id) });
                    logToTerminal(`You drop the ${itemToDrop.name}.`, 'game');
                } else { logToTerminal("You aren't carrying that.", 'error'); }
                break;
            case 'say':
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
                     } else {
                         logToTerminal("Say what?", "error");
                     }
                } else { logToTerminal("Say what?", "error"); }
                break;
            case 'inventory':
                const pDocInv = await getDoc(playerRef);
                const inv = pDocInv.data().inventory || [];
                if (inv.length > 0) {
                    logToTerminal("You are carrying:", 'system');
                    inv.forEach(item => logToTerminal(`- ${item.name}`, 'game'));
                } else { logToTerminal("You are not carrying anything.", 'system'); }
                break;
            case 'examine':
                // Special case: leaderboard frame
                if (target && (target.toLowerCase() === 'frame' || target.toLowerCase() === 'leaderboard' || target.toLowerCase() === 'board')) {
                    await displayLeaderboard();
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
                } else if (currentRoom.details && currentRoom.details[target]) {
                    logToTerminal(currentRoom.details[target], 'game');
                } else { 
                    logToTerminal("You see nothing special about that.", 'game'); 
                }
                break;
            case 'buy':
                const vendor = findNpcInRoom(npc_target);
                if (!vendor) { logToTerminal("There's no one here by that name to buy from.", "error"); break; }
                
                const itemToBuy = findItemByName(target);
                if (!itemToBuy || !vendor.sells.includes(itemToBuy.id)) { logToTerminal(`${vendor.shortName || vendor.name} isn't selling that.`, "error"); break; }

                const playerDocBuy = await getDoc(playerRef);
                const playerDataBuy = playerDocBuy.data();
                const playerGold = playerDataBuy.money || 0;

                if (playerGold < itemToBuy.cost) { logToTerminal("You can't afford that.", "error"); break; }

                const newGold = playerGold - itemToBuy.cost;
                await updateDoc(playerRef, {
                    money: newGold,
                    inventory: arrayUnion({id: itemToBuy.id, name: itemToBuy.name, cost: itemToBuy.cost, movable: itemToBuy.movable})
                });
                logToTerminal(`You buy ${itemToBuy.name} from ${vendor.shortName || vendor.name} for ${itemToBuy.cost} gold.`, 'system');
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

                // Find the item in inventory
                const itemInInventory = currentInventory.find(item => 
                    item.name.toLowerCase().includes(itemNameToUse.toLowerCase()) ||
                    item.id.toLowerCase().includes(itemNameToUse.toLowerCase())
                );

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
                
                // Calculate HP restoration
                let newHp = playerDataUse.hp || 10;
                const maxHp = playerDataUse.maxHp || 100;
                if (fullItemData.hpRestore > 0) {
                    newHp = Math.min(maxHp, newHp + fullItemData.hpRestore);
                }

                // Update player data
                await updateDoc(playerRef, {
                    inventory: updatedInventory,
                    hp: newHp
                });

                // Show consumption message
                let consumeMessage = `You ${action} ${itemInInventory.name}.`;
                if (fullItemData.hpRestore > 0) {
                    consumeMessage += ` It restores ${fullItemData.hpRestore} HP!`;
                }
                if (fullItemData.effect) {
                    consumeMessage += ` ${fullItemData.effect}`;
                }
                logToTerminal(consumeMessage, 'system');
                
                // Show current HP if it changed
                if (fullItemData.hpRestore > 0) {
                    logToTerminal(`Current HP: ${newHp}/${maxHp}`, 'game');
                }
                break;

            case 'read':
                // Check if reading an item in inventory
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
                const itemInInventoryRead = inventoryRead.find(item => item.id === itemToRead.id);
                
                if (itemInInventoryRead) {
                    // Reading an item from inventory
                    const fullItemData = gameItems[itemToRead.id];
                    if (!fullItemData || !fullItemData.isReadable) {
                        logToTerminal(`There is nothing to read on ${itemToRead.name}.`, 'error');
                        break;
                    }
                    
                    logToTerminal(`You read ${itemToRead.name}:`, 'system');
                    logToTerminal(fullItemData.readableText || "The text is too faded to read.", 'game');
                } else {
                    // Check if it's a room detail that can be read
                    const roomDetails = currentRoom.details || {};
                    const detailKey = Object.keys(roomDetails).find(key => key.toLowerCase() === target.toLowerCase());
                    
                    if (detailKey) {
                        const detailText = roomDetails[detailKey];
                        // Check if this detail mentions it has text/writing
                        logToTerminal(`You read the ${target}:`, 'system');
                        logToTerminal(detailText, 'game');
                    } else {
                        logToTerminal(`You don't have "${target}" to read. You need to pick it up first.`, 'error');
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
                                
                                // Defender respawns at start with penalties
                                transaction.update(targetPlayerRef, {
                                    roomId: 'start',
                                    hp: defenderData.maxHp,
                                    money: Math.floor((defenderData.money || 0) * 0.9)
                                });
                                
                                // Notify defender
                                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                    senderId: 'system',
                                    senderName: 'System',
                                    roomId: 'start',
                                    text: `You were defeated by ${playerName}! You lost 10% of your gold.`,
                                    timestamp: serverTimestamp()
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
                                    combatMessages.push({ msg: `You have been defeated! You respawn at the Nexus.`, type: 'error' });
                                    transaction.update(attackerRef, {
                                        roomId: 'start',
                                        hp: attackerData.maxHp,
                                        money: Math.floor((attackerData.money || 0) * 0.9)
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
                    targetName && 
                    (m.monsterId.toLowerCase().includes(targetName.toLowerCase()) || m.name.toLowerCase().includes(targetName.toLowerCase()))
                );

                if (!monsterToAttack) {
                    logToTerminal(`There's nothing here by the name "${targetName}" to attack.`, "error");
                    logToTerminal(`Available targets: Use 'who' to see players, 'look' to see monsters.`, "game");
                    break;
                }

                const [monsterInstanceId, monsterInstanceData] = monsterToAttack;
                const monsterRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${monsterInstanceId}`);
                
                // Collect combat messages to log after transaction
                const combatMessages = [];
                
                await runTransaction(db, async (transaction) => {
                    const playerDoc = await transaction.get(playerRef);
                    const roomDoc = await transaction.get(roomRef);
                    const monsterDoc = await transaction.get(monsterRef);

                    if (!playerDoc.exists() || !monsterDoc.exists()) {
                        throw "Player or Monster vanished during the transaction!";
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
                        combatMessages.push({ msg: `The ${monsterData.name} dodges your attack!`, type: 'combat-log' });
                    } else {
                        // Calculate damage with enhanced combat system
                        const attackResult = calculateDamage(playerData, monsterAsEntity, weaponBonus, false);
                        playerDamage = attackResult.damage;
                        newMonsterHp = monsterData.hp - playerDamage;
                        
                        // Apply combat result with detailed logging
                        applyCombatResult(
                            { ...attackResult, dodged: false },
                            'You',
                            `the ${monsterData.name}`,
                            combatMessages
                        );
                    }
                    
                    if (newMonsterHp <= 0) {
                        combatMessages.push({ msg: `You have defeated the ${monsterData.name}!`, type: 'system' });
                        transaction.delete(monsterRef);

                        const updates = {};
                        const newXp = (playerData.xp || 0) + monsterTemplate.xp;
                        const currentLevel = playerData.level || 1;
                        
                        updates.xp = newXp;
                        updates.score = (playerData.score || 0) + monsterTemplate.xp;
                        updates.money = (playerData.money || 0) + monsterTemplate.gold;

                        combatMessages.push({ msg: `You gain ${monsterTemplate.xp} XP and ${monsterTemplate.gold} gold.`, type: 'loot-log' });
                        
                        // Log to news if monster is newsworthy
                        if (monsterTemplate.newsworthy) {
                            // Store for logging after transaction
                            combatMessages.push({ 
                                msg: 'LOG_NEWS', 
                                type: 'news',
                                newsData: { type: 'kill', playerName, event: `defeated the ${monsterData.name}!` }
                            });
                        }
                        
                        if (monsterTemplate.itemDrop && gameItems[monsterTemplate.itemDrop]) {
                            const item = gameItems[monsterTemplate.itemDrop];
                            const droppedItem = { id: monsterTemplate.itemDrop, ...item };
                            updates.inventory = arrayUnion(droppedItem);
                            combatMessages.push({ msg: `The ${monsterData.name} dropped ${item.name}!`, type: 'loot-log' });
                        }
                        
                        if (roomData.monsterSpawns) {
                            const spawnIndex = roomData.monsterSpawns.findIndex(s => s.monsterId === monsterData.monsterId);
                            if(spawnIndex > -1) {
                                const newSpawns = [...roomData.monsterSpawns];
                                newSpawns[spawnIndex].lastDefeated = Date.now();
                                transaction.update(roomRef, { monsterSpawns: newSpawns });
                            }
                        }
                        transaction.update(playerRef, updates);
                    } else if (!monsterDodged) {
                        // Monster survives and counter-attacks
                        transaction.update(monsterRef, { hp: newMonsterHp });
                        
                        // Check if player dodges monster's counter-attack
                        const playerDodgeChance = calculateDodge(playerData);
                        const playerDodged = Math.random() < playerDodgeChance;
                        
                        let monsterDamage = 0;
                        let newPlayerHp = playerData.hp || playerData.maxHp;
                        
                        if (playerDodged) {
                            combatMessages.push({ msg: `You dodge the ${monsterData.name}'s attack!`, type: 'combat-log' });
                        } else {
                            // Calculate monster's counter-attack damage (enhanced with player's CON defense)
                            const monsterCounterResult = calculateDamage(monsterAsEntity, playerData, 0, false);
                            monsterDamage = monsterCounterResult.damage;
                            newPlayerHp = (playerData.hp || playerData.maxHp) - monsterDamage;
                            
                            let counterMsg = `The ${monsterData.name} counter-attacks for ${monsterDamage} damage`;
                            if (monsterCounterResult.isCritical) {
                                counterMsg += ` (Critical Hit!)`;
                            }
                            combatMessages.push({ msg: counterMsg + '!', type: 'combat-log' });
                        }

                        if (!playerDodged && newPlayerHp <= 0) {
                            combatMessages.push({ msg: `You have been defeated! You respawn at the Nexus with a gold penalty.`, type: 'error' });
                            transaction.update(playerRef, {
                                roomId: 'start',
                                hp: playerData.maxHp,
                                money: Math.floor((playerData.money || 0) * 0.9)
                            });
                        } else {
                            transaction.update(playerRef, { hp: newPlayerHp });
                        }
                    }
                });
                
                // Log all messages after transaction completes
                for (const { msg, type, newsData } of combatMessages) {
                    if (type === 'news' && newsData) {
                        // Log news entry
                        await logNews(newsData.type, newsData.playerName, newsData.event);
                    } else if (msg !== 'LOG_NEWS') {
                        logToTerminal(msg, type);
                    }
                }
                
                // Check for level up after combat
                const playerDocAfterCombat = await getDoc(playerRef);
                if (playerDocAfterCombat.exists()) {
                    const playerDataAfter = playerDocAfterCombat.data();
                    await checkLevelUp(playerRef, playerDataAfter.xp || 0, playerDataAfter.level || 1);
                }
                break;
            case 'talk':
                const npcToTalkTo = findNpcInRoom(npc_target);
                if(npcToTalkTo) {
                    if (npcToTalkTo.useAI) {
                        await handleAiNpcInteraction(npcToTalkTo, 'talk', currentRoom);
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
                    const hp = player.hp || player.maxHp || 100;
                    const maxHp = player.maxHp || 100;
                    const hpPercent = Math.round((hp / maxHp) * 100);
                    const levelName = getLevelName(player.level || 1);
                    const isBot = player.isBot ? ' 🤖' : '';
                    const room = gameWorld[player.roomId];
                    const roomName = room ? room.name : 'Unknown';
                    const playerClass = player.class || 'Adventurer';
                    const playerRace = player.race || 'Human';
                    
                    let hpColor = 'game';
                    if (hpPercent < 30) hpColor = 'error';
                    else if (hpPercent < 70) hpColor = 'combat-log';
                    
                    logToTerminal(`${player.name}${isBot} - ${playerRace} ${playerClass} - Level ${player.level} ${levelName} - HP: ${hp}/${maxHp} - ${roomName}`, hpColor);
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
                const levelName = getLevelName(level);
                logToTerminal(`Level: ${level} - ${levelName}${level >= MAX_LEVEL ? ' (MAX)' : ''}`, 'game');
                logToTerminal(`HP: ${hp} / ${playerMaxHp}`, 'game');
                logToTerminal(`MP: ${mp} / ${playerMaxMp}`, 'game');
                
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
                            logToTerminal(`✨ ${spell.name} - ${costStr}${targetStr}`, 'game');
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
                
                // Find the spell
                const spellName = parsedCommand.target.toLowerCase();
                const spellId = knownSpellsCast.find(id => {
                    const spell = gameSpells[id];
                    return spell && spell.name.toLowerCase() === spellName;
                });
                
                if (!spellId) {
                    logToTerminal(`You don't know the spell "${parsedCommand.target}".`, 'error');
                    break;
                }
                
                const spell = gameSpells[spellId];
                
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
                            await updateDoc(playerRef, {
                                hp: newHp,
                                mp: currentMp - spell.mpCost
                            });
                            logToTerminal(`You cast ${spell.name}!`, 'magic');
                            logToTerminal(`You heal yourself for ${healAmount} HP!`, 'success');
                        } else if (spell.statEffects && Object.keys(spell.statEffects).length > 0) {
                            logToTerminal(`You cast ${spell.name}!`, 'magic');
                            logToTerminal(`${spell.description}`, 'game');
                            // TODO: Implement stat buff system with duration
                            await updateDoc(playerRef, { mp: currentMp - spell.mpCost });
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
                            await updateDoc(playerRef, {
                                xp: (pDataCast.xp || 0) + xpGain,
                                mp: currentMp - spell.mpCost
                            });
                            logToTerminal(`You gained ${xpGain} XP!`, 'success');
                            await checkLevelUp();
                        } else {
                            // Monster survives
                            await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${targetMonster.id}`), {
                                hp: newMonsterHp
                            });
                            await updateDoc(playerRef, { mp: currentMp - spell.mpCost });
                        }
                        castSuccess = true;
                        break;
                        
                    case 'single-ally':
                        // Find player in room to heal
                        if (!spellTargetName) {
                            // No target specified, heal self
                            const newHpAlly = Math.min(currentHp + spell.healing, maxHpCast);
                            const healAmountAlly = newHpAlly - currentHp;
                            await updateDoc(playerRef, {
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
                            
                            // Update target's HP
                            await updateDoc(targetPlayerRef, {
                                hp: newTargetHp
                            });
                            
                            // Deduct caster's MP
                            await updateDoc(playerRef, {
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
                        
                        await updateDoc(playerRef, { mp: currentMp - spell.mpCost });
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
                
                await updateDoc(playerRef, {
                    knownSpells: arrayUnion(learnSpellId)
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
                    
                    logToTerminal("--- Your Attributes ---", 'system');
                    logToTerminal(`Level: ${statsLevel} - ${getLevelName(statsLevel)}`, 'game');
                    logToTerminal(`HP: ${statsHp} / ${statsMaxHp}`, 'game');
                    logToTerminal("", 'game'); // Blank line
                    Object.entries(pDataStats.attributes).forEach(([key, value]) => {
                         logToTerminal(`${key.toUpperCase()}: ${value}`, 'game');
                    });
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
            case 'help':
                logToTerminal("--- Help ---", "system");
                logToTerminal("You can now type commands in natural language!", "system");
                logToTerminal("After talking to an AI character, you can reply just by typing.", "system");
                logToTerminal("Core commands: look, go, get, drop, inventory, examine, talk to, ask...about, buy...from, attack, who, say, score, stats, logout, forceadmin.", "system");
                logToTerminal("Combat: 'attack [monster]' or 'attack [player]' - Fight monsters or other players! PvP combat is active.", "system");
                logToTerminal("Magic: 'spells' to view your spells, 'cast [spell name] [target]' to cast spells.", "system");
                logToTerminal("Emotes: wave, dance, laugh, smile, nod, bow, clap, cheer, cry, sigh, shrug, grin, frown, wink, yawn, stretch, jump, sit, stand, kneel, salute, think, ponder, scratch.", "system");
                logToTerminal("Or use 'emote [action]' for custom actions!", "system");
                logToTerminal("Special: 'examine frame' to view the leaderboard!", "system");
                logToTerminal("Test AI: Type 'test ai' to check if AI is working.", "system");
                if (gamePlayers[userId]?.isAdmin) {
                    logToTerminal("--- Admin Commands ---", "system");
                    logToTerminal("learn [spell name] - Learn any spell instantly", "system");
                    logToTerminal("startbots [count] - Start bot system (default: 3 bots)", "system");
                    logToTerminal("stopbots - Stop bot system", "system");
                    logToTerminal("spawnbot - Manually spawn one bot", "system");
                    logToTerminal("listbots - List all active bots", "system");
                    logToTerminal("killbots - Remove all bots from the game", "system");
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
                if (action === 'emote' && target) {
                    const emoteText = `${playerName} ${target}`;
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
    return {
        setPlayerInfo,
        setCurrentRoom,
        getCurrentRoom,
        showRoom,
        spawnMonster,
        handleAiNpcInteraction,
        executeParsedCommand,
        logNpcResponse,
        loadLevelConfig,
        loadActions
    };
}






