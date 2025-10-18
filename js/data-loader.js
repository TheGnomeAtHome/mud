// Data loading module - Handles loading game data from Firebase
export function initializeDataLoader(firebase, appId) {
    const { db, firestoreFunctions } = firebase;
    const { collection, onSnapshot } = firestoreFunctions;
    
    const gameData = {
        gameWorld: {},
        gameItems: {},
        gameNpcs: {},
        gameMonsters: {},
        gamePlayers: {},
        activeMonsters: {},
        gameClasses: {},
        gameSpells: {}
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
        loadPromise = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const expectedCount = 8;
            
            function checkComplete() {
                loadedCount++;
                if (loadedCount === expectedCount) {
                    isLoaded = true;
                    isLoading = false;
                    resolve(true);
                }
            }
            
            // Load rooms
            const roomsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-rooms`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.gameWorld[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(roomsUnsub);
            
            // Load items
            const itemsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-items`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.gameItems[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(itemsUnsub);
            
            // Load NPCs
            const npcsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-npcs`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.gameNpcs[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(npcsUnsub);
            
            // Load monsters
            const monstersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-monsters`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.gameMonsters[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(monstersUnsub);
            
            // Load players
            const playersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-players`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.gamePlayers[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(playersUnsub);
            
            // Load active monsters
            const activeMonstersUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), (snapshot) => {
                snapshot.forEach(doc => {
                    gameData.activeMonsters[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(activeMonstersUnsub);
            
            // Load classes
            const classesUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-classes`), (snapshot) => {
                gameData.gameClasses = {};
                snapshot.forEach(doc => {
                    gameData.gameClasses[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(classesUnsub);
            
            // Load spells
            const spellsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-spells`), (snapshot) => {
                gameData.gameSpells = {};
                snapshot.forEach(doc => {
                    gameData.gameSpells[doc.id] = { id: doc.id, ...doc.data() };
                });
                checkComplete();
            }, reject);
            unsubscribers.push(spellsUnsub);
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
