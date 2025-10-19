// Data loading module - Handles loading game data from Firebase
export function initializeDataLoader(firebase, appId) {
    const { db, firestoreFunctions } = firebase;
    const { collection, onSnapshot, getDocs } = firestoreFunctions;
    
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
            
            // Load rooms (real-time listener - frequently changes)
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
            
            // Load items (real-time listener - can change in rooms)
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
            
            // Load NPCs (real-time listener - positions can change)
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
            
            // Load monsters (real-time listener)
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
            
            // Load classes, spells, guilds, quests ONCE (no real-time) - reduces listeners
            // These are admin-only data that changes infrequently
            try {
                // Load classes
                const classesSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-classes`));
                gameData.gameClasses = {};
                classesSnapshot.forEach(doc => {
                    gameData.gameClasses[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('classes');
                
                // Load spells  
                const spellsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-spells`));
                gameData.gameSpells = {};
                spellsSnapshot.forEach(doc => {
                    gameData.gameSpells[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('spells');
                
                // Load guilds
                const guildsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-guilds`));
                gameData.gameGuilds = {};
                guildsSnapshot.forEach(doc => {
                    gameData.gameGuilds[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('guilds');
                
                // Load quests
                const questsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-quests`));
                gameData.gameQuests = {};
                questsSnapshot.forEach(doc => {
                    gameData.gameQuests[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete('quests');
                
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
