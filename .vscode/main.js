<script type="module">
// FILE: main.js (This would be your main entry point)
// It imports functions from other files and initializes the application.

// --- SECTION: Imports ---
// In a real project, you would have separate files for each of these sections.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, getDocs, arrayUnion, arrayRemove, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- SECTION: Global Variables & DOM Elements ---
// FILE: globals.js
const output = document.getElementById('terminal-output');
const input = document.getElementById('command-input');
const userInfo = document.getElementById('user-info');

const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');

const adminToggleBtn = document.getElementById('admin-toggle-btn');
const appContainer = document.getElementById('app-container');
const adminPanel = document.getElementById('admin-panel');

let db, auth;
let userId, playerName;
let currentPlayerRoomId = null;
let isGameInitialized = false;
let lastNpcInteraction = null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'mud-default-app';

let gameWorld = {}, gameItems = {}, gameNpcs = {}, gameMonsters = {}, activeMonsters = {}, gamePlayers = {};

let unsubscribers = [];

// --- SECTION: API Calls ---
// FILE: api.js
async function callGeminiForText(prompt) {
     const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "The AI is pondering...";
    } catch (error) {
        console.error("Gemini text API error:", error);
        return "The AI is silent for now.";
    }
}

async function parseCommandWithGemini(command) {
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a text adventure game parser. Analyze the user's input and convert it into a JSON command.
    - The action must be one of: "go", "get", "drop", "examine", "say", "buy", "attack", "ask_dm", "talk", "ask_npc", "look", "inventory", "who", "score", "stats", "help", "logout", "unknown".
    - 'target': The primary noun or direction (e.g., "north", "torch", "goblin").
    - 'npc_target': The NPC being interacted with for 'buy', 'talk', 'ask_npc'.
    - 'buy': The item is the 'target', the vendor is 'npc_target'. Ex: "buy beer from barman" -> {action: "buy", target: "beer", npc_target: "barman"}.
    - 'attack': The monster is the 'target'. Ex: "attack goblin" -> {action: "attack", target: "goblin"}.
    - 'talk': The NPC is the 'npc_target'. Ex: "talk to the guard" -> {action: "talk", npc_target: "guard"}.
    - 'ask_npc': The NPC is 'npc_target', the subject is 'topic'. Ex: "ask man about cave" -> {action: "ask_npc", npc_target: "man", topic: "cave"}.
    - Synonyms are fine. "purchase" for "buy", "fight" for "attack", etc. If the intent is unclear, the action is "unknown".`;

    const payload = {
        contents: [{ parts: [{ text: command }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "action": { "type": "STRING" },
                    "target": { "type": "STRING" },
                    "npc_target": { "type": "STRING" },
                    "topic": { "type": "STRING" }
                }
            }
        }
    };
     try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Gemini parsing error:", error);
        return { action: "unknown" };
    }
}

// --- SECTION: Core Game Logic ---
// FILE: game.js
function generateAttributes() {
    const roll3d6 = () => Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    return {
        str: roll3d6(), dex: roll3d6(), con: roll3d6(),
        int: roll3d6(), wis: roll3d6(), cha: roll3d6(),
    };
}

async function initializeGameData() {
    const settingsRef = doc(db, `/artifacts/${appId}/public/data/mud-settings/world`);
    try {
        const settingsDoc = await getDoc(settingsRef);

        if (!settingsDoc.exists()) {
            logToTerminal("No world found. Seeding initial realm with sample data...", "system");
            
            await setDoc(settingsRef, { initializedAt: serverTimestamp(), version: "1.4" });

            const initialItems = {
                "boulder": { name: "a mossy boulder", movable: false, cost: 0 },
                "torch": { name: "a discarded torch", movable: true, cost: 5 },
                "glyphs": { name: "strange glyphs", movable: false, cost: 0 },
                "beer": { name: "a pint of beer", movable: true, cost: 10 }
            };
            const initialNpcs = {
                "old_man": {
                    shortName: "Albert",
                    name: "an old man",
                    description: "The old man has a long white beard and leans heavily on a gnarled staff. His eyes seem to hold ancient secrets.",
                    dialogue: ["You are a wise, slightly mysterious old man named Albert. When you respond, describe your actions in asterisks *like this* and your speech in quotes \"like this\". Be creative and in-character. IMPORTANT: Always refer to yourself as 'Albert' or 'he', NEVER 'I'."],
                    triggers: { "darkness": "torch", "lost": "torch", "help": "torch" },
                    useAI: true,
                    sells: []
                },
                "barman": {
                    shortName: "Bob",
                    name: "a busy barman",
                    description: "Bob the barman tirelessly cleans a glass with a grubby rag, nodding at you as you approach.",
                    dialogue: ["What can I get for ya?", "Another one? Coming right up.", "This tavern's seen its share of heroes... and villains."],
                    useAI: false,
                    sells: ["beer"]
                }
            };
             const initialMonsters = {
                "goblin": {
                    name: "a grumpy goblin",
                    description: "A small, green-skinned creature with pointy ears and a foul temper. It wields a rusty dagger.",
                    hp: 15,
                    minAtk: 2,
                    maxAtk: 5,
                    xp: 20,
                    gold: 10,
                    itemDrop: ""
                }
            };
             const initialWorld = {
                "start": {
                    name: "The Nexus", description: "A shimmering portal hangs in the center of this timeless space... A path leads north into a forest, and another south towards a cozy-looking building.",
                    exits: { "north": "forest_path", "south": "tavern" }, items: [], npcs: ["old_man"], monsterSpawns:[]
                },
                 "tavern": {
                    name: "The Weary Adventurer Tavern",
                    description: "The tavern is warm and filled with the smell of old wood and spilled ale. A few patrons are scattered around, and a busy barman is cleaning glasses.",
                    exits: { "north": "start" }, items: [], npcs: ["barman"], monsterSpawns:[]
                },
                "forest_path": {
                    name: "Whispering Woods Path", description: "A narrow, winding path leads through a forest of impossibly tall, ancient trees...",
                    exits: { "south": "start", "north": "forest_clearing" }, items: [], npcs: [], monsterSpawns:[]
                },
                "forest_clearing": {
                    name: "Sun-dappled Clearing", description: "The path opens into a small, circular clearing... To the east, you see the dark maw of a cave.",
                    exits: { "south": "forest_path", "east": "dark_cave" }, items: ["boulder"], npcs: [], monsterSpawns:[]
                },
                "dark_cave": {
                    name: "Echoing Caverns", description: "The air grows cold and damp as you step into the darkness... A faint glow emanates from strange glyphs...",
                    exits: { "west": "forest_clearing" }, items: ["torch", "glyphs"], npcs: [],
                    details: { "glyphs": "The ancient symbols pulse with a soft, ethereal light..." },
                    monsterSpawns: [{monsterId: "goblin", respawnTime: 60}]
                }
            };
             for (const [itemId, itemData] of Object.entries(initialItems)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${itemId}`), itemData);
            }
             for (const [npcId, npcData] of Object.entries(initialNpcs)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${npcId}`), npcData);
            }
            for (const [monsterId, monsterData] of Object.entries(initialMonsters)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${monsterId}`), monsterData);
            }
            for (const [roomId, roomData] of Object.entries(initialWorld)) {
                await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`), roomData);
            }
        }
        return true; 
    } catch (error) {
        console.error("Error initializing game data:", error);
        logToTerminal("Error: Could not read or write world data. Check permissions.", "error");
        return false; 
    }
}

function logToTerminal(message, type = 'game') {
    const p = document.createElement('p');
    let prefix = '';
    switch(type) {
        case 'system': p.className = 'text-yellow-400'; prefix = '[SYSTEM] '; break;
        case 'chat': p.className = 'text-cyan-400'; break;
        case 'error': p.className = 'text-red-500'; prefix = '[ERROR] '; break;
        case 'dm': p.className = 'text-purple-400'; prefix = '[DM] '; break;
        case 'npc': p.className = 'text-lime-300'; break;
        case 'action': p.className = 'text-gray-400 italic'; break;
        case 'game': default: p.className = 'text-[#00ff41]'; break;
    }
    p.innerHTML = prefix + message; 
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function logNpcResponse(npc, rawText) {
    const npcDisplayName = npc.shortName || npc.name;
    const regex = /(\*[^*]+\*|"[^"]+"|[^"*]+)/g;
    const parts = rawText.match(regex) || [];

    parts.forEach(part => {
        const trimmedPart = part.trim();
        if (trimmedPart.startsWith('*') && trimmedPart.endsWith('*')) {
            logToTerminal(trimmedPart.slice(1, -1), 'action');
        } else if (trimmedPart.startsWith('"') && trimmedPart.endsWith('"')) {
            logToTerminal(`${npcDisplayName} says, ${trimmedPart}`, 'npc');
        } else if (trimmedPart) {
            logToTerminal(trimmedPart, 'action');
        }
    });
}


async function showRoom(roomId) {
    lastNpcInteraction = null;
    if (!roomId || !gameWorld[roomId]) {
        logToTerminal("You are lost in the void. Returning to Nexus...", "error");
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`), { roomId: 'start' });
        return;
    }

    currentPlayerRoomId = roomId;
    const room = gameWorld[roomId];

    logToTerminal(`\n<span class="text-white text-xl font-bold">${room.name}</span>`, 'game');
    logToTerminal(room.description, 'game');
    
    if (room.items && room.items.length > 0) {
        const itemNames = room.items.map(itemId => gameItems[itemId]?.name || 'an unknown object').join(', ');
        logToTerminal(`You see here: <span class="text-yellow-300">${itemNames}</span>.`, 'game');
    }
    
    if (room.npcs && room.npcs.length > 0) {
        const npcNames = room.npcs.map(npcId => gameNpcs[npcId]?.name || 'a mysterious figure').join(', ');
        logToTerminal(`You see <span class="text-lime-300">${npcNames}</span> here.`, 'game');
    }
    
    const monstersInRoom = Object.values(activeMonsters).filter(m => m.roomId === roomId);
    if (monstersInRoom.length > 0) {
        const monsterNames = monstersInRoom.map(m => m.name).join(', ');
        logToTerminal(`Here you see: <span class="combat-log">${monsterNames}</span>.`, 'game');
    }
    
    const roomTemplate = gameWorld[roomId];
    if(roomTemplate && roomTemplate.monsterSpawns && roomTemplate.monsterSpawns.length > 0) {
        roomTemplate.monsterSpawns.forEach(spawn => {
            const isMonsterActive = Object.values(activeMonsters).some(m => m.roomId === roomId && m.monsterId === spawn.monsterId);
            if(!isMonsterActive) {
                const lastDefeated = spawn.lastDefeated?.toMillis() || 0;
                const respawnTime = (spawn.respawnTime || 60) * 1000;
                if(Date.now() - lastDefeated > respawnTime) {
                    spawnMonster(spawn.monsterId, roomId);
                }
            }
        });
    }

    const exits = Object.keys(room.exits || {}).join(', ');
    logToTerminal(`Exits: <span class="text-yellow-300">[ ${exits} ]</span>`, 'game');
}

