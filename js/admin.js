// admin.js - Admin Panel functionality for MUD game
// Handles all admin panel UI, editors, and game entity management

import { callGeminiForRoom, callGeminiForMonster, callGeminiForItem, callGeminiForNpc, callGeminiForText } from './ai.js';

/**
 * Initialize the admin panel with all editors and event handlers
 * @param {Object} params - Required dependencies
 * @param {Object} params.db - Firestore database instance
 * @param {string} params.appId - Application ID
 * @param {Object} params.gameWorld - Game world data object
 * @param {Object} params.gameItems - Game items data object
 * @param {Object} params.gameNpcs - Game NPCs data object
 * @param {Object} params.gameMonsters - Game monsters data object
 * @param {Object} params.gamePlayers - Game players data object
 * @param {Object} params.gameClasses - Game character classes data object
 * @param {Object} params.gameSpells - Game spells data object
 * @param {Object} params.gameGuilds - Game guilds data object
 * @param {Object} params.gameQuests - Game quests data object
 * @param {Function} params.logToTerminal - Terminal logging function
 * @param {Object} params.firestoreFunctions - Firestore functions (doc, setDoc, updateDoc, deleteDoc)
 */
export function initializeAdminPanel({
    db,
    appId,
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
    gameLogic = null // Optional, set later
}) {
    console.log('=== INITIALIZING ADMIN PANEL ===');
    console.log('Initial data counts:', {
        rooms: Object.keys(gameWorld).length,
        items: Object.keys(gameItems).length,
        npcs: Object.keys(gameNpcs).length,
        monsters: Object.keys(gameMonsters).length,
        players: Object.keys(gamePlayers).length,
        classes: Object.keys(gameClasses).length,
        spells: Object.keys(gameSpells).length,
        guilds: Object.keys(gameGuilds).length,
        quests: Object.keys(gameQuests).length
    });
    
    const { doc, setDoc, updateDoc, deleteDoc, arrayUnion } = firestoreFunctions;

    // Tab switching
    const adminTabs = document.querySelectorAll('.admin-tab');
    const adminTabPanels = {
        'setup-tab-btn': document.getElementById('setup-panel'),
        'room-tab-btn': document.getElementById('room-editor-panel'),
        'item-tab-btn': document.getElementById('item-editor-panel'),
        'npc-tab-btn': document.getElementById('npc-editor-panel'),
        'monster-tab-btn': document.getElementById('monster-editor-panel'),
        'player-tab-btn': document.getElementById('player-editor-panel'),
        'spell-tab-btn': document.getElementById('spell-editor-panel'),
        'class-tab-btn': document.getElementById('class-editor-panel'),
        'guild-tab-btn': document.getElementById('guild-editor-panel'),
        'quest-tab-btn': document.getElementById('quest-editor-panel'),
        'levels-tab-btn': document.getElementById('levels-editor-panel'),
        'actions-tab-btn': document.getElementById('actions-editor-panel'),
        'map-tab-btn': document.getElementById('map-editor-panel'),
        'settings-tab-btn': document.getElementById('settings-panel'),
    };
    
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.values(adminTabPanels).forEach(p => p.classList.add('hidden'));
            adminTabPanels[tab.id].classList.remove('hidden');
            
            // If switching to map tab, refresh the map
            if (tab.id === 'map-tab-btn') {
                setTimeout(() => generateMap(), 100); // Small delay to ensure panel is visible
            }
            
            // If switching to levels tab, initialize the editor
            if (tab.id === 'levels-tab-btn') {
                setTimeout(() => initializeLevelsEditor(db, appId), 100);
            }
            
            // If switching to actions tab, initialize the editor
            if (tab.id === 'actions-tab-btn') {
                setTimeout(() => initializeActionsEditor(db, appId), 100);
            }
            
            // If switching to settings tab, initialize the editor
            if (tab.id === 'settings-tab-btn') {
                setTimeout(() => initializeSettingsPanel(), 100);
            }
        });
    });

    // ========== DEBUG BUTTONS ==========
    const debugDataBtn = document.getElementById('debug-data-btn');
    const refreshDropdownsBtn = document.getElementById('refresh-dropdowns-btn');
    
    if (debugDataBtn) {
        debugDataBtn.addEventListener('click', () => {
            console.log('=== LOADED GAME DATA ===');
            console.log('Rooms:', Object.keys(gameWorld).length, gameWorld);
            console.log('Items:', Object.keys(gameItems).length, gameItems);
            console.log('NPCs:', Object.keys(gameNpcs).length, gameNpcs);
            console.log('Monsters:', Object.keys(gameMonsters).length, gameMonsters);
            console.log('Players:', Object.keys(gamePlayers).length, gamePlayers);
            console.log('Classes:', Object.keys(gameClasses).length, gameClasses);
            alert(`Data loaded:\n${Object.keys(gameWorld).length} rooms\n${Object.keys(gameItems).length} items\n${Object.keys(gameNpcs).length} NPCs\n${Object.keys(gameMonsters).length} monsters\n${Object.keys(gamePlayers).length} players\n${Object.keys(gameClasses).length} classes`);
        });
    }
    
    // ========== ROOM EDITOR ==========
    const roomSelect = document.getElementById('room-select');
    const roomIdInput = document.getElementById('room-id');
    const roomNameInput = document.getElementById('room-name');
    const roomDescInput = document.getElementById('room-desc');
    const roomDescKeywordsInput = document.getElementById('room-desc-keywords');
    const generateDescBtn = document.getElementById('generate-desc-btn');
    const roomExitsInput = document.getElementById('room-exits');
    const roomDetailsInput = document.getElementById('room-details');
    const roomItemsSelector = document.getElementById('room-items-selector');
    const roomNpcsSelector = document.getElementById('room-npcs-selector');
    const roomMonstersSelector = document.getElementById('room-monsters-selector');
    const adminRoomStatus = document.getElementById('admin-room-status');
    const generateRoomBtn = document.getElementById('generate-room-btn');
    const aiRoomPrompt = document.getElementById('ai-room-prompt');
    
    function populateRoomSelector() {
        const currentVal = roomSelect.value;
        roomSelect.innerHTML = '<option value="">-- Select a Room --</option>';
        const sortedRoomIds = Object.keys(gameWorld).sort();
        sortedRoomIds.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${gameWorld[id]?.name || 'Unnamed Room'} (${id})`;
            roomSelect.appendChild(option);
        });
        if (currentVal) roomSelect.value = currentVal;
    }

    function clearAdminRoomForm() {
        roomIdInput.value = ''; roomNameInput.value = ''; roomDescInput.value = '';
        roomExitsInput.value = '{}'; roomDetailsInput.value = '{}';
        roomIdInput.disabled = false; roomSelect.value = ''; roomDescKeywordsInput.value = '';
        document.querySelectorAll('.room-item-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.room-npc-checkbox').forEach(cb => cb.checked = false);
        roomMonstersSelector.innerHTML = '';
    }
    
    document.getElementById('new-room-btn').addEventListener('click', clearAdminRoomForm);
    
    roomSelect.addEventListener('change', () => {
        const roomId = roomSelect.value;
        if (roomId && gameWorld[roomId]) {
            const room = gameWorld[roomId];
            roomIdInput.value = roomId; roomIdInput.disabled = true;
            roomNameInput.value = room.name || ''; roomDescInput.value = room.description || '';
            roomExitsInput.value = JSON.stringify(room.exits || {}, null, 2);
            roomDetailsInput.value = JSON.stringify(room.details || {}, null, 2);
            populateRoomItemsSelector();
            populateRoomNpcsSelector();
            populateRoomMonsterSelector();
        } else {
            clearAdminRoomForm();
        }
    });

    function populateRoomItemsSelector() {
        const currentRoomId = roomSelect.value;
        const room = currentRoomId ? gameWorld[currentRoomId] : null;

        roomItemsSelector.innerHTML = '';
        const sortedItemIds = Object.keys(gameItems).sort();
        if (sortedItemIds.length === 0) {
            roomItemsSelector.innerHTML = '<p class="text-gray-400">No items created yet.</p>';
            return;
        }
        sortedItemIds.forEach(id => {
            const item = gameItems[id];
            const isChecked = room?.items?.includes(id) ?? false;
            const div = document.createElement('div');
            div.innerHTML = `<label><input type="checkbox" class="room-item-checkbox" value="${id}" ${isChecked ? 'checked' : ''}> ${item?.name || 'Unnamed Item'} (${id})</label>`;
            roomItemsSelector.appendChild(div);
        });
    }
    
    function populateRoomNpcsSelector() {
        const currentRoomId = roomSelect.value;
        const room = currentRoomId ? gameWorld[currentRoomId] : null;

        roomNpcsSelector.innerHTML = '';
        const sortedNpcIds = Object.keys(gameNpcs).sort();
        if (sortedNpcIds.length === 0) {
            roomNpcsSelector.innerHTML = '<p class="text-gray-400">No NPCs created yet.</p>';
            return;
        }
        sortedNpcIds.forEach(id => {
            const npc = gameNpcs[id];
            const isChecked = room?.npcs?.includes(id) ?? false;
            const div = document.createElement('div');
            div.innerHTML = `<label><input type="checkbox" class="room-npc-checkbox" value="${id}" ${isChecked ? 'checked' : ''}> ${npc?.shortName || npc?.name || 'Unnamed NPC'} (${id})</label>`;
            roomNpcsSelector.appendChild(div);
        });
    }

    function populateRoomMonsterSelector() {
        const currentRoomId = roomSelect.value;
        const room = currentRoomId ? gameWorld[currentRoomId] : null;

        roomMonstersSelector.innerHTML = '';
        const sortedMonsterIds = Object.keys(gameMonsters).sort();
        if (sortedMonsterIds.length === 0) {
            roomMonstersSelector.innerHTML = '<p class="text-gray-400">No monsters created yet.</p>';
            return;
        }

        const roomSpawns = room?.monsterSpawns || [];
        roomSpawns.forEach((spawn, index) => {
            const monster = gameMonsters[spawn.monsterId];
            const div = document.createElement('div');
            div.className = 'mb-2 p-2 bg-gray-700 rounded';
            div.innerHTML = `
                <label>Monster: 
                    <select class="monster-spawn-select bg-gray-800 text-white p-1 rounded" data-index="${index}">
                        ${sortedMonsterIds.map(id => `<option value="${id}" ${id === spawn.monsterId ? 'selected' : ''}>${gameMonsters[id]?.name || id}</option>`).join('')}
                    </select>
                </label>
                <label class="ml-2">Respawn (sec): 
                    <input type="number" class="respawn-time-input bg-gray-800 text-white p-1 rounded w-20" data-index="${index}" value="${spawn.respawnTime || 60}">
                </label>
                <button class="ml-2 text-red-500 remove-spawn-btn" data-index="${index}">Remove</button>
            `;
            roomMonstersSelector.appendChild(div);
        });

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Monster Spawn';
        addBtn.className = 'btn mt-2';
        addBtn.addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'mb-2 p-2 bg-gray-700 rounded';
            const newIndex = roomMonstersSelector.querySelectorAll('.monster-spawn-select').length;
            div.innerHTML = `
                <label>Monster: 
                    <select class="monster-spawn-select bg-gray-800 text-white p-1 rounded" data-index="${newIndex}">
                        ${sortedMonsterIds.map(id => `<option value="${id}">${gameMonsters[id]?.name || id}</option>`).join('')}
                    </select>
                </label>
                <label class="ml-2">Respawn (sec): 
                    <input type="number" class="respawn-time-input bg-gray-800 text-white p-1 rounded w-20" data-index="${newIndex}" value="60">
                </label>
                <button class="ml-2 text-red-500 remove-spawn-btn" data-index="${newIndex}">Remove</button>
            `;
            roomMonstersSelector.insertBefore(div, addBtn);
            attachSpawnRemoveHandlers();
        });
        roomMonstersSelector.appendChild(addBtn);
        attachSpawnRemoveHandlers();
    }

    function attachSpawnRemoveHandlers() {
        document.querySelectorAll('.remove-spawn-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('div').remove();
            });
        });
    }

    generateDescBtn.addEventListener('click', async () => {
        const keywords = roomDescKeywordsInput.value.trim();
        if (!keywords) {
            adminRoomStatus.textContent = 'Please enter keywords for description generation.';
            return;
        }
        
        generateDescBtn.disabled = true;
        generateDescBtn.textContent = '✨ Generating...';
        adminRoomStatus.textContent = 'AI is writing the description...';
        
        try {
            const prompt = `Write a vivid, atmospheric description for a room in a text-based MUD game. Keywords: ${keywords}. Make it 2-3 sentences, evocative and immersive.`;
            const description = await callGeminiForText(prompt);
            roomDescInput.value = description;
            adminRoomStatus.textContent = 'Description generated!';
        } catch (error) {
            console.error("Description generation error:", error);
            adminRoomStatus.textContent = 'Failed to generate description.';
        } finally {
            generateDescBtn.disabled = false;
            generateDescBtn.textContent = '✨ Generate Description';
        }
    });

    generateRoomBtn.addEventListener('click', async () => {
        const prompt = aiRoomPrompt.value.trim();
        if (!prompt) {
            adminRoomStatus.textContent = 'Please enter a room description.';
            return;
        }

        const generateRoomBtn = document.getElementById('generate-room-btn');
        generateRoomBtn.disabled = true;
        generateRoomBtn.textContent = '✨ Generating...';
        adminRoomStatus.textContent = 'AI is creating your room...';

        try {
            const existingRooms = Object.keys(gameWorld);
            const existingItems = Object.keys(gameItems);
            const existingMonsters = Object.keys(gameMonsters);
            const newRoomData = await callGeminiForRoom(prompt, existingRooms, existingItems, existingMonsters, logToTerminal);
            
            clearAdminRoomForm();

            roomIdInput.value = newRoomData.roomId;
            roomNameInput.value = newRoomData.name;
            roomDescInput.value = newRoomData.description;
            roomExitsInput.value = JSON.stringify(newRoomData.exits || {}, null, 2);
            
            populateRoomItemsSelector();
            if (newRoomData.items && Array.isArray(newRoomData.items)) {
                newRoomData.items.forEach(itemId => {
                    const checkbox = document.querySelector(`.room-item-checkbox[value="${itemId}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            populateRoomMonsterSelector();
            if (newRoomData.monsterSpawns && Array.isArray(newRoomData.monsterSpawns)) {
                roomMonstersSelector.innerHTML = '';
                const sortedMonsterIds = Object.keys(gameMonsters).sort();
                newRoomData.monsterSpawns.forEach((spawn, index) => {
                    const div = document.createElement('div');
                    div.className = 'mb-2 p-2 bg-gray-700 rounded';
                    div.innerHTML = `
                        <label>Monster: 
                            <select class="monster-spawn-select bg-gray-800 text-white p-1 rounded" data-index="${index}">
                                ${sortedMonsterIds.map(id => `<option value="${id}" ${id === spawn.monsterId ? 'selected' : ''}>${gameMonsters[id]?.name || id}</option>`).join('')}
                            </select>
                        </label>
                        <label class="ml-2">Respawn (sec): 
                            <input type="number" class="respawn-time-input bg-gray-800 text-white p-1 rounded w-20" data-index="${index}" value="${spawn.respawnTime || 60}">
                        </label>
                        <button class="ml-2 text-red-500 remove-spawn-btn" data-index="${index}">Remove</button>
                    `;
                    roomMonstersSelector.appendChild(div);
                });
                const addBtn = document.createElement('button');
                addBtn.textContent = '+ Add Monster Spawn';
                addBtn.className = 'btn mt-2';
                addBtn.addEventListener('click', () => {
                    const div = document.createElement('div');
                    div.className = 'mb-2 p-2 bg-gray-700 rounded';
                    const newIndex = roomMonstersSelector.querySelectorAll('.monster-spawn-select').length;
                    div.innerHTML = `
                        <label>Monster: 
                            <select class="monster-spawn-select bg-gray-800 text-white p-1 rounded" data-index="${newIndex}">
                                ${sortedMonsterIds.map(id => `<option value="${id}">${gameMonsters[id]?.name || id}</option>`).join('')}
                            </select>
                        </label>
                        <label class="ml-2">Respawn (sec): 
                            <input type="number" class="respawn-time-input bg-gray-800 text-white p-1 rounded w-20" data-index="${newIndex}" value="60">
                        </label>
                        <button class="ml-2 text-red-500 remove-spawn-btn" data-index="${newIndex}">Remove</button>
                    `;
                    roomMonstersSelector.insertBefore(div, addBtn);
                    attachSpawnRemoveHandlers();
                });
                roomMonstersSelector.appendChild(addBtn);
                attachSpawnRemoveHandlers();
            }

            adminRoomStatus.textContent = 'AI room generated! Review and click Save Room.';
        } catch (error) {
            console.error("Room generation error:", error);
            adminRoomStatus.textContent = 'The AI failed to generate a valid room. Please try again.';
        } finally {
            generateRoomBtn.textContent = "Generate New Room";
            generateRoomBtn.disabled = false;
        }
    });

    // callGeminiForRoom is now imported from js/ai.js
        
    document.getElementById('save-room-btn').addEventListener('click', async () => {
        try {
            adminRoomStatus.textContent = 'Saving...';
            adminRoomStatus.className = 'ml-2 text-yellow-400';
            
            console.log('Save room button clicked');
            const roomId = roomIdInput.value.trim();
            const name = roomNameInput.value.trim();
            const description = roomDescInput.value.trim();

            console.log('Room data:', { roomId, name, description });

            if (!roomId || !name || !description) {
                adminRoomStatus.textContent = '✗ Please fill in Room ID, Name, and Description.';
                adminRoomStatus.className = 'ml-2 text-red-400';
                return;
            }

            let exits, details;
            try {
                exits = JSON.parse(roomExitsInput.value);
                details = JSON.parse(roomDetailsInput.value);
                console.log('Parsed JSON - Exits:', exits, 'Details:', details);
            } catch (e) {
                adminRoomStatus.textContent = `✗ Invalid JSON: ${e.message}`;
                adminRoomStatus.className = 'ml-2 text-red-400';
                console.error('JSON parse error:', e);
                return;
            }

            const checkedItems = Array.from(document.querySelectorAll('.room-item-checkbox:checked')).map(cb => cb.value);
            const checkedNpcs = Array.from(document.querySelectorAll('.room-npc-checkbox:checked')).map(cb => cb.value);
            
            const monsterSpawns = [];
            document.querySelectorAll('.monster-spawn-select').forEach(select => {
                const index = select.getAttribute('data-index');
                const respawnInput = document.querySelector(`.respawn-time-input[data-index="${index}"]`);
                monsterSpawns.push({
                    monsterId: select.value,
                    respawnTime: parseInt(respawnInput.value) || 60
                });
            });

            const roomData = { name, description, exits, details, items: checkedItems, npcs: checkedNpcs, monsterSpawns };
            console.log('Full room data being saved:', JSON.stringify(roomData, null, 2));
            
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`), roomData);
            console.log('Room saved successfully to Firebase');
            
            adminRoomStatus.textContent = `✓ Room "${roomId}" saved successfully!`;
            adminRoomStatus.className = 'ml-2 text-green-400';
            
            // Refresh the selector to show updated room
            populateRoomSelector();
            
            // Auto-clear status after 3 seconds
            setTimeout(() => {
                adminRoomStatus.textContent = '';
            }, 3000);
        } catch (error) {
            console.error('Error saving room:', error);
            adminRoomStatus.textContent = `✗ Error: ${error.message}`;
            adminRoomStatus.className = 'ml-2 text-red-400';
        }
    });

    document.getElementById('delete-room-btn').addEventListener('click', async () => {
        const roomId = roomIdInput.value.trim();
        if (!roomId) {
            adminRoomStatus.textContent = 'No room selected.';
            return;
        }
        if (!confirm(`Delete room "${roomId}"?`)) return;

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`));
        adminRoomStatus.textContent = `Room "${roomId}" deleted.`;
        clearAdminRoomForm();
    });

    // ========== ITEM EDITOR ==========
    const itemSelect = document.getElementById('item-select');
    const itemIdInput = document.getElementById('item-id');
    const itemNameInput = document.getElementById('item-name');
    const itemAliasesInput = document.getElementById('item-aliases');
    const itemCostInput = document.getElementById('item-cost');
    const itemMovableCheckbox = document.getElementById('item-movable');
    const itemConsumableCheckbox = document.getElementById('item-consumable');
    const itemNewsworthyCheckbox = document.getElementById('item-newsworthy');
    const itemHpRestoreInput = document.getElementById('item-hp-restore');
    const itemEffectInput = document.getElementById('item-effect');
    const itemIsWeaponCheckbox = document.getElementById('item-is-weapon');
    const itemWeaponFields = document.getElementById('item-weapon-fields');
    const itemWeaponDamageInput = document.getElementById('item-weapon-damage');
    const itemWeaponTypeSelect = document.getElementById('item-weapon-type');
    const itemIsReadableCheckbox = document.getElementById('item-is-readable');
    const readableFields = document.getElementById('readable-fields');
    const itemReadableTextArea = document.getElementById('item-readable-text');
    const itemTypeSelect = document.getElementById('item-type');
    const itemSpecialDataInput = document.getElementById('item-special-data');
    const adminItemStatus = document.getElementById('admin-item-status');
    const generateItemBtn = document.getElementById('generate-item-btn');
    const aiItemPrompt = document.getElementById('item-ai-prompt');
    
    // Toggle weapon fields visibility
    itemIsWeaponCheckbox.addEventListener('change', () => {
        itemWeaponFields.classList.toggle('hidden', !itemIsWeaponCheckbox.checked);
    });
    
    // Toggle readable fields visibility
    itemIsReadableCheckbox.addEventListener('change', () => {
        readableFields.classList.toggle('hidden', !itemIsReadableCheckbox.checked);
    });
    
    if (!generateItemBtn) {
        console.error('generate-item-btn not found!');
    }
    
    function populateItemSelector() {
        const currentVal = itemSelect.value;
        itemSelect.innerHTML = '<option value="">-- Select an Item --</option>';
        const sortedItemIds = Object.keys(gameItems).sort();
        sortedItemIds.forEach(id => {
            const item = gameItems[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${item?.name || 'Unnamed Item'} (${id})`;
            itemSelect.appendChild(option);
        });
        if (currentVal) itemSelect.value = currentVal;
    }

    function clearAdminItemForm() {
        itemIdInput.value = ''; itemNameInput.value = ''; itemAliasesInput.value = ''; itemCostInput.value = '';
        itemMovableCheckbox.checked = true;
        itemConsumableCheckbox.checked = false;
        itemNewsworthyCheckbox.checked = false;
        itemHpRestoreInput.value = '0';
        itemEffectInput.value = '';
        itemIsWeaponCheckbox.checked = false;
        itemWeaponFields.classList.add('hidden');
        itemWeaponDamageInput.value = '3';
        itemWeaponTypeSelect.value = 'melee';
        itemIsReadableCheckbox.checked = false;
        readableFields.classList.add('hidden');
        itemReadableTextArea.value = '';
        itemTypeSelect.value = 'normal';
        itemSpecialDataInput.value = '';
        itemIdInput.disabled = false;
        itemSelect.value = '';
    }

    document.getElementById('new-item-btn').addEventListener('click', clearAdminItemForm);

    itemSelect.addEventListener('change', () => {
        const itemId = itemSelect.value;
        if (itemId && gameItems[itemId]) {
            const item = gameItems[itemId];
            itemIdInput.value = itemId; itemIdInput.disabled = true;
            itemNameInput.value = item.name || '';
            itemAliasesInput.value = Array.isArray(item.aliases) ? item.aliases.join(', ') : (item.aliases || '');
            itemCostInput.value = item.cost || 0;
            itemMovableCheckbox.checked = item.movable !== false;
            itemConsumableCheckbox.checked = item.consumable === true;
            itemNewsworthyCheckbox.checked = item.newsworthy === true;
            itemHpRestoreInput.value = item.hpRestore || 0;
            itemEffectInput.value = item.effect || '';
            itemIsWeaponCheckbox.checked = item.isWeapon === true;
            if (item.isWeapon) {
                itemWeaponFields.classList.remove('hidden');
                itemWeaponDamageInput.value = item.weaponDamage || 3;
                itemWeaponTypeSelect.value = item.weaponType || 'melee';
            } else {
                itemWeaponFields.classList.add('hidden');
            }
            itemIsReadableCheckbox.checked = item.isReadable === true;
            if (item.isReadable) {
                readableFields.classList.remove('hidden');
                itemReadableTextArea.value = item.readableText || '';
            } else {
                readableFields.classList.add('hidden');
            }
            itemTypeSelect.value = item.itemType || 'normal';
            itemSpecialDataInput.value = item.specialData ? JSON.stringify(item.specialData) : '';
        } else {
            clearAdminItemForm();
        }
    });

    generateItemBtn.addEventListener('click', async () => {
        console.log('Generate Item button clicked!');
        const prompt = aiItemPrompt.value.trim();
        if (!prompt) {
            adminItemStatus.textContent = 'Please enter an item description.';
            return;
        }

        generateItemBtn.disabled = true;
        generateItemBtn.textContent = '✨ Generating...';
        adminItemStatus.textContent = 'AI is creating your item...';

        try {
            console.log('Calling callGeminiForItem...');
            const existingItems = Object.keys(gameItems);
            const newItemData = await callGeminiForItem(prompt, existingItems);
            console.log('Item generated:', newItemData);
            
            clearAdminItemForm();

            itemIdInput.value = newItemData.itemId;
            itemNameInput.value = newItemData.name;
            itemCostInput.value = newItemData.cost;
            itemMovableCheckbox.checked = newItemData.movable !== false;
            itemConsumableCheckbox.checked = newItemData.consumable === true;
            itemHpRestoreInput.value = newItemData.hpRestore || 0;
            itemEffectInput.value = newItemData.effect || '';
            itemIsWeaponCheckbox.checked = newItemData.isWeapon === true;
            if (newItemData.isWeapon) {
                itemWeaponFields.classList.remove('hidden');
                itemWeaponDamageInput.value = newItemData.weaponDamage || 3;
                itemWeaponTypeSelect.value = newItemData.weaponType || 'melee';
            }
            itemTypeSelect.value = newItemData.itemType || 'normal';
            itemSpecialDataInput.value = newItemData.specialData ? JSON.stringify(newItemData.specialData) : '';

            adminItemStatus.textContent = 'AI item generated! Review and click Save Item.';
        } catch (error) {
            console.error("Item generation error:", error);
            adminItemStatus.textContent = 'The AI failed to generate a valid item. Please try again.';
        } finally {
            generateItemBtn.textContent = '✨ Generate Item';
            generateItemBtn.disabled = false;
        }
    });

    // callGeminiForItem is now imported from js/ai.js

    document.getElementById('save-item-btn').addEventListener('click', async () => {
        try {
            const itemId = itemIdInput.value.trim();
            const name = itemNameInput.value.trim();
            const aliasesRaw = itemAliasesInput.value.trim();
            const aliases = aliasesRaw ? aliasesRaw.split(',').map(a => a.trim()).filter(a => a.length > 0) : [];
            const cost = parseInt(itemCostInput.value) || 0;
            const movable = itemMovableCheckbox.checked;
            const consumable = itemConsumableCheckbox.checked;
            const newsworthy = itemNewsworthyCheckbox.checked;
            const hpRestore = parseInt(itemHpRestoreInput.value) || 0;
            const effect = itemEffectInput.value.trim();
            const itemType = itemTypeSelect.value || 'normal';
            
            let specialData = null;
            if (itemSpecialDataInput.value.trim()) {
                try {
                    specialData = JSON.parse(itemSpecialDataInput.value);
                } catch (e) {
                    adminItemStatus.textContent = 'Invalid JSON in Special Data field.';
                    return;
                }
            }

            if (!itemId || !name) {
                adminItemStatus.textContent = 'Please fill in Item ID and Name.';
                return;
            }

            const itemData = { name, cost, movable, consumable, newsworthy, hpRestore, effect, itemType };
            
            // Add aliases if provided
            if (aliases.length > 0) {
                itemData.aliases = aliases;
            }
            
            // Add weapon properties if isWeapon is checked
            if (itemIsWeaponCheckbox.checked) {
                itemData.isWeapon = true;
                itemData.weaponDamage = parseInt(itemWeaponDamageInput.value) || 3;
                itemData.weaponType = itemWeaponTypeSelect.value || 'melee';
            } else {
                itemData.isWeapon = false;
            }
            
            // Add readable properties if isReadable is checked
            if (itemIsReadableCheckbox.checked) {
                itemData.isReadable = true;
                itemData.readableText = itemReadableTextArea.value.trim() || '';
            } else {
                itemData.isReadable = false;
            }
            
            if (specialData) itemData.specialData = specialData;
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${itemId}`), itemData);
            adminItemStatus.textContent = `Item "${itemId}" saved!`;
            populateItemSelector();
        } catch (error) {
            console.error('Error saving item:', error);
            adminItemStatus.textContent = `Error saving item: ${error.message}`;
        }
    });

    document.getElementById('delete-item-btn').addEventListener('click', async () => {
        const itemId = itemIdInput.value.trim();
        if (!itemId) {
            adminItemStatus.textContent = 'No item selected.';
            return;
        }
        if (!confirm(`Delete item "${itemId}"?`)) return;

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${itemId}`));
        adminItemStatus.textContent = `Item "${itemId}" deleted.`;
        clearAdminItemForm();
    });

    // ========== NPC EDITOR ==========
    const npcSelect = document.getElementById('npc-select');
    const npcIdInput = document.getElementById('npc-id');
    const npcShortNameInput = document.getElementById('npc-short-name');
    const npcNameInput = document.getElementById('npc-name');
    const npcDescInput = document.getElementById('npc-desc');
    const npcSellsSelector = document.getElementById('npc-sells-selector');
    const npcAiEnabledCheckbox = document.getElementById('npc-ai-enabled');
    const npcDialogueInput = document.getElementById('npc-dialogue');
    const npcDialogueLabel = document.getElementById('npc-dialogue-label');
    const npcTriggersInput = document.getElementById('npc-triggers');
    const npcCanFightCheckbox = document.getElementById('npc-can-fight');
    const npcCombatFields = document.getElementById('npc-combat-fields');
    const npcHpInput = document.getElementById('npc-hp');
    const npcHostileSelect = document.getElementById('npc-hostile');
    const npcMinAtkInput = document.getElementById('npc-min-atk');
    const npcMaxAtkInput = document.getElementById('npc-max-atk');
    const npcXpInput = document.getElementById('npc-xp');
    const npcGoldInput = document.getElementById('npc-gold');
    const adminNpcStatus = document.getElementById('admin-npc-status');
    const generateNpcBtn = document.getElementById('generate-npc-btn');
    const aiNpcPrompt = document.getElementById('npc-ai-prompt');
    const npcWandersCheckbox = document.getElementById('npc-wanders');
    const npcWanderFields = document.getElementById('npc-wander-fields');
    const npcWanderMinInput = document.getElementById('npc-wander-min');
    const npcWanderMaxInput = document.getElementById('npc-wander-max');
    const npcProactiveGreetingCheckbox = document.getElementById('npc-proactive-greeting');
    const npcGreetingFields = document.getElementById('npc-greeting-fields');
    const npcGreetingDelayMinInput = document.getElementById('npc-greeting-delay-min');
    const npcGreetingDelayMaxInput = document.getElementById('npc-greeting-delay-max');
    const npcGreetingIntervalInput = document.getElementById('npc-greeting-interval');
    const npcAmbientDialogueCheckbox = document.getElementById('npc-ambient-dialogue');
    const npcAmbientFields = document.getElementById('npc-ambient-fields');
    const npcAmbientMinInput = document.getElementById('npc-ambient-min');
    const npcAmbientMaxInput = document.getElementById('npc-ambient-max');
    
    // Toggle combat fields visibility
    npcCanFightCheckbox.addEventListener('change', () => {
        npcCombatFields.classList.toggle('hidden', !npcCanFightCheckbox.checked);
    });
    
    // Toggle wander fields visibility
    npcWandersCheckbox.addEventListener('change', () => {
        npcWanderFields.classList.toggle('hidden', !npcWandersCheckbox.checked);
    });
    
    // Toggle proactive greeting fields visibility
    npcProactiveGreetingCheckbox.addEventListener('change', () => {
        npcGreetingFields.classList.toggle('hidden', !npcProactiveGreetingCheckbox.checked);
    });
    
    // Toggle ambient dialogue fields visibility
    npcAmbientDialogueCheckbox.addEventListener('change', () => {
        npcAmbientFields.classList.toggle('hidden', !npcAmbientDialogueCheckbox.checked);
    });
    
    function populateNpcSelector() {
        const currentVal = npcSelect.value;
        npcSelect.innerHTML = '<option value="">-- Select an NPC --</option>';
        const sortedNpcIds = Object.keys(gameNpcs).sort();
        sortedNpcIds.forEach(id => {
            const npc = gameNpcs[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${npc?.shortName || npc?.name || 'Unnamed NPC'} (${id})`;
            npcSelect.appendChild(option);
        });
        if (currentVal) npcSelect.value = currentVal;
    }

    function clearAdminNpcForm() {
        npcIdInput.value = ''; npcShortNameInput.value = ''; npcNameInput.value = ''; npcDescInput.value = '';
        npcDialogueInput.value = ''; npcTriggersInput.value = '{}';
        npcAiEnabledCheckbox.checked = false;
        npcCanFightCheckbox.checked = false;
        npcCombatFields.classList.add('hidden');
        npcHpInput.value = '50';
        npcHostileSelect.value = 'false';
        npcMinAtkInput.value = '3';
        npcMaxAtkInput.value = '8';
        npcXpInput.value = '50';
        npcGoldInput.value = '25';
        npcWandersCheckbox.checked = false;
        npcWanderFields.classList.add('hidden');
        npcWanderMinInput.value = '60';
        npcWanderMaxInput.value = '180';
        npcProactiveGreetingCheckbox.checked = false;
        npcGreetingFields.classList.add('hidden');
        npcGreetingDelayMinInput.value = '5';
        npcGreetingDelayMaxInput.value = '30';
        npcGreetingIntervalInput.value = '120';
        npcAmbientDialogueCheckbox.checked = false;
        npcAmbientFields.classList.add('hidden');
        npcAmbientMinInput.value = '120';
        npcAmbientMaxInput.value = '600';
        npcIdInput.disabled = false; npcSelect.value = '';
        updateNpcDialogueLabel();
        document.querySelectorAll('.npc-sells-checkbox').forEach(cb => cb.checked = false);
    }

    function updateNpcDialogueLabel() {
        if (npcAiEnabledCheckbox.checked) {
            npcDialogueLabel.textContent = 'AI Personality Prompt (describe their character):';
            npcDialogueInput.placeholder = 'e.g., You are a mysterious wizard who speaks in riddles...';
        } else {
            npcDialogueLabel.textContent = 'Dialogue Lines (one per line):';
            npcDialogueInput.placeholder = 'e.g., Hello traveler!\nWelcome to my shop!';
        }
    }

    npcAiEnabledCheckbox.addEventListener('change', updateNpcDialogueLabel);

    document.getElementById('new-npc-btn').addEventListener('click', clearAdminNpcForm);

    npcSelect.addEventListener('change', () => {
        const npcId = npcSelect.value;
        if (npcId && gameNpcs[npcId]) {
            const npc = gameNpcs[npcId];
            npcIdInput.value = npcId; npcIdInput.disabled = true;
            npcShortNameInput.value = npc.shortName || '';
            npcNameInput.value = npc.name || '';
            npcDescInput.value = npc.description || '';
            npcAiEnabledCheckbox.checked = npc.useAI || false;
            
            if (npc.useAI) {
                npcDialogueInput.value = npc.dialogue || '';
            } else {
                npcDialogueInput.value = Array.isArray(npc.dialogue) ? npc.dialogue.join('\n') : (npc.dialogue || '');
            }
            
            npcTriggersInput.value = JSON.stringify(npc.triggers || {}, null, 2);
            
            // Load combat stats
            npcCanFightCheckbox.checked = npc.canFight || false;
            if (npc.canFight) {
                npcCombatFields.classList.remove('hidden');
                npcHpInput.value = npc.hp || 50;
                npcHostileSelect.value = npc.hostile ? 'true' : 'false';
                npcMinAtkInput.value = npc.minAtk || 3;
                npcMaxAtkInput.value = npc.maxAtk || 8;
                npcXpInput.value = npc.xp || 50;
                npcGoldInput.value = npc.gold || 25;
            } else {
                npcCombatFields.classList.add('hidden');
            }
            
            // Load wandering settings
            npcWandersCheckbox.checked = npc.wanders || false;
            if (npc.wanders) {
                npcWanderFields.classList.remove('hidden');
                npcWanderMinInput.value = npc.wanderInterval?.min || 60;
                npcWanderMaxInput.value = npc.wanderInterval?.max || 180;
            } else {
                npcWanderFields.classList.add('hidden');
            }
            
            // Load proactive greeting settings
            npcProactiveGreetingCheckbox.checked = npc.proactiveGreeting || false;
            if (npc.proactiveGreeting) {
                npcGreetingFields.classList.remove('hidden');
                npcGreetingDelayMinInput.value = npc.greetingDelay?.min || 5;
                npcGreetingDelayMaxInput.value = npc.greetingDelay?.max || 30;
                npcGreetingIntervalInput.value = npc.greetingInterval?.min || 120;
                
                npcAmbientDialogueCheckbox.checked = npc.ambientDialogue || false;
                if (npc.ambientDialogue) {
                    npcAmbientFields.classList.remove('hidden');
                    npcAmbientMinInput.value = npc.ambientInterval?.min || 120;
                    npcAmbientMaxInput.value = npc.ambientInterval?.max || 600;
                } else {
                    npcAmbientFields.classList.add('hidden');
                }
            } else {
                npcGreetingFields.classList.add('hidden');
                npcAmbientFields.classList.add('hidden');
            }
            
            updateNpcDialogueLabel();
            populateNpcSellsSelector(npc.sells || []);
        } else {
            clearAdminNpcForm();
        }
    });

    function populateNpcSellsSelector(selectedItems = []) {
        npcSellsSelector.innerHTML = '';
        const sortedItemIds = Object.keys(gameItems).sort();
        if (sortedItemIds.length === 0) {
            npcSellsSelector.innerHTML = '<p class="text-gray-400">No items created yet.</p>';
            return;
        }
        sortedItemIds.forEach(id => {
            const item = gameItems[id];
            const isChecked = selectedItems.includes(id);
            const div = document.createElement('div');
            div.innerHTML = `<label><input type="checkbox" class="npc-sells-checkbox" value="${id}" ${isChecked ? 'checked' : ''}> ${item?.name || 'Unnamed Item'} (${id})</label>`;
            npcSellsSelector.appendChild(div);
        });
    }

    generateNpcBtn.addEventListener('click', async () => {
        const prompt = aiNpcPrompt.value.trim();
        if (!prompt) {
            adminNpcStatus.textContent = 'Please enter an NPC description.';
            return;
        }

        generateNpcBtn.disabled = true;
        generateNpcBtn.textContent = '✨ Generating...';
        adminNpcStatus.textContent = 'AI is creating your NPC...';

        try {
            const existingNpcs = Object.keys(gameNpcs);
            const existingItems = Object.keys(gameItems);
            const newNpcData = await callGeminiForNpc(prompt, existingNpcs, existingItems);
            
            clearAdminNpcForm();

            npcIdInput.value = newNpcData.npcId;
            npcShortNameInput.value = newNpcData.shortName || '';
            npcNameInput.value = newNpcData.name;
            npcDescInput.value = newNpcData.description || '';
            npcAiEnabledCheckbox.checked = newNpcData.useAI || false;
            
            if (newNpcData.useAI) {
                npcDialogueInput.value = newNpcData.dialogue || '';
            } else {
                npcDialogueInput.value = Array.isArray(newNpcData.dialogue) 
                    ? newNpcData.dialogue.join('\n') 
                    : (newNpcData.dialogue || '');
            }
            
            npcTriggersInput.value = JSON.stringify(newNpcData.triggers || {}, null, 2);
            updateNpcDialogueLabel();

            populateNpcSellsSelector(newNpcData.sells || []);

            adminNpcStatus.textContent = 'AI NPC generated! Review and click Save NPC.';
        } catch (error) {
            console.error("NPC generation error:", error);
            adminNpcStatus.textContent = 'The AI failed to generate a valid NPC. Please try again.';
        } finally {
            generateNpcBtn.textContent = '✨ Generate NPC';
            generateNpcBtn.disabled = false;
        }
    });

    // callGeminiForNpc is now imported from js/ai.js

    document.getElementById('save-npc-btn').addEventListener('click', async () => {
        try {
            console.log('Save NPC button clicked');
            const npcId = npcIdInput.value.trim();
            const shortName = npcShortNameInput.value.trim();
            const name = npcNameInput.value.trim();
            const description = npcDescInput.value.trim();
            const useAI = npcAiEnabledCheckbox.checked;
            const dialogueRaw = npcDialogueInput.value.trim();

            console.log('NPC data:', { npcId, shortName, name, description, useAI, dialogueRaw });

            if (!npcId || !name) {
                adminNpcStatus.textContent = 'Please fill in NPC ID and Name.';
                return;
            }

            let dialogue;
            if (useAI) {
                dialogue = dialogueRaw;
            } else {
                dialogue = dialogueRaw.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            }

            let triggers;
            try {
                triggers = JSON.parse(npcTriggersInput.value);
            } catch (e) {
                adminNpcStatus.textContent = 'Invalid JSON in Triggers.';
                return;
            }

            const sells = Array.from(document.querySelectorAll('.npc-sells-checkbox:checked')).map(cb => cb.value);

            const npcData = { shortName, name, description, useAI, dialogue, triggers, sells };
            
            // Add wandering behavior if enabled
            if (npcWandersCheckbox.checked) {
                npcData.wanders = true;
                npcData.wanderInterval = {
                    min: parseInt(npcWanderMinInput.value) || 60,
                    max: parseInt(npcWanderMaxInput.value) || 180
                };
            } else {
                npcData.wanders = false;
            }
            
            // Add proactive greeting behavior if enabled
            if (npcProactiveGreetingCheckbox.checked) {
                npcData.proactiveGreeting = true;
                npcData.greetingDelay = {
                    min: parseInt(npcGreetingDelayMinInput.value) || 5,
                    max: parseInt(npcGreetingDelayMaxInput.value) || 30
                };
                npcData.greetingInterval = {
                    min: parseInt(npcGreetingIntervalInput.value) || 120
                };
                
                // Add ambient dialogue if enabled
                if (npcAmbientDialogueCheckbox.checked) {
                    npcData.ambientDialogue = true;
                    npcData.ambientInterval = {
                        min: parseInt(npcAmbientMinInput.value) || 120,
                        max: parseInt(npcAmbientMaxInput.value) || 600
                    };
                } else {
                    npcData.ambientDialogue = false;
                }
            } else {
                npcData.proactiveGreeting = false;
                npcData.ambientDialogue = false;
            }
            
            // Add combat stats if canFight is enabled
            if (npcCanFightCheckbox.checked) {
                npcData.canFight = true;
                npcData.hp = parseInt(npcHpInput.value) || 50;
                npcData.hostile = npcHostileSelect.value === 'true';
                npcData.minAtk = parseInt(npcMinAtkInput.value) || 3;
                npcData.maxAtk = parseInt(npcMaxAtkInput.value) || 8;
                npcData.xp = parseInt(npcXpInput.value) || 50;
                npcData.gold = parseInt(npcGoldInput.value) || 25;
            } else {
                npcData.canFight = false;
            }
            
            console.log('Saving NPC to Firebase:', npcData);
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${npcId}`), npcData);
            console.log('NPC saved successfully');
            adminNpcStatus.textContent = `NPC "${npcId}" saved!`;
            populateNpcSelector();
        } catch (error) {
            console.error('Error saving NPC:', error);
            adminNpcStatus.textContent = `Error saving NPC: ${error.message}`;
        }
    });

    document.getElementById('delete-npc-btn').addEventListener('click', async () => {
        const npcId = npcIdInput.value.trim();
        if (!npcId) {
            adminNpcStatus.textContent = 'No NPC selected.';
            return;
        }
        if (!confirm(`Delete NPC "${npcId}"?`)) return;

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${npcId}`));
        adminNpcStatus.textContent = `NPC "${npcId}" deleted.`;
        clearAdminNpcForm();
    });

    // ========== MONSTER EDITOR ==========
    const monsterSelect = document.getElementById('monster-select');
    const monsterIdInput = document.getElementById('monster-id');
    const monsterNameInput = document.getElementById('monster-name');
    const monsterDescInput = document.getElementById('monster-desc');
    const monsterHpInput = document.getElementById('monster-hp');
    const monsterMinAtkInput = document.getElementById('monster-min-atk');
    const monsterMaxAtkInput = document.getElementById('monster-max-atk');
    const monsterXpInput = document.getElementById('monster-xp');
    const monsterGoldInput = document.getElementById('monster-gold');
    const monsterItemDropSelect = document.getElementById('monster-item-drop');
    const monsterNewsworthyCheckbox = document.getElementById('monster-newsworthy');
    const adminMonsterStatus = document.getElementById('admin-monster-status');
    const generateMonsterBtn = document.getElementById('generate-monster-btn');
    const aiMonsterPrompt = document.getElementById('monster-ai-prompt');

    function populateMonsterSelector() {
        const currentVal = monsterSelect.value;
        monsterSelect.innerHTML = '<option value="">-- Select a Monster --</option>';
        const sortedMonsterIds = Object.keys(gameMonsters).sort();
        sortedMonsterIds.forEach(id => {
            const monster = gameMonsters[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${monster?.name || 'Unnamed Monster'} (${id})`;
            monsterSelect.appendChild(option);
        });
        if (currentVal) monsterSelect.value = currentVal;
    }

    function populateMonsterItemDropSelector(selected = '') {
        monsterItemDropSelect.innerHTML = '<option value="">-- No Item Drop --</option>';
        const sortedItemIds = Object.keys(gameItems).sort();
        sortedItemIds.forEach(id => {
            const item = gameItems[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${item?.name || 'Unnamed Item'} (${id})`;
            if (id === selected) option.selected = true;
            monsterItemDropSelect.appendChild(option);
        });
    }

    function clearAdminMonsterForm() {
        monsterIdInput.value = ''; monsterIdInput.disabled = false;
        monsterNameInput.value = ''; monsterDescInput.value = '';
        monsterHpInput.value = ''; monsterMinAtkInput.value = ''; monsterMaxAtkInput.value = '';
        monsterXpInput.value = ''; monsterGoldInput.value = '';
        monsterNewsworthyCheckbox.checked = false;
        monsterSelect.value = '';
        populateMonsterItemDropSelector();
    }

    document.getElementById('new-monster-btn').addEventListener('click', clearAdminMonsterForm);

    monsterSelect.addEventListener('change', () => {
        const monsterId = monsterSelect.value;
        if (monsterId && gameMonsters[monsterId]) {
            const monster = gameMonsters[monsterId];
            monsterIdInput.value = monsterId; monsterIdInput.disabled = true;
            monsterNameInput.value = monster.name || '';
            monsterDescInput.value = monster.description || '';
            monsterHpInput.value = monster.hp || '';
            monsterMinAtkInput.value = monster.minAtk || '';
            monsterMaxAtkInput.value = monster.maxAtk || '';
            monsterXpInput.value = monster.xp || '';
            monsterGoldInput.value = monster.gold || '';
            monsterNewsworthyCheckbox.checked = monster.newsworthy === true;
            populateMonsterItemDropSelector(monster.itemDrop || '');
        } else {
            clearAdminMonsterForm();
        }
    });

    generateMonsterBtn.addEventListener('click', async () => {
        const prompt = aiMonsterPrompt.value.trim();
        if (!prompt) {
            adminMonsterStatus.textContent = 'Please enter a monster description.';
            return;
        }

        generateMonsterBtn.disabled = true;
        generateMonsterBtn.textContent = '✨ Generating...';
        adminMonsterStatus.textContent = 'AI is creating your monster...';

        try {
            const existingMonsters = Object.keys(gameMonsters);
            const existingItems = Object.keys(gameItems);
            const newMonsterData = await callGeminiForMonster(prompt, existingMonsters, existingItems);
            
            clearAdminMonsterForm();

            monsterIdInput.value = newMonsterData.monsterId;
            monsterNameInput.value = newMonsterData.name;
            monsterDescInput.value = newMonsterData.description;
            monsterHpInput.value = newMonsterData.hp;
            monsterMinAtkInput.value = newMonsterData.minAtk;
            monsterMaxAtkInput.value = newMonsterData.maxAtk;
            monsterXpInput.value = newMonsterData.xp;
            monsterGoldInput.value = newMonsterData.gold;
            populateMonsterItemDropSelector(newMonsterData.itemDrop || '');

            adminMonsterStatus.textContent = 'AI monster generated! Review and click Save Monster.';
        } catch (error) {
            console.error("Monster generation error:", error);
            adminMonsterStatus.textContent = 'The AI failed to generate a valid monster. Please try again.';
        } finally {
            generateMonsterBtn.textContent = '✨ Generate Monster';
            generateMonsterBtn.disabled = false;
        }
    });

    // callGeminiForMonster is now imported from js/ai.js
    
    document.getElementById('save-monster-btn').addEventListener('click', async () => {
        try {
            const monsterId = monsterIdInput.value.trim();
            const name = monsterNameInput.value.trim();
            const description = monsterDescInput.value.trim();
            const hp = parseInt(monsterHpInput.value) || 10;
            const minAtk = parseInt(monsterMinAtkInput.value) || 1;
            const maxAtk = parseInt(monsterMaxAtkInput.value) || 3;
            const xp = parseInt(monsterXpInput.value) || 10;
            const gold = parseInt(monsterGoldInput.value) || 5;
            const itemDrop = monsterItemDropSelect.value || '';
            const newsworthy = monsterNewsworthyCheckbox.checked;

            if (!monsterId || !name) {
                adminMonsterStatus.textContent = 'Please fill in Monster ID and Name.';
                return;
            }

            const monsterData = { name, description, hp, minAtk, maxAtk, xp, gold, itemDrop, newsworthy };
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${monsterId}`), monsterData);
            adminMonsterStatus.textContent = `Monster "${monsterId}" saved!`;
            populateMonsterSelector();
        } catch (error) {
            console.error('Error saving monster:', error);
            adminMonsterStatus.textContent = `Error saving monster: ${error.message}`;
        }
    });

    document.getElementById('delete-monster-btn').addEventListener('click', async () => {
        const monsterId = monsterIdInput.value.trim();
        if (!monsterId) {
            adminMonsterStatus.textContent = 'No monster selected.';
            return;
        }
        if (!confirm(`Delete monster "${monsterId}"?`)) return;

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${monsterId}`));
        adminMonsterStatus.textContent = `Monster "${monsterId}" deleted.`;
        clearAdminMonsterForm();
    });

    // ========== PLAYER EDITOR ==========
    const playerSelect = document.getElementById('player-select');
    const playerEditForm = document.getElementById('player-edit-form');
    const adminPlayerStatus = document.getElementById('admin-player-status');
    
    // Basic info fields
    const playerNameEdit = document.getElementById('player-name-edit');
    const playerRaceEdit = document.getElementById('player-race-edit');
    const playerClassEdit = document.getElementById('player-class-edit');
    const playerGenderEdit = document.getElementById('player-gender-edit');
    const playerAgeEdit = document.getElementById('player-age-edit');
    const playerDescriptionEdit = document.getElementById('player-description-edit');
    const playerAdminEdit = document.getElementById('player-admin-edit');
    
    // Progression fields
    const playerLevelEdit = document.getElementById('player-level-edit');
    const playerXpEdit = document.getElementById('player-xp-edit');
    const playerMoneyEdit = document.getElementById('player-money-edit');
    const playerRoomEdit = document.getElementById('player-room-edit');
    
    // HP/MP fields
    const playerHpEdit = document.getElementById('player-hp-edit');
    const playerMaxHpEdit = document.getElementById('player-maxhp-edit');
    const playerMpEdit = document.getElementById('player-mp-edit');
    const playerMaxMpEdit = document.getElementById('player-maxmp-edit');
    
    // Attribute fields
    const attrInputs = {
        str: document.getElementById('player-str-edit'),
        dex: document.getElementById('player-dex-edit'),
        con: document.getElementById('player-con-edit'),
        int: document.getElementById('player-int-edit'),
        wis: document.getElementById('player-wis-edit'),
        cha: document.getElementById('player-cha-edit'),
    };
    
    // Inventory field
    const playerInventoryEdit = document.getElementById('player-inventory-edit');
    
    function populatePlayerSelector() {
         const currentVal = playerSelect.value;
         playerSelect.innerHTML = '<option value="">-- Select Player --</option>';
         Object.keys(gamePlayers).forEach(id => {
            const player = gamePlayers[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${player?.name || 'Unnamed'} (${player?.email || id})`;
            playerSelect.appendChild(option);
         });
         if (currentVal) playerSelect.value = currentVal;
    }

    function populatePlayerRoomSelector(selectedRoom = '') {
        playerRoomEdit.innerHTML = '';
        const sortedRoomIds = Object.keys(gameWorld).sort();
        sortedRoomIds.forEach(id => {
            const room = gameWorld[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${room?.name || 'Unnamed Room'} (${id})`;
            if (id === selectedRoom) option.selected = true;
            playerRoomEdit.appendChild(option);
        });
    }

    function populatePlayerClassSelector(selectedClass = '') {
        playerClassEdit.innerHTML = '';
        const sortedClassIds = Object.keys(gameClasses).sort();
        sortedClassIds.forEach(id => {
            const classData = gameClasses[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = classData?.name || id;
            if (id === selectedClass) option.selected = true;
            playerClassEdit.appendChild(option);
        });
    }

    playerSelect.addEventListener('change', () => {
        const playerId = playerSelect.value;
        if (playerId && gamePlayers[playerId]) {
            const player = gamePlayers[playerId];
            
            // Basic info
            playerNameEdit.value = player.name || '';
            playerRaceEdit.value = player.race || '';
            playerGenderEdit.value = player.gender || 'Other';
            playerAgeEdit.value = player.age || 25;
            playerDescriptionEdit.value = player.description || '';
            playerAdminEdit.checked = player.isAdmin || false;
            
            // Populate class selector and set current class
            populatePlayerClassSelector(player.class || 'Adventurer');
            
            // Progression
            playerLevelEdit.value = player.level || 1;
            playerXpEdit.value = player.xp || 0;
            playerMoneyEdit.value = player.money || 0;
            populatePlayerRoomSelector(player.roomId || 'start');
            
            // HP/MP
            playerHpEdit.value = player.hp || 100;
            playerMaxHpEdit.value = player.maxHp || 100;
            playerMpEdit.value = player.mp || 100;
            playerMaxMpEdit.value = player.maxMp || 100;
            
            // Attributes
            const attrs = player.attributes || {};
            attrInputs.str.value = attrs.str || 10;
            attrInputs.dex.value = attrs.dex || 10;
            attrInputs.con.value = attrs.con || 10;
            attrInputs.int.value = attrs.int || 10;
            attrInputs.wis.value = attrs.wis || 10;
            attrInputs.cha.value = attrs.cha || 10;
            
            // Inventory
            playerInventoryEdit.value = JSON.stringify(player.inventory || [], null, 2);

            playerEditForm.classList.remove('hidden');
        } else {
            playerEditForm.classList.add('hidden');
        }
    });

    document.getElementById('save-player-btn').addEventListener('click', async () => {
        const selectedPlayerId = playerSelect.value;
        if (!selectedPlayerId) {
            adminPlayerStatus.textContent = 'No player selected.';
            return;
        }

        // Parse inventory JSON
        let inventory = [];
        try {
            inventory = JSON.parse(playerInventoryEdit.value || '[]');
            if (!Array.isArray(inventory)) {
                adminPlayerStatus.textContent = 'Error: Inventory must be a JSON array.';
                return;
            }
        } catch (e) {
            adminPlayerStatus.textContent = 'Error: Invalid JSON in inventory field.';
            return;
        }

        const updates = {
            name: playerNameEdit.value.trim(),
            race: playerRaceEdit.value.trim(),
            class: playerClassEdit.value,
            gender: playerGenderEdit.value,
            age: parseInt(playerAgeEdit.value) || 25,
            description: playerDescriptionEdit.value.trim(),
            level: parseInt(playerLevelEdit.value) || 1,
            xp: parseInt(playerXpEdit.value) || 0,
            money: parseInt(playerMoneyEdit.value) || 0,
            roomId: playerRoomEdit.value,
            hp: parseInt(playerHpEdit.value) || 100,
            maxHp: parseInt(playerMaxHpEdit.value) || 100,
            mp: parseInt(playerMpEdit.value) || 100,
            maxMp: parseInt(playerMaxMpEdit.value) || 100,
            isAdmin: playerAdminEdit.checked,
            inventory: inventory,
            attributes: {
                str: parseInt(attrInputs.str.value) || 10,
                dex: parseInt(attrInputs.dex.value) || 10,
                con: parseInt(attrInputs.con.value) || 10,
                int: parseInt(attrInputs.int.value) || 10,
                wis: parseInt(attrInputs.wis.value) || 10,
                cha: parseInt(attrInputs.cha.value) || 10,
            }
        };

        await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${selectedPlayerId}`), updates);
        adminPlayerStatus.textContent = 'Player updated successfully!';
    });

    document.getElementById('delete-player-btn').addEventListener('click', async () => {
        const selectedPlayerId = playerSelect.value;
        if (selectedPlayerId) {
            await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${selectedPlayerId}`));
            adminPlayerStatus.textContent = `Player deleted.`;
            playerEditForm.classList.add('hidden');
        }
    });

    // ========== SPELL EDITOR ==========
    const spellSelect = document.getElementById('spell-select');
    const adminSpellStatus = document.getElementById('admin-spell-status');
    
    // Spell form fields
    const spellIdInput = document.getElementById('spell-id');
    const spellNameInput = document.getElementById('spell-name');
    const spellSchoolSelect = document.getElementById('spell-school');
    const spellDescInput = document.getElementById('spell-description');
    const spellMpCostInput = document.getElementById('spell-mp-cost');
    const spellLevelReqInput = document.getElementById('spell-level-req');
    const spellClassReqInput = document.getElementById('spell-class-req');
    const spellTargetTypeSelect = document.getElementById('spell-target-type');
    const spellRangeSelect = document.getElementById('spell-range');
    const spellDamageInput = document.getElementById('spell-damage');
    const spellHealingInput = document.getElementById('spell-healing');
    const spellDurationInput = document.getElementById('spell-duration');
    const spellCooldownInput = document.getElementById('spell-cooldown');
    const spellStatEffectsInput = document.getElementById('spell-stat-effects');
    const spellSpecialEffectsInput = document.getElementById('spell-special-effects');
    
    // Populate spell selector
    function populateSpellSelector() {
        const currentVal = spellSelect.value;
        spellSelect.innerHTML = '<option value="">-- Create New Spell --</option>';
        Object.entries(gameSpells).sort((a, b) => a[1].name?.localeCompare(b[1].name)).forEach(([id, spell]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = spell.name || id;
            spellSelect.appendChild(option);
        });
        if (currentVal) spellSelect.value = currentVal;
    }
    
    // Load spell data into form
    function loadSpellData(spellId) {
        const spell = gameSpells[spellId];
        if (!spell) {
            clearSpellForm();
            return;
        }
        
        spellIdInput.value = spellId;
        spellNameInput.value = spell.name || '';
        spellSchoolSelect.value = spell.school || 'evocation';
        spellDescInput.value = spell.description || '';
        spellMpCostInput.value = spell.mpCost || 10;
        spellLevelReqInput.value = spell.levelRequired || 1;
        spellClassReqInput.value = spell.classRequired || 'any';
        spellTargetTypeSelect.value = spell.targetType || 'single-enemy';
        spellRangeSelect.value = spell.range || 'close';
        spellDamageInput.value = spell.damage || 0;
        spellHealingInput.value = spell.healing || 0;
        spellDurationInput.value = spell.duration || 0;
        spellCooldownInput.value = spell.cooldown || 0;
        spellStatEffectsInput.value = spell.statEffects ? JSON.stringify(spell.statEffects, null, 2) : '{}';
        spellSpecialEffectsInput.value = spell.specialEffects || '';
    }
    
    function clearSpellForm() {
        spellIdInput.value = '';
        spellNameInput.value = '';
        spellSchoolSelect.value = 'evocation';
        spellDescInput.value = '';
        spellMpCostInput.value = '10';
        spellLevelReqInput.value = '1';
        spellClassReqInput.value = 'any';
        spellTargetTypeSelect.value = 'single-enemy';
        spellRangeSelect.value = 'close';
        spellDamageInput.value = '0';
        spellHealingInput.value = '0';
        spellDurationInput.value = '0';
        spellCooldownInput.value = '0';
        spellStatEffectsInput.value = '{}';
        spellSpecialEffectsInput.value = '';
    }
    
    // Spell selector change event
    spellSelect.addEventListener('change', () => {
        const spellId = spellSelect.value;
        if (spellId && gameSpells[spellId]) {
            loadSpellData(spellId);
        } else {
            clearSpellForm();
        }
    });
    
    // New spell button
    document.getElementById('new-spell-btn').addEventListener('click', () => {
        spellSelect.value = '';
        clearSpellForm();
        adminSpellStatus.textContent = '';
    });
    
    // Save spell button
    document.getElementById('save-spell-btn').addEventListener('click', async () => {
        const spellId = spellIdInput.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (!spellId) {
            adminSpellStatus.textContent = 'Error: Spell ID is required.';
            return;
        }
        
        // Parse stat effects JSON
        let statEffects = {};
        try {
            statEffects = JSON.parse(spellStatEffectsInput.value || '{}');
        } catch (e) {
            adminSpellStatus.textContent = 'Error: Invalid JSON in stat effects field.';
            return;
        }
        
        const spellData = {
            id: spellId,
            name: spellNameInput.value.trim() || spellId,
            school: spellSchoolSelect.value,
            description: spellDescInput.value.trim(),
            mpCost: parseInt(spellMpCostInput.value) || 10,
            levelRequired: parseInt(spellLevelReqInput.value) || 1,
            classRequired: spellClassReqInput.value.trim() || 'any',
            targetType: spellTargetTypeSelect.value,
            range: spellRangeSelect.value,
            damage: parseInt(spellDamageInput.value) || 0,
            healing: parseInt(spellHealingInput.value) || 0,
            duration: parseInt(spellDurationInput.value) || 0,
            cooldown: parseInt(spellCooldownInput.value) || 0,
            statEffects: statEffects,
            specialEffects: spellSpecialEffectsInput.value.trim()
        };
        
        try {
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-spells/${spellId}`), spellData);
            adminSpellStatus.textContent = `Spell "${spellData.name}" saved successfully!`;
            populateSpellSelector();
            spellSelect.value = spellId;
        } catch (error) {
            adminSpellStatus.textContent = `Error saving spell: ${error.message}`;
        }
    });
    
    // Delete spell button
    document.getElementById('delete-spell-btn').addEventListener('click', async () => {
        const spellId = spellIdInput.value.trim();
        if (!spellId) {
            adminSpellStatus.textContent = 'Error: No spell selected to delete.';
            return;
        }
        
        if (confirm(`Are you sure you want to delete the spell "${spellNameInput.value}"?`)) {
            try {
                await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-spells/${spellId}`));
                adminSpellStatus.textContent = `Spell deleted successfully.`;
                clearSpellForm();
                populateSpellSelector();
                spellSelect.value = '';
            } catch (error) {
                adminSpellStatus.textContent = `Error deleting spell: ${error.message}`;
            }
        }
    });

    // ========== CLASS EDITOR ==========
    const classSelect = document.getElementById('class-select');
    const adminClassStatus = document.getElementById('admin-class-status');
    
    // Populate class selector
    function populateClassSelector() {
        classSelect.innerHTML = '<option value="">-- Create New Class --</option>';
        Object.entries(gameClasses).forEach(([id, classData]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = classData.name || id;
            classSelect.appendChild(option);
        });
    }
    
    // Load class data into form
    function loadClassData(classId) {
        const classData = gameClasses[classId];
        if (!classData) {
            clearClassForm();
            return;
        }
        
        document.getElementById('class-id').value = classId;
        document.getElementById('class-name').value = classData.name || '';
        document.getElementById('class-description').value = classData.description || '';
        
        // Stat bonuses
        const bonuses = classData.statBonuses || {};
        document.getElementById('class-str-bonus').value = bonuses.str || 0;
        document.getElementById('class-dex-bonus').value = bonuses.dex || 0;
        document.getElementById('class-con-bonus').value = bonuses.con || 0;
        document.getElementById('class-int-bonus').value = bonuses.int || 0;
        document.getElementById('class-wis-bonus').value = bonuses.wis || 0;
        document.getElementById('class-cha-bonus').value = bonuses.cha || 0;
        
        document.getElementById('class-hp-bonus').value = classData.hpBonus || 0;
        document.getElementById('class-mp-bonus').value = classData.mpBonus || 0;
        document.getElementById('class-abilities').value = JSON.stringify(classData.abilities || []);
        document.getElementById('class-level-titles').value = classData.levelTitles ? JSON.stringify(classData.levelTitles, null, 2) : '';
    }
    
    function clearClassForm() {
        document.getElementById('class-id').value = '';
        document.getElementById('class-name').value = '';
        document.getElementById('class-description').value = '';
        document.getElementById('class-str-bonus').value = 0;
        document.getElementById('class-dex-bonus').value = 0;
        document.getElementById('class-con-bonus').value = 0;
        document.getElementById('class-int-bonus').value = 0;
        document.getElementById('class-wis-bonus').value = 0;
        document.getElementById('class-cha-bonus').value = 0;
        document.getElementById('class-hp-bonus').value = 0;
        document.getElementById('class-mp-bonus').value = 0;
        document.getElementById('class-abilities').value = '[]';
        document.getElementById('class-level-titles').value = '';
    }
    
    classSelect.addEventListener('change', () => {
        const classId = classSelect.value;
        if (classId) {
            loadClassData(classId);
        } else {
            clearClassForm();
        }
    });
    
    document.getElementById('new-class-btn').addEventListener('click', () => {
        classSelect.value = '';
        clearClassForm();
        adminClassStatus.textContent = 'Ready to create new class';
    });
    
    document.getElementById('save-class-btn').addEventListener('click', async () => {
        const classId = document.getElementById('class-id').value.trim();
        const className = document.getElementById('class-name').value.trim();
        
        if (!classId || !className) {
            adminClassStatus.textContent = 'Class ID and Name are required!';
            return;
        }
        
        let abilities = [];
        const abilitiesInput = document.getElementById('class-abilities').value.trim();
        
        if (abilitiesInput) {
            try {
                abilities = JSON.parse(abilitiesInput);
                if (!Array.isArray(abilities)) {
                    adminClassStatus.textContent = 'Abilities must be a JSON array like ["Ability 1", "Ability 2"]';
                    return;
                }
            } catch (e) {
                adminClassStatus.textContent = 'Invalid JSON in abilities field! Use format: ["Ability 1", "Ability 2"]';
                return;
            }
        }
        
        let levelTitles = null;
        const levelTitlesInput = document.getElementById('class-level-titles').value.trim();
        
        if (levelTitlesInput) {
            try {
                levelTitles = JSON.parse(levelTitlesInput);
                if (typeof levelTitles !== 'object' || Array.isArray(levelTitles)) {
                    adminClassStatus.textContent = 'Level Titles must be a JSON object like {"1":"Title1","5":"Title2"}';
                    return;
                }
            } catch (e) {
                adminClassStatus.textContent = 'Invalid JSON in level titles field! Use format: {"1":"Title1","5":"Title2"}';
                return;
            }
        }
        
        const classData = {
            name: className,
            description: document.getElementById('class-description').value.trim(),
            statBonuses: {
                str: parseInt(document.getElementById('class-str-bonus').value) || 0,
                dex: parseInt(document.getElementById('class-dex-bonus').value) || 0,
                con: parseInt(document.getElementById('class-con-bonus').value) || 0,
                int: parseInt(document.getElementById('class-int-bonus').value) || 0,
                wis: parseInt(document.getElementById('class-wis-bonus').value) || 0,
                cha: parseInt(document.getElementById('class-cha-bonus').value) || 0,
            },
            hpBonus: parseInt(document.getElementById('class-hp-bonus').value) || 0,
            mpBonus: parseInt(document.getElementById('class-mp-bonus').value) || 0,
            abilities: abilities
        };
        
        // Always include levelTitles (even if null) to properly update/remove it
        classData.levelTitles = levelTitles;
        
        await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-classes/${classId}`), classData);
        adminClassStatus.textContent = `Class "${className}" saved successfully!`;
        populateClassSelector();
    });
    
    document.getElementById('delete-class-btn').addEventListener('click', async () => {
        const classId = classSelect.value;
        if (!classId) {
            adminClassStatus.textContent = 'No class selected!';
            return;
        }
        
        if (!confirm(`Delete class "${gameClasses[classId]?.name}"? This cannot be undone.`)) {
            return;
        }
        
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-classes/${classId}`));
        adminClassStatus.textContent = 'Class deleted successfully!';
        clearClassForm();
        populateClassSelector();
    });
    
    // Create default classes button
    document.getElementById('create-defaults-btn').addEventListener('click', async () => {
        if (!confirm('Create 6 default classes (Warrior, Priest, Wizard, Rogue, Paladin, Ranger)?')) {
            return;
        }
        
        adminClassStatus.textContent = 'Creating default classes...';
        
        const defaultClasses = {
            warrior: {
                name: "Warrior",
                description: "Strong melee fighters with high HP. Bonus to Strength and Constitution.",
                statBonuses: { str: 3, dex: 0, con: 2, int: -1, wis: 0, cha: 0 },
                hpBonus: 20,
                mpBonus: 0,
                abilities: ["Power Strike", "Second Wind", "Weapon Mastery"]
            },
            priest: {
                name: "Priest",
                description: "Holy healers with divine powers. Bonus to Wisdom and Charisma.",
                statBonuses: { str: 0, dex: 0, con: 1, int: 0, wis: 3, cha: 2 },
                hpBonus: 5,
                mpBonus: 20,
                abilities: ["Heal", "Divine Protection", "Turn Undead"]
            },
            wizard: {
                name: "Wizard",
                description: "Masters of arcane magic. Bonus to Intelligence.",
                statBonuses: { str: -1, dex: 1, con: 0, int: 4, wis: 1, cha: 0 },
                hpBonus: -10,
                mpBonus: 30,
                abilities: ["Fireball", "Magic Missile", "Arcane Shield"]
            },
            rogue: {
                name: "Rogue",
                description: "Stealthy thieves with quick reflexes. Bonus to Dexterity and Charisma.",
                statBonuses: { str: 0, dex: 4, con: 0, int: 1, wis: 0, cha: 2 },
                hpBonus: 0,
                mpBonus: 5,
                abilities: ["Backstab", "Sneak", "Pick Lock"]
            },
            paladin: {
                name: "Paladin",
                description: "Holy warriors combining combat prowess with divine magic. Balanced bonuses.",
                statBonuses: { str: 2, dex: 0, con: 1, int: 0, wis: 2, cha: 2 },
                hpBonus: 15,
                mpBonus: 10,
                abilities: ["Smite Evil", "Lay on Hands", "Divine Sense"]
            },
            ranger: {
                name: "Ranger",
                description: "Wilderness experts skilled with bow and blade. Bonus to Dexterity and Wisdom.",
                statBonuses: { str: 1, dex: 3, con: 1, int: 0, wis: 2, cha: 0 },
                hpBonus: 10,
                mpBonus: 5,
                abilities: ["Track", "Hunter's Mark", "Animal Companion"]
            }
        };
        
        try {
            for (const [classId, classData] of Object.entries(defaultClasses)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-classes/${classId}`), classData);
            }
            adminClassStatus.textContent = '✅ All 6 default classes created successfully!';
            populateClassSelector();
        } catch (error) {
            adminClassStatus.textContent = `❌ Error: ${error.message}`;
            console.error('Error creating default classes:', error);
        }
    });
    
    // Initialize class selector
    populateClassSelector();

    // ========== GUILD EDITOR ==========
    const guildSelect = document.getElementById('guild-select');
    const adminGuildStatus = document.getElementById('admin-guild-status');

    function populateGuildSelector() {
        guildSelect.innerHTML = '<option value="">-- Select Guild --</option>';
        Object.entries(gameGuilds).forEach(([guildId, guild]) => {
            const option = document.createElement('option');
            option.value = guildId;
            option.textContent = guild.name || guildId;
            guildSelect.appendChild(option);
        });
    }

    function loadGuildData(guildId) {
        const guild = gameGuilds[guildId];
        if (!guild) {
            clearGuildForm();
            return;
        }

        document.getElementById('guild-id').value = guildId;
        document.getElementById('guild-name').value = guild.name || '';
        document.getElementById('guild-description').value = guild.description || '';
        document.getElementById('guild-motto').value = guild.motto || '';
        document.getElementById('guild-leader').value = guild.leader || '';
        document.getElementById('guild-treasury').value = guild.treasury || 0;
        document.getElementById('guild-level').value = guild.level || 1;
        document.getElementById('guild-exp').value = guild.exp || 0;
        document.getElementById('guild-hall-room').value = guild.guildHallRoomId || '';
        document.getElementById('guild-perks').value = guild.perks ? JSON.stringify(guild.perks, null, 2) : '';
        document.getElementById('guild-members').value = JSON.stringify(guild.members || {}, null, 2);
    }

    function clearGuildForm() {
        document.getElementById('guild-id').value = '';
        document.getElementById('guild-name').value = '';
        document.getElementById('guild-description').value = '';
        document.getElementById('guild-motto').value = '';
        document.getElementById('guild-leader').value = '';
        document.getElementById('guild-treasury').value = 0;
        document.getElementById('guild-level').value = 1;
        document.getElementById('guild-exp').value = 0;
        document.getElementById('guild-hall-room').value = '';
        document.getElementById('guild-perks').value = '';
        document.getElementById('guild-members').value = '{}';
    }

    guildSelect.addEventListener('change', () => {
        const guildId = guildSelect.value;
        if (guildId) {
            loadGuildData(guildId);
        } else {
            clearGuildForm();
        }
    });

    document.getElementById('new-guild-btn').addEventListener('click', () => {
        guildSelect.value = '';
        clearGuildForm();
        // Generate new guild ID
        document.getElementById('guild-id').value = `guild-${Date.now()}`;
        document.getElementById('guild-id').removeAttribute('readonly');
        adminGuildStatus.textContent = 'Ready to create new guild';
    });

    document.getElementById('save-guild-btn').addEventListener('click', async () => {
        const guildId = document.getElementById('guild-id').value.trim();
        const guildName = document.getElementById('guild-name').value.trim();

        if (!guildId || !guildName) {
            adminGuildStatus.textContent = 'Guild ID and Name are required!';
            return;
        }

        let perks = null;
        const perksInput = document.getElementById('guild-perks').value.trim();

        if (perksInput) {
            try {
                perks = JSON.parse(perksInput);
                if (typeof perks !== 'object' || Array.isArray(perks)) {
                    adminGuildStatus.textContent = 'Perks must be a JSON object!';
                    return;
                }
            } catch (e) {
                adminGuildStatus.textContent = 'Invalid JSON in perks field!';
                return;
            }
        }

        let members = {};
        const membersInput = document.getElementById('guild-members').value.trim();

        if (membersInput) {
            try {
                members = JSON.parse(membersInput);
            } catch (e) {
                adminGuildStatus.textContent = 'Invalid JSON in members field!';
                return;
            }
        }

        const guildData = {
            name: guildName,
            description: document.getElementById('guild-description').value.trim(),
            motto: document.getElementById('guild-motto').value.trim(),
            leader: document.getElementById('guild-leader').value.trim(),
            treasury: parseInt(document.getElementById('guild-treasury').value) || 0,
            level: parseInt(document.getElementById('guild-level').value) || 1,
            exp: parseInt(document.getElementById('guild-exp').value) || 0,
            guildHallRoomId: document.getElementById('guild-hall-room').value.trim(),
            perks: perks,
            members: members
        };

        // Find leader ID from members
        const leaderEntry = Object.entries(members).find(([id, member]) => member.rank === 'leader');
        if (leaderEntry) {
            guildData.leaderId = leaderEntry[0];
        }

        await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`), guildData);
        adminGuildStatus.textContent = `Guild "${guildName}" saved successfully!`;
        document.getElementById('guild-id').setAttribute('readonly', 'readonly');
        populateGuildSelector();
    });

    document.getElementById('delete-guild-btn').addEventListener('click', async () => {
        const guildId = guildSelect.value;
        if (!guildId) {
            adminGuildStatus.textContent = 'No guild selected!';
            return;
        }

        if (!confirm(`Delete guild "${gameGuilds[guildId]?.name}"? This cannot be undone and will remove all members from the guild.`)) {
            return;
        }

        // Remove guild from all players
        for (const [playerId, player] of Object.entries(gamePlayers)) {
            if (player.guildId === guildId) {
                const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${playerId}`);
                await updateDoc(playerRef, { guildId: "" });
            }
        }

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-guilds/${guildId}`));
        adminGuildStatus.textContent = 'Guild deleted successfully!';
        clearGuildForm();
        populateGuildSelector();
    });

    // Initialize guild selector
    populateGuildSelector();

    // ========== QUEST MANAGEMENT ==========
    
    const questSelect = document.getElementById('quest-select');
    const questIdInput = document.getElementById('quest-id');
    const questTitleInput = document.getElementById('quest-title');
    const questDescriptionInput = document.getElementById('quest-description');
    const questLevelReqInput = document.getElementById('quest-level-req');
    const questRepeatableSelect = document.getElementById('quest-repeatable');
    const questPartyQuestSelect = document.getElementById('quest-party-quest');
    const questGiverNpcInput = document.getElementById('quest-giver-npc');
    const questTurninNpcInput = document.getElementById('quest-turnin-npc');
    const questObjectivesInput = document.getElementById('quest-objectives');
    const questRewardsInput = document.getElementById('quest-rewards');
    const questPrerequisitesInput = document.getElementById('quest-prerequisites');
    const saveQuestBtn = document.getElementById('save-quest-btn');
    const newQuestBtn = document.getElementById('new-quest-btn');
    const deleteQuestBtn = document.getElementById('delete-quest-btn');
    const adminQuestStatus = document.getElementById('admin-quest-status');

    function populateQuestSelector() {
        questSelect.innerHTML = '<option value="">-- Select Quest --</option>';
        Object.values(gameQuests).forEach(quest => {
            const option = document.createElement('option');
            option.value = quest.id;
            option.textContent = `${quest.title || quest.id}`;
            questSelect.appendChild(option);
        });
    }

    function loadQuestData(questId) {
        const quest = gameQuests[questId];
        if (!quest) return;

        questIdInput.value = quest.id || '';
        questTitleInput.value = quest.title || '';
        questDescriptionInput.value = quest.description || '';
        questLevelReqInput.value = quest.levelRequired || 1;
        questRepeatableSelect.value = quest.isRepeatable ? 'true' : 'false';
        questPartyQuestSelect.value = quest.isPartyQuest ? 'true' : 'false';
        questGiverNpcInput.value = quest.giverNpcId || '';
        questTurninNpcInput.value = quest.turninNpcId || '';
        questObjectivesInput.value = quest.objectives ? JSON.stringify(quest.objectives, null, 2) : '[]';
        questRewardsInput.value = quest.rewards ? JSON.stringify(quest.rewards, null, 2) : '{}';
        questPrerequisitesInput.value = quest.prerequisites ? JSON.stringify(quest.prerequisites, null, 2) : '[]';
    }

    function clearQuestForm() {
        questIdInput.value = '';
        questTitleInput.value = '';
        questDescriptionInput.value = '';
        questLevelReqInput.value = '1';
        questRepeatableSelect.value = 'false';
        questPartyQuestSelect.value = 'false';
        questGiverNpcInput.value = '';
        questTurninNpcInput.value = '';
        questObjectivesInput.value = '[]';
        questRewardsInput.value = '{}';
        questPrerequisitesInput.value = '[]';
        questSelect.value = '';
        adminQuestStatus.textContent = '';
    }

    questSelect.addEventListener('change', () => {
        if (questSelect.value) {
            loadQuestData(questSelect.value);
        }
    });

    newQuestBtn.addEventListener('click', clearQuestForm);

    saveQuestBtn.addEventListener('click', async () => {
        const questId = questIdInput.value.trim();
        if (!questId) {
            adminQuestStatus.textContent = 'Quest ID is required!';
            return;
        }

        const title = questTitleInput.value.trim();
        if (!title) {
            adminQuestStatus.textContent = 'Quest title is required!';
            return;
        }

        // Parse JSON fields
        let objectives, rewards, prerequisites;
        try {
            objectives = JSON.parse(questObjectivesInput.value || '[]');
        } catch (e) {
            adminQuestStatus.textContent = 'Invalid JSON in Objectives field!';
            return;
        }

        try {
            rewards = JSON.parse(questRewardsInput.value || '{}');
        } catch (e) {
            adminQuestStatus.textContent = 'Invalid JSON in Rewards field!';
            return;
        }

        try {
            prerequisites = JSON.parse(questPrerequisitesInput.value || '[]');
        } catch (e) {
            adminQuestStatus.textContent = 'Invalid JSON in Prerequisites field!';
            return;
        }

        const questData = {
            id: questId,
            title: title,
            description: questDescriptionInput.value.trim() || '',
            levelRequired: parseInt(questLevelReqInput.value) || 1,
            isRepeatable: questRepeatableSelect.value === 'true',
            isPartyQuest: questPartyQuestSelect.value === 'true',
            giverNpcId: questGiverNpcInput.value.trim() || '',
            turninNpcId: questTurninNpcInput.value.trim() || questGiverNpcInput.value.trim() || '',
            objectives: objectives,
            rewards: rewards,
            prerequisites: prerequisites
        };

        await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-quests/${questId}`), questData);
        adminQuestStatus.textContent = 'Quest saved successfully!';
        populateQuestSelector();
    });

    deleteQuestBtn.addEventListener('click', async () => {
        const questId = questIdInput.value.trim();
        if (!questId) {
            adminQuestStatus.textContent = 'No quest selected to delete!';
            return;
        }

        if (!confirm(`Are you sure you want to delete quest "${questId}"? This will affect all players who have this quest!`)) {
            return;
        }

        // Remove quest from all players' active and completed quests
        for (const [playerId, player] of Object.entries(gamePlayers)) {
            let needsUpdate = false;
            const updates = {};

            if (player.activeQuests && player.activeQuests.some(q => q.questId === questId)) {
                updates.activeQuests = player.activeQuests.filter(q => q.questId !== questId);
                needsUpdate = true;
            }

            if (player.completedQuests && player.completedQuests.includes(questId)) {
                updates.completedQuests = player.completedQuests.filter(id => id !== questId);
                needsUpdate = true;
            }

            if (needsUpdate) {
                const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${playerId}`);
                await updateDoc(playerRef, updates);
            }
        }

        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-quests/${questId}`));
        adminQuestStatus.textContent = 'Quest deleted successfully!';
        clearQuestForm();
        populateQuestSelector();
    });

    // Initialize quest selector
    populateQuestSelector();

    // ========== MAP VISUALIZATION ==========
    let networkInstance = null;

    function generateMap() {
        const container = document.getElementById('map-network');
        if (!container) return;

        // Calculate positions based on directional exits
        const GRID_SIZE = 200; // Distance between rooms
        const positions = {};
        const visited = new Set();
        
        // Direction vectors: north = up (negative y), south = down, east = right, west = left
        const directionVectors = {
            'north': { x: 0, y: -1 },
            'south': { x: 0, y: 1 },
            'east': { x: 1, y: 0 },
            'west': { x: -1, y: 0 },
            'northeast': { x: 1, y: -1 },
            'northwest': { x: -1, y: -1 },
            'southeast': { x: 1, y: 1 },
            'southwest': { x: -1, y: 1 },
            'up': { x: 0, y: -1.5 },
            'down': { x: 0, y: 1.5 }
        };

        // Find starting room (first room in gameWorld or one with most connections)
        let startRoomId = Object.keys(gameWorld)[0];
        let maxExits = 0;
        Object.entries(gameWorld).forEach(([roomId, room]) => {
            const exitCount = room.exits ? Object.keys(room.exits).length : 0;
            if (exitCount > maxExits) {
                maxExits = exitCount;
                startRoomId = roomId;
            }
        });

        // Recursive function to position rooms based on exits
        function positionRoom(roomId, x, y) {
            if (visited.has(roomId)) return;
            visited.add(roomId);
            positions[roomId] = { x: x * GRID_SIZE, y: y * GRID_SIZE };

            const room = gameWorld[roomId];
            if (!room || !room.exits) return;

            Object.entries(room.exits).forEach(([direction, targetRoomId]) => {
                if (gameWorld[targetRoomId] && !visited.has(targetRoomId)) {
                    const vector = directionVectors[direction.toLowerCase()] || { x: 1, y: 0 };
                    positionRoom(targetRoomId, x + vector.x, y + vector.y);
                }
            });
        }

        // Start positioning from origin
        positionRoom(startRoomId, 0, 0);

        // Build nodes (rooms) with calculated positions
        const nodes = [];
        const edges = [];
        
        Object.keys(gameWorld).forEach(roomId => {
            const room = gameWorld[roomId];
            
            // Count entities in this room
            const itemCount = room.items?.length || 0;
            const npcCount = room.npcs?.length || 0;
            const monsterCount = room.monsterSpawns?.length || 0;
            const playerCount = Object.values(gamePlayers).filter(p => p.roomId === roomId).length;
            
            // Build label with icons
            let label = room.name || roomId;
            let badges = [];
            if (itemCount > 0) badges.push('🎒');
            if (npcCount > 0) badges.push('👤');
            if (monsterCount > 0) badges.push('👹');
            if (playerCount > 0) badges.push(`⭐${playerCount}`);
            
            if (badges.length > 0) {
                label += '\n' + badges.join(' ');
            }
            
            // Determine node color based on contents
            let color = '#00ff41'; // Default green
            if (playerCount > 0) color = '#fbbf24'; // Yellow if players present
            else if (monsterCount > 0) color = '#ef4444'; // Red if monsters
            else if (npcCount > 0) color = '#a855f7'; // Purple if NPCs
            else if (itemCount > 0) color = '#3b82f6'; // Blue if items
            
            // Get position or default to random if not visited
            const pos = positions[roomId] || { x: Math.random() * 400 - 200, y: Math.random() * 400 - 200 };
            
            nodes.push({
                id: roomId,
                label: label,
                title: `${room.name}\n${room.description?.substring(0, 100) || ''}...\n\nClick to edit`,
                x: pos.x,
                y: pos.y,
                color: {
                    background: color,
                    border: '#ffffff',
                    highlight: {
                        background: color,
                        border: '#ffff00'
                    }
                },
                font: {
                    color: '#000000',
                    size: 14,
                    face: 'VT323, monospace',
                    multi: true
                },
                shape: 'box',
                margin: 10,
                fixed: false // Allow manual repositioning
            });
            
            // Build edges (exits)
            if (room.exits) {
                Object.entries(room.exits).forEach(([direction, targetRoomId]) => {
                    // Only add edge if target room exists
                    if (gameWorld[targetRoomId]) {
                        edges.push({
                            from: roomId,
                            to: targetRoomId,
                            label: direction,
                            arrows: 'to',
                            font: {
                                size: 12,
                                color: '#00ff41',
                                face: 'VT323, monospace'
                            },
                            color: {
                                color: '#00ff41',
                                highlight: '#ffff00'
                            },
                            smooth: {
                                type: 'straightCross'
                            }
                        });
                    }
                });
            }
        });

        // Create the network
        const data = { nodes, edges };
        const options = {
            nodes: {
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2
            },
            physics: {
                enabled: false // Disable physics since we're using fixed positions
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                navigationButtons: true,
                keyboard: true,
                dragNodes: true,
                dragView: true,
                zoomView: true
            },
            layout: {
                randomSeed: 42 // For consistent layout if physics were enabled
            }
        };

        // Destroy old network if exists
        if (networkInstance) {
            networkInstance.destroy();
        }

        // Create new network
        networkInstance = new vis.Network(container, data, options);

        // Handle click events
        networkInstance.on('click', (params) => {
            if (params.nodes.length > 0) {
                const roomId = params.nodes[0];
                // Switch to room tab and select this room
                document.getElementById('room-tab-btn').click();
                setTimeout(() => {
                    document.getElementById('room-select').value = roomId;
                    document.getElementById('room-select').dispatchEvent(new Event('change'));
                }, 100);
            }
        });

        // Fit the network to show all nodes
        setTimeout(() => {
            networkInstance.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }, 100);
    }

    // Refresh map button
    document.getElementById('refresh-map-btn')?.addEventListener('click', () => {
        generateMap();
    });

    // Refresh dropdowns button
    if (refreshDropdownsBtn) {
        refreshDropdownsBtn.addEventListener('click', () => {
            console.log('Refreshing all dropdowns...');
            populateRoomSelector();
            populateItemSelector();
            populateNpcSelector();
            populateMonsterSelector();
            populatePlayerSelector();
            populateSpellSelector();
            populateClassSelector();
            populateRoomItemsSelector();
            populateRoomNpcsSelector();
            populateNpcSellsSelector();
            alert('All dropdowns refreshed!');
        });
    }

    // Initialize all dropdowns with current data
    // Use a longer delay and retry mechanism to ensure data is loaded
    function tryPopulateDropdowns(attempt = 0) {
        const maxAttempts = 10;
        const delay = 500;
        
        const hasData = Object.keys(gameWorld).length > 0 || 
                       Object.keys(gameItems).length > 0 || 
                       Object.keys(gameNpcs).length > 0;
        
        if (hasData || attempt >= maxAttempts) {
            console.log(`Populating admin dropdowns (attempt ${attempt + 1})...`);
            console.log(`Data available: ${Object.keys(gameWorld).length} rooms, ${Object.keys(gameItems).length} items, ${Object.keys(gameNpcs).length} npcs, ${Object.keys(gameSpells).length} spells`);
            populateRoomSelector();
            populateItemSelector();
            populateNpcSelector();
            populateMonsterSelector();
            populatePlayerSelector();
            populateSpellSelector();
            populateClassSelector();
            populateRoomItemsSelector();
            populateRoomNpcsSelector();
            populateNpcSellsSelector();
        } else {
            console.log(`Waiting for data... attempt ${attempt + 1}/${maxAttempts}`);
            setTimeout(() => tryPopulateDropdowns(attempt + 1), delay);
        }
    }
    
    // Start trying to populate dropdowns
    tryPopulateDropdowns();

    // Return populate functions so they can be called when data updates
    return {
        populateRoomSelector,
        populateItemSelector,
        populateNpcSelector,
        populateMonsterSelector,
        populatePlayerSelector,
        populateSpellSelector,
        populateRoomItemsSelector,
        populateRoomNpcsSelector,
        populateRoomMonsterSelector,
        populateNpcSellsSelector,
        populateMonsterItemDropSelector,
        populatePlayerRoomSelector
    };

    // ===== SETUP PANEL FUNCTIONS =====
    const setupStatus = document.getElementById('setup-status');
    
    function logSetup(message, type = 'info') {
        const colors = {
            info: 'text-blue-400',
            success: 'text-green-400',
            error: 'text-red-400'
        };
        const div = document.createElement('div');
        div.className = colors[type] || 'text-gray-300';
        div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        setupStatus.appendChild(div);
        setupStatus.scrollTop = setupStatus.scrollHeight;
    }

    // Setup Classes
    document.getElementById('setup-classes-btn').addEventListener('click', async () => {
        logSetup('Creating default classes...', 'info');
        const classes = {
            'warrior': {
                name: 'Warrior',
                description: 'Strong melee fighter with high HP',
                statBonuses: { str: 3, dex: 0, con: 2, int: -1, wis: 0, cha: 0 },
                hpBonus: 20,
                mpBonus: 0,
                abilities: ['Power Attack', 'Shield Bash'],
                // Leveling properties
                xpMultiplier: 0.95,  // Levels slightly faster (5% less XP needed)
                hpPerLevel: 12,      // High HP gain per level
                mpPerLevel: 2,       // Low MP gain per level
                statGrowth: {        // Stat increases every N levels
                    str: 2,  // +1 STR every 2 levels
                    dex: 4,  // +1 DEX every 4 levels
                    con: 3,  // +1 CON every 3 levels
                    int: 6,  // +1 INT every 6 levels
                    wis: 5,  // +1 WIS every 5 levels
                    cha: 5   // +1 CHA every 5 levels
                }
            },
            'priest': {
                name: 'Priest',
                description: 'Holy healer and support class',
                statBonuses: { str: 0, dex: 0, con: 1, int: 0, wis: 3, cha: 2 },
                hpBonus: 0,
                mpBonus: 20,
                abilities: ['Heal', 'Bless', 'Smite'],
                xpMultiplier: 1.0,   // Standard XP progression
                hpPerLevel: 8,       // Average HP gain
                mpPerLevel: 8,       // High MP gain
                statGrowth: {
                    str: 6,
                    dex: 5,
                    con: 4,
                    int: 4,
                    wis: 2,  // +1 WIS every 2 levels
                    cha: 3   // +1 CHA every 3 levels
                }
            },
            'wizard': {
                name: 'Wizard',
                description: 'Powerful magic user',
                statBonuses: { str: -1, dex: 0, con: -1, int: 4, wis: 1, cha: 0 },
                hpBonus: -10,
                mpBonus: 30,
                abilities: ['Fireball', 'Lightning Bolt', 'Shield'],
                xpMultiplier: 1.1,   // Levels slower (10% more XP needed)
                hpPerLevel: 6,       // Low HP gain
                mpPerLevel: 10,      // Highest MP gain
                statGrowth: {
                    str: 6,
                    dex: 4,
                    con: 5,
                    int: 2,  // +1 INT every 2 levels
                    wis: 3,  // +1 WIS every 3 levels
                    cha: 5
                }
            },
            'rogue': {
                name: 'Rogue',
                description: 'Sneaky and agile character',
                statBonuses: { str: 0, dex: 4, con: 0, int: 0, wis: 0, cha: 2 },
                hpBonus: 0,
                mpBonus: 0,
                abilities: ['Backstab', 'Stealth', 'Lockpick'],
                xpMultiplier: 0.9,   // Levels fastest
                hpPerLevel: 9,       // Average HP
                mpPerLevel: 3,       // Low MP
                statGrowth: {
                    str: 4,
                    dex: 2,  // +1 DEX every 2 levels
                    con: 4,
                    int: 5,
                    wis: 4,
                    cha: 3
                }
            },
            'paladin': {
                name: 'Paladin',
                description: 'Holy warrior with divine powers',
                statBonuses: { str: 2, dex: 0, con: 2, int: 0, wis: 1, cha: 1 },
                hpBonus: 15,
                mpBonus: 10,
                abilities: ['Lay on Hands', 'Divine Shield', 'Holy Strike'],
                xpMultiplier: 1.05,  // Levels slightly slower
                hpPerLevel: 10,      // Good HP gain
                mpPerLevel: 5,       // Good MP gain
                statGrowth: {
                    str: 3,  // +1 STR every 3 levels
                    dex: 5,
                    con: 3,  // +1 CON every 3 levels
                    int: 5,
                    wis: 4,
                    cha: 4
                }
            },
            'ranger': {
                name: 'Ranger',
                description: 'Skilled tracker and archer',
                statBonuses: { str: 1, dex: 3, con: 1, int: 0, wis: 2, cha: 0 },
                hpBonus: 10,
                mpBonus: 5,
                abilities: ['Track', 'Rapid Shot', 'Animal Companion'],
                xpMultiplier: 0.95,  // Levels slightly faster
                hpPerLevel: 10,      // Good HP
                mpPerLevel: 4,       // Low-moderate MP
                statGrowth: {
                    str: 4,
                    dex: 2,  // +1 DEX every 2 levels
                    con: 4,
                    int: 5,
                    wis: 3,  // +1 WIS every 3 levels
                    cha: 6
                }
            }
        };

        try {
            for (const [id, classData] of Object.entries(classes)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-classes/${id}`), classData);
                logSetup(`✓ Created class: ${classData.name}`, 'success');
            }
            logSetup('✓✓✓ Classes setup complete!', 'success');
        } catch (error) {
            logSetup(`Error creating classes: ${error.message}`, 'error');
        }
    });

    // Setup Rooms
    document.getElementById('setup-rooms-btn').addEventListener('click', async () => {
        logSetup('Creating starter rooms...', 'info');
        const rooms = {
            'start': {
                name: 'Town Square',
                description: 'You stand in the bustling town square. A fountain bubbles in the center, and merchants hawk their wares. Paths lead in all directions.',
                exits: { north: 'forest', south: 'shop', east: 'tavern', west: 'guild' },
                details: { fountain: 'An ornate stone fountain with crystal-clear water.', merchants: 'Colorful merchants selling various goods.' }
            },
            'forest': {
                name: 'Dark Forest',
                description: 'Dense trees block most of the sunlight. Strange sounds echo through the woods.',
                exits: { south: 'start' },
                details: { trees: 'Tall, ancient oaks with twisted branches.' },
                monsters: [{ monsterId: 'wolf', respawnTime: 300000 }]
            },
            'shop': {
                name: 'General Store',
                description: 'A cozy shop filled with adventuring supplies. The shopkeeper eyes you hopefully.',
                exits: { north: 'start' },
                details: { counter: 'A wooden counter with various items on display.' }
            },
            'tavern': {
                name: 'The Prancing Pony',
                description: 'A warm tavern filled with the smell of ale and roasting meat. Patrons chat at wooden tables.',
                exits: { west: 'start' },
                details: { bar: 'A long oak bar with various drinks.', fireplace: 'A crackling fire in the corner.' }
            },
            'guild': {
                name: 'Adventurers Guild',
                description: 'The guild hall is decorated with trophies and quest boards. Fellow adventurers mingle here.',
                exits: { east: 'start' },
                details: { board: 'A quest board covered in notices.', trophies: 'Monster heads and weapons mounted on the walls.' }
            }
        };

        try {
            for (const [id, roomData] of Object.entries(rooms)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${id}`), roomData);
                logSetup(`✓ Created room: ${roomData.name}`, 'success');
            }
            logSetup('✓✓✓ Rooms setup complete!', 'success');
        } catch (error) {
            logSetup(`Error creating rooms: ${error.message}`, 'error');
        }
    });

    // Setup Items
    document.getElementById('setup-items-btn').addEventListener('click', async () => {
        logSetup('Creating starter items...', 'info');
        const items = {
            'sword': {
                name: 'Iron Sword',
                description: 'A sturdy iron sword with a leather grip.',
                type: 'weapon',
                value: 50,
                damage: 10,
                weight: 5
            },
            'shield': {
                name: 'Wooden Shield',
                description: 'A simple wooden shield reinforced with iron bands.',
                type: 'armor',
                value: 30,
                defense: 5,
                weight: 8
            },
            'potion': {
                name: 'Health Potion',
                description: 'A red potion that restores health.',
                type: 'consumable',
                value: 20,
                healing: 50,
                weight: 1
            },
            'bread': {
                name: 'Loaf of Bread',
                description: 'Fresh-baked bread.',
                type: 'food',
                value: 5,
                healing: 10,
                weight: 1
            },
            'key': {
                name: 'Rusty Key',
                description: 'An old rusty key. What does it unlock?',
                type: 'key',
                value: 10,
                weight: 0.5
            },
            'torch': {
                name: 'Torch',
                description: 'A wooden torch that provides light.',
                type: 'tool',
                value: 5,
                weight: 2
            },
            'rope': {
                name: 'Rope',
                description: '50 feet of sturdy rope.',
                type: 'tool',
                value: 10,
                weight: 3
            },
            'dagger': {
                name: 'Steel Dagger',
                description: 'A sharp steel dagger.',
                type: 'weapon',
                value: 25,
                damage: 5,
                weight: 2
            },
            'ring': {
                name: 'Silver Ring',
                description: 'A simple silver ring.',
                type: 'jewelry',
                value: 100,
                weight: 0.1
            },
            'book': {
                name: 'Spellbook',
                description: 'An ancient book filled with arcane symbols.',
                type: 'magic',
                value: 150,
                weight: 3
            }
        };

        try {
            for (const [id, itemData] of Object.entries(items)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${id}`), itemData);
                logSetup(`✓ Created item: ${itemData.name}`, 'success');
            }
            logSetup('✓✓✓ Items setup complete!', 'success');
        } catch (error) {
            logSetup(`Error creating items: ${error.message}`, 'error');
        }
    });

    // Setup NPCs
    document.getElementById('setup-npcs-btn').addEventListener('click', async () => {
        logSetup('Creating starter NPCs...', 'info');
        const npcs = {
            'shopkeeper': {
                name: 'Marcus the Shopkeeper',
                description: 'A portly merchant with a friendly smile.',
                roomId: 'shop',
                isTrader: true,
                inventory: ['sword', 'shield', 'potion', 'bread', 'torch', 'rope'],
                dialogue: ['Welcome to my shop!', 'Looking to buy something?', 'Best prices in town!'],
                aiEnabled: false
            },
            'barkeep': {
                name: 'Old Tom',
                description: 'A grizzled bartender with many stories to tell.',
                roomId: 'tavern',
                isTrader: false,
                dialogue: ['What can I get ya?', 'Heard any good rumors lately?', 'Adventurers always bring trouble...'],
                aiEnabled: false
            },
            'guildmaster': {
                name: 'Lady Evelyn',
                description: 'The stern but fair guildmaster. She oversees all adventurer activities.',
                roomId: 'guild',
                isTrader: false,
                dialogue: ['Greetings, adventurer.', 'Many quests await those brave enough.', 'Prove your worth and earn great rewards.'],
                aiEnabled: false
            }
        };

        try {
            for (const [id, npcData] of Object.entries(npcs)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${id}`), npcData);
                logSetup(`✓ Created NPC: ${npcData.name}`, 'success');
            }
            logSetup('✓✓✓ NPCs setup complete!', 'success');
        } catch (error) {
            logSetup(`Error creating NPCs: ${error.message}`, 'error');
        }
    });

    // Setup Monsters
    document.getElementById('setup-monsters-btn').addEventListener('click', async () => {
        logSetup('Creating starter monsters...', 'info');
        const monsters = {
            'wolf': {
                name: 'Gray Wolf',
                description: 'A lean, hungry wolf with sharp fangs.',
                hp: 30,
                maxHp: 30,
                damage: 8,
                xpReward: 50,
                loot: ['bread'],
                aggressive: true
            },
            'goblin': {
                name: 'Goblin Scout',
                description: 'A small green creature with beady eyes and a rusty dagger.',
                hp: 20,
                maxHp: 20,
                damage: 5,
                xpReward: 30,
                loot: ['dagger', 'key'],
                aggressive: true
            },
            'skeleton': {
                name: 'Skeleton Warrior',
                description: 'An undead warrior wielding an ancient sword.',
                hp: 40,
                maxHp: 40,
                damage: 12,
                xpReward: 75,
                loot: ['sword', 'ring'],
                aggressive: true
            }
        };

        try {
            for (const [id, monsterData] of Object.entries(monsters)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${id}`), monsterData);
                logSetup(`✓ Created monster: ${monsterData.name}`, 'success');
            }
            logSetup('✓✓✓ Monsters setup complete!', 'success');
        } catch (error) {
            logSetup(`Error creating monsters: ${error.message}`, 'error');
        }
    });

    // Setup All
    document.getElementById('setup-all-btn').addEventListener('click', async () => {
        setupStatus.innerHTML = '';
        logSetup('========================================', 'info');
        logSetup('🚀 STARTING COMPLETE WORLD SETUP', 'info');
        logSetup('========================================', 'info');
        
        // Trigger all setup buttons
        document.getElementById('setup-classes-btn').click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        document.getElementById('setup-rooms-btn').click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        document.getElementById('setup-items-btn').click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        document.getElementById('setup-npcs-btn').click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        document.getElementById('setup-monsters-btn').click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logSetup('========================================', 'success');
        logSetup('✓✓✓ WORLD SETUP COMPLETE! ✓✓✓', 'success');
        logSetup('========================================', 'success');
        logSetup('Switch to other tabs to edit your content!', 'success');
    });
}

