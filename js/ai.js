// AI Functions Module
// Handles all Gemini AI interactions

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_API_BASE } from './config.js';

/**
 * Call Gemini AI for general text generation
 * @param {string} prompt - The prompt to send to the AI
 * @param {Function} logToTerminal - Terminal logging function
 * @returns {Promise<string>} - AI response text
 */
export async function callGeminiForText(prompt, logToTerminal) {
    if (GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
        logToTerminal("AI features are disabled. Please add your Google Cloud API key to the script file.", "error");
        return "The AI is offline.";
    }
    
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API error details:", errorData);
            logToTerminal(`AI Error: ${errorData.error?.message || response.status}`, "error");
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Gemini API response:", result);
        
        const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiText) {
            console.error("No text in AI response:", result);
            logToTerminal("AI returned an empty response.", "error");
            return "The AI is pondering...";
        }
        
        return aiText;
    } catch (error) {
        console.error("Gemini text API error:", error);
        logToTerminal("AI is having trouble responding. Check console for details.", "error");
        return "The AI is silent for now.";
    }
}

/**
 * Parse natural language command into structured format
 * @param {string} command - User's natural language command
 * @param {Function} logToTerminal - Terminal logging function
 * @returns {Promise<Object>} - Parsed command object
 */
export async function parseCommandWithGemini(command, logToTerminal) {
    if (GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
        return { action: "unknown" };
    }
    
    // Pre-process direction shortcuts before sending to Gemini
    const directionMap = {
        'n': 'north',
        's': 'south',
        'e': 'east',
        'w': 'west',
        'ne': 'northeast',
        'nw': 'northwest',
        'se': 'southeast',
        'sw': 'southwest',
        'u': 'up',
        'd': 'down'
    };
    
    // Check if command is a single direction shortcut
    const lowerCmd = command.toLowerCase().trim();
    if (directionMap[lowerCmd]) {
        console.log(`[Command Parser] Direction shortcut detected: "${command}" -> "go ${directionMap[lowerCmd]}"`);
        return { action: "go", target: directionMap[lowerCmd] };
    }
    
    // Check if command is a full direction word
    const fullDirections = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'];
    if (fullDirections.includes(lowerCmd)) {
        console.log(`[Command Parser] Direction detected: "${command}" -> "go ${lowerCmd}"`);
        return { action: "go", target: lowerCmd };
    }
    
    // Pre-process common trading commands
    console.log(`[Command Parser] Testing command: "${lowerCmd}"`);
    
    const sellMatch = lowerCmd.match(/^(?:sell|vendor)\s+(.+?)\s+(?:to|from)\s+(.+)$/);
    if (sellMatch) {
        console.log(`[Command Parser] Sell command detected: "${command}" -> item: "${sellMatch[1]}", npc: "${sellMatch[2]}"`);
        return { action: "sell", target: sellMatch[1], npc_target: sellMatch[2] };
    }
    
    const buyMatch = lowerCmd.match(/^(?:buy|purchase)\s+(.+?)\s+(?:from|at)\s+(.+)$/);
    if (buyMatch) {
        console.log(`[Command Parser] Buy command detected: "${command}" -> item: "${buyMatch[1]}", npc: "${buyMatch[2]}"`);
        return { action: "buy", target: buyMatch[1], npc_target: buyMatch[2] };
    }
    
    // Haggle formats - order matters, most specific first:
    // "haggle torch for 5 from frank" - with "for" before price
    // "haggle torch 5 from frank" - standard format
    // "haggle torch 5 frank" - no preposition
    // "haggle for torch from frank" - no price
    
    // Try: "haggle <item> for <price> from/with <npc>"
    const haggleForMatch = lowerCmd.match(/^(?:haggle|negotiate|barter)\s+(\w+(?:\s+\w+)?)\s+for\s+(\d+)\s+(?:from|with)\s+(.+)$/);
    if (haggleForMatch) {
        console.log(`[Command Parser] Haggle (with 'for') detected: "${command}"`);
        return { action: "haggle", target: haggleForMatch[1], topic: haggleForMatch[2], npc_target: haggleForMatch[3] };
    }
    
    // Try: "haggle <item> <price> from/with <npc>"
    const haggleWithPriceMatch = lowerCmd.match(/^(?:haggle|negotiate|barter)\s+(\w+(?:\s+\w+)?)\s+(\d+)\s+(?:from|with)\s+(.+)$/);
    if (haggleWithPriceMatch) {
        console.log(`[Command Parser] Haggle with price detected: "${command}"`);
        return { action: "haggle", target: haggleWithPriceMatch[1], topic: haggleWithPriceMatch[2], npc_target: haggleWithPriceMatch[3] };
    }
    
    // Try: "haggle <item> <price> <npc>" (no preposition)
    const haggleSimpleMatch = lowerCmd.match(/^(?:haggle|negotiate|barter)\s+(\w+(?:\s+\w+)?)\s+(\d+)\s+(.+)$/);
    if (haggleSimpleMatch) {
        console.log(`[Command Parser] Haggle (simple) detected: "${command}"`);
        return { action: "haggle", target: haggleSimpleMatch[1], topic: haggleSimpleMatch[2], npc_target: haggleSimpleMatch[3] };
    }
    
    // Try: "haggle for <item> from/with <npc>" (no price)
    const haggleMatch = lowerCmd.match(/^(?:haggle|negotiate|barter)\s+(?:for\s+)?(\w+(?:\s+\w+)?)\s+(?:from|with)\s+(.+)$/);
    if (haggleMatch) {
        console.log(`[Command Parser] Haggle command detected: "${command}"`);
        return { action: "haggle", target: haggleMatch[1], npc_target: haggleMatch[2] };
    }
    
    const giveMatch = lowerCmd.match(/^give\s+(.+?)\s+to\s+(.+)$/);
    if (giveMatch) {
        console.log(`[Command Parser] Give command detected: "${command}"`);
        return { action: "give", target: giveMatch[1], npc_target: giveMatch[2] };
    }
    
    const tradeMatch = lowerCmd.match(/^(?:trade|swap)\s+(?:with\s+)?(.+)$/);
    if (tradeMatch) {
        console.log(`[Command Parser] Trade command detected: "${command}"`);
        return { action: "trade", npc_target: tradeMatch[1] };
    }
    
    const listMatch = lowerCmd.match(/^(?:list|show|display|view)\s+(?:inventory\s+)?(?:from\s+)?(.+)$/);
    if (listMatch) {
        console.log(`[Command Parser] List command detected: "${command}" -> npc: "${listMatch[1]}"`);
        return { action: "list", target: listMatch[1] };
    }
    
    const appraiseMatch = lowerCmd.match(/^(?:appraise|value|price|worth)\s+(.+)$/);
    if (appraiseMatch) {
        console.log(`[Command Parser] Appraise command detected: "${command}" -> item: "${appraiseMatch[1]}"`);
        return { action: "appraise", target: appraiseMatch[1] };
    }
    
    const reputationMatch = lowerCmd.match(/^(?:reputation|rep|standing)\s+(?:with\s+)?(.+)$/);
    if (reputationMatch) {
        console.log(`[Command Parser] Reputation command detected: "${command}" -> npc: "${reputationMatch[1]}"`);
        return { action: "reputation", npc_target: reputationMatch[1] };
    }
    
    console.log(`[Command Parser] No pre-processor match, sending to Gemini...`);
    
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are a text adventure game command parser. Parse this command into JSON format.

User command: "${command}"

Rules:
- The action must be one of: "go", "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest", "up", "down", "n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d", "get", "drop", "examine", "say", "buy", "sell", "haggle", "give", "trade", "attack", "ask_dm", "talk", "ask_npc", "look", "inventory", "who", "score", "stats", "help", "logout", "use", "unlock", "lock", "drink", "consume", "eat", "read", "write", "cast", "spells", "spell", "learn", "guild", "guilds", "gc", "quest", "quests", "party", "pc", "npcchats", "put", "take", "equip", "unequip", "wear", "wield", "remove", "equipment", "equipped", "unknown"
- For movement: "go north" -> {"action": "go", "target": "north"}
- For movement: "north" -> {"action": "north"}
- For movement: "n" -> {"action": "n"}
- For movement: "walk north" -> {"action": "go", "target": "north"}
- For movement: "head east" -> {"action": "go", "target": "east"}
- For movement: "move to the south" -> {"action": "go", "target": "south"}
- For movement: "I want to go west" -> {"action": "go", "target": "west"}
- For movement: "let's go upstairs" -> {"action": "go", "target": "up"}
- For movement: "climb down" -> {"action": "go", "target": "down"}
- For movement: "southeast" -> {"action": "southeast"}
- For movement: "se" -> {"action": "se"}
- For items: "get torch" -> {"action": "get", "target": "torch"}
- For items: "pick up the sword" -> {"action": "get", "target": "sword"}
- For items: "grab the key" -> {"action": "get", "target": "key"}
- For items: "take the iron" -> {"action": "get", "target": "iron"}
- For items: "I want to pick up the torch" -> {"action": "get", "target": "torch"}
- For dropping: "drop sword" -> {"action": "drop", "target": "sword"}
- For dropping: "put down the axe" -> {"action": "drop", "target": "axe"}
- For dropping: "leave the shield here" -> {"action": "drop", "target": "shield"}
- For examining: "look at the door" -> {"action": "examine", "target": "door"}
- For examining: "check out the painting" -> {"action": "examine", "target": "painting"}
- For examining: "inspect the chest" -> {"action": "examine", "target": "chest"}
- For examining: "what's that statue" -> {"action": "examine", "target": "statue"}
- For NPCs: "talk to guard" -> {"action": "talk", "npc_target": "guard"}
- For NPCs: "speak with the merchant" -> {"action": "talk", "npc_target": "merchant"}
- For NPCs: "chat with bob" -> {"action": "talk", "npc_target": "bob"}
- For NPCs: "I want to talk to the blacksmith" -> {"action": "talk", "npc_target": "blacksmith"}
- For buying: "buy beer from barman" -> {"action": "buy", "target": "beer", "npc_target": "barman"}
- For buying: "purchase a sword" -> {"action": "buy", "target": "sword"}
- For buying: "I'd like to buy the armor" -> {"action": "buy", "target": "armor"}
- For buying: "can I buy a potion from the alchemist" -> {"action": "buy", "target": "potion", "npc_target": "alchemist"}
- For selling: "sell ring to frank" -> {"action": "sell", "target": "ring", "npc_target": "frank"}
- For selling: "I want to sell my sword" -> {"action": "sell", "target": "sword"}
- For selling: "can I sell this axe" -> {"action": "sell", "target": "axe"}
- For haggling: "haggle sword 50 from merchant" -> {"action": "haggle", "target": "sword", "topic": "50", "npc_target": "merchant"}
- For haggling: "negotiate the price of the sword" -> {"action": "haggle", "target": "sword"}
- For haggling: "can you do better on the price" -> {"action": "haggle"}
- For giving: "give potion to bob" -> {"action": "give", "target": "potion", "npc_target": "bob"}
- For giving: "hand the key to the guard" -> {"action": "give", "target": "key", "npc_target": "guard"}
- For trading: "trade with alice" -> {"action": "trade", "npc_target": "alice"}
- For trading: "I want to trade with the merchant" -> {"action": "trade", "npc_target": "merchant"}
- For trading: "open trade window" -> {"action": "trade"}
- For asking: "ask man about cave" -> {"action": "ask_npc", "npc_target": "man", "topic": "cave"}
- For asking: "what does the guard know about dragons" -> {"action": "ask_npc", "npc_target": "guard", "topic": "dragons"}
- For asking: "hey merchant, tell me about quests" -> {"action": "ask_npc", "npc_target": "merchant", "topic": "quests"}
- For attacking: "kick goblin" -> {"action": "attack", "target": "goblin", "verb": "kick"}
- For attacking: "punch dragon" -> {"action": "attack", "target": "dragon", "verb": "punch"}
- For attacking: "slash troll" -> {"action": "attack", "target": "troll", "verb": "slash"}
- For attacking: "attack the orc" -> {"action": "attack", "target": "orc"}
- For attacking: "fight the wolf" -> {"action": "attack", "target": "wolf"}
- For attacking: "hit the skeleton" -> {"action": "attack", "target": "skeleton", "verb": "hit"}
- For attacking: "strike the monster" -> {"action": "attack", "target": "monster", "verb": "strike"}
- For attacking: "I want to fight the dragon" -> {"action": "attack", "target": "dragon"}
- For attacking: ALWAYS extract the combat verb and include it in the "verb" field (kick, punch, slash, stab, bite, headbutt, strike, hit, etc.)
- For consuming: "drink beer" -> {"action": "drink", "target": "beer"}
- For reading: "read scroll" -> {"action": "read", "target": "scroll"}
- For reading: "read sign" -> {"action": "read", "target": "sign"}
- For reading: "read the book" -> {"action": "read", "target": "book"}
- For reading: "what does the journal say" -> {"action": "read", "target": "journal"}
- For writing: "write book Hello world" -> {"action": "write", "target": "book", "topic": "Hello world"}
- For writing: "write in journal Today was a great day" -> {"action": "write", "target": "journal", "topic": "Today was a great day"}
- For writing: "I want to write something in the book" -> {"action": "write", "target": "book"}
- For writing: "scribe on scroll magic words here" -> {"action": "write", "target": "scroll", "topic": "magic words here"}
- For unlocking: "unlock door" -> {"action": "unlock", "target": "door"}
- For unlocking: "unlock north" -> {"action": "unlock", "target": "north"}
- For locking: "lock door" -> {"action": "lock", "target": "door"}
- For locking: "lock gate behind me" -> {"action": "lock", "target": "gate"}
- For containers: "put sword in backpack" -> {"action": "put", "target": "sword in backpack"}
- For containers: "store the axe in my bag" -> {"action": "put", "target": "axe in bag"}
- For containers: "place potion in chest" -> {"action": "put", "target": "potion in chest"}
- For containers: "take sword from backpack" -> {"action": "take", "target": "sword from backpack"}
- For containers: "get the key from the chest" -> {"action": "take", "target": "key from chest"}
- For containers: "retrieve my armor from the bag" -> {"action": "take", "target": "armor from bag"}
- For containers: "open backpack" -> {"action": "use", "target": "backpack"}
- For containers: "open the chest" -> {"action": "use", "target": "chest"}
- For containers: "check what's in my bag" -> {"action": "use", "target": "bag"}
- For using items: "use key" -> {"action": "use", "target": "key"}
- For using items: "use the potion" -> {"action": "use", "target": "potion"}
- For using items: "drink the water" -> {"action": "drink", "target": "water"}
- For using items: "eat the bread" -> {"action": "eat", "target": "bread"}
- For equipping: "equip sword" -> {"action": "equip", "target": "sword"}
- For equipping: "wear armor" -> {"action": "wear", "target": "armor"}
- For equipping: "wield axe" -> {"action": "wield", "target": "axe"}
- For equipping: "put on the helmet" -> {"action": "wear", "target": "helmet"}
- For equipping: "I want to equip my sword" -> {"action": "equip", "target": "sword"}
- For unequipping: "unequip sword" -> {"action": "unequip", "target": "sword"}
- For unequipping: "remove armor" -> {"action": "remove", "target": "armor"}
- For unequipping: "take off the boots" -> {"action": "remove", "target": "boots"}
- For unequipping: "stop wearing the shield" -> {"action": "unequip", "target": "shield"}
- For inventory: "inventory" -> {"action": "inventory"}
- For inventory: "what am I carrying" -> {"action": "inventory"}
- For inventory: "show my items" -> {"action": "inventory"}
- For inventory: "check my bag" -> {"action": "inventory"}
- For looking: "look" -> {"action": "look"}
- For looking: "look around" -> {"action": "look"}
- For looking: "where am I" -> {"action": "look"}
- For looking: "describe the room" -> {"action": "look"}
- For stats: "stats" -> {"action": "stats"}
- For stats: "score" -> {"action": "score"}
- For stats: "show my stats" -> {"action": "stats"}
- For stats: "how am I doing" -> {"action": "stats"}
- For stats: "character sheet" -> {"action": "stats"}
- For who: "who" -> {"action": "who"}
- For who: "who's online" -> {"action": "who"}
- For who: "show players" -> {"action": "who"}
- For who: "who else is here" -> {"action": "who"}
- For equipment list: "equipment" -> {"action": "equipment"}
- For equipment list: "what am I wearing" -> {"action": "equipment"}
- For equipment list: "show equipped items" -> {"action": "equipment"}
- For equipment list: "what do I have equipped" -> {"action": "equipment"}
- For spells: "cast fireball" -> {"action": "cast", "target": "fireball"}
- For spells: "cast fireball at goblin" -> {"action": "cast", "target": "fireball", "npc_target": "goblin"}
- For spells: "use fireball on the dragon" -> {"action": "cast", "target": "fireball", "npc_target": "dragon"}
- For learning: "learn fireball" -> {"action": "learn", "target": "fireball"}
- For learning: "study the fireball spell" -> {"action": "learn", "target": "fireball"}
- For spell list: "spells" -> {"action": "spells"}
- For spell list: "what spells do I know" -> {"action": "spells"}
- For spell list: "show my magic" -> {"action": "spells"}
- For guilds: "guild" -> {"action": "guild"}
- For guilds: "guild create Dragons" -> {"action": "guild", "target": "create", "npc_target": "Dragons"}
- For guilds: "guild invite John" -> {"action": "guild", "target": "invite", "npc_target": "John"}
- For guilds: "guild deposit 100" -> {"action": "guild", "target": "deposit", "npc_target": "100"}
- For guilds: "guild withdraw 50" -> {"action": "guild", "target": "withdraw", "npc_target": "50"}
- For guilds: "guild promote PlayerName" -> {"action": "guild", "target": "promote", "npc_target": "PlayerName"}
- For guilds: "guild demote PlayerName" -> {"action": "guild", "target": "demote", "npc_target": "PlayerName"}
- For guilds: "guild disband" -> {"action": "guild", "target": "disband"}
- For guilds: "guild disband confirm" -> {"action": "guild", "target": "disband", "npc_target": "confirm"}
- For guild chat: "gc Hello everyone" -> {"action": "gc", "target": "Hello everyone"}
- For quests: "quests" -> {"action": "quests"}
- For quests: "show me my quests" -> {"action": "quests"}
- For quests: "what quests do I have" -> {"action": "quests"}
- For quests: "quest accept dragon slayer" -> {"action": "quest", "target": "accept", "topic": "dragon slayer"}
- For quests: "accept quest dragon slayer" -> {"action": "quest", "target": "accept", "topic": "dragon slayer"}
- For quests: "accept the iron quest" -> {"action": "quest", "target": "accept", "topic": "iron"}
- For quests: "I want to accept the quest about iron" -> {"action": "quest", "target": "accept", "topic": "iron"}
- For quests: "take the quest" -> {"action": "quest", "target": "accept"}
- For quests: "quest abandon dragon slayer" -> {"action": "quest", "target": "abandon", "topic": "dragon slayer"}
- For quests: "abandon quest" -> {"action": "quest", "target": "abandon"}
- For quests: "drop the quest" -> {"action": "quest", "target": "abandon"}
- For quests: "quest progress" -> {"action": "quest", "target": "progress"}
- For quests: "how am I doing on my quests" -> {"action": "quest", "target": "progress"}
- For quests: "check quest progress" -> {"action": "quest", "target": "progress"}
- For quests: "quest log" -> {"action": "quest", "target": "log"}
- For parties: "party" -> {"action": "party"}
- For parties: "party create" -> {"action": "party", "target": "create"}
- For parties: "party invite John" -> {"action": "party", "target": "invite", "npc_target": "John"}
- For parties: "party join Sarah" -> {"action": "party", "target": "join", "npc_target": "Sarah"}
- For parties: "party leave" -> {"action": "party", "target": "leave"}
- For parties: "party kick PlayerName" -> {"action": "party", "target": "kick", "npc_target": "PlayerName"}
- For parties: "party list" -> {"action": "party", "target": "list"}
- For party chat: "pc Hello team" -> {"action": "pc", "target": "Hello team"}
- Accept synonyms and natural variations:
  - "purchase", "obtain", "acquire" = "buy"
  - "vendor", "vend" = "sell"
  - "barter", "negotiate", "bargain" = "haggle"
  - "offer", "swap", "exchange" = "trade"
  - "fight", "combat", "battle", "engage" = "attack"
  - "speak", "chat", "converse" = "talk"
  - "consume", "eat", "drink", "quaff" = "use"
  - "magic", "abilities" = "spells"
  - "missions", "tasks", "objectives" = "quests"
  - "group", "team", "squad" = "party"
  - "grab", "collect", "retrieve", "fetch" = "get"
  - "discard", "toss", "leave" = "drop"
  - "inspect", "study", "check", "view" = "examine"
  - "walk", "move", "travel", "head" = "go"
  - "bag", "pack", "inv", "items", "i" = "inventory"
  - "character", "sheet", "info", "status" = "stats"
- Be flexible with phrasing: understand "I want to...", "Can I...", "Let me...", "How do I...", etc.
- Extract the core action and targets even from conversational language

Respond with ONLY valid JSON in this exact format:
{"action": "...", "target": "...", "npc_target": "...", "topic": "...", "verb": "..."}

Omit fields that are not needed (except "verb" for attack actions). If unclear, use {"action": "unknown"}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
    };
    
    try {
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini parsing API error details:", errorData);
            logToTerminal(`AI Parser Error: ${errorData.error?.message || response.status}`, "error");
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Gemini parse response:", result);
        
        let jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            console.error("No text in parse response");
            return { action: "unknown" };
        }
        
        // Clean up markdown code blocks if present
        jsonText = cleanJsonResponse(jsonText);
        
        const parsed = JSON.parse(jsonText);
        console.log("Parsed command:", parsed);
        return parsed;
    } catch (error) {
        console.error("Gemini parsing error:", error);
        logToTerminal("AI command parser failed. Try simpler commands.", "error");
        return { action: "unknown" };
    }
}

