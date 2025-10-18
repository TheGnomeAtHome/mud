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
    
    const apiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are a text adventure game command parser. Parse this command into JSON format.

User command: "${command}"

Rules:
- The action must be one of: "go", "get", "drop", "examine", "say", "buy", "attack", "ask_dm", "talk", "ask_npc", "look", "inventory", "who", "score", "stats", "help", "logout", "use", "drink", "consume", "eat", "read", "cast", "spells", "spell", "learn", "guild", "guilds", "gc", "unknown"
- For movement: "go north" -> {"action": "go", "target": "north"}
- For items: "get torch" -> {"action": "get", "target": "torch"}
- For NPCs: "talk to guard" -> {"action": "talk", "npc_target": "guard"}
- For buying: "buy beer from barman" -> {"action": "buy", "target": "beer", "npc_target": "barman"}
- For asking: "ask man about cave" -> {"action": "ask_npc", "npc_target": "man", "topic": "cave"}
- For attacking: "kick goblin" -> {"action": "attack", "target": "goblin", "verb": "kick"}
- For attacking: "punch dragon" -> {"action": "attack", "target": "dragon", "verb": "punch"}
- For attacking: "slash troll" -> {"action": "attack", "target": "troll", "verb": "slash"}
- For attacking: ALWAYS extract the combat verb and include it in the "verb" field (kick, punch, slash, stab, bite, headbutt, etc.)
- For consuming: "drink beer" -> {"action": "drink", "target": "beer"}
- For reading: "read scroll" -> {"action": "read", "target": "scroll"}
- For reading: "read sign" -> {"action": "read", "target": "sign"}
- For spells: "cast fireball" -> {"action": "cast", "target": "fireball"}
- For spells: "cast fireball goblin" -> {"action": "cast", "target": "fireball", "npc_target": "goblin"}
- For learning: "learn fireball" -> {"action": "learn", "target": "fireball"}
- For spell list: "spells" -> {"action": "spells"}
- For guilds: "guild" -> {"action": "guild"}
- For guilds: "guild create Dragons" -> {"action": "guild", "target": "create", "npc_target": "Dragons"}
- For guilds: "guild invite John" -> {"action": "guild", "target": "invite", "npc_target": "John"}
- For guild chat: "gc Hello everyone" -> {"action": "gc", "target": "Hello everyone"}
- Accept synonyms: "purchase"="buy", "fight"="attack", "speak"="talk", "consume"="use", "eat"="use", "drink"="use", "magic"="spells"

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
