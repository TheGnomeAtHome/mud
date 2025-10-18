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
        activeMonsters: {}
    };
    
    const unsubscribers = [];
    
    function loadGameData() {
        return new Promise((resolve, reject) => {
            let loadedCount = 0;
            const expectedCount = 6;
            
            function checkComplete() {
                loadedCount++;
                if (loadedCount === expectedCount) {
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
        });
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
