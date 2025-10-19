# Proactive NPC Greetings & Ambient Dialogue System

## Overview
The Proactive NPC system allows AI-powered NPCs to autonomously initiate interactions with players, creating a living, breathing game world. NPCs can greet players when they enter rooms, perform ambient actions, and create atmospheric moments without requiring player input.

## Features

### Proactive Greetings
- NPCs greet players shortly after they enter a room
- AI-generated greetings based on NPC personality
- Configurable delay (default: 5-30 seconds after entry)
- Minimum time between greetings to avoid spam

### Ambient Dialogue
- Periodic ambient actions/dialogue while players are present
- NPCs "perform" their role naturally (singing, humming, working)
- Configurable intervals for atmospheric immersion
- Completely independent of player actions

### Smart Behavior
- Only triggers for AI-powered NPCs
- Respects API quota limits
- Stops when players leave room
- Works alongside NPC-to-NPC conversations
- Compatible with wandering NPCs

## Configuration

### Admin Panel Setup

1. **Open Admin Panel → NPCs Tab**
2. **Select or Create an NPC**
3. **Enable AI** - Must have "Use AI for Dialogue?" checked
4. **Enable Proactive Greetings:**
   - Check "✨ Proactive Greetings? (AI only)"
   - Configure greeting settings:
     - **Greeting Delay Min:** How soon NPC might greet (default: 5 seconds)
     - **Greeting Delay Max:** Latest NPC might greet (default: 30 seconds)
     - **Min Time Between Greetings:** Cooldown period (default: 120 seconds)
5. **Optional: Enable Ambient Dialogue:**
   - Check "Ambient Dialogue?"
   - Configure ambient settings:
     - **Ambient Min Interval:** Shortest time between actions (default: 120 seconds)
     - **Ambient Max Interval:** Longest time between actions (default: 600 seconds)
6. **Save NPC**

### Data Structure

```javascript
{
  "shortName": "Cedric",
  "name": "a wandering minstrel",
  "useAI": true,
  "dialogue": "You are a cheerful minstrel who loves singing about heroic deeds...",
  "proactiveGreeting": true,
  "greetingDelay": {
    "min": 5,   // Seconds before greeting
    "max": 30
  },
  "greetingInterval": {
    "min": 120  // Minimum seconds between greetings
  },
  "ambientDialogue": true,
  "ambientInterval": {
    "min": 120,  // Minimum seconds between ambient actions
    "max": 600   // Maximum seconds between ambient actions
  }
}
```

## Perfect Use Cases

### Minstrel/Bard
```javascript
{
  "shortName": "Cedric",
  "name": "a wandering minstrel",
  "useAI": true,
  "dialogue": "You are a cheerful minstrel who travels between taverns, singing ballads about heroes and legends. You love music and entertainment.",
  "proactiveGreeting": true,
  "ambientDialogue": true
}
```

**Behavior:**
- **Greeting:** "strums a lute and begins singing a ballad about ancient heroes"
- **Ambient:** "hums a cheerful melody while tuning the lute"

### Blacksmith
```javascript
{
  "shortName": "Grok",
  "name": "a burly blacksmith",
  "useAI": true,
  "dialogue": "You are a gruff but skilled blacksmith, always working on weapons and armor. You take pride in your craft.",
  "proactiveGreeting": true,
  "ambientDialogue": true,
  "ambientInterval": { "min": 180, "max": 600 }
}
```

**Behavior:**
- **Greeting:** "looks up from the forge and grunts in acknowledgment"
- **Ambient:** "wipes sweat from brow and examines a freshly forged blade"

### Mysterious Wizard
```javascript
{
  "shortName": "Eldrin",
  "name": "a mysterious wizard",
  "useAI": true,
  "dialogue": "You are an enigmatic wizard who studies arcane mysteries. You speak in cryptic riddles and observe travelers with keen interest.",
  "proactiveGreeting": true,
  "greetingDelay": { "min": 10, "max": 45 },
  "ambientDialogue": true
}
```

**Behavior:**
- **Greeting:** "glances up from a dusty tome with piercing eyes"
- **Ambient:** "traces glowing runes in the air absentmindedly"

### Tavern Keeper
```javascript
{
  "shortName": "Mara",
  "name": "a friendly tavern keeper",
  "useAI": true,
  "dialogue": "You are a warm and welcoming tavern keeper who loves chatting with customers. You know all the local gossip.",
  "proactiveGreeting": true,
  "greetingDelay": { "min": 3, "max": 15 },
  "ambientDialogue": true,
  "ambientInterval": { "min": 90, "max": 300 }
}
```

