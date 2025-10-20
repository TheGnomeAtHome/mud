// Data loading module - Handles loading game data from Firebase or static JSON files
export function initializeDataLoader(firebase, appId) {
    const { db, firestoreFunctions } = firebase;
    const { collection, onSnapshot, getDocs } = firestoreFunctions;
    
    // Configuration: Set to true to use static JSON files instead of Firebase for game content
    // NOTE: Set to FALSE first time to export your data, then set to TRUE after placing JSON files in /data/
    const USE_STATIC_FILES = true;  // TODO: Change to true after exporting
    const STATIC_FILES_PATH = './data/';
    
    const gameData = {
        gameWorld: {},
        gameItems: {},
        gameNpcs: {},
        gameMonsters: {},
        gamePlayers: {},
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

    
    function loadGameData() {
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
                    gameData.gamePlayers[doc.id] = { id: doc.id, ...doc.data() };
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
            
            // Load classes, spells, guilds, quests - from STATIC FILES or Firebase
            // These are admin-only data that changes infrequently
            try {
                if (USE_STATIC_FILES) {
                    // Load from static JSON files (MUCH faster, 90% fewer reads)
                    console.log('[DataLoader] Using static file mode for game content');
                    
                    // Load rooms from static files
                    gameData.gameWorld = await loadFromStaticFile('rooms', 'mud-rooms');
                    checkComplete('rooms');
                    
                    // Load items from static files
                    gameData.gameItems = await loadFromStaticFile('items', 'mud-items');
                    checkComplete('items');
                    
                    // Load NPCs from static files
                    gameData.gameNpcs = await loadFromStaticFile('npcs', 'mud-npcs');
                    checkComplete('npcs');
                    
                    // Load monsters from static files
                    gameData.gameMonsters = await loadFromStaticFile('monsters', 'mud-monsters');
                    checkComplete('monsters');
                    
                    // Load classes from static files
                    gameData.gameClasses = await loadFromStaticFile('classes', 'mud-classes');
                    checkComplete('classes');
                    
                    // Load spells from static files
                    gameData.gameSpells = await loadFromStaticFile('spells', 'mud-spells');
                    checkComplete('spells');
                    
                    // Load quests from static files
                    gameData.gameQuests = await loadFromStaticFile('quests', 'mud-quests');
                    checkComplete('quests');
                    
                    // Still load guilds from Firebase (changes more frequently)
                    const guildsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-guilds`));
                    gameData.gameGuilds = {};
                    guildsSnapshot.forEach(doc => {
                        gameData.gameGuilds[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    checkComplete('guilds');
                    
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
                    
                    // Load guilds from Firebase
                    const guildsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-guilds`));
                    gameData.gameGuilds = {};
                    guildsSnapshot.forEach(doc => {
                        gameData.gameGuilds[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    checkComplete('guilds');
                    
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
    
    return {
        loadGameData,
        cleanup,
        gameData
    };
}