// ========== LEVELS EDITOR ==========
async function initializeLevelsEditor(db, appId) {
    const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    
    const levelsTableBody = document.getElementById('levels-table-body');
    const saveLevelsBtn = document.getElementById('save-all-levels-btn');
    const loadLevelsBtn = document.getElementById('load-levels-btn');
    const levelsStatus = document.getElementById('admin-levels-status');
    
    // Default level configuration
    const DEFAULT_LEVELS = {
        1: { name: "Novice", xp: 0 },
        2: { name: "Beginner", xp: 100 },
        3: { name: "Apprentice", xp: 283 },
        4: { name: "Student", xp: 520 },
        5: { name: "Initiate", xp: 800 },
        6: { name: "Trainee", xp: 1114 },
        7: { name: "Journeyman", xp: 1458 },
        8: { name: "Practitioner", xp: 1828 },
        9: { name: "Adept", xp: 2221 },
        10: { name: "Expert", xp: 2636 },
        11: { name: "Specialist", xp: 3070 },
        12: { name: "Veteran", xp: 3522 },
        13: { name: "Master", xp: 3991 },
        14: { name: "Champion", xp: 4477 },
        15: { name: "Hero", xp: 4978 },
        16: { name: "Legend", xp: 5494 },
        17: { name: "Titan", xp: 6024 },
        18: { name: "Demigod", xp: 6568 },
        19: { name: "Avatar", xp: 7125 },
        20: { name: "Ascended", xp: 7695 },
        21: { name: "Immortal", xp: 8278 },
        22: { name: "Celestial", xp: 8873 },
        23: { name: "Divine", xp: 9481 },
        24: { name: "Eternal", xp: 10100 },
        25: { name: "Supreme", xp: 10732 },
        26: { name: "Transcendent", xp: 11375 },
        27: { name: "Omnipotent", xp: 12029 },
        28: { name: "Primordial", xp: 12695 },
        29: { name: "Cosmic", xp: 13372 },
        30: { name: "God", xp: 14060 }
    };
    
    // Load levels from Firebase or use defaults
    async function loadLevels() {
        try {
            const levelsDoc = await getDoc(doc(db, `/artifacts/${appId}/public/data/mud-levels/config`));
            return levelsDoc.exists() ? levelsDoc.data() : DEFAULT_LEVELS;
        } catch (error) {
            console.error("Error loading levels:", error);
            return DEFAULT_LEVELS;
        }
    }
    
    // Populate the table
    async function populateLevelsTable() {
        const levels = await loadLevels();
        levelsTableBody.innerHTML = '';
        
        for (let i = 1; i <= 30; i++) {
            const level = levels[i] || { name: `Level ${i}`, xp: 0 };
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-2">${i}</td>
                <td class="p-2">
                    <input type="text" 
                           class="admin-input w-full" 
                           data-level="${i}" 
                           data-field="name"
                           value="${level.name}"
                           placeholder="Level Name">
                </td>
                <td class="p-2">
                    <input type="number" 
                           class="admin-input w-full" 
                           data-level="${i}"
                           data-field="xp"
                           value="${level.xp}"
                           min="0"
                           placeholder="XP Required">
                </td>
            `;
            levelsTableBody.appendChild(row);
        }
    }
    
    // Save levels to Firebase
    saveLevelsBtn.addEventListener('click', async () => {
        try {
            levelsStatus.textContent = 'Saving...';
            levelsStatus.className = 'ml-4 text-sm text-yellow-400';
            
            const levelsConfig = {};
            const inputs = levelsTableBody.querySelectorAll('input');
            
            inputs.forEach(input => {
                const level = parseInt(input.dataset.level);
                const field = input.dataset.field;
                
                if (!levelsConfig[level]) {
                    levelsConfig[level] = {};
                }
                
                if (field === 'name') {
                    levelsConfig[level].name = input.value.trim() || `Level ${level}`;
                } else if (field === 'xp') {
                    levelsConfig[level].xp = parseInt(input.value) || 0;
                }
            });
            
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-levels/config`), levelsConfig);
            
            levelsStatus.textContent = '✓ Saved successfully!';
            levelsStatus.className = 'ml-4 text-sm text-green-400';
            setTimeout(() => { levelsStatus.textContent = ''; }, 3000);
            
        } catch (error) {
            console.error("Error saving levels:", error);
            levelsStatus.textContent = '✗ Error saving levels';
            levelsStatus.className = 'ml-4 text-sm text-red-400';
        }
    });
    
    // Reload levels from database
    loadLevelsBtn.addEventListener('click', async () => {
        levelsStatus.textContent = 'Loading...';
        levelsStatus.className = 'ml-4 text-sm text-yellow-400';
        await populateLevelsTable();
        levelsStatus.textContent = '✓ Reloaded!';
        levelsStatus.className = 'ml-4 text-sm text-green-400';
        setTimeout(() => { levelsStatus.textContent = ''; }, 2000);
    });
    
    // Initial load
    await populateLevelsTable();
}