**Behavior:**
- **Greeting:** "waves enthusiastically and smiles warmly"
- **Ambient:** "wipes down the bar while humming a tavern song"

## Technical Implementation

### Core Functions

#### `checkProactiveNpcs(roomId)`
- Called when player enters a room
- Scans for AI NPCs with `proactiveGreeting: true`
- Schedules greeting for each qualifying NPC
- Respects cooldown periods

#### `scheduleProactiveGreeting(npcId, roomId)`
- Checks last greeting time (prevents spam)
- Calculates random delay within configured range
- Sets timeout to trigger greeting
- Logs scheduled greeting time

#### `triggerProactiveGreeting(npcId, roomId)`
- Verifies NPC still in room (handles wandering NPCs)
- Confirms players present
- Generates AI greeting via `generateProactiveGreeting()`
- Broadcasts to room via Firebase
- Updates last greeting timestamp
- Schedules ambient dialogue if enabled

#### `generateProactiveGreeting(npc, playersInRoom)`
- Builds AI prompt with NPC personality
- Includes player names and count
- Requests short, natural greeting (1-2 sentences)
- Suggests appropriate actions (singing, waving, working)
- Returns cleaned AI response

#### `scheduleAmbientDialogue(npcId, roomId)`
- Sets up periodic ambient actions
- Random interval within configured range
- Continuously reschedules after each action
- Independent of player interactions

#### `triggerAmbientDialogue(npcId, roomId)`
- Verifies NPC and players still present
- Generates atmospheric action via `generateAmbientDialogue()`
- Broadcasts to room
- Doesn't require player response

#### `generateAmbientDialogue(npc)`
- Builds AI prompt for ambient action
- One sentence maximum
- Natural, atmospheric actions
- Doesn't address players directly
- Returns AI-generated action

#### `stopProactiveNpcsInRoom(roomId)`
- Clears all greeting and ambient timers for room
- Called when player leaves room
- Prevents unnecessary AI calls and Firebase writes

### Firebase Integration

**Messages Created:**
```javascript
{
  roomId: "room-id",
  userId: "npc-npcId",
  username: "Cedric",
  text: "strums a lute and begins singing...",
  timestamp: serverTimestamp(),
  isNpcGreeting: true  // or isNpcAmbient: true
}
```

### State Tracking

```javascript
let npcGreetingTimers = {};  // Track active timers
let npcLastGreeting = {};    // Track cooldown periods
```

## Player Experience

### What Players See

**Player Enters Room:**
```
The Tavern
A cozy room with a crackling fireplace.

NPCs here:
- Mara the tavern keeper
- Cedric the minstrel
```

**5-30 seconds later (Proactive Greeting):**
```
Mara waves enthusiastically and smiles warmly.
```

**10 seconds after that:**
```
Cedric strums a lute and begins singing a ballad about ancient heroes.
```

**2-10 minutes later (Ambient Dialogue):**
```
Mara wipes down the bar while humming a tavern song.
```

**Another few minutes:**
```
Cedric hums a cheerful melody while tuning the lute.
```

### Immersion Benefits

1. **Living World** - NPCs feel alive, not static
2. **Atmospheric** - Creates mood without player input
3. **Character Personality** - NPCs express themselves
4. **Unexpected Moments** - Surprises keep players engaged
5. **Environmental Storytelling** - NPCs reveal world through actions

## Advanced Combinations

### Wandering + Proactive + Ambient
```javascript
{
  "wanders": true,
  "wanderInterval": { "min": 120, "max": 300 },
  "proactiveGreeting": true,
  "ambientDialogue": true,
  "dialogue": "You are a traveling merchant with exotic goods..."
}
```

**Result:** Merchant wanders between rooms, greets players in each location, occasionally mentions wares

### Combat NPC + Proactive
```javascript
{
  "canFight": true,
  "hostile": false,
  "proactiveGreeting": true,
  "greetingDelay": { "min": 1, "max": 5 },
  "dialogue": "You are a vigilant town guard who watches for troublemakers..."
}
```

**Result:** Guard quickly acknowledges arrivals, maintains watchful presence

### Shop + Proactive + Ambient
```javascript
{
  "sells": ["sword", "shield", "armor"],
  "proactiveGreeting": true,
  "ambientDialogue": true,
  "dialogue": "You are an enthusiastic shopkeeper eager to make sales..."
}
```

**Result:** Shopkeeper greets potential customers, works on displays between interactions

## Performance Considerations

### API Usage
- **Greeting:** 1 Gemini API call per player entry (with cooldown)
- **Ambient:** 1 API call per interval (2-10 minutes)
- **Example:** 5 proactive NPCs, 10 player entries/hour = ~15 API calls/hour