async function spawnMonster(monsterId, roomId) {
    const monsterTemplate = gameMonsters[monsterId];
    if (!monsterTemplate) return;

    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), {
        monsterId: monsterId,
        roomId: roomId,
        name: monsterTemplate.name,
        hp: monsterTemplate.hp,
        maxHp: monsterTemplate.hp
    });
    logToTerminal(`A ${monsterTemplate.name} appears!`, 'combat-log');
}

async function handleAiNpcInteraction(npc, interactionType, currentRoom, topicOrSpeech = null) {
    lastNpcInteraction = npc.id;
    logToTerminal(`${npc.shortName || npc.name} is thinking...`, 'action');

    const personalityPrompt = (npc.dialogue || []).join(' ');
    let taskPrompt = "";
    switch(interactionType) {
        case 'talk': taskPrompt = `The player has just started a conversation with you. Respond to them based on your personality.`; break;
        case 'ask_npc': taskPrompt = `The player has asked you specifically about "${topicOrSpeech}". Formulate a response based on your personality.`; break;
        case 'reply': taskPrompt = `The player is replying to you. Their reply is: "${topicOrSpeech}". Continue the conversation based on your personality.`; break;
    }

    let triggerInstructions = "";
    if (npc.triggers && Object.keys(npc.triggers).length > 0) {
        triggerInstructions += "You have the ability to give items. Here are the rules: ";
        const rules = Object.entries(npc.triggers).map(([keyword, itemId]) =>
            `If the player's query mentions '${keyword}', you can give them the '${gameItems[itemId]?.name || itemId}'. To do so, you MUST include the tag [GIVE_ITEM:${itemId}] in your response.`
        ).join(' ');
        triggerInstructions += rules;
    }

    const fullPrompt = `CONTEXT: You are playing an NPC in a game. Your name is ${npc.shortName || npc.name}. The player you are talking to is named ${playerName}. You are in a location called "${currentRoom.name}".
    PERSONALITY: ${personalityPrompt}
    ${triggerInstructions}
    TASK: ${taskPrompt}`;

    let aiResponse = await callGeminiForText(fullPrompt);

    const giveMatch = aiResponse.match(/\[GIVE_ITEM:(\w+)\]/);
    if (giveMatch) {
        const itemIdToGive = giveMatch[1];
        if (gameItems[itemIdToGive]) {
            const item = { id: itemIdToGive, ...gameItems[itemIdToGive] };
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await updateDoc(playerRef, { inventory: arrayUnion(item) });
            logToTerminal(`${npc.shortName || npc.name} gives you ${item.name}.`, 'system');
            aiResponse = aiResponse.replace(giveMatch[0], '').trim();
        }
    }

    logNpcResponse(npc, aiResponse);
}

