// Data loading module - Handles loading game data from Firebase or static JSON files

// Global game data objects (exported for use in other modules)
export const gameWorld = {};
export const gameItems = {};
export const gameNpcs = {};
export const gameMonsters = {};
export const gamePlayers = {};

export function initializeDataLoader(firebase, appId) {
    const { db, firestoreFunctions } = firebase;
    const { collection, onSnapshot, getDocs } = firestoreFunctions;
    
    // Configuration: Set to true to use static JSON files instead of Firebase for game content
    // NOTE: Set to FALSE first time to export your data, then set to TRUE after placing JSON files in /data/
    const USE_STATIC_FILES = false;  // DISABLED - Using MySQL backend instead
    const USE_MYSQL_BACKEND = true;  // ✓ ENABLED - Using MySQL via PHP API
    const STATIC_FILES_PATH = './data/';
    const MYSQL_API_URL = 'https://jphsoftware.com/api';  // PHP API endpoint
    
    // Hybrid mode: Load some collections from Firebase (for live editing) and others from static files
    // Set individual collections to false to load from Firebase/MySQL instead of static files
    const STATIC_CONFIG = {
        rooms: false,      // FALSE = Load from MySQL (live editing for admins)
        items: false,      // FALSE = Load from MySQL
        npcs: false,       // FALSE = Load from MySQL (admins can edit NPCs)
        monsters: false,   // FALSE = Load from MySQL
        classes: false,    // FALSE = Load from MySQL
        spells: false,     // FALSE = Load from MySQL
        quests: false      // FALSE = Load from MySQL
    };
    
    const gameData = {
        gameWorld,
        gameItems,
        gameNpcs,
        gameMonsters,
        gamePlayers,
        activeMonsters: {},
        gameClasses: {},
        gameSpells: {},
        gameGuilds: {},
        gameQuests: {},
        gameParties: {}
    };
    
    const unsubscribers = [];
    let isLoading = false;
    let isLoaded = false;
    let loadPromise = null;
    
    /**
     * Load data from static JSON file with fallback to Firebase
     */
    async function loadFromStaticFile(fileName, collectionName) {
        try {
            console.log(`[DataLoader] Attempting to load ${fileName} from static files...`);
            const response = await fetch(`${STATIC_FILES_PATH}${fileName}.json`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const count = Object.keys(data).length;
            console.log(`[DataLoader] ✓ Loaded ${count} ${collectionName} from static file`);
            return data;
            
        } catch (error) {
            console.warn(`[DataLoader] Failed to load ${fileName} from static files:`, error.message);
            console.log(`[DataLoader] Falling back to Firebase for ${collectionName}...`);
            
            // Fallback to Firebase
            const snapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/${collectionName}`));
            const data = {};
            snapshot.forEach(doc => {
                data[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            const count = Object.keys(data).length;
            console.log(`[DataLoader] ✓ Loaded ${count} ${collectionName} from Firebase (fallback)`);
            return data;
        }
    }
    
    /**
     * Load data from MySQL API server with fallback to Firebase
     */
    async function loadFromMySQL(collectionName) {
        try {
            console.log(`[DataLoader] Attempting to load ${collectionName} from MySQL...`);
            const response = await fetch(`${MYSQL_API_URL}/${collectionName}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const count = Object.keys(data).length;
            console.log(`[DataLoader] ✓ Loaded ${count} ${collectionName} from MySQL`);
            return data;
            
        } catch (error) {
            console.error(`[DataLoader] Failed to load ${collectionName} from MySQL:`, error.message);
            console.log(`[DataLoader] Falling back to Firebase for ${collectionName}...`);
            
            // Fallback to Firebase
            const snapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-${collectionName}`));
            const data = {};
            snapshot.forEach(doc => {
                data[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            const count = Object.keys(data).length;
            console.log(`[DataLoader] ✓ Loaded ${count} ${collectionName} from Firebase (fallback)`);
            return data;
        }
    }

    
    function loadGameData(userId = null) {
        // Store userId for death detection
        if (userId) {
            gameData.userId = userId;
            gameData.deathHandled = false;
        }
        
        // If already loaded, return resolved promise
        if (isLoaded) {
            return Promise.resolve(true);
        }
        
        // If currently loading, return existing promise
        if (isLoading && loadPromise) {
            return loadPromise;
        }
        
        isLoading = true;
        loadPromise = new Promise(async (resolve, reject) => {
            let loadedCount = 0;
            const expectedCount = 11;
            const loadStatus = {
                rooms: false,
                items: false,
                npcs: false,
                monsters: false,
                players: false,
                activeMonsters: false,
                classes: false,
                spells: false,
                guilds: false,
                quests: false,
                parties: false
            };
            
            // Add timeout to prevent infinite waiting
            const timeout = setTimeout(() => {
                if (loadedCount < expectedCount) {
                    console.warn('[DataLoader] Timeout waiting for collections. Loaded:', loadedCount, '/', expectedCount);
                    console.warn('[DataLoader] Status:', loadStatus);
                    // Resolve anyway to allow game to start
                    isLoaded = true;
                    isLoading = false;
                    resolve(true);
                }
            }, 10000); // 10 second timeout
            
            function checkComplete(collectionName) {
                loadedCount++;
                loadStatus[collectionName] = true;
                console.log(`[DataLoader] Loaded ${collectionName} (${loadedCount}/${expectedCount})`);
                if (loadedCount === expectedCount) {
                    clearTimeout(timeout);
                    isLoaded = true;
                    isLoading = false;
                    console.log('[DataLoader] All collections loaded successfully');
                    resolve(true);
                }
            }
            
            // Always load dynamic data from Firebase (players, active monsters, parties)
            // These change frequently and need real-time sync
            
            // Load players (real-time listener - critical for multiplayer)
            const playersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-players`), (snapshot) => {
                let count = 0;
                snapshot.forEach(doc => {
                    const playerData = { id: doc.id, ...doc.data() };
                    gameData.gamePlayers[doc.id] = playerData;
                    
                    // Check if THIS player just died
                    if (doc.id === gameData.userId && playerData.isDead && !gameData.deathHandled) {
                        gameData.deathHandled = true;
                        // Import and call the death choice function from game.js
                        if (window.offerDeathChoice) {
                            setTimeout(() => {
                                window.offerDeathChoice(playerData, playerData.deathCause || 'unknown');
                            }, 500);
                        }
                    }
                    
                    count++;
                });
                console.log(`[Firestore] Loaded ${count} players.`);
                if (count === 0) console.warn('[Firestore] No players found in mud-players collection!');
                checkComplete('players');
            }, error => {
                console.error('[Firestore] Error loading players:', error);
                reject(error);
            });
            unsubscribers.push(playersUnsub);
            
            // Load active monsters (real-time listener - frequently changes)
            const activeMonstersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.activeMonsters[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('activeMonsters');
            }, reject);
            unsubscribers.push(activeMonstersUnsub);
            
            // Load parties (real-time listener - important for multiplayer)
            const partiesUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-parties`), (snapshot) => {
                gameData.gameParties = {};
                snapshot.forEach(doc => {
                    gameData.gameParties[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('parties');
            }, reject);
            unsubscribers.push(partiesUnsub);
            
            // Load classes, spells, guilds, quests - from STATIC FILES, MySQL, or Firebase
            // These are admin-only data that changes infrequently
            try {
                if (USE_STATIC_FILES || USE_MYSQL_BACKEND) {
                    // Load from static JSON files or MySQL (MUCH faster, 90% fewer reads)
                    if (USE_STATIC_FILES) {
                        console.log('[DataLoader] Using hybrid/static file mode for game content');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Using MySQL backend for game content');
                    }
                    
                    // Load rooms - check config
                    if (STATIC_CONFIG.rooms) {
                        gameData.gameWorld = await loadFromStaticFile('rooms', 'mud-rooms');
                        checkComplete('rooms');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading rooms from MySQL (live editing enabled)');
                        gameData.gameWorld = await loadFromMySQL('rooms');
                        checkComplete('rooms');
                    } else {
                        console.log('[DataLoader] Loading rooms from Firebase (live editing enabled)');
                        const roomsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-rooms`));
                        gameData.gameWorld = {};
                        roomsSnapshot.forEach(doc => {
                            gameData.gameWorld[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('rooms');
                    }
                    
                    // Load items - check config
                    if (STATIC_CONFIG.items) {
                        gameData.gameItems = await loadFromStaticFile('items', 'mud-items');
                        checkComplete('items');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading items from MySQL (live editing enabled)');
                        gameData.gameItems = await loadFromMySQL('items');
                        checkComplete('items');
                    } else {
                        console.log('[DataLoader] Loading items from Firebase (live editing enabled)');
                        const itemsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-items`));
                        gameData.gameItems = {};
                        itemsSnapshot.forEach(doc => {
                            gameData.gameItems[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('items');
                    }
                    
                    // Load NPCs - check config
                    if (STATIC_CONFIG.npcs) {
                        gameData.gameNpcs = await loadFromStaticFile('npcs', 'mud-npcs');
                        checkComplete('npcs');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading NPCs from MySQL (live editing enabled)');
                        gameData.gameNpcs = await loadFromMySQL('npcs');
                        checkComplete('npcs');
                    } else {
                        console.log('[DataLoader] Loading NPCs from Firebase (live editing enabled)');
                        const npcsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-npcs`));
                        gameData.gameNpcs = {};
                        npcsSnapshot.forEach(doc => {
                            gameData.gameNpcs[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('npcs');
                    }
                    
                    // Load monsters - check config
                    if (STATIC_CONFIG.monsters) {
                        gameData.gameMonsters = await loadFromStaticFile('monsters', 'mud-monsters');
                        checkComplete('monsters');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading monsters from MySQL...');
                        gameData.gameMonsters = await loadFromMySQL('monsters');
                        checkComplete('monsters');
                    } else {
                        console.log('[DataLoader] Loading monsters from Firebase (live editing enabled)');
                        const monstersSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-monsters`));
                        gameData.gameMonsters = {};
                        monstersSnapshot.forEach(doc => {
                            gameData.gameMonsters[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('monsters');
                    }
                    
                    // Load classes - check config
                    if (STATIC_CONFIG.classes) {
                        gameData.gameClasses = await loadFromStaticFile('classes', 'mud-classes');
                        checkComplete('classes');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading classes from MySQL...');
                        gameData.gameClasses = await loadFromMySQL('classes');
                        checkComplete('classes');
                    } else {
                        console.log('[DataLoader] Loading classes from Firebase (live editing enabled)');
                        const classesSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-classes`));
                        gameData.gameClasses = {};
                        classesSnapshot.forEach(doc => {
                            gameData.gameClasses[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('classes');
                    }
                    
                    // Load spells - check config
                    if (STATIC_CONFIG.spells) {
                        gameData.gameSpells = await loadFromStaticFile('spells', 'mud-spells');
                        checkComplete('spells');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading spells from MySQL...');
                        gameData.gameSpells = await loadFromMySQL('spells');
                        checkComplete('spells');
                    } else {
                        console.log('[DataLoader] Loading spells from Firebase (live editing enabled)');
                        const spellsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-spells`));
                        gameData.gameSpells = {};
                        spellsSnapshot.forEach(doc => {
                            gameData.gameSpells[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('spells');
                    }
                    
                    // Load quests - check config
                    if (STATIC_CONFIG.quests) {
                        gameData.gameQuests = await loadFromStaticFile('quests', 'mud-quests');
                        checkComplete('quests');
                    } else if (USE_MYSQL_BACKEND) {
                        console.log('[DataLoader] Loading quests from MySQL...');
                        gameData.gameQuests = await loadFromMySQL('quests');
                        checkComplete('quests');
                    } else {
                        console.log('[DataLoader] Loading quests from Firebase (live editing enabled)');
                        const questsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-quests`));
                        gameData.gameQuests = {};
                        questsSnapshot.forEach(doc => {
                            gameData.gameQuests[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('quests');
                    }
                    
                    // Load guilds from Firebase with real-time listener (changes when players create/modify guilds)
                    const guildsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-guilds`), (snapshot) => {
                        gameData.gameGuilds = {};
                        snapshot.forEach(doc => {
                            gameData.gameGuilds[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('guilds');
                    }, error => {
                        console.error('[Firestore] Error loading guilds:', error);
                        reject(error);
                    });
                    unsubscribers.push(guildsUnsub);
                    
                } else {
                    // Original Firebase loading (fallback/compatibility mode)
                    console.log('[DataLoader] Using Firebase mode for game content');
                    
                    // Load rooms from Firebase with real-time listener
                    const roomsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-rooms`), (snapshot) => {
                        let count = 0;
                        snapshot.forEach(doc => {
                            gameData.gameWorld[doc.id] = { id: doc.id, ...doc.data() };
                            count++;
                        });
                        console.log(`[Firestore] Loaded ${count} rooms.`);
                        if (count === 0) console.warn('[Firestore] No rooms found in mud-rooms collection!');
                        checkComplete('rooms');
                    }, error => {
                        console.error('[Firestore] Error loading rooms:', error);
                        reject(error);
                    });
                    unsubscribers.push(roomsUnsub);
                    
                    // Load items from Firebase with real-time listener
                    const itemsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-items`), (snapshot) => {
                        let count = 0;
                        snapshot.forEach(doc => {
                            gameData.gameItems[doc.id] = { id: doc.id, ...doc.data() };
                            count++;
                        });
                        console.log(`[Firestore] Loaded ${count} items.`);
                        if (count === 0) console.warn('[Firestore] No items found in mud-items collection!');
                        checkComplete('items');
                    }, error => {
                        console.error('[Firestore] Error loading items:', error);
                        reject(error);
                    });
                    unsubscribers.push(itemsUnsub);
                    
                    // Load NPCs from Firebase with real-time listener
                    const npcsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-npcs`), (snapshot) => {
                        let count = 0;
                        snapshot.forEach(doc => {
                            gameData.gameNpcs[doc.id] = { id: doc.id, ...doc.data() };
                            count++;
                        });
                        console.log(`[Firestore] Loaded ${count} NPCs.`);
                        if (count === 0) console.warn('[Firestore] No NPCs found in mud-npcs collection!');
                        checkComplete('npcs');
                    }, error => {
                        console.error('[Firestore] Error loading NPCs:', error);
                        reject(error);
                    });
                    unsubscribers.push(npcsUnsub);
                    
                    // Load monsters from Firebase with real-time listener
                    const monstersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-monsters`), (snapshot) => {
                        let count = 0;
                        snapshot.forEach(doc => {
                            gameData.gameMonsters[doc.id] = { id: doc.id, ...doc.data() };
                            count++;
                        });
                        console.log(`[Firestore] Loaded ${count} monsters.`);
                        if (count === 0) console.warn('[Firestore] No monsters found in mud-monsters collection!');
                        checkComplete('monsters');
                    }, error => {
                        console.error('[Firestore] Error loading monsters:', error);
                        reject(error);
                    });
                    unsubscribers.push(monstersUnsub);
                    
                    // Load classes from Firebase
                    const classesSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-classes`));
                    gameData.gameClasses = {};
                    classesSnapshot.forEach(doc => {
                        gameData.gameClasses[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    checkComplete('classes');
                    
                    // Load spells from Firebase
                    const spellsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-spells`));
                    gameData.gameSpells = {};
                    spellsSnapshot.forEach(doc => {
                        gameData.gameSpells[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    checkComplete('spells');
                    
                    // Load guilds from Firebase with real-time listener
                    const guildsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-guilds`), (snapshot) => {
                        gameData.gameGuilds = {};
                        snapshot.forEach(doc => {
                            gameData.gameGuilds[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        checkComplete('guilds');
                    }, error => {
                        console.error('[Firestore] Error loading guilds:', error);
                        reject(error);
                    });
                    unsubscribers.push(guildsUnsub);
                    
                    // Load quests from Firebase
                    const questsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-quests`));
                    gameData.gameQuests = {};
                    questsSnapshot.forEach(doc => {
                        gameData.gameQuests[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    checkComplete('quests');
                }
                
            } catch (error) {
                console.error('[DataLoader] Error loading static collections:', error);
                reject(error);
            }
        });
        
        return loadPromise;
    }
    
    function cleanup() {
        unsubscribers.forEach(unsub => unsub());
    }
    
    /**
     * Refresh static data cache from MySQL
     * Use this when admin makes changes to game content in the admin panel
     */
    async function refreshCache(collections = null) {
        if (!USE_MYSQL_BACKEND) {
            console.warn('[DataLoader] Cache refresh only available in MySQL mode');
            return false;
        }
        
        const collectionsToRefresh = collections || ['rooms', 'items', 'npcs', 'monsters', 'classes', 'spells', 'quests'];
        console.log('[DataLoader] Refreshing cache for:', collectionsToRefresh.join(', '));
        
        try {
            const promises = collectionsToRefresh.map(async (collectionName) => {
                const data = await loadFromMySQL(collectionName);
                
                // Update the appropriate game data object
                switch(collectionName) {
                    case 'rooms':
                        Object.keys(gameData.gameWorld).forEach(key => delete gameData.gameWorld[key]);
                        Object.assign(gameData.gameWorld, data);
                        break;
                    case 'items':
                        Object.keys(gameData.gameItems).forEach(key => delete gameData.gameItems[key]);
                        Object.assign(gameData.gameItems, data);
                        break;
                    case 'npcs':
                        Object.keys(gameData.gameNpcs).forEach(key => delete gameData.gameNpcs[key]);
                        Object.assign(gameData.gameNpcs, data);
                        break;
                    case 'monsters':
                        Object.keys(gameData.gameMonsters).forEach(key => delete gameData.gameMonsters[key]);
                        Object.assign(gameData.gameMonsters, data);
                        break;
                    case 'classes':
                        Object.keys(gameData.gameClasses).forEach(key => delete gameData.gameClasses[key]);
                        Object.assign(gameData.gameClasses, data);
                        break;
                    case 'spells':
                        Object.keys(gameData.gameSpells).forEach(key => delete gameData.gameSpells[key]);
                        Object.assign(gameData.gameSpells, data);
                        break;
                    case 'quests':
                        Object.keys(gameData.gameQuests).forEach(key => delete gameData.gameQuests[key]);
                        Object.assign(gameData.gameQuests, data);
                        break;
                }
            });
            
            await Promise.all(promises);
            console.log('[DataLoader] ✓ Cache refresh complete');
            return true;
            
        } catch (error) {
            console.error('[DataLoader] Error refreshing cache:', error);
            return false;
        }
    }
    
    return {
        loadGameData,
        cleanup,
        refreshCache,
        gameData
    };
}
