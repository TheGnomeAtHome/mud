/**
 * Main application module
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

import { APP_ID, GEMINI_API_KEY, MYSQL_CONFIG } from './config.js';
import { initializeFirebase } from './firebase-init.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';
import { initializeDataLoader } from './data-loader.js';
import { initializeGameLogic } from './game.js';
import { initializeAdminPanel, setGameLogicForSettings } from './admin.js';
import { initializeBotSystem } from './bots.js';
import { initializeWeatherSystem } from './weather.js';
import { initializePlayerPersistence } from './player-persistence.js';
import { 
    callGeminiForText, 
    parseCommandWithGemini,
    callGeminiForRoom,
    callGeminiForMonster,
    callGeminiForItem,
    callGeminiForNpc 
} from './ai.js';

/**
 * Start periodic cleanup of old chat messages from Firebase
 * This is part of the Firebase optimization strategy to reduce storage costs
 * Messages older than 24 hours are automatically deleted
 */
function startMessageCleanup(db, appId, firestoreFunctions) {
    const { collection, query, where, getDocs, deleteDoc, doc, Timestamp } = firestoreFunctions;
    
    async function cleanupOldMessages() {
        try {
            console.log('[Message Cleanup] Starting cleanup of old messages...');
            
            // Calculate cutoff time (24 hours ago)
            const cutoffTime = Timestamp.fromMillis(Date.now() - (24 * 60 * 60 * 1000));
            
            // Query messages older than cutoff
            const messagesRef = collection(db, `/artifacts/${appId}/public/data/mud-messages`);
            const oldMessagesQuery = query(messagesRef, where('timestamp', '<', cutoffTime));
            
            const snapshot = await getDocs(oldMessagesQuery);
            console.log(`[Message Cleanup] Found ${snapshot.size} old messages to delete`);
            
            if (snapshot.size === 0) {
                console.log('[Message Cleanup] No old messages to clean up');
                return;
            }
            
            // Delete messages in batches to avoid overwhelming Firebase
            let deletedCount = 0;
            const deletePromises = [];
            
            snapshot.forEach((docSnapshot) => {
                const docRef = doc(db, `/artifacts/${appId}/public/data/mud-messages/${docSnapshot.id}`);
                deletePromises.push(
                    deleteDoc(docRef)
                        .then(() => {
                            deletedCount++;
                        })
                        .catch(err => {
                            console.error(`[Message Cleanup] Error deleting message ${docSnapshot.id}:`, err);
                        })
                );
            });
            
            // Wait for all deletions to complete
            await Promise.all(deletePromises);
            
            console.log(`[Message Cleanup] Successfully deleted ${deletedCount} old messages`);
        } catch (error) {
            console.error('[Message Cleanup] Error during cleanup:', error);
        }
    }
    
    // Run cleanup immediately on startup
    cleanupOldMessages();
    
    // Run cleanup every hour (3600000ms)
    const cleanupInterval = setInterval(cleanupOldMessages, 3600000);
    
    console.log('[Message Cleanup] Automatic cleanup scheduled (runs every hour)');
    
    // Return cleanup function in case we need to stop it
    return () => {
        clearInterval(cleanupInterval);
        console.log('[Message Cleanup] Automatic cleanup stopped');
    };
}

// Setup auth form switching immediately
function setupAuthFormSwitching() {
    const showRegister = document.getElementById('show-register');
    const showLoginRegister = document.getElementById('show-login-register');
    const showForgotPassword = document.getElementById('show-forgot-password');
    const showLoginForgot = document.getElementById('show-login-forgot');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const authError = document.getElementById('auth-error');
    
    // Helper to add both click and touchend events for better mobile support
    function addMobileClickHandler(element, handler) {
        if (!element) return;
        
        // Click event for desktop
        element.addEventListener('click', handler);
        
        // Touchend for mobile (more reliable than click on some devices)
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            handler(e);
        }, { passive: false });
    }
    
    if (showRegister) {
        addMobileClickHandler(showRegister, (e) => {
            e.preventDefault();
            e.stopPropagation();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            forgotPasswordForm.classList.add('hidden');
            if (authError) authError.textContent = '';
        });
    }
    
    if (showLoginRegister) {
        addMobileClickHandler(showLoginRegister, (e) => {
            e.preventDefault();
            e.stopPropagation();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            forgotPasswordForm.classList.add('hidden');
            if (authError) authError.textContent = '';
        });
    }
    
    if (showForgotPassword) {
        addMobileClickHandler(showForgotPassword, (e) => {
            e.preventDefault();
            e.stopPropagation();
            loginForm.classList.add('hidden');
            forgotPasswordForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            if (authError) authError.textContent = '';
        });
    }
    
    if (showLoginForgot) {
        addMobileClickHandler(showLoginForgot, (e) => {
            e.preventDefault();
            e.stopPropagation();
            forgotPasswordForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            if (authError) authError.textContent = '';
        });
    }
}