async function executeParsedCommand(parsedCommand, originalText) {
    const { action, target, npc_target, topic } = parsedCommand;

    if (action !== 'talk' && action !== 'ask_npc' && action !== 'reply_npc') {
        lastNpcInteraction = null;
    }

    const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
    const currentRoom = gameWorld[currentPlayerRoomId];
    const roomRef = doc(db, `/artifacts/${appId}/public/data/mud-rooms/${currentPlayerRoomId}`);

    const findNpcInRoom = (targetName) => {
        if (!targetName || !currentRoom.npcs) return null;
        const lowerTarget = targetName.toLowerCase();
        const roomNpcIds = currentRoom.npcs || [];
        const npcId = roomNpcIds.find(id => {
            const npc = gameNpcs[id];
            if (!npc) return false;
            const shortNameMatch = npc.shortName && npc.shortName.toLowerCase() === lowerTarget;
            const descriptiveNameMatch = npc.name.toLowerCase().includes(lowerTarget);
            return shortNameMatch || descriptiveNameMatch;
        });
        return npcId ? { id: npcId, ...gameNpcs[npcId] } : null;
    };
    
    const findItemByName = (itemName) => {
        if (!itemName) return null;
        const lowerItemName = itemName.toLowerCase();
        for (const id in gameItems) {
            const item = gameItems[id];
            if(item.name.toLowerCase().includes(lowerItemName)) {
                return {id, ...item};
            }
        }
        return null;
    };

    switch(action) {
        case 'logout':
            await signOut(auth);
            break;
        case 'look': await showRoom(currentPlayerRoomId); break;
        case 'go':
             const direction = target.toLowerCase();
             if (currentRoom.exits && currentRoom.exits[direction]) {
                const destinationRoomId = currentRoom.exits[direction];
                const playerDoc = await getDoc(playerRef);
                const playerData = playerDoc.data();
                const updates = { roomId: destinationRoomId };
                
                if (!playerData.visitedRooms || !playerData.visitedRooms.includes(destinationRoomId)) {
                    updates.score = (playerData.score || 0) + 25;
                    updates.visitedRooms = arrayUnion(destinationRoomId);
                    logToTerminal("You discovered a new area! +25 XP", "system");

                    const newLevel = Math.floor(updates.score / 100) + 1;
                    if (newLevel > (playerData.level || 1)) {
                        updates.level = newLevel;
                        logToTerminal(`*** CONGRATULATIONS! You have reached Level ${updates.level}! ***`, "system");
                    }
                }
                await updateDoc(playerRef, updates);
            } else { logToTerminal("You can't go that way.", "error"); }
            break;
        case 'get':
            const roomItemIds = currentRoom.items || [];
            const itemIdToGet = roomItemIds.find(id => gameItems[id] && (id.toLowerCase() === target || gameItems[id].name.toLowerCase().includes(target)));
            
            if (itemIdToGet) {
                const item = gameItems[itemIdToGet];
                if (item.movable === false) {
                    logToTerminal("You can't take that.", "error"); return;
                }
                const fullItemObject = { id: itemIdToGet, ...item };
                await updateDoc(playerRef, { inventory: arrayUnion(fullItemObject) });
                await updateDoc(roomRef, { items: arrayRemove(itemIdToGet) });
                logToTerminal(`You take the ${item.name}.`, 'game');
            } else { logToTerminal("You don't see that here.", 'error'); }
            break;
        case 'drop':
            const playerDocDrop = await getDoc(playerRef);
            const inventoryDrop = playerDocDrop.data().inventory || [];
            const itemToDrop = inventoryDrop.find(i => i.id.toLowerCase() === target || i.name.toLowerCase().includes(target));

            if (itemToDrop) {
                await updateDoc(playerRef, { inventory: arrayRemove(itemToDrop) });
                await updateDoc(roomRef, { items: arrayUnion(itemToDrop.id) });
                logToTerminal(`You drop the ${itemToDrop.name}.`, 'game');
            } else { logToTerminal("You aren't carrying that.", 'error'); }
            break;
        case 'say':
             if (originalText) {
                 const speech = originalText.substring(originalText.indexOf(' ')).trim();
                await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), { senderId: userId, senderName: playerName, roomId: currentPlayerRoomId, text: speech, timestamp: serverTimestamp() });
            } else { logToTerminal("Say what?", "error"); }
            break;
        case 'inventory':
            const pDocInv = await getDoc(playerRef);
            const inv = pDocInv.data().inventory || [];
            if (inv.length > 0) {
                logToTerminal("You are carrying:", 'system');
                inv.forEach(item => logToTerminal(`- ${item.name}`, 'game'));
            } else { logToTerminal("You are not carrying anything.", 'system'); }
            break;
        case 'examine':
            const npcToExamine = findNpcInRoom(target);
            if (npcToExamine) {
                logToTerminal(npcToExamine.description, 'game');
                if (npcToExamine.sells && npcToExamine.sells.length > 0) {
                    logToTerminal(`${npcToExamine.shortName || npcToExamine.name} is selling:`, 'system');
                    npcToExamine.sells.forEach(itemId => {
                        const item = gameItems[itemId];
                        if(item) {
                            logToTerminal(`- ${item.name} (${item.cost} gold)`, 'game');
                        }
                    });
                }
            } else if (currentRoom.details && currentRoom.details[target]) {
                logToTerminal(currentRoom.details[target], 'game');
            } else { 
                logToTerminal("You see nothing special about that.", 'game'); 
            }
            break;
        case 'buy':
            const vendor = findNpcInRoom(npc_target);
            if (!vendor) { logToTerminal("There's no one here by that name to buy from.", "error"); break; }
            
            const itemToBuy = findItemByName(target);
            if (!itemToBuy || !vendor.sells.includes(itemToBuy.id)) { logToTerminal(`${vendor.shortName || vendor.name} isn't selling that.`, "error"); break; }

            const playerDocBuy = await getDoc(playerRef);
            const playerDataBuy = playerDocBuy.data();
            const playerGold = playerDataBuy.money || 0;

            if (playerGold < itemToBuy.cost) { logToTerminal("You can't afford that.", "error"); break; }

            const newGold = playerGold - itemToBuy.cost;
            await updateDoc(playerRef, {
                money: newGold,
                inventory: arrayUnion({id: itemToBuy.id, name: itemToBuy.name, cost: itemToBuy.cost, movable: itemToBuy.movable})
            });
            logToTerminal(`You buy ${itemToBuy.name} from ${vendor.shortName || vendor.name} for ${itemToBuy.cost} gold.`, 'system');
            break;
         case 'attack':
            const targetMonsterName = target;
            const monsterToAttack = Object.entries(activeMonsters).find(([id, m]) => 
                m.roomId === currentPlayerRoomId && (m.monsterId.toLowerCase().includes(targetMonsterName) || m.name.toLowerCase().includes(targetMonsterName))
            );

            if (!monsterToAttack) {
                logToTerminal("There's nothing here by that name to attack.", "error");
                break;
            }

            const [monsterInstanceId, monsterInstanceData] = monsterToAttack;
            const monsterRef = doc(db, `/artifacts/${appId}/public/data/mud-active-monsters/${monsterInstanceId}`);
            
            await runTransaction(db, async (transaction) => {
                const playerDoc = await transaction.get(playerRef);
                const roomDoc = await transaction.get(roomRef);
                const monsterDoc = await transaction.get(monsterRef);

                if (!playerDoc.exists() || !monsterDoc.exists()) {
                    throw "Player or Monster vanished during the transaction!";
                }

                const playerData = playerDoc.data();
                const monsterData = monsterDoc.data();
                const roomData = roomDoc.data();
                const monsterTemplate = gameMonsters[monsterData.monsterId];
                
                const playerDamage = 1 + Math.floor((playerData.attributes.str - 10) / 2) + Math.ceil(Math.random() * 4);
                const newMonsterHp = monsterData.hp - playerDamage;
                
                logToTerminal(`You hit the ${monsterData.name} for ${playerDamage} damage.`, 'combat-log');
                
                if (newMonsterHp <= 0) {
                    logToTerminal(`You have defeated the ${monsterData.name}!`, 'system');
                    transaction.delete(monsterRef);

                    const updates = {};
                    updates.score = (playerData.score || 0) + monsterTemplate.xp;
                    updates.money = (playerData.money || 0) + monsterTemplate.gold;

                    logToTerminal(`You gain ${monsterTemplate.xp} XP and ${monsterTemplate.gold} gold.`, 'loot-log');
                    
                    if (monsterTemplate.itemDrop && gameItems[monsterTemplate.itemDrop]) {
                        const item = gameItems[monsterTemplate.itemDrop];
                        const droppedItem = { id: monsterTemplate.itemDrop, ...item };
                        updates.inventory = arrayUnion(droppedItem);
                        logToTerminal(`The ${monsterData.name} dropped ${item.name}!`, 'loot-log');
                    }
                    
                    if (roomData.monsterSpawns) {
                        const spawnIndex = roomData.monsterSpawns.findIndex(s => s.monsterId === monsterData.monsterId);
                        if(spawnIndex > -1) {
                            const newSpawns = [...roomData.monsterSpawns];
                            newSpawns[spawnIndex].lastDefeated = serverTimestamp();
                            transaction.update(roomRef, { monsterSpawns: newSpawns });
                        }
                    }
                    transaction.update(playerRef, updates);
                } else {
                    transaction.update(monsterRef, { hp: newMonsterHp });
                    const monsterDamage = monsterTemplate.minAtk + Math.floor(Math.random() * (monsterTemplate.maxAtk - monsterTemplate.minAtk + 1));
                    const newPlayerHp = (playerData.currentHp || playerData.maxHp) - monsterDamage;
                    
                    logToTerminal(`The ${monsterData.name} hits you for ${monsterDamage} damage.`, 'combat-log');

                    if (newPlayerHp <= 0) {
                        logToTerminal(`You have been defeated! You respawn at the Nexus with a gold penalty.`, 'error');
                        transaction.update(playerRef, {
                            roomId: 'start',
                            currentHp: playerData.maxHp,
                            money: Math.floor((playerData.money || 0) * 0.9)
                        });
                    } else {
                        transaction.update(playerRef, { currentHp: newPlayerHp });
                    }
                }
            });
            break;
        case 'talk':
            const npcToTalkTo = findNpcInRoom(npc_target);
            if(npcToTalkTo) {
                if (npcToTalkTo.useAI) {
                    await handleAiNpcInteraction(npcToTalkTo, 'talk', currentRoom);
                } else {
                    lastNpcInteraction = null;
                    if (npcToTalkTo.dialogue && npcToTalkTo.dialogue.length > 0) {
                        const randomLine = npcToTalkTo.dialogue[Math.floor(Math.random() * npcToTalkTo.dialogue.length)];
                        logToTerminal(`${npcToTalkTo.shortName || npcToTalkTo.name} says, "${randomLine}"`, 'npc');
                    } else {
                        logToTerminal(`${npcToTalkTo.shortName || npcToTalkTo.name} doesn't seem to have much to say.`, 'game');
                    }
                }
            } else {
                logToTerminal("There's no one here by that name.", 'error');
            }
            break;
        case 'ask_npc':
            const npcToAsk = findNpcInRoom(npc_target);
            if (npcToAsk) {
                if (npcToAsk.useAI) {
                    await handleAiNpcInteraction(npcToAsk, 'ask_npc', currentRoom, topic);
                } else {
                    lastNpcInteraction = null;
                    logToTerminal(`${npcToAsk.shortName || npcToAsk.name} doesn't seem to have an answer for that.`, 'game');
                }
            } else {
                logToTerminal("There is no one here by that name to ask.", 'error');
            }
            break;
        case 'reply_npc':
            const lastNpc = gameNpcs[lastNpcInteraction];
            if (lastNpc) {
                 const npcData = { id: lastNpcInteraction, ...lastNpc };
                 await handleAiNpcInteraction(npcData, 'reply', currentRoom, originalText);
            } else {
                 logToTerminal("You're not talking to anyone right now.", "error");
            }
            break;
        case 'who':
            logToTerminal("--- Adventurers Online ---", 'system');
            Object.values(gamePlayers).forEach(player => logToTerminal(player.name, 'game'));
            break;
        case 'ask_dm':
            if (originalText) {
                const question = originalText.substring(originalText.indexOf(' ')).trim();
                logToTerminal("You pose your question to the unseen forces of the realm...", "system");
                const prompt = `You are a creative Dungeon Master... A player is in a room called "${currentRoom.name}"... They ask you: "${question}". Respond creatively and in-character. Keep it brief.`;
                const answer = await callGeminiForText(prompt);
                logToTerminal(answer, "dm");
            } else { logToTerminal("Ask what?", "error"); }
            break;
        case 'score':
            const pDocScore = await getDoc(playerRef);
            const pData = pDocScore.data();
            const level = pData.level || 1;
            const score = pData.score || 0;
            const money = pData.money || 0;
            const nextLevelScore = level * 100;
            logToTerminal("--- Player Status ---", 'system');
            logToTerminal(`Level: ${level}`, 'game');
            logToTerminal(`Experience: ${score} / ${nextLevelScore}`, 'game');
            logToTerminal(`Gold: ${money}`, 'game');
            logToTerminal(`${nextLevelScore - score} XP to next level.`, 'game');
            break;
        case 'stats':
            const pDocStats = await getDoc(playerRef);
            const pDataStats = pDocStats.data();
            if (pDataStats && pDataStats.attributes) {
                logToTerminal("--- Your Attributes ---", 'system');
                Object.entries(pDataStats.attributes).forEach(([key, value]) => {
                     logToTerminal(`${key.toUpperCase()}: ${value}`, 'game');
                });
            } else { logToTerminal("You have no attributes to display.", 'error'); }
            break;
        case 'help':
            logToTerminal("--- Help ---", "system");
            logToTerminal("You can now type commands in natural language!", "system");
            logToTerminal("After talking to an AI character, you can reply just by typing.", "system");
            logToTerminal("Core commands: look, go, get, drop, inventory, examine, talk to, ask...about, buy...from, attack, who, say, score, stats, logout.", "system");
            break;
        default:
            logToTerminal("I don't understand that. Type 'help' for ideas.", "error");
    }
}