// ========== ACTIONS/EMOTES EDITOR ==========
async function initializeActionsEditor(db, appId) {
    const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    
    const actionSelect = document.getElementById('action-select');
    const actionCommand = document.getElementById('action-command');
    const actionMessage = document.getElementById('action-message');
    const actionStatus = document.getElementById('admin-action-status');
    const actionList = document.getElementById('action-list');
    const newActionBtn = document.getElementById('new-action-btn');
    const saveActionBtn = document.getElementById('save-action-btn');
    const deleteActionBtn = document.getElementById('delete-action-btn');
    
    let gameActions = {}; // Store actions locally
    
    // Default actions
    const DEFAULT_ACTIONS = {
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
    
    // Load actions from Firebase
    async function loadActions() {
        try {
            const actionsSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-actions`));
            gameActions = {};
            
            if (actionsSnapshot.empty) {
                // Initialize with defaults
                for (const [cmd, msg] of Object.entries(DEFAULT_ACTIONS)) {
                    gameActions[cmd] = msg;
                    await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-actions/${cmd}`), { 
                        command: cmd, 
                        message: msg 
                    });
                }
            } else {
                actionsSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    gameActions[data.command] = data.message;
                });
            }
        } catch (error) {
            console.error("Error loading actions:", error);
            gameActions = { ...DEFAULT_ACTIONS };
        }
    }
    
    // Populate selector and list
    function populateActionUI() {
        actionSelect.innerHTML = '<option value="">-- Select an Action --</option>';
        actionList.innerHTML = '';
        
        const sortedActions = Object.keys(gameActions).sort();
        sortedActions.forEach(cmd => {
            const option = document.createElement('option');
            option.value = cmd;
            option.textContent = cmd;
            actionSelect.appendChild(option);
            
            const badge = document.createElement('span');
            badge.className = 'bg-purple-600 px-2 py-1 rounded text-xs cursor-pointer hover:bg-purple-500';
            badge.textContent = cmd;
            badge.onclick = () => {
                actionSelect.value = cmd;
                actionSelect.dispatchEvent(new Event('change'));
            };
            actionList.appendChild(badge);
        });
    }
    
    // Select action
    actionSelect.addEventListener('change', () => {
        const cmd = actionSelect.value;
        if (cmd && gameActions[cmd]) {
            actionCommand.value = cmd;
            actionMessage.value = gameActions[cmd];
            actionCommand.disabled = true; // Can't change command when editing
        }
    });
    
    // New action
    newActionBtn.addEventListener('click', () => {
        actionSelect.value = '';
        actionCommand.value = '';
        actionMessage.value = '';
        actionCommand.disabled = false;
        actionStatus.textContent = '';
    });
    
    // Save action
    saveActionBtn.addEventListener('click', async () => {
        try {
            const cmd = actionCommand.value.trim().toLowerCase();
            const msg = actionMessage.value.trim();
            
            if (!cmd || !msg) {
                actionStatus.textContent = '✗ Command and message required';
                actionStatus.className = 'ml-2 text-sm self-center text-red-400';
                return;
            }
            
            if (!msg.includes('{player}')) {
                actionStatus.textContent = '✗ Message must include {player}';
                actionStatus.className = 'ml-2 text-sm self-center text-red-400';
                return;
            }
            
            actionStatus.textContent = 'Saving...';
            actionStatus.className = 'ml-2 text-sm self-center text-yellow-400';
            
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-actions/${cmd}`), {
                command: cmd,
                message: msg
            });
            
            gameActions[cmd] = msg;
            populateActionUI();
            
            actionStatus.textContent = '✓ Saved!';
            actionStatus.className = 'ml-2 text-sm self-center text-green-400';
            setTimeout(() => { actionStatus.textContent = ''; }, 2000);
        } catch (error) {
            console.error("Error saving action:", error);
            actionStatus.textContent = '✗ Error saving';
            actionStatus.className = 'ml-2 text-sm self-center text-red-400';
        }
    });
    
    // Delete action
    deleteActionBtn.addEventListener('click', async () => {
        const cmd = actionCommand.value.trim().toLowerCase();
        if (!cmd) {
            actionStatus.textContent = '✗ No action selected';
            actionStatus.className = 'ml-2 text-sm self-center text-red-400';
            return;
        }
        
        if (!confirm(`Delete action "${cmd}"?`)) return;
        
        try {
            await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-actions/${cmd}`));
            delete gameActions[cmd];
            populateActionUI();
            actionCommand.value = '';
            actionMessage.value = '';
            actionSelect.value = '';
            
            actionStatus.textContent = '✓ Deleted!';
            actionStatus.className = 'ml-2 text-sm self-center text-green-400';
            setTimeout(() => { actionStatus.textContent = ''; }, 2000);
        } catch (error) {
            console.error("Error deleting action:", error);
            actionStatus.textContent = '✗ Error deleting';
            actionStatus.className = 'ml-2 text-sm self-center text-red-400';
        }
    });
    
    // Initial load
    await loadActions();
    populateActionUI();
}