/**
 * Generate a room using AI
 */
export async function callGeminiForRoom(prompt, existingRooms, existingItems, existingMonsters) {
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const fullPrompt = `You are a Dungeon Master for a text-based MUD game. Generate a new room based on this description: "${prompt}"

Available Resources:
- Existing Room IDs: ${JSON.stringify(existingRooms)}
- Existing Item IDs: ${JSON.stringify(existingItems)}
- Existing Monster IDs: ${JSON.stringify(existingMonsters)}

RULES:
1. Generate a unique, single-word, lowercase 'roomId' that is NOT in the existing rooms list
2. Create a descriptive 'name' and 'description' based on the prompt
3. The 'exits' object should link to ONE existing room ID using a direction key (north, south, east, west)
4. The 'items' array can contain 0-3 existing Item IDs (optional)
5. The 'monsterSpawns' array can contain 0-1 monster spawn with format: {"monsterId": "existingMonsterId", "respawnTime": 60}

Example JSON format:
{
  "roomId": "darkforest",
  "name": "Dark Forest",
  "description": "A mysterious forest shrouded in darkness...",
  "exits": {"south": "tavern"},
  "items": ["torch"],
  "monsterSpawns": [{"monsterId": "goblin", "respawnTime": 60}]
}

Respond with ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;
    
    return await callGeminiForEntity(apiUrl, fullPrompt, ['roomId', 'name', 'description']);
}

/**
 * Generate a monster using AI
 */
export async function callGeminiForMonster(prompt, existingMonsters, existingItems) {
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const fullPrompt = `You are a Dungeon Master for a text-based MUD game. Generate a new monster based on this description: "${prompt}"

Available Resources:
- Existing Monster IDs: ${JSON.stringify(existingMonsters)}
- Existing Item IDs: ${JSON.stringify(existingItems)}

RULES:
1. Generate a unique, single-word, lowercase 'monsterId' that is NOT in the existing monsters list
2. Create a descriptive 'name' (e.g., "a fierce dragon") and 'description' based on the prompt
3. Set balanced stats based on monster difficulty:
   - Weak monsters: hp=10-20, minAtk=1-2, maxAtk=3-5, xp=10-20, gold=5-10
   - Medium monsters: hp=30-50, minAtk=3-5, maxAtk=6-10, xp=30-50, gold=15-25
   - Strong monsters: hp=60-100, minAtk=5-10, maxAtk=11-20, xp=60-100, gold=30-50
4. The 'itemDrop' can be empty string "" or one existing Item ID (optional)

Example JSON format:
{
  "monsterId": "dragon",
  "name": "a fierce dragon",
  "description": "A massive scaled beast breathing fire and fury.",
  "hp": 80,
  "minAtk": 8,
  "maxAtk": 15,
  "xp": 75,
  "gold": 40,
  "itemDrop": ""
}

Respond with ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;
    
    return await callGeminiForEntity(apiUrl, fullPrompt, ['monsterId', 'name', 'description', 'hp']);
}