function setupMessageListener() {
     const unsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-messages`), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const msg = change.doc.data();
                if (msg.roomId === currentPlayerRoomId && msg.timestamp) {
                    const sender = msg.senderId === userId ? "You" : `<span class="text-fuchsia-400">${msg.senderName}</span>`;
                    const verb = msg.senderId === userId ? "say" : "says";
                    logToTerminal(`${sender} ${verb}, "${msg.text}"`, 'chat');
                }
            }
        });
    });
    unsubscribers.push(unsub);
}

function cleanupListeners() {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
}

async function main() {
     try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        onAuthStateChanged(auth, async user => {
            if (user) {
                if (isGameInitialized) return;
                isGameInitialized = true;
                userId = user.uid;

                const worldReady = await initializeGameData();
                if (!worldReady) {
                    logToTerminal("Failed to initialize the game world. Please reload.", "error");
                    return;
                }
                
                const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
                const playerDoc = await getDoc(playerRef);

                if (playerDoc.exists()) {
                    const playerData = playerDoc.data();
                    playerName = playerData.name;
                    if (playerData.isAdmin) adminToggleBtn.classList.remove('hidden');
                    
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-rooms`), (s) => { gameWorld = {}; s.forEach(d => gameWorld[d.id] = d.data()); populateRoomSelector(); }));
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-items`), (s) => { gameItems = {}; s.forEach(d => gameItems[d.id] = d.data()); populateItemSelector(); populateRoomItemsSelector(); populateNpcSellsSelector(); populateMonsterItemDropSelector(); }));
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-npcs`), (s) => { gameNpcs = {}; s.forEach(d => gameNpcs[d.id] = d.data()); populateNpcSelector(); populateRoomNpcsSelector(); }));
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-monsters`), (s) => { gameMonsters = {}; s.forEach(d => gameMonsters[d.id] = d.data()); populateMonsterSelector(); populateRoomMonsterSelector(); }));
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-active-monsters`), (s) => { activeMonsters = {}; s.forEach(d => activeMonsters[d.id] = d.data()); }));
                    unsubscribers.push(onSnapshot(collection(db, `/artifacts/${appId}/public/data/mud-players`), (s) => { gamePlayers = {}; s.forEach(d => gamePlayers[d.id] = d.data()); populatePlayerSelector(); }));
                    
                    authModal.style.display = 'none';
                    appContainer.classList.remove('hidden');
                    appContainer.classList.add('flex');
                    startGame();
                } else {
                     await signOut(auth);
                }
            } else {
                isGameInitialized = false;
                cleanupListeners();
                authModal.style.display = 'flex';
                appContainer.classList.add('hidden');
                appContainer.classList.remove('flex');
                adminToggleBtn.classList.add('hidden');
                output.innerHTML = '';
            }
        });
    } catch (e) { 
        console.error("Firebase init error:", e); 
        logToTerminal("A critical error occurred during initialization. Please reload the page.", "error");
    }
}