// ========== SETTINGS PANEL ==========

let gameLogicReference = null; // Store reference to game logic

/**
 * Initialize Settings Panel
 */
function initializeSettingsPanel() {
    const toggle = document.getElementById('npc-conversations-toggle');
    const thresholdInput = document.getElementById('npc-chat-player-threshold');
    const saveBtn = document.getElementById('save-npc-settings-btn');
    const testBtn = document.getElementById('test-npc-conversations-btn');
    const statusBadge = document.getElementById('npc-conversations-status');
    const playerCountSpan = document.getElementById('active-player-count');
    const thresholdDisplaySpan = document.getElementById('threshold-display');
    const warningP = document.getElementById('threshold-warning');
    
    // Define helper functions first
    const updatePlayerCount = () => {
        // Get player count from global if available
        let playerCount = 0;
        try {
            // This will be available from the game context
            playerCount = window.gamePlayers ? Object.keys(window.gamePlayers).length : 0;
        } catch (e) {
            playerCount = 0;
        }
        
        playerCountSpan.textContent = playerCount;
        
        const threshold = parseInt(thresholdInput.value, 10) || 0;
        if (threshold > 0) {
            thresholdDisplaySpan.textContent = `${threshold} players`;
            if (playerCount > threshold) {
                warningP.classList.remove('hidden');
            } else {
                warningP.classList.add('hidden');
            }
        } else {
            thresholdDisplaySpan.textContent = 'No limit';
            warningP.classList.add('hidden');
        }
    };
    
    const updateStatusDisplay = (settings) => {
        const isEnabled = settings.enabled && !settings.autoDisabled && !settings.quotaExhausted;
        
        if (isEnabled) {
            statusBadge.textContent = 'ENABLED';
            statusBadge.className = 'px-3 py-1 rounded text-sm font-bold bg-green-500 text-white';
        } else if (settings.quotaExhausted) {
            statusBadge.textContent = 'QUOTA EXHAUSTED';
            statusBadge.className = 'px-3 py-1 rounded text-sm font-bold bg-red-500 text-white';
        } else if (settings.autoDisabled) {
            statusBadge.textContent = 'AUTO-DISABLED';
            statusBadge.className = 'px-3 py-1 rounded text-sm font-bold bg-yellow-500 text-black';
        } else {
            statusBadge.textContent = 'DISABLED';
            statusBadge.className = 'px-3 py-1 rounded text-sm font-bold bg-gray-500 text-white';
        }
        
        updatePlayerCount();
    };
    
    // Load current settings
    if (gameLogicReference) {
        const settings = gameLogicReference.getNpcConversationSettings();
        toggle.checked = settings.enabled;
        thresholdInput.value = settings.threshold;
        updateStatusDisplay(settings);
    } else {
        // Fallback to localStorage if gameLogic not available yet
        const savedEnabled = localStorage.getItem('npcConversationsEnabled');
        const enabled = savedEnabled === null ? true : savedEnabled === 'true'; // Default to true if never set
        const threshold = parseInt(localStorage.getItem('npcChatPlayerThreshold') || '0', 10);
        toggle.checked = enabled;
        thresholdInput.value = threshold;
    }
    
    // Update display initially and every 5 seconds
    updatePlayerCount();
    const intervalId = setInterval(updatePlayerCount, 5000);
    
    // Save settings
    saveBtn.addEventListener('click', () => {
        const enabled = toggle.checked;
        const threshold = parseInt(thresholdInput.value, 10) || 0;
        
        if (gameLogicReference) {
            gameLogicReference.setNpcConversationSettings(enabled, threshold);
            const settings = gameLogicReference.getNpcConversationSettings();
            updateStatusDisplay(settings);
            console.log('✅ NPC conversation settings saved:', { enabled, threshold });
            
            // Also update the toggle to reflect saved state (in case of any processing)
            toggle.checked = settings.enabled;
            thresholdInput.value = settings.threshold;
        } else {
            // Fallback to localStorage
            localStorage.setItem('npcConversationsEnabled', enabled.toString());
            localStorage.setItem('npcChatPlayerThreshold', threshold.toString());
            console.log('✅ Settings saved (will apply on page reload)');
        }
    });
    
    // Test button
    testBtn.addEventListener('click', () => {
        const status = gameLogicReference ? gameLogicReference.getNpcConversationSettings() : null;
        if (status) {
            const statusText = status.enabled ? 'ENABLED' : 'DISABLED';
            const autoText = status.autoDisabled ? ' (auto-disabled)' : '';
            const quotaText = status.quotaExhausted ? ' (quota exhausted)' : '';
            console.log(`NPC Conversations: ${statusText}${autoText}${quotaText}`);
            console.log(`Player threshold: ${status.threshold || 'none'}`);
            console.log(`Active players: ${window.gamePlayers ? Object.keys(window.gamePlayers).length : 0}`);
        } else {
            console.log('Game logic not initialized yet');
        }
    });
    
    // Clean up interval when panel is hidden
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList.contains('hidden')) {
                clearInterval(intervalId);
            }
        });
    });
    
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        observer.observe(settingsPanel, { attributes: true, attributeFilter: ['class'] });
    }
}

/**
 * Set game logic reference for settings panel
 */
export function setGameLogicForSettings(gameLogic) {
    gameLogicReference = gameLogic;
}