### Firebase Writes
- 1 message document per greeting
- 1 message document per ambient action
- Minimal impact compared to conversations

### Recommended Limits
- **5-10 proactive NPCs** for balanced atmosphere
- **120+ second minimum greeting interval** to avoid spam
- **120-600 second ambient intervals** for natural pacing
- Enable only on key atmospheric NPCs

## Troubleshooting

### NPC Not Greeting

**Check:**
1. Is "Use AI for Dialogue?" enabled?
2. Is "Proactive Greetings?" checked?
3. Is AI personality prompt filled in (`dialogue` field)?
4. Has enough time passed since last greeting (cooldown)?
5. Check browser console for errors

### Too Many Greetings

**Solution:**
- Increase "Min Time Between Greetings" (e.g., 300 seconds)
- Reduce number of proactive NPCs in same room
- Increase greeting delay range

### Greetings Don't Match Personality

**Solution:**
- Improve AI personality prompt
- Be more specific about character traits
- Include examples of desired behavior in prompt

### Ambient Actions Too Frequent

**Solution:**
- Increase ambient min/max intervals
- Default 120-600 is good for most NPCs
- Consider 300-900 for subtle atmosphere

## Best Practices

### Personality Prompts

**Good:**
```
You are a cheerful minstrel who loves singing ballads about heroic deeds. 
You're friendly, outgoing, and always ready with a song or story. 
You speak in a poetic, melodic way and often reference music in your speech.
```

**Bad:**
```
A minstrel.
```

### NPC Distribution

- **1-2 proactive NPCs per major location** (tavern, shop, guild hall)
- **Not every NPC needs this** - reserve for atmospheric characters
- **Mix proactive and non-proactive** for variety

### Timing Configuration

| NPC Type | Greeting Delay | Greeting Cooldown | Ambient Interval |
|----------|----------------|-------------------|------------------|
| Eager (shopkeeper) | 3-15s | 60s | 90-300s |
| Friendly (innkeeper) | 5-30s | 120s | 120-600s |
| Reserved (wizard) | 10-45s | 180s | 180-900s |
| Busy (blacksmith) | 15-60s | 300s | 300-1200s |

### Content Guidelines

**Proactive Greetings Should:**
- Be 1-2 sentences
- Feel natural and spontaneous
- Match NPC personality
- Sometimes include actions (strums lute, waves)
- Not require response

**Ambient Dialogue Should:**
- Be 1 sentence maximum
- Describe actions, not dialogue
- Not directly address players
- Create atmosphere
- Feel like background activity

## Future Enhancements (Potential)

### Advanced Features
- Time-of-day greetings (morning/evening)
- React to weather/events
- Remember player names from previous visits
- Emotional states affecting greetings
- Group vs solo greetings

### Player Interaction
- Respond if player replies to greeting
- Offer quests proactively
- Share rumors/tips unprompted
- React to player equipment/level

### World Events
- Special greetings during festivals
- React to nearby combat
- Comment on world state changes
- Coordinate with other NPCs

## Examples in Action

### Tavern Scene
```
> north

The Cozy Tavern
A warm room with a roaring fireplace and the smell of fresh bread.

NPCs here:
- Mara the tavern keeper
- Cedric the minstrel
- Old Tom

[5 seconds later]
Mara looks up from polishing glasses and waves warmly.

[12 seconds later]
Cedric strums his lute and begins a cheerful tune about adventurers.

[You interact with game...]

[3 minutes later]
Mara hums softly while arranging mugs on the shelf.

[5 minutes later]
Cedric practices a complex melody, fingers dancing across the lute strings.
```

### Blacksmith's Forge
```
> east

The Forge
Heat radiates from the blazing furnace. The ring of hammer on anvil fills the air.

NPCs here:
- Grok the blacksmith

[20 seconds later]
Grok glances up from his work and grunts in acknowledgment before returning to the anvil.

[8 minutes later]
Grok wipes sweat from his brow and examines a glowing blade critically.
```

## Summary

The Proactive NPC system creates **living, breathing characters** that:

✅ **Greet players naturally** - No awkward silence when entering rooms
✅ **Perform ambient actions** - NPCs "live" their roles continuously  
✅ **Enhance atmosphere** - World feels dynamic and alive
✅ **Respect player agency** - NPCs don't demand responses
✅ **Work with other systems** - Compatible with wandering, combat, shops
✅ **Configurable timing** - Fine-tune for your game's pace
✅ **AI-powered variety** - Every greeting unique and in-character

Perfect for creating **immersive taverns, bustling marketplaces, and memorable character encounters** that make your MUD world feel truly alive!