async function startGame() {
    logToTerminal(`Welcome to the Digital Realm, ${playerName}.`, 'system');
    
    const playerUnsub = onSnapshot(doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`), (doc) => {
        if (doc.exists()) {
            const playerData = doc.data();
            if(playerData) {
                const maxHp = 50 + ((playerData.attributes.con - 10) * 5);
                if (!playerData.maxHp || playerData.maxHp !== maxHp) {
                    updateDoc(doc.ref, {maxHp: maxHp, currentHp: maxHp});
                }
                const currentHp = playerData.currentHp === undefined ? maxHp : playerData.currentHp;
                userInfo.textContent = `User: ${playerData.name} | HP: ${currentHp}/${maxHp} | Lvl: ${playerData.level || 1} | Gold: ${playerData.money || 0}`;
                if (playerData.roomId !== currentPlayerRoomId) {
                   showRoom(playerData.roomId);
                }
            }
        }
    });
    unsubscribers.push(playerUnsub);
    setupMessageListener();
}

document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authError.textContent = '';
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authError.textContent = '';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error.message);
        authError.textContent = "Failed to login. Please check your credentials.";
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    authError.textContent = '';

    if (!name) {
        authError.textContent = "Character name is required.";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        const playersSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-players`));
        const isAdmin = playersSnapshot.empty;
        const newAttributes = generateAttributes();
        const maxHp = 50 + ((newAttributes.con - 10) * 5);

        await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${newUser.uid}`), {
            name: name, roomId: "start", inventory: [],
            isAdmin: isAdmin, lastSeen: serverTimestamp(),
            level: 1, score: 0, visitedRooms: ["start"],
            attributes: newAttributes,
            money: 100,
            maxHp: maxHp,
            currentHp: maxHp
        });
    } catch (error) {
         console.error("Registration Error:", error.message);
        if (error.code === 'auth/email-already-in-use') {
            authError.textContent = "This email is already registered.";
        } else {
            authError.textContent = "Registration failed. Please try again.";
        }
    }
});

input.addEventListener('keydown', async (e) => {
     if (e.key === 'Enter') { 
        const cmdText = input.value.trim();
        if (cmdText) {
            input.value = '';
            input.disabled = true;
            logToTerminal(`> ${cmdText}`, 'chat');
            
            let parsedCommand = await parseCommandWithGemini(cmdText);
            
            if (parsedCommand.action === 'unknown' && lastNpcInteraction) {
                parsedCommand = { action: 'reply_npc' };
            }
            
            await executeParsedCommand(parsedCommand, cmdText);
            input.disabled = false;
            input.focus();
        }
    } 
});

// --- ADMIN PANEL LOGIC ---
const adminTabs = document.querySelectorAll('.admin-tab');
const adminTabPanels = {
    'room-tab-btn': document.getElementById('room-editor-panel'),
    'item-tab-btn': document.getElementById('item-editor-panel'),
    'npc-tab-btn': document.getElementById('npc-editor-panel'),
    'monster-tab-btn': document.getElementById('monster-editor-panel'),
    'player-tab-btn': document.getElementById('player-editor-panel'),
};

adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.values(adminTabPanels).forEach(p => p.classList.add('hidden'));
        adminTabPanels[tab.id].classList.remove('hidden');
    });
});

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
        div.innerHTML = `<label><input type="checkbox" class="room-npc-checkbox" value="${id}" ${isChecked ? 'checked' : ''}> ${npc?.name || 'Unnamed NPC'} (${id})</label>`;
        roomNpcsSelector.appendChild(div);
    });
}

function populateRoomMonsterSelector() {
    const currentRoomId = roomSelect.value;
    const room = currentRoomId ? gameWorld[currentRoomId] : null;
    roomMonstersSelector.innerHTML = '';
    
    const monsterSpawns = room?.monsterSpawns || [];

    Object.keys(gameMonsters).sort().forEach(id => {
         const monster = gameMonsters[id];
         const spawnData = monsterSpawns.find(s => s.monsterId === id);
         const div = document.createElement('div');
         div.className = "flex gap-2 items-center mb-1";
         div.innerHTML = `
            <label class="flex-grow"><input type="checkbox" class="room-monster-checkbox" value="${id}" ${spawnData ? 'checked' : ''}> ${monster.name}</label>
            <input type="number" class="admin-input w-24 room-monster-respawn" value="${spawnData?.respawnTime || 60}" ${!spawnData ? 'disabled' : ''}>
            <span class="text-sm">sec</span>
         `;
         roomMonstersSelector.appendChild(div);
    });

    roomMonstersSelector.addEventListener('change', (e) => {
        if(e.target.classList.contains('room-monster-checkbox')) {
            const respawnInput = e.target.closest('div').querySelector('.room-monster-respawn');
            respawnInput.disabled = !e.target.checked;
        }
    });
}

generateDescBtn.addEventListener('click', async () => {
    const keywords = roomDescKeywordsInput.value.trim();
    if(!keywords) { adminRoomStatus.textContent = "Please provide keywords."; return; }
    generateDescBtn.textContent = 'Generating...';
    generateDescBtn.disabled = true;
    const prompt = `Generate a vivid, atmospheric description for a fantasy MUD room. Keywords: ${keywords}. Keep it under 50 words. Be evocative.`;
    const description = await callGeminiForText(prompt);
    roomDescInput.value = description.replace(/"/g, ''); 
    generateDescBtn.textContent = 'Generate with AI ✨';
    generateDescBtn.disabled = false;
});

document.getElementById('save-room-btn').addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) { adminRoomStatus.textContent = 'Error: Room ID is required.'; return; }
    
    const selectedItemIds = Array.from(document.querySelectorAll('.room-item-checkbox:checked')).map(cb => cb.value);
    const selectedNpcIds = Array.from(document.querySelectorAll('.room-npc-checkbox:checked')).map(cb => cb.value);
    
    const monsterSpawns = [];
    document.querySelectorAll('.room-monster-checkbox:checked').forEach(cb => {
        const monsterId = cb.value;
        const respawnTime = parseInt(cb.closest('div').querySelector('.room-monster-respawn').value, 10) || 60;
        monsterSpawns.push({ monsterId, respawnTime });
    });
    
    let exits, details;
    try { exits = JSON.parse(roomExitsInput.value || '{}'); } catch (e) { adminRoomStatus.textContent = 'Error: Invalid JSON in Exits field.'; return; }
    try { details = JSON.parse(roomDetailsInput.value || '{}'); } catch (e) { adminRoomStatus.textContent = 'Error: Invalid JSON in Details field.'; return; }
    
    try {
        const roomData = {
            name: roomNameInput.value.trim(), description: roomDescInput.value.trim(),
            exits: exits, items: selectedItemIds, npcs: selectedNpcIds, monsterSpawns: monsterSpawns, details: details
        };
        await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`), roomData);
        adminRoomStatus.textContent = `Room '${roomId}' saved successfully!`;
    } catch (e) { adminRoomStatus.textContent = 'An unexpected error occurred while saving.'; console.error("Save room error:", e); }
});

