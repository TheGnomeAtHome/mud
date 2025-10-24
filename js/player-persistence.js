/**
 * Player Persistence Module
 * Handles split between Firebase (session data) and MySQL (permanent data)
 * Part of Phase 3: Firebase Optimization
 */

const MYSQL_API_URL = 'https://jphsoftware.com/api';

/**
 * Initialize player persistence system
 * @param {Object} firebase - Firebase instance
 * @param {string} appId - Application ID
 */
export function initializePlayerPersistence(firebase, appId) {
    const { db, firestoreFunctions } = firebase;
    const { doc, getDoc, setDoc, updateDoc } = firestoreFunctions;
    
    /**
     * Load player character data from MySQL
     * @param {string} userId - Player's user ID
     * @returns {Promise<Object|null>} Player character data or null
     */
    async function loadPlayerCharacter(userId) {
        try {
            console.log(`[PlayerPersistence] Loading character data for ${userId} from MySQL...`);
            
            const response = await fetch(`${MYSQL_API_URL}/players/${userId}`);
            
            if (response.status === 404) {
                console.log(`[PlayerPersistence] No character data found in MySQL for ${userId}`);
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`[PlayerPersistence] ✓ Loaded character from MySQL`);
            return data;
            
        } catch (error) {
            console.error('[PlayerPersistence] Error loading from MySQL:', error.message);
            console.log('[PlayerPersistence] Falling back to Firebase...');
            
            // Fallback to Firebase
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            const playerSnap = await getDoc(playerRef);
            
            if (playerSnap.exists()) {
                return { id: userId, ...playerSnap.data() };
            }
            
            return null;
        }
    }
    
    /**
     * Save player character data to MySQL
     * @param {string} userId - Player's user ID
     * @param {Object} characterData - Character data to save
     * @returns {Promise<boolean>} Success status
     */
    async function savePlayerCharacter(userId, characterData) {
        try {
            console.log(`[PlayerPersistence] Saving character data for ${userId} to MySQL...`);
            
            // Prepare permanent character data (exclude session data)
            const permanentData = {
                name: characterData.name,
                race: characterData.race,
                class: characterData.class,
                level: characterData.level || 1,
                xp: characterData.xp || 0,
                score: characterData.score || 0,
                maxHp: characterData.maxHp || 100,
                maxMp: characterData.maxMp || 100,
                str: characterData.str || 10,
                dex: characterData.dex || 10,
                con: characterData.con || 10,
                int: characterData.int || 10,
                wis: characterData.wis || 10,
                cha: characterData.cha || 10,
                money: characterData.money || 0,
                inventory: characterData.inventory || [],
                equipment: characterData.equipment || {},
                knownSpells: characterData.knownSpells || [],
                completedQuests: characterData.completedQuests || [],
                activeQuests: characterData.activeQuests || [],
                guildId: characterData.guildId || null,
                isAdmin: characterData.isAdmin || false,
                monstersKilled: characterData.monstersKilled || 0,
                deaths: characterData.deaths || 0,
                createdAt: characterData.createdAt || Date.now()
            };
            
            const response = await fetch(`${MYSQL_API_URL}/players/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'your-admin-api-key-here' // TODO: Get from config
                },
                body: JSON.stringify(permanentData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log(`[PlayerPersistence] ✓ Saved character to MySQL`);
            return true;
            
        } catch (error) {
            console.error('[PlayerPersistence] Error saving to MySQL:', error.message);
            console.log('[PlayerPersistence] Character data will be in Firebase only');
            return false;
        }
    }
    
    /**
     * Create session data in Firebase (real-time only)
     * @param {string} userId - Player's user ID
     * @param {Object} characterData - Full character data
     * @returns {Promise<void>}
     */
    async function createSession(userId, characterData) {
        try {
            console.log(`[PlayerPersistence] Creating Firebase session for ${userId}...`);
            
            // Session data: only frequently changing data
            const sessionData = {
                name: characterData.name,
                roomId: characterData.roomId || 'start',
                online: true,
                lastSeen: Date.now(),
                hp: characterData.hp || characterData.maxHp || 100,
                mp: characterData.mp || characterData.maxMp || 100,
                inCombat: false,
                combatTarget: null,
                poisonedUntil: null,
                poisonDamage: null,
                poisonInterval: null,
                lastPoisonTick: null
            };
            
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await setDoc(playerRef, sessionData, { merge: true });
            
            console.log(`[PlayerPersistence] ✓ Session created in Firebase`);
            
        } catch (error) {
            console.error('[PlayerPersistence] Error creating session:', error);
            throw error;
        }
    }
    
    /**
     * Update session data in Firebase
     * @param {string} userId - Player's user ID  
     * @param {Object} updates - Session data updates (hp, mp, position, etc.)
     * @returns {Promise<void>}
     */
    async function updateSession(userId, updates) {
        try {
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await updateDoc(playerRef, {
                ...updates,
                lastSeen: Date.now()
            });
        } catch (error) {
            console.error('[PlayerPersistence] Error updating session:', error);
            throw error;
        }
    }
    
    /**
     * Sync permanent data to MySQL
     * @param {string} userId - Player's user ID
     * @param {Object} updates - Permanent data updates (xp, inventory, etc.)
     * @returns {Promise<void>}
     */
    async function syncToMySQL(userId, updates) {
        try {
            // This is a partial update - only update specific fields
            const response = await fetch(`${MYSQL_API_URL}/players/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'your-admin-api-key-here' // TODO: Get from config
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log(`[PlayerPersistence] ✓ Synced to MySQL:`, Object.keys(updates).join(', '));
            
        } catch (error) {
            console.error('[PlayerPersistence] Error syncing to MySQL:', error.message);
            // Don't throw - continue with Firebase-only mode
        }
    }
    
    /**
     * End session and save final state
     * @param {string} userId - Player's user ID
     * @param {Object} finalData - Final character state
     * @returns {Promise<void>}
     */
    async function endSession(userId, finalData) {
        try {
            console.log(`[PlayerPersistence] Ending session for ${userId}...`);
            
            // Save final state to MySQL
            await savePlayerCharacter(userId, finalData);
            
            // Update Firebase session to offline
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await updateDoc(playerRef, {
                online: false,
                lastSeen: Date.now()
            });
            
            console.log(`[PlayerPersistence] ✓ Session ended`);
            
        } catch (error) {
            console.error('[PlayerPersistence] Error ending session:', error);
        }
    }
    
    /**
     * Merge character data from MySQL and Firebase session
     * @param {Object} mysqlData - Data from MySQL
     * @param {Object} sessionData - Data from Firebase
     * @returns {Object} Merged player data
     */
    function mergePlayerData(mysqlData, sessionData) {
        // MySQL data is authoritative for permanent fields
        // Session data is authoritative for real-time fields
        return {
            ...mysqlData,
            // Session-only fields
            roomId: sessionData.roomId || mysqlData.roomId || 'start',
            hp: sessionData.hp !== undefined ? sessionData.hp : mysqlData.maxHp,
            mp: sessionData.mp !== undefined ? sessionData.mp : mysqlData.maxMp,
            online: sessionData.online || false,
            lastSeen: sessionData.lastSeen || Date.now(),
            inCombat: sessionData.inCombat || false,
            combatTarget: sessionData.combatTarget || null,
            poisonedUntil: sessionData.poisonedUntil || null,
            poisonDamage: sessionData.poisonDamage || null,
            poisonInterval: sessionData.poisonInterval || null,
            lastPoisonTick: sessionData.lastPoisonTick || null
        };
    }
    
    return {
        loadPlayerCharacter,
        savePlayerCharacter,
        createSession,
        updateSession,
        syncToMySQL,
        endSession,
        mergePlayerData
    };
}