// Set up form switching when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuthFormSwitching);
} else {
    setupAuthFormSwitching();
}

export async function initializeApp() {
    console.log('Initializing MUD application...');
    
    // Initialize Firebase
    const firebase = await initializeFirebase();
    const { db, auth, authFunctions, firestoreFunctions } = firebase;
    const { onSnapshot, collection, addDoc, serverTimestamp, doc } = firestoreFunctions;
    
    // Initialize UI
    const ui = initializeUI();
    const { logToTerminal, updateUserInfo, focusInput, setInputEnabled, input } = ui;
    
    // Initialize Authentication
    const authModule = initializeAuth(firebase, ui, APP_ID);
    
    // Initialize Data Loader
    const dataLoader = initializeDataLoader(firebase, APP_ID);
    
    // Expose data loader globally for cache refresh command
    window.gameDataLoader = dataLoader;
    
    // Initialize Player Persistence (Phase 3 optimization)
    const playerPersistence = initializePlayerPersistence(firebase, APP_ID);
    
    // Expose player persistence globally
    window.playerPersistence = playerPersistence;
    
    // Start loading game data immediately (needed for class selection during character creation)
    dataLoader.loadGameData().catch(error => {
        console.error('Error preloading game data:', error);
    });
    
    // Initialize game components
    let gameLogic = null;
    let adminPanelFunctions = null;
    let botSystem = null;
    let userId = null;
    let playerName = null;
    let sessionStartTime = Date.now();
    let unsubscribers = [];
    let inactivityTimer = null;
    
    // Show/hide UI elements
    const appContainer = document.getElementById('app-container');
    const adminPanel = document.getElementById('admin-panel');
    const adminToggleBtn = document.getElementById('admin-toggle-btn');
    
    // Character creation modal
    const charCreateModal = document.getElementById('character-creation-modal');
    const charCreateForm = document.getElementById('start-adventure-btn');
    
    // Inactivity timeout (30 minutes)
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            logToTerminal("You have been logged out due to inactivity.", "error");
            authFunctions.signOut(auth);
        }, 30 * 60 * 1000);
    }
    
    // Track displayed messages to prevent duplicates from serverTimestamp updates
    const displayedMessages = new Set();
    
    // Setup message listener for real-time chat
    function setupMessageListener() {
        const unsub = onSnapshot(collection(db, `/artifacts/${APP_ID}/public/data/mud-messages`), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    const docId = change.doc.id;
                    
                    // Skip if we've already displayed this message
                    if (displayedMessages.has(docId)) {
                        return;
                    }
                    displayedMessages.add(docId);
                    
                    let messageTime = 0;
                    if (msg.timestamp) {
                        if (msg.timestamp.toMillis) {
                            messageTime = msg.timestamp.toMillis();
                        } else if (msg.timestamp.seconds) {
                            messageTime = msg.timestamp.seconds * 1000;
                        } else {
                            messageTime = msg.timestamp;
                        }
                    }
                    
                    const myCurrentRoom = gameLogic ? gameLogic.getCurrentRoom() : null;
                    const myCurrentRoomId = typeof myCurrentRoom === 'string' ? myCurrentRoom : myCurrentRoom?.id || null;
                    
                    // Special handling for NPC conversations - always show if in same room and new
                    if (msg.isNpcConversation && msg.roomId === myCurrentRoomId && messageTime >= sessionStartTime) {
                        logToTerminal(`<span class="text-lime-300">${msg.username}</span> says, "${msg.text}"`, 'game');
                        return; // Skip the normal message processing
                    }
                    
                    // Special handling for proactive NPC greetings - always show if in same room and new
                    if (msg.isNpcGreeting && msg.roomId === myCurrentRoomId && messageTime >= sessionStartTime) {
                        // Check if message starts with pronouns like "He", "She", etc. (action descriptions)
                        const startsWithPronoun = /^(he|she|they|it)\s+/i.test(msg.text.trim());
                        if (startsWithPronoun) {
                            // Replace pronoun with NPC name and wrap entire message in lime color
                            const textWithName = msg.text.trim().replace(/^(he|she|they|it)\s+/i, `${msg.username} `);
                            logToTerminal(`<span class="text-lime-300">${textWithName}</span>`, 'game');
                        } else {
                            // Direct dialogue or action, show as-is with lime color
                            logToTerminal(`<span class="text-lime-300">${msg.text}</span>`, 'game');
                        }
                        return; // Skip the normal message processing
                    }
                    
                    // Special handling for NPC responses to room chat - always show if in same room and new
                    if (msg.isNpcResponse && msg.roomId === myCurrentRoomId && messageTime >= sessionStartTime) {
                        logToTerminal(`<span class="text-lime-300">${msg.username}</span> says, "${msg.text}"`, 'game');
                        return; // Skip the normal message processing
                    }
                    
                    // Special handling for whisper messages - only show to sender and recipient
                    if (msg.isWhisper) {
                        if (msg.senderId === userId) {
                            // Already shown when sent, skip here
                            return;
                        } else if (msg.recipientId === userId) {
                            // Show whisper to recipient
                            logToTerminal(`<span class="text-cyan-300">${msg.senderName}</span> whispers to you: "${msg.text}"`, 'chat');
                            return;
                        } else {
                            // Not for this player, skip
                            return;
                        }
                    }
                    
                    // Special handling for guild chat - show to all guild members
                    if (msg.isGuildChat) {
                        // Check if this player is in the guild
                        const myPlayer = gamePlayers[userId];
                        if (myPlayer && myPlayer.guildId === msg.guildId && messageTime >= sessionStartTime) {
                            const sender = msg.senderId === userId ? "You" : msg.senderName;
                            logToTerminal(`[Guild] ${sender}: ${msg.text}`, 'system');
                        }
                        return; // Skip normal processing
                    }
                    
                    if (messageTime >= sessionStartTime && msg.roomId === myCurrentRoom) {
                        if (msg.isPartyChat) {
                            const sender = msg.senderId === userId ? "You" : msg.senderName;
                            logToTerminal(`[Party] ${sender}: ${msg.text}`, 'party');
                        } else if (msg.isSystem) {
                            logToTerminal(msg.text, 'system');
                        } else if (msg.isEmote) {
                            // Show sender name for emotes unless it's already in the text
                            const sender = msg.senderId === userId ? "You" : msg.senderName;
                            if (sender && !msg.text.startsWith(sender)) {
                                logToTerminal(`${sender} ${msg.text}`, 'action');
                            } else {
                                logToTerminal(msg.text, 'action');
                            }
                        } else if (msg.text.includes(' leaves ') || msg.text.includes(' arrives')) {
                            logToTerminal(msg.text, 'system');
                        } else {
                            const sender = msg.senderId === userId ? "You" : `<span class="text-fuchsia-400">${msg.senderName}</span>`;
                            const verb = msg.senderId === userId ? "say" : "says";
                            logToTerminal(`${sender} ${verb}, "${msg.text}"`, 'chat');
                        }
                    }
                }
            });
        });
        unsubscribers.push(unsub);
    }
    
    // Character creation functions
    function rollRandomStats() {
        function roll3d6() {
            return Math.floor(Math.random() * 6) + 1 +
                   Math.floor(Math.random() * 6) + 1 +
                   Math.floor(Math.random() * 6) + 1;
        }
        
        return {
            str: roll3d6(),
            dex: roll3d6(),
            con: roll3d6(),
            int: roll3d6(),
            wis: roll3d6(),
            cha: roll3d6()
        };
    }
    
    function displayRolledStats(stats) {
        document.getElementById('stat-str').textContent = stats.str;
        document.getElementById('stat-dex').textContent = stats.dex;
        document.getElementById('stat-con').textContent = stats.con;
        document.getElementById('stat-int').textContent = stats.int;
        document.getElementById('stat-wis').textContent = stats.wis;
        document.getElementById('stat-cha').textContent = stats.cha;
    }
    
    let currentStats = rollRandomStats();
    displayRolledStats(currentStats);
    
    document.getElementById('reroll-stats-btn').addEventListener('click', () => {
        currentStats = rollRandomStats();
        displayRolledStats(currentStats);
    });
    
    // Populate class selector from Firebase
    function populateClassSelector() {
        const classSelect = document.getElementById('char-class');
        const classDesc = document.getElementById('class-desc');
        
        // Check if classes are loaded yet
        const classes = dataLoader.gameData.gameClasses || {};
        if (Object.keys(classes).length === 0) {
            classSelect.innerHTML = '<option value="">Loading classes...</option>';
            // Retry after a short delay if classes haven't loaded yet
            setTimeout(populateClassSelector, 500);
            return;
        }
        
        classSelect.innerHTML = '<option value="">-- Select a Class --</option>';
        
        Object.entries(classes).forEach(([id, classData]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = classData.name || id;
            option.dataset.description = classData.description || '';
            classSelect.appendChild(option);
        });
        
        // Remove any existing change listeners to avoid duplicates
        const newClassSelect = classSelect.cloneNode(true);
        classSelect.parentNode.replaceChild(newClassSelect, classSelect);
        
        // Show class description on selection
        newClassSelect.addEventListener('change', () => {
            const selectedOption = newClassSelect.options[newClassSelect.selectedIndex];
            classDesc.textContent = selectedOption.dataset.description || '';
        });
    }
    
    document.getElementById('start-adventure-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        
        const characterName = document.getElementById('char-name').value.trim();
        const race = document.getElementById('char-race').value;
        const characterClass = document.getElementById('char-class').value;
        const gender = document.getElementById('char-gender').value;
        const age = document.getElementById('char-age').value;
        const description = document.getElementById('char-description').value.trim();
        
        if (!characterName) {
            alert('Please enter a character name');
            return;
        }
        
        // Make class optional if no classes exist yet
        if (!characterClass && Object.keys(dataLoader.gameData.gameClasses).length > 0) {
            alert('Please select a character class');
            return;
        }
        
        // Get class data and apply bonuses (if class selected)
        const classData = characterClass ? dataLoader.gameData.gameClasses[characterClass] : null;
        const finalStats = { ...currentStats };
        let maxHp = 100;
        
        if (classData && classData.statBonuses) {
            finalStats.str += classData.statBonuses.str || 0;
            finalStats.dex += classData.statBonuses.dex || 0;
            finalStats.con += classData.statBonuses.con || 0;
            finalStats.int += classData.statBonuses.int || 0;
            finalStats.wis += classData.statBonuses.wis || 0;
            finalStats.cha += classData.statBonuses.cha || 0;
            maxHp += classData.hpBonus || 0;
        }
        
        // Check if this is the first player (should be admin)
        let isFirstPlayer = false;
        try {
            const playersSnapshot = await firestoreFunctions.getDocs(
                firestoreFunctions.collection(db, `/artifacts/${APP_ID}/public/data/mud-players`)
            );
            isFirstPlayer = playersSnapshot.empty;
        } catch (error) {
            console.error('Error checking player count:', error);
        }
        
        // Calculate initial MP based on class
        let maxMp = 100;
        if (classData && classData.mpBonus) {
            maxMp += classData.mpBonus;
        }
        
        const playerData = {
            name: characterName,
            race: race,
            class: characterClass || 'Adventurer',
            gender: gender,
            age: parseInt(age) || 25,
            description: description || 'A mysterious adventurer.',
            roomId: 'start',
            inventory: [],
            equipment: {},
            knownSpells: [], // Player starts with no spells
            completedQuests: [],
            activeQuests: [],
            money: 100,
            hp: maxHp,
            maxHp: maxHp,
            mp: maxMp,
            maxMp: maxMp,
            xp: 0,
            level: 1,
            score: 0,
            str: finalStats.str,
            dex: finalStats.dex,
            con: finalStats.con,
            int: finalStats.int,
            wis: finalStats.wis,
            cha: finalStats.cha,
            isAdmin: isFirstPlayer, // First player becomes admin
            monstersKilled: 0,
            deaths: 0,
            online: true,
            lastSeen: serverTimestamp(),
            createdAt: Date.now()
        };
        
        try {
            console.log('[CharCreate] Creating new character...');
            
            // Phase 3: Save permanent data to MySQL
            await playerPersistence.savePlayerCharacter(userId, playerData);
            
            // Create Firebase session (real-time data only)
            await playerPersistence.createSession(userId, playerData);
            
            console.log('[CharCreate] ✓ Character created in MySQL + Firebase session');
            
            charCreateModal.classList.add('hidden');
            playerName = characterName;
            await initializePlayerGame(playerData);
        } catch (error) {
            console.error('Error creating character:', error);
            alert('Failed to create character. Please try again.');
        }
    });
    
    // Initialize player game after character creation or login
    async function initializePlayerGame(playerData) {
        try {
            appContainer.classList.remove('hidden');
            logToTerminal("Welcome to the M.U.D. - The Digital Realm!", "system");
            logToTerminal("Type 'help' for a list of commands.", "system");
            logToTerminal("Loading game world...", "system");
            focusInput();
            
            console.log('[Init] Starting game data load...');
            const worldReady = await dataLoader.loadGameData(userId);
            if (!worldReady) {
                logToTerminal("Failed to initialize the game world. Please reload.", "error");
                return;
            }
            console.log('[Init] Game data loaded successfully');
        
        const { gameWorld, gameItems, gameNpcs, gameMonsters, gamePlayers, activeMonsters, gameClasses, gameSpells, gameGuilds, gameQuests, gameParties } = dataLoader.gameData;
        
        // Check if player should be admin - either already is, or if there are no admins
        let shouldBeAdmin = playerData.isAdmin || false;
        if (!shouldBeAdmin) {
            const hasAnyAdmin = Object.values(gamePlayers).some(p => p.isAdmin);
            if (!hasAnyAdmin) {
                shouldBeAdmin = true;
                // Update player document to grant admin
                try {
                    await firestoreFunctions.updateDoc(
                        firestoreFunctions.doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`),
                        { isAdmin: true }
                    );
                    playerData.isAdmin = true;
                    logToTerminal("You have been granted admin privileges (first user).", "system");
                } catch (error) {
                    console.error('Error granting admin:', error);
                }
            }
        }
        
        if (shouldBeAdmin || playerData.isAdmin) {
            adminToggleBtn.classList.remove('hidden');
        }
        
        console.log('[Init] Initializing admin panel...');
        console.log('[Init] MYSQL_CONFIG =', MYSQL_CONFIG);
        // Initialize admin panel
        adminPanelFunctions = initializeAdminPanel({
            db,
            appId: APP_ID,
            gameWorld,
            gameItems,
            gameNpcs,
            gameMonsters,
            gamePlayers,
            gameClasses,
            gameSpells,
            gameGuilds,
            gameQuests,
            logToTerminal,
            firestoreFunctions,
            mysqlConfig: MYSQL_CONFIG
        });
        console.log('[Init] Admin panel initialized');
        
        console.log('[Init] Initializing game logic...');
        // Initialize game logic
        gameLogic = initializeGameLogic({
            db,
            appId: APP_ID,
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
            GEMINI_API_KEY,
            authFunctions,
            firestoreFunctions
        });
        console.log('[Init] Game logic initialized');
        
        console.log('[Init] Starting corpse cleanup system...');
        // Start periodic cleanup of old monster corpses
        gameLogic.startCorpseCleanup();
        console.log('[Init] Corpse cleanup system started');
        
        console.log('[Init] Starting poison tick system...');
        // Start poison damage over time system
        gameLogic.startPoisonTicks();
        console.log('[Init] Poison tick system started');
        
        console.log('[Init] Starting message cleanup system...');
        // Start periodic cleanup of old chat messages (Firebase optimization)
        startMessageCleanup(db, APP_ID, firestoreFunctions);
        console.log('[Init] Message cleanup system started');
        
        console.log('[Init] Initializing weather system...');
        // Initialize weather system
        window.weatherSystem = initializeWeatherSystem({
            db,
            appId: APP_ID,
            gameWorld,
            gameItems,
            gamePlayers,
            logToTerminal,
            firestoreFunctions
        });
        const weatherUnsub = await weatherSystem.initialize(userId);
        unsubscribers.push(weatherUnsub);
        console.log('[Init] Weather system initialized');
        
        console.log('[Init] Loading level config...');
        await gameLogic.loadLevelConfig(db, APP_ID);
        console.log('[Init] Loading actions...');
        await gameLogic.loadActions(db, APP_ID);
        console.log('[Init] Setting player info...');
        console.log('[Init] Setting player info...');
        gameLogic.setPlayerInfo(userId, playerData.name, playerData.roomId);
        
        // Pass gameLogic to settings panel
        setGameLogicForSettings(gameLogic);
        console.log('[Init] Game logic connected to settings panel');
        
        // Expose gamePlayers globally for admin panel
        window.gamePlayers = gamePlayers;
        
        // Expose death choice functions globally for death system
        window.offerDeathChoice = gameLogic.offerDeathChoice;
        window.handleRespawn = gameLogic.handleRespawn;
        window.handlePermadeath = gameLogic.handlePermadeath;
        
        console.log('[Init] Initializing bot system...');
        // Initialize bot system
        botSystem = initializeBotSystem({
            db,
            appId: APP_ID,
            gameWorld,
            gameItems,
            gameNpcs,
            logToTerminal,
            firestoreFunctions
        });
        window.botSystem = botSystem;
        console.log('[Init] Bot system initialized');
        
        console.log('[Init] Setting up message listener...');
        setupMessageListener();
        resetInactivityTimer();
        
        // Monitor player document for kick flag
        console.log('[Init] Setting up kick detection...');
        const playerDocRef = doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`);
        const kickUnsub = onSnapshot(playerDocRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.kicked === true) {
                    logToTerminal("⚠️ You have been kicked from the game by an administrator.", "error");
                    setTimeout(async () => {
                        await authFunctions.signOut(auth);
                        window.location.reload();
                    }, 2000);
                }
            }
        });
        unsubscribers.push(kickUnsub);
        console.log('[Init] Kick detection enabled');
        
        // Set player as online and start heartbeat
        console.log('[Init] Setting up player heartbeat...');
        const playerRef = doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`);
        
        // Set player as online immediately
        try {
            await firestoreFunctions.setDoc(playerRef, {
                online: true,
                lastSeen: serverTimestamp()
            }, { merge: true });
            console.log('[Init] Player set to online');
        } catch (error) {
            console.error('[Init] Error setting online status:', error.message);
        }
        
        // Heartbeat - update lastSeen every 30 seconds
        const heartbeatInterval = setInterval(async () => {
            try {
                await firestoreFunctions.updateDoc(playerRef, {
                    lastSeen: serverTimestamp(),
                    online: true // Also update online status in case it was set to false
                });
                console.log('[Heartbeat] Player presence updated');
            } catch (error) {
                // If update fails due to permissions, try to set the document instead
                console.warn('[Heartbeat] Update failed, attempting setDoc with merge:', error.message);
                try {
                    await firestoreFunctions.setDoc(playerRef, {
                        lastSeen: serverTimestamp(),
                        online: true
                    }, { merge: true });
                    console.log('[Heartbeat] Player presence set via merge');
                } catch (setError) {
                    console.error('[Heartbeat] Both update and setDoc failed. Check Firebase security rules:', setError.message);
                }
            }
        }, 30000); // 30 seconds
        
        // Set player as offline when page unloads
        window.addEventListener('beforeunload', async () => {
            try {
                await firestoreFunctions.updateDoc(playerRef, {
                    online: false,
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error('[Cleanup] Error setting offline status:', error);
            }
        });
        
        // Cleanup heartbeat on logout
        unsubscribers.push(() => clearInterval(heartbeatInterval));
        console.log('[Init] Heartbeat enabled - updating presence every 30 seconds');
        
        // Initialize screen reader mode if previously enabled
        const screenReaderMode = localStorage.getItem('screenReaderMode') === 'true';
        if (screenReaderMode) {
            const terminalOutput = document.getElementById('terminal-output');
            terminalOutput.setAttribute('role', 'log');
            terminalOutput.setAttribute('aria-live', 'polite');
            terminalOutput.setAttribute('aria-atomic', 'false');
            terminalOutput.setAttribute('aria-relevant', 'additions');
            
            const commandInput = document.getElementById('command-input');
            commandInput.setAttribute('aria-label', 'Game command input');
            commandInput.setAttribute('aria-describedby', 'terminal-output');
            
            console.log('[Accessibility] Screen reader mode auto-enabled');
        }
        
        // Set up real-time room change listener for admin edits
        console.log('[Init] Setting up room change listener for admin edits...');
        const roomsCollection = collection(db, `/artifacts/${APP_ID}/public/data/mud-rooms`);
        const roomsUnsub = onSnapshot(roomsCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const roomId = change.doc.id;
                    const newRoomData = change.doc.data();
                    
                    // Preserve existing item entries from local cache when updating
                    const oldRoomData = gameWorld[roomId];
                    if (oldRoomData && oldRoomData.items && newRoomData.items) {
                        newRoomData.items = newRoomData.items.map((item, index) => {
                            // If item is an object with entries, preserve them
                            if (typeof item === 'object' && item.entries) {
                                return item;
                            }
                            // If old data had entries for this item, preserve them
                            const oldItem = oldRoomData.items[index];
                            if (oldItem && typeof oldItem === 'object' && oldItem.entries) {
                                // Merge: keep ID from new data, preserve entries from old data
                                const itemId = typeof item === 'string' ? item : item.id;
                                if (oldItem.id === itemId) {
                                    return { ...item, entries: oldItem.entries };
                                }
                            }
                            return item;
                        });
                    }
                    
                    // Update local cache
                    gameWorld[roomId] = { id: roomId, ...newRoomData };
                    
                    // If this is the current room, refresh the display
                    const currentRoom = gameLogic.getCurrentRoom();
                    if (currentRoom && currentRoom.id === roomId) {
                        logToTerminal("✨ The room shimmers as reality shifts around you...", "system");
                        setTimeout(() => {
                            gameLogic.showRoom();
                        }, 300);
                    }
                }
            });
        });
        unsubscribers.push(roomsUnsub);
        console.log('[Init] Room change listener active');
        
        // Set up real-time item change listener for admin edits
        console.log('[Init] Setting up item change listener for admin edits...');
        const itemsCollection = collection(db, `/artifacts/${APP_ID}/public/data/mud-items`);
        const itemsUnsub = onSnapshot(itemsCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const itemId = change.doc.id;
                    const newItemData = change.doc.data();
                    
                    // Update local cache
                    gameItems[itemId] = { id: itemId, ...newItemData };
                    
                    // If item is in current room or player has it, refresh display
                    const currentRoom = gameLogic.getCurrentRoom();
                    if (currentRoom) {
                        const itemInRoom = currentRoom.items?.some(item => {
                            return (typeof item === 'string' ? item === itemId : item?.id === itemId);
                        });
                        
                        if (itemInRoom) {
                            logToTerminal(`✨ ${newItemData.name} glows briefly as it transforms...`, "system");
                            setTimeout(() => {
                                gameLogic.showRoom();
                            }, 300);
                        }
                    }
                }
            });
        });
        unsubscribers.push(itemsUnsub);
        console.log('[Init] Item change listener active');
        
        // Set up real-time NPC change listener for admin edits
        console.log('[Init] Setting up NPC change listener for admin edits...');
        const npcsCollection = collection(db, `/artifacts/${APP_ID}/public/data/mud-npcs`);
        const npcsUnsub = onSnapshot(npcsCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const npcId = change.doc.id;
                    const newNpcData = change.doc.data();
                    
                    // Update local cache
                    gameNpcs[npcId] = { id: npcId, ...newNpcData };
                    
                    // If NPC is in current room, refresh display
                    const currentRoom = gameLogic.getCurrentRoom();
                    if (currentRoom && currentRoom.npcs?.includes(npcId)) {
                        logToTerminal(`✨ ${newNpcData.name} flickers momentarily...`, "system");
                        setTimeout(() => {
                            gameLogic.showRoom();
                        }, 300);
                    }
                }
            });
        });
        unsubscribers.push(npcsUnsub);
        console.log('[Init] NPC change listener active');
        
        // Set up real-time Monster change listener for admin edits
        console.log('[Init] Setting up monster change listener for admin edits...');
        const monstersCollection = collection(db, `/artifacts/${APP_ID}/public/data/mud-monsters`);
        const monstersUnsub = onSnapshot(monstersCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const monsterId = change.doc.id;
                    const newMonsterData = change.doc.data();
                    
                    // Update local cache
                    gameMonsters[monsterId] = { id: monsterId, ...newMonsterData };
                    
                    logToTerminal(`✨ The ${newMonsterData.name} template has been updated...`, "system");
                }
            });
        });
        unsubscribers.push(monstersUnsub);
        console.log('[Init] Monster change listener active');
        
        // Set up real-time Guild change listener for new guilds and updates
        console.log('[Init] Setting up guild change listener...');
        const guildsCollection = collection(db, `/artifacts/${APP_ID}/public/data/mud-guilds`);
        const guildsUnsub = onSnapshot(guildsCollection, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const guildId = change.doc.id;
                    const newGuildData = change.doc.data();
                    
                    // Update local cache
                    gameGuilds[guildId] = { id: guildId, ...newGuildData };
                    
                    // Refresh admin panel guild selector if available
                    if (adminPanelFunctions && adminPanelFunctions.populateGuildSelector) {
                        adminPanelFunctions.populateGuildSelector();
                    }
                }
            });
        });
        unsubscribers.push(guildsUnsub);
        console.log('[Init] Guild change listener active');
        
        console.log('[Init] Showing initial room...');
        await gameLogic.showRoom();
        console.log('[Init] Initialization complete!');
        logToTerminal("Ready to play! Game fully loaded.", "success");
        
        // Check for pending guild invites
        if (playerData.guildInvites && playerData.guildInvites.length > 0) {
            logToTerminal("\n📨 You have pending guild invitations!", "system");
            playerData.guildInvites.forEach(invite => {
                logToTerminal(`  • ${invite.guildName} (invited by ${invite.invitedBy})`, "game");
            });
            logToTerminal("Use 'guild accept [guild name]' to join a guild.", "system");
        }
        } catch (error) {
            console.error('[Init] Error during game initialization:', error);
            logToTerminal(`Failed to initialize game: ${error.message}`, "error");
            logToTerminal("Please refresh the page and try again.", "error");
        }
    }
    
    // Command input handler
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            resetInactivityTimer();
            const cmdText = input.value.trim();
            if (cmdText) {
                input.value = '';
                setInputEnabled(false);
                
                // Expand command shortcuts when they're standalone
                let expandedCmdText = cmdText;
                const lowerCmd = cmdText.toLowerCase();
                if (lowerCmd === 'i' || lowerCmd === 'inv') {
                    expandedCmdText = 'inventory';
                }
                
                logToTerminal(`> ${cmdText}`, 'chat');
                
                const simpleCommands = ['help', 'inventory', 'i', 'inv', 'score', 'stats', 'news', 'who', 'logout', 'forceadmin', 'look', 'testai', 'test ai', 'listmodels', 'list models', 'listbots', 'killbots', 'spawnbot', 'stopbots', 'rooms', 'invis', 'invisible', 'shout', 'screenreader'];
                const directions = ['north', 'south', 'east', 'west', 'up', 'down', 'n', 's', 'e', 'w', 'u', 'd'];
                const lowerCmdText = expandedCmdText.toLowerCase();
                let parsedCommand;
                
                // Handle multi-word admin commands
                if (lowerCmdText.startsWith('announce ') || lowerCmdText.startsWith('broadcast ')) {
                    const parts = expandedCmdText.split(' ');
                    const target = parts.slice(1).join(' ');
                    parsedCommand = { action: 'announce', target: target };
                } else if (lowerCmdText.startsWith('goto ') || lowerCmdText.startsWith('tp ') || lowerCmdText.startsWith('teleport ')) {
                    const parts = expandedCmdText.split(' ');
                    const action = parts[0].toLowerCase();
                    const target = parts.slice(1).join(' ');
                    parsedCommand = { action: action === 'tp' ? 'goto' : action, target: target };
                } else if (lowerCmdText.startsWith('summon ')) {
                    const target = expandedCmdText.substring('summon '.length).trim();
                    parsedCommand = { action: 'summon', target: target };
                } else if (lowerCmdText.startsWith('kick ')) {
                    const target = expandedCmdText.substring('kick '.length).trim();
                    parsedCommand = { action: 'kick', target: target };
                } else if (lowerCmdText.startsWith('mute ')) {
                    const parts = expandedCmdText.split(' ');
                    parsedCommand = { action: 'mute', target: parts[1] };
                } else if (lowerCmdText.startsWith('unmute ')) {
                    const target = expandedCmdText.substring('unmute '.length).trim();
                    parsedCommand = { action: 'unmute', target: target };
                } else if (lowerCmdText.startsWith('startbots')) {
                    const parts = lowerCmdText.split(' ');
                    parsedCommand = { action: 'startbots', target: parts[1] || null };
                } else if (simpleCommands.includes(lowerCmdText)) {
                    parsedCommand = { action: lowerCmdText };
                } else if (directions.includes(lowerCmdText)) {
                    const directionMap = { 'n': 'north', 's': 'south', 'e': 'east', 'w': 'west', 'u': 'up', 'd': 'down' };
                    const fullDirection = directionMap[lowerCmdText] || lowerCmdText;
                    parsedCommand = { action: 'go', target: fullDirection };
                } else if (lowerCmdText.split(' ').length === 1) {
                    parsedCommand = { action: lowerCmdText };
                } else {
                    parsedCommand = await parseCommandWithGemini(expandedCmdText);
                    console.log("Parsed command:", parsedCommand);
                }
                
                try {
                    if (!gameLogic) {
                        logToTerminal("Game not initialized yet. Please wait for authentication to complete.", "error");
                        setInputEnabled(true);
                        return;
                    }
                    console.log('[Command] Executing parsed command:', parsedCommand);
                    await gameLogic.executeParsedCommand(parsedCommand, expandedCmdText);
                    console.log('[Command] Command execution complete');
                } catch (error) {
                    console.error("Error executing command:", error);
                    logToTerminal(`An error occurred: ${error.message || error}`, "error");
                } finally {
                    setInputEnabled(true);
                }
            }
        }
    });
    
    // Admin panel toggle
    adminToggleBtn.addEventListener('click', () => {
        appContainer.classList.toggle('hidden');
        adminPanel.classList.toggle('hidden');
        adminPanel.classList.toggle('flex');
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            // Phase 3: End session and save final state to MySQL
            if (userId && gameLogic?.getPlayerData) {
                console.log('[Logout] Saving final player state...');
                const finalPlayerData = gameLogic.getPlayerData();
                if (finalPlayerData) {
                    await playerPersistence.endSession(userId, finalPlayerData);
                    console.log('[Logout] ✓ Player data saved to MySQL');
                }
            }
            await authFunctions.signOut(auth);
            location.reload();
        }
    });
    
    // Authentication state handler
    authModule.setupAuthStateHandler(async (user) => {
        try {
            if (user) {
                userId = user.uid;
                sessionStartTime = Date.now();
                logoutBtn.classList.remove('hidden');
                
                console.log('[Auth] User logged in, loading character data...');
                
                // Phase 3: Load character from MySQL first, fallback to Firebase
                const playerData = await playerPersistence.loadPlayerCharacter(userId);
                
                if (!playerData) {
                    // No character found, show character creation
                    console.log('[Auth] No character found, showing creation screen');
                    charCreateModal.classList.remove('hidden');
                    currentStats = rollRandomStats();
                    displayRolledStats(currentStats);
                    populateClassSelector(); // Load available classes
                } else {
                    // Player exists, create/update Firebase session and load game
                    console.log('[Auth] ✓ Character loaded from MySQL');
                    await playerPersistence.createSession(userId, playerData);
                    console.log('[Auth] ✓ Firebase session created');
                    playerName = playerData.name;
                    await initializePlayerGame(playerData);
                    
                    // Start presence cleanup system (run every 60 seconds)
                    setInterval(() => {
                        playerPersistence.cleanupStaleSessions();
                    }, 60000);
                    
                    // Run initial cleanup after 5 seconds
                    setTimeout(() => {
                        playerPersistence.cleanupStaleSessions();
                    }, 5000);
                }
            } else {
                authModule.showAuthModal();
                appContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('[Auth] Error in authentication handler:', error);
            logToTerminal(`Authentication error: ${error.message}`, "error");
            logToTerminal("Please refresh the page and try again.", "error");
        }
    });
    
    console.log('MUD application initialized successfully!');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