document.getElementById('delete-room-btn').addEventListener('click', async () => {
    const roomId = roomSelect.value;
    if (roomId && roomId !== 'start') {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-rooms/${roomId}`));
        adminRoomStatus.textContent = `Room '${roomId}' deleted.`;
        clearAdminRoomForm();
    } else {
        adminRoomStatus.textContent = "Cannot delete the selected room (or it's the start room).";
    }
});

// Item Editor Elements & Logic
const itemSelect = document.getElementById('item-select');
const itemIdInput = document.getElementById('item-id');
const itemNameInput = document.getElementById('item-name');
const itemCostInput = document.getElementById('item-cost');
const itemMovableCheckbox = document.getElementById('item-movable');
const adminItemStatus = document.getElementById('admin-item-status');

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
    itemIdInput.value = ''; itemNameInput.value = ''; 
    itemCostInput.value = 0;
    itemMovableCheckbox.checked = true; itemSelect.value = '';
    itemIdInput.disabled = false;
}

document.getElementById('new-item-btn').addEventListener('click', clearAdminItemForm);

itemSelect.addEventListener('change', () => {
    const itemId = itemSelect.value;
    if (itemId && gameItems[itemId]) {
        const item = gameItems[itemId];
        itemIdInput.value = itemId; itemIdInput.disabled = true;
        itemNameInput.value = item.name;
        itemCostInput.value = item.cost || 0;
        itemMovableCheckbox.checked = item.movable !== false;
    } else {
        clearAdminItemForm();
    }
});

document.getElementById('save-item-btn').addEventListener('click', async () => {
    const itemId = itemIdInput.value.trim();
    if (!itemId) { adminItemStatus.textContent = 'Error: Item ID is required.'; return; }
    const itemData = { 
        name: itemNameInput.value.trim(), 
        movable: itemMovableCheckbox.checked,
        cost: parseInt(itemCostInput.value, 10) || 0
    };
    await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${itemId}`), itemData);
    adminItemStatus.textContent = `Item '${itemId}' saved.`;
});

 document.getElementById('delete-item-btn').addEventListener('click', async () => {
    const itemId = itemSelect.value;
    if (itemId) {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-items/${itemId}`));
        adminItemStatus.textContent = `Item '${itemId}' deleted.`;
        clearAdminItemForm();
    } else { adminItemStatus.textContent = "No item selected to delete."; }
});

// NPC Editor Elements & Logic
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
const adminNpcStatus = document.getElementById('admin-npc-status');

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

function populateNpcSellsSelector() {
    const currentNpcId = npcSelect.value;
    const npc = currentNpcId ? gameNpcs[currentNpcId] : null;

    npcSellsSelector.innerHTML = '';
    const sortedItemIds = Object.keys(gameItems).filter(id => gameItems[id].cost > 0).sort();
     if (sortedItemIds.length === 0) {
        npcSellsSelector.innerHTML = '<p class="text-gray-400">No purchasable items created yet.</p>';
        return;
    }
     sortedItemIds.forEach(id => {
        const item = gameItems[id];
        const isChecked = npc?.sells?.includes(id) ?? false;
        const div = document.createElement('div');
        div.innerHTML = `<label><input type="checkbox" class="npc-sells-checkbox" value="${id}" ${isChecked ? 'checked' : ''}> ${item.name} (${item.cost}g)</label>`;
        npcSellsSelector.appendChild(div);
    });
}


function clearAdminNpcForm() {
    npcIdInput.value = ''; npcNameInput.value = ''; npcDescInput.value = ''; 
    npcDialogueInput.value = ''; npcSelect.value = ''; npcShortNameInput.value = '';
    npcTriggersInput.value = '{}';
    npcAiEnabledCheckbox.checked = false;
    npcIdInput.disabled = false;
    npcDialogueLabel.textContent = 'Dialogue (one line per response)';
    populateNpcSellsSelector();
}

npcAiEnabledCheckbox.addEventListener('change', () => {
    if (npcAiEnabledCheckbox.checked) {
        npcDialogueLabel.textContent = 'AI Personality Prompt';
    } else {
        npcDialogueLabel.textContent = 'Dialogue (one line per response)';
    }
});

document.getElementById('new-npc-btn').addEventListener('click', clearAdminNpcForm);

npcSelect.addEventListener('change', () => {
    const npcId = npcSelect.value;
    if (npcId && gameNpcs[npcId]) {
        const npc = gameNpcs[npcId];
        npcIdInput.value = npcId; npcIdInput.disabled = true;
        npcShortNameInput.value = npc.shortName || '';
        npcNameInput.value = npc.name;
        npcDescInput.value = npc.description;
        npcAiEnabledCheckbox.checked = npc.useAI || false;
        npcAiEnabledCheckbox.dispatchEvent(new Event('change'));
        npcDialogueInput.value = (npc.dialogue || []).join('\n');
        npcTriggersInput.value = JSON.stringify(npc.triggers || {}, null, 2);
        populateNpcSellsSelector();
    } else {
        clearAdminNpcForm();
    }
});

document.getElementById('save-npc-btn').addEventListener('click', async () => {
    const npcId = npcIdInput.value.trim();
    if (!npcId) { adminNpcStatus.textContent = 'Error: NPC ID is required.'; return; }
    
    let triggers;
    try {
        triggers = JSON.parse(npcTriggersInput.value || '{}');
    } catch (e) {
        adminNpcStatus.textContent = 'Error: Invalid JSON in Item Triggers.';
        return;
    }
    
    const soldItemIds = Array.from(document.querySelectorAll('.npc-sells-checkbox:checked')).map(cb => cb.value);

    const dialogueLines = npcDialogueInput.value.split('\n').filter(line => line.trim() !== '');
    const npcData = { 
        shortName: npcShortNameInput.value.trim(),
        name: npcNameInput.value.trim(), 
        description: npcDescInput.value.trim(),
        dialogue: dialogueLines,
        useAI: npcAiEnabledCheckbox.checked,
        triggers: triggers,
        sells: soldItemIds
    };
    await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${npcId}`), npcData);
    adminNpcStatus.textContent = `NPC '${npcId}' saved.`;
});

 document.getElementById('delete-npc-btn').addEventListener('click', async () => {
    const npcId = npcSelect.value;
    if (npcId) {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-npcs/${npcId}`));
        adminNpcStatus.textContent = `NPC '${npcId}' deleted.`;
        clearAdminNpcForm();
    } else { adminNpcStatus.textContent = "No NPC selected to delete."; }
});

// Monster Editor Elements & Logic
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
const adminMonsterStatus = document.getElementById('admin-monster-status');

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

function populateMonsterItemDropSelector() {
    const currentVal = monsterItemDropSelect.value;
    monsterItemDropSelect.innerHTML = '<option value="">-- None --</option>';
    const sortedItemIds = Object.keys(gameItems).sort();
    sortedItemIds.forEach(id => {
        const item = gameItems[id];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${item?.name || 'Unnamed Item'} (${id})`;
        monsterItemDropSelect.appendChild(option);
    });
    if(currentVal) monsterItemDropSelect.value = currentVal;
}

