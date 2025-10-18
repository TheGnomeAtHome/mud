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

// Setup auth form switching immediately
function setupAuthFormSwitching() {
    console.log('Setting up auth form switching...');
    const showRegister = document.getElementById('show-register');
    const showLoginRegister = document.getElementById('show-login-register');
    const showForgotPassword = document.getElementById('show-forgot-password');
    const showLoginForgot = document.getElementById('show-login-forgot');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    
    console.log('Elements found:', { showRegister, loginForm, registerForm });
    
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            console.log('Show register clicked!');
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
        console.log('Register link handler attached');
    } else {
        console.error('show-register element not found!');
    }
    
    if (showLoginRegister) {
        showLoginRegister.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }
    
    if (showForgotPassword) {
        showForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            forgotPasswordForm.classList.remove('hidden');
        });
    }
    
    if (showLoginForgot) {
        showLoginForgot.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
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
    const { onSnapshot, collection, addDoc, serverTimestamp } = firestoreFunctions;
    
    // Initialize UI
    const ui = initializeUI();
    const { logToTerminal, updateUserInfo, focusInput, setInputEnabled, input } = ui;
    
    // Initialize Authentication
    const authModule = initializeAuth(firebase, ui, APP_ID);
    
    // Initialize Data Loader
    const dataLoader = initializeDataLoader(firebase, APP_ID);
    
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
            knownSpells: [], // Player starts with no spells
            money: 100,
            hp: maxHp,
            maxHp: maxHp,
            mp: maxMp,
            maxMp: maxMp,
            xp: 0,
            level: 1,
            score: 0,
            attributes: finalStats,
            isAdmin: isFirstPlayer, // First player becomes admin
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
        
        const { gameWorld, gameItems, gameNpcs, gameMonsters, gamePlayers, activeMonsters, gameClasses, gameSpells, gameGuilds } = dataLoader.gameData;
        
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
            gameSpells,
            gameGuilds,
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
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await authFunctions.signOut(auth);
            location.reload();
        }
    });
    
    // Authentication state handler
    authModule.setupAuthStateHandler(async (user) => {
        if (user) {
            userId = user.uid;
            sessionStartTime = Date.now();
            logoutBtn.classList.remove('hidden');
            
            const playerDoc = await firestoreFunctions.getDoc(firestoreFunctions.doc(db, `/artifacts/${APP_ID}/public/data/mud-players/${userId}`));
            
            if (!playerDoc.exists()) {
                // Show character creation
                charCreateModal.classList.remove('hidden');
                currentStats = rollRandomStats();
                displayRolledStats(currentStats);
                populateClassSelector(); // Load available classes
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
