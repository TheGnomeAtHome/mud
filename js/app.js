// Main application module
import { APP_ID, GEMINI_API_KEY } from './config.js';
import { initializeFirebase } from './firebase-init.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';
import { initializeDataLoader } from './data-loader.js';
import { initializeGameLogic } from './game.js';
import { initializeAdminPanel } from './admin.js';
import { initializeBotSystem } from './bots.js';
import { 
    callGeminiForText, 
    parseCommandWithGemini,
    callGeminiForRoom,
    callGeminiForMonster,
    callGeminiForItem,
    callGeminiForNpc 
} from './ai.js';

export async function initializeApp() {
    console.log('Initializing MUD application...');
    
    // Initialize Firebase
    const firebase = await initializeFirebase();
    const { db, auth, authFunctions, firestoreFunctions } = firebase;
    const { onSnapshot, collection, addDoc, serverTimestamp } = firestoreFunctions;
    
    // Initialize UI
    const ui = initializeUI();
    const { logToTerminal, updateUserInfo, focusInput, setInputEnabled, input } = ui;
    
    // Setup auth form switching
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });
    
    document.getElementById('show-login-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });
    
    document.getElementById('show-forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('forgot-password-form').classList.remove('hidden');
    });
    
    document.getElementById('show-login-forgot').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });
    
    // Initialize Authentication
    const authModule = initializeAuth(firebase, ui, APP_ID);
    
    // Initialize Data Loader
    const dataLoader = initializeDataLoader(firebase, APP_ID);
    
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
    
    // Setup message listener for real-time chat
    function setupMessageListener() {
        const unsub = onSnapshot(collection(db, `/artifacts/${APP_ID}/public/data/mud-messages`), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    
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
                    
                    if (messageTime >= sessionStartTime && msg.roomId === myCurrentRoom) {
                        if (msg.isEmote) {
                            logToTerminal(msg.text, 'action');
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
    
    document.getElementById('start-adventure-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        
        const characterName = document.getElementById('char-name').value.trim();
        const race = document.getElementById('char-race').value;
        const gender = document.getElementById('char-gender').value;
        const age = document.getElementById('char-age').value;
        const description = document.getElementById('char-description').value.trim();
        
        if (!characterName) {
            alert('Please enter a character name');
            return;
        }
        
        const playerData = {
            name: characterName,
            race: race,
            gender: gender,
            age: parseInt(age) || 25,
            description: description || 'A mysterious adventurer.',
            roomId: 'start',
            inventory: [],
            money: 100,
            hp: 100,
            maxHp: 100,
            xp: 0,
            level: 1,
            score: 0,
            attributes: currentStats,
            createdAt: serverTimestamp()
        };
        
        try {
            await firestoreFunctions.setDoc(firestoreFunctions.doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`), playerData);
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
        appContainer.classList.remove('hidden');
        logToTerminal("Welcome to the M.U.D. - The Digital Realm!", "system");
        logToTerminal("Type 'help' for a list of commands.", "system");
        focusInput();
        
        const worldReady = await dataLoader.loadGameData();
        if (!worldReady) {
            logToTerminal("Failed to initialize the game world. Please reload.", "error");
            return;
        }
        
        const { gameWorld, gameItems, gameNpcs, gameMonsters, gamePlayers, activeMonsters } = dataLoader.gameData;
        
        if (playerData.isAdmin) {
            adminToggleBtn.classList.remove('hidden');
        }
        
        // Initialize admin panel
        adminPanelFunctions = initializeAdminPanel({
            db,
            appId: APP_ID,
            gameWorld,
            gameItems,
            gameNpcs,
            gameMonsters,
            gamePlayers,
            logToTerminal,
            firestoreFunctions
        });
        
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
            logToTerminal,
            callGeminiForText,
            parseCommandWithGemini,
            GEMINI_API_KEY,
            firestoreFunctions
        });
        
        await gameLogic.loadLevelConfig(db, APP_ID);
        await gameLogic.loadActions(db, APP_ID);
        gameLogic.setPlayerInfo(userId, playerData.name, playerData.roomId);
        
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
        
        setupMessageListener();
        resetInactivityTimer();
        
        await gameLogic.showRoom();
    }
    
    // Command input handler
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            resetInactivityTimer();
            const cmdText = input.value.trim();
            if (cmdText) {
                input.value = '';
                setInputEnabled(false);
                logToTerminal(`> ${cmdText}`, 'chat');
                
                const simpleCommands = ['help', 'inventory', 'score', 'stats', 'news', 'who', 'logout', 'forceadmin', 'look', 'testai', 'test ai', 'listmodels', 'list models', 'listbots', 'killbots', 'spawnbot', 'stopbots'];
                const directions = ['north', 'south', 'east', 'west', 'up', 'down', 'n', 's', 'e', 'w', 'u', 'd'];
                const lowerCmdText = cmdText.toLowerCase();
                let parsedCommand;
                
                if (lowerCmdText.startsWith('startbots')) {
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
                    parsedCommand = await parseCommandWithGemini(cmdText);
                    console.log("Parsed command:", parsedCommand);
                }
                
                try {
                    await gameLogic.executeParsedCommand(parsedCommand, cmdText);
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
    
    // Authentication state handler
    authModule.setupAuthStateHandler(async (user) => {
        if (user) {
            userId = user.uid;
            sessionStartTime = Date.now();
            
            const playerDoc = await firestoreFunctions.getDoc(firestoreFunctions.doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`));
            
            if (!playerDoc.exists()) {
                // Show character creation
                charCreateModal.classList.remove('hidden');
                currentStats = rollRandomStats();
                displayRolledStats(currentStats);
            } else {
                // Player exists, load game
                const playerData = playerDoc.data();
                playerName = playerData.name;
                await initializePlayerGame(playerData);
            }
        } else {
            authModule.showAuthModal();
            appContainer.classList.add('hidden');
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