function clearAdminMonsterForm() {
    monsterIdInput.value = ''; monsterIdInput.disabled = false;
    monsterNameInput.value = ''; monsterDescInput.value = '';
    monsterHpInput.value = 10; monsterMinAtkInput.value = 1; monsterMaxAtkInput.value = 3;
    monsterXpInput.value = 10; monsterGoldInput.value = 5; monsterItemDropSelect.value = '';
    monsterSelect.value = '';
}

document.getElementById('new-monster-btn').addEventListener('click', clearAdminMonsterForm);

monsterSelect.addEventListener('change', () => {
    const monsterId = monsterSelect.value;
    if (monsterId && gameMonsters[monsterId]) {
        const monster = gameMonsters[monsterId];
        monsterIdInput.value = monsterId; monsterIdInput.disabled = true;
        monsterNameInput.value = monster.name; monsterDescInput.value = monster.description;
        monsterHpInput.value = monster.hp; monsterMinAtkInput.value = monster.minAtk; monsterMaxAtkInput.value = monster.maxAtk;
        monsterXpInput.value = monster.xp; monsterGoldInput.value = monster.gold;
        monsterItemDropSelect.value = monster.itemDrop || '';
    } else {
        clearAdminMonsterForm();
    }
});

document.getElementById('save-monster-btn').addEventListener('click', async () => {
    const monsterId = monsterIdInput.value.trim();
    if (!monsterId) { adminMonsterStatus.textContent = 'Error: Monster ID is required.'; return; }
    const monsterData = {
        name: monsterNameInput.value,
        description: monsterDescInput.value,
        hp: parseInt(monsterHpInput.value, 10),
        minAtk: parseInt(monsterMinAtkInput.value, 10),
        maxAtk: parseInt(monsterMaxAtkInput.value, 10),
        xp: parseInt(monsterXpInput.value, 10),
        gold: parseInt(monsterGoldInput.value, 10),
        itemDrop: monsterItemDropSelect.value
    };
    await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${monsterId}`), monsterData);
    adminMonsterStatus.textContent = `Monster '${monsterId}' saved.`;
});

document.getElementById('delete-monster-btn').addEventListener('click', async () => {
    const monsterId = monsterSelect.value;
    if (monsterId) {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-monsters/${monsterId}`));
        adminMonsterStatus.textContent = `Monster '${monsterId}' deleted.`;
        clearAdminMonsterForm();
    } else {
        adminMonsterStatus.textContent = 'No monster selected to delete.';
    }
});