/**
 * Generate an item using AI
 */
export async function callGeminiForItem(prompt, existingItems) {
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const fullPrompt = `You are a Dungeon Master for a text-based MUD game. Generate a new item based on this description: "${prompt}"

Available Resources:
- Existing Item IDs: ${JSON.stringify(existingItems)}

RULES:
1. Generate a unique, single-word or hyphenated, lowercase 'itemId' that is NOT in the existing items list
2. Create a descriptive 'name' (e.g., "a rusty sword", "a healing potion") based on the prompt
3. Set appropriate 'cost' in gold:
   - Common items: 5-20 gold
   - Uncommon items: 25-75 gold
   - Rare items: 100-500 gold
   - Quest items: 0 gold (not for sale)
4. Set 'movable' to true for items that can be picked up, false for scenery/fixtures
5. Set 'consumable' to true for items that can be eaten/drunk/used once (food, potions, scrolls), false otherwise
6. Set 'hpRestore' (0-50) for healing items, or 0 for non-healing items
7. Set 'effect' to a short description of what happens when consumed (e.g., "refreshes you", "makes you feel stronger") or empty string

Example JSON format:
{
  "itemId": "healing-potion",
  "name": "a healing potion",
  "cost": 50,
  "movable": true,
  "consumable": true,
  "hpRestore": 30,
  "effect": "The magical liquid courses through your veins."
}

Respond with ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;
    
    return await callGeminiForEntity(apiUrl, fullPrompt, ['itemId', 'name']);
}

/**
 * Generate an NPC using AI
 */
export async function callGeminiForNpc(prompt, existingNpcs, existingItems) {
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const fullPrompt = `You are a Dungeon Master for a text-based MUD game. Generate a new NPC based on this description: "${prompt}"

Available Resources:
- Existing NPC IDs: ${JSON.stringify(existingNpcs)}
- Existing Item IDs: ${JSON.stringify(existingItems)}

RULES:
1. Generate a unique, single-word, lowercase 'npcId' that is NOT in the existing NPCs list
2. Create a 'shortName' (e.g., "Albert", "Gandalf") - capitalized proper name
3. Create a descriptive 'name' (e.g., "an old wizard", "a friendly merchant") based on the prompt
4. Write a 'description' that appears when examining the NPC
5. Set 'useAI' to true if the NPC should use AI dialogue, false for simple random responses
6. For 'dialogue':
   - If useAI=true: Write a personality prompt describing their character
   - If useAI=false: Provide 2-3 response lines separated by newlines
7. The 'sells' array can contain 0-5 existing Item IDs if they're a merchant
8. The 'triggers' object can be empty {} or contain keyword-to-itemId mappings for AI NPCs

Example JSON format (AI NPC):
{
  "npcId": "wizard",
  "shortName": "Merlin",
  "name": "a wise wizard",
  "description": "An ancient wizard with a long white beard and mystical robes.",
  "useAI": true,
  "dialogue": "You are Merlin, a wise and ancient wizard. You speak in riddles and offer cryptic advice.",
  "sells": ["magic-scroll"],
  "triggers": {"spell": "magic-scroll"}
}

Respond with ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;
    
    return await callGeminiForEntity(apiUrl, fullPrompt, ['npcId', 'name']);
}

/**
 * Generic entity generation helper
 */
async function callGeminiForEntity(apiUrl, fullPrompt, requiredFields) {
    const payload = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7 }
    };
    
    try {
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini entity API error:", errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Gemini entity response:", result);
        
        let jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            throw new Error("No text in AI response");
        }
        
        jsonText = cleanJsonResponse(jsonText);
        const parsed = JSON.parse(jsonText);
        console.log("Parsed entity data:", parsed);
        
        // Validate required fields
        for (const field of requiredFields) {
            if (!parsed[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        return parsed;
    } catch (error) {
        console.error("Entity generation error:", error);
        throw error;
    }
}

/**
 * Clean up JSON response by removing markdown code blocks
 */
function cleanJsonResponse(jsonText) {
    jsonText = jsonText.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
    }
    return jsonText.trim();
}