// Player Editor Elements & Logic
const playerSelect = document.getElementById('player-select');
const playerEditForm = document.getElementById('player-edit-form');
const adminPlayerStatus = document.getElementById('admin-player-status');

const playerNameEdit = document.getElementById('player-name-edit');
const playerLevelEdit = document.getElementById('player-level-edit');
const playerScoreEdit = document.getElementById('player-score-edit');
const playerMoneyEdit = document.getElementById('player-money-edit');
const playerRoomEdit = document.getElementById('player-room-edit');
const playerAdminEdit = document.getElementById('player-admin-edit');
const attrInputs = {
    str: document.getElementById('player-str-edit'),
    dex: document.getElementById('player-dex-edit'),
    con: document.getElementById('player-con-edit'),
    int: document.getElementById('player-int-edit'),
    wis: document.getElementById('player-wis-edit'),
    cha: document.getElementById('player-cha-edit'),
};

function populatePlayerSelector() {
     const currentVal = playerSelect.value;
     playerSelect.innerHTML = '<option value="">-- Select Player --</option>';
     Object.keys(gamePlayers).forEach(id => {
        const player = gamePlayers[id];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${player?.name || 'Unnamed Player'} (ID: ${id.substring(0,6)}...)`;
        playerSelect.appendChild(option);
    });
    if (currentVal) playerSelect.value = currentVal;
}

playerSelect.addEventListener('change', () => {
    const selectedPlayerId = playerSelect.value;
    if (selectedPlayerId && gamePlayers[selectedPlayerId]) {
        const player = gamePlayers[selectedPlayerId];
        playerNameEdit.value = player.name || '';
        playerLevelEdit.value = player.level || 1;
        playerScoreEdit.value = player.score || 0;
        playerMoneyEdit.value = player.money || 0;
        playerRoomEdit.value = player.roomId || 'start';
        playerAdminEdit.checked = player.isAdmin || false;
        
        if (player.attributes) {
            for(const [key, input] of Object.entries(attrInputs)) {
                input.value = player.attributes[key] || 0;
            }
        }
        playerEditForm.classList.remove('hidden');
    } else {
         playerEditForm.classList.add('hidden');
    }
});

document.getElementById('save-player-btn').addEventListener('click', async () => {
    const selectedPlayerId = playerSelect.value;
    if (!selectedPlayerId) {
        adminPlayerStatus.textContent = "No player selected.";
        return;
    }

    try {
        const updatedAttributes = {};
        for(const [key, input] of Object.entries(attrInputs)) {
            updatedAttributes[key] = parseInt(input.value, 10) || 0;
        }

        const playerData = {
            name: playerNameEdit.value,
            level: parseInt(playerLevelEdit.value, 10),
            score: parseInt(playerScoreEdit.value, 10),
            money: parseInt(playerMoneyEdit.value, 10),
            roomId: playerRoomEdit.value,
            isAdmin: playerAdminEdit.checked,
            attributes: updatedAttributes
        };

        await updateDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${selectedPlayerId}`), playerData);
        adminPlayerStatus.textContent = `Player '${playerData.name}' saved successfully!`;
    } catch (e) {
        adminPlayerStatus.textContent = 'Error saving player data.';
        console.error("Save Player Error:", e);
    }
});

document.getElementById('delete-player-btn').addEventListener('click', async () => {
    const selectedPlayerId = playerSelect.value;
    if (selectedPlayerId) {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${selectedPlayerId}`));
        adminPlayerStatus.textContent = `Player deleted.`;
        playerEditForm.classList.add('hidden');
    }
});

adminToggleBtn.addEventListener('click', () => { appContainer.classList.toggle('hidden'); adminPanel.classList.toggle('hidden'); adminPanel.classList.toggle('flex');});

main();
</script>