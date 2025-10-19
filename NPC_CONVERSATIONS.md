# NPC-to-NPC Conversation System

## Overview
AI-powered NPCs can now have autonomous conversations with each other when multiple AI NPCs are present in the same room. These conversations are generated using Google's Gemini AI and broadcast to all players in the room, creating a more immersive and dynamic world.

## How It Works

### Automatic Activation
When a player enters or is in a room with **2 or more AI NPCs**:
- The system automatically detects AI NPCs (those with dialogue arrays or personality strings)
- A conversation timer starts for that room
- Conversations trigger every **60-120 seconds** (randomized to avoid API rate limits)
- First conversation starts after **20-40 seconds** (initial delay)

### Conversation Generation
Each conversation consists of **2-3 exchanges** between random pairs of NPCs:
1. System picks two random AI NPCs from the room
2. **Loads conversation history from Firebase** (persistent across sessions)
3. Gemini generates contextual dialogue based on:
   - Each NPC's personality prompt (from their dialogue array/string)
   - The room's name and description
   - Previous conversation history (last 10-12 messages)
   - Whether the last message was a question (ensures answers)
   - The flow of the conversation
4. **Saves updated conversation history to Firebase** after each cycle

### Persistent Memory
- Conversation history is **stored in Firebase** (`mud-npc-conversations` collection)
- NPCs remember conversations **across browser refreshes** and sessions
- Each NPC pair maintains a separate conversation thread per room
- History keeps last **12 messages** (6 exchanges) to balance context vs token usage
- Conversations can evolve over days/weeks with running jokes and callbacks

### Display Format
NPC conversations appear in the game terminal like this:
```
Blacksmith says, "Business has been slow lately, friend."
Innkeeper says, "At least the ale keeps flowing! Care for a drink?"
```

## Technical Implementation

### Data Structures

#### Conversation Timers
```javascript
npcConversationTimers = {
  "room_id": <intervalId>
}
```
- One timer per room with active conversations
- Automatically cleared when players leave or room changes

#### Conversation States (In-Memory Cache)
```javascript
npcConversationStates = {
  "npc1_id-npc2_id-room_id": {
    exchanges: <number>,
    history: [
      { speaker: "NPC Name", text: "dialogue" },
      ...
    ]
  }
}
```
- Cached in memory for quick access during active conversations
- Loaded from Firebase when first needed
- Saved to Firebase after each conversation cycle

#### Firebase Collection: `mud-npc-conversations`
Document ID: `{npc1_id}-{npc2_id}-{room_id}` (sorted NPC IDs for consistency)

```javascript
{
  exchanges: <number>,        // Total exchanges in this conversation thread
  history: [                  // Last 12 messages
    { speaker: "NPC Name", text: "dialogue text" },
    ...
  ],
  lastUpdated: <Timestamp>    // When last conversation occurred
}
```

### Key Functions

#### `loadNpcConversationHistory(roomId, npc1Id, npc2Id)`
- Loads conversation history from Firebase for a specific NPC pair
- Called when conversation state doesn't exist in memory
- Creates empty state if no Firebase document exists
- Populates `npcConversationStates` cache

#### `saveNpcConversationHistory(conversationKey, state)`
- Saves conversation history to Firebase after each conversation cycle
- Updates `exchanges` count and `history` array
- Sets `lastUpdated` timestamp for tracking
- Ensures persistence across sessions

#### `startNpcConversationsInRoom(roomId)`
- Called when `showRoom()` displays a new location
- Checks for 2+ AI NPCs in the room
- Starts interval timer for periodic conversations
- Triggers first conversation after random delay

#### `stopNpcConversationsInRoom(roomId)`
- Called when player leaves a room
- Clears interval timer to prevent memory leaks
- Removes conversation timer from tracking object

#### `triggerNpcConversation(roomId, aiNpcs)`
- Picks two random AI NPCs from the room
- **Loads conversation history from Firebase if not in memory**
- Generates 3-5 dialogue exchanges
- Adds 2-4 second delays between exchanges
- Updates conversation history with each exchange
- **Saves updated history to Firebase after conversation**

#### `generateNpcDialogue(speaker, listener, roomId, history)`
- Builds comprehensive Gemini prompt with:
  - Speaker's personality
  - Listener's personality
  - Room context
  - Conversation history (last 10 messages)
  - **Question detection** - ensures questions get answered
- Generates 1-2 sentence responses
- Cleans up AI response (removes quotes, attributions)

#### `broadcastNpcConversation(roomId, npc, message)`
- Finds all players currently in the room
- Writes message to Firestore `mud-messages` collection
- Sets `isNpcConversation: true` flag
- Uses `serverTimestamp()` for ordering

### Message Handling

Messages are stored in Firebase with this structure:
```javascript
{
  roomId: "room_id",
  userId: "npc-conversation",
  username: "NPC Name",
  text: "The dialogue text",
  timestamp: <Firestore Timestamp>,
  isNpcConversation: true
}
```

In `app.js`, the message listener handles NPC conversations:
```javascript
if (msg.isNpcConversation) {
    logToTerminal(`<span class="text-lime-300">${msg.username}</span> says, "${msg.text}"`, 'game');
}
```

## NPC Configuration

### AI NPC Requirements
For NPCs to participate in conversations, they must have:
```javascript
{
  "id": "npc_id",
  "name": "NPC Name",
  "shortName": "Name",
  "dialogue": [
    "Personality prompt describing the NPC's character, traits, speech patterns..."
  ],
  // ... other properties
}
```

### Traditional NPCs
NPCs with random dialogue arrays (not personality prompts) won't participate:
```javascript
{
  "dialogue": [
    "Hello there!",
    "Nice day, isn't it?"
  ]
}
```
These NPCs use simple random selection, not AI generation.

## Performance Considerations

### API Usage
- Conversations generate **2-3 API calls per cycle** (one per exchange)
- Cycles run every **60-120 seconds** (rate limit protection)
- Exchanges have **3-6 second delays** between them
- Only active when players are present in rooms with 2+ AI NPCs
- Typical cost: ~3-6 API calls per hour per active room
- **Rate Limit Protection**: Automatic backoff on 429 errors

### Firebase Usage
- **One read** per conversation cycle (loading history)
- **One write** per conversation cycle (saving history)
- Documents are small (~1-2KB with 12 messages)
- Minimal impact on Firestore quota

### Token Optimization
- Prompts are concise and focused
- Conversation history limited to 10-12 messages
- Responses limited to 1-2 sentences
- No unnecessary context included

### Memory Management
- Timers properly cleared when players leave rooms
- Conversation history pruned to 12 messages maximum
- Single timer per room (not per NPC pair)
- Memory cache reduces Firebase reads during active sessions

## Design Patterns

### Conversation Quality
To ensure engaging NPC conversations:

1. **Personality Prompts** - Make them detailed:
   ```
   "You are a gruff dwarven blacksmith with 40 years experience. You speak bluntly but have a good heart. You're proud of your craft and often complain about young adventurers not appreciating quality work."
   ```

2. **Topic Variety** - AI naturally varies topics:
   - Comments on the location
   - Questions to other NPCs
   - Reactions to events
   - Sharing opinions or stories

3. **Context Awareness** - AI uses:
   - Room name and description
   - NPC personalities
   - Previous conversation flow

### Example Conversations

**Tavern Scene:**
```
Innkeeper says, "Quiet night tonight. Strange for a weekend."
Bard says, "Perhaps folks are staying home after those monster attacks on the road?"
Innkeeper says, "Aye, bad for business. But at least you're here to lighten the mood!"
```

**Shop Scene:**
```
Blacksmith says, "These new apprentices these days... no respect for the craft."
Merchant says, "Ha! Try dealing with customers who haggle over a single copper piece."
Blacksmith says, "At least your goods don't require a forge hot as dragon's breath!"
```

## Future Enhancements

Potential improvements:
- [x] Persistent conversation memory across sessions (implemented via Firebase)
- [ ] Admin command to reset/clear conversation history
- [ ] React to player actions (combat, spells, etc.)
- [ ] Emotional states that affect dialogue tone
- [ ] NPCs mentioning players by name in conversations
- [ ] Relationship tracking between NPCs (friendship levels)
- [ ] Special event-triggered conversations
- [ ] Conversation history viewer in admin panel

## Admin Panel

Currently there is **no admin UI** for NPC conversations - they are automatic. 

To control conversations:
- Add/remove AI NPCs from rooms (via NPC admin panel)
- Edit NPC personality prompts (dialogue array)
- Conversations start/stop automatically based on NPC presence

## Troubleshooting

### NPCs Not Talking
- Verify 2+ AI NPCs in room
- Check NPCs have dialogue arrays (not null/undefined)
- Check browser console for errors
- Verify Gemini API key is configured

### Conversations Don't Stop
- Check for console errors in `stopNpcConversationsInRoom`
- Verify movement code calls stop function
- May need to refresh page to clear orphaned timers

### Incoherent Dialogue
- Improve personality prompts with more detail
- Check conversation history is being maintained
- Verify API responses are being cleaned properly

### High API Usage
- Reduce number of AI NPCs in popular rooms
- Increase conversation interval (currently 45-90s)
- Consider static pre-written ambient messages for some NPCs

## Related Systems
- **AI NPC Interaction** (`handleAiNpcInteraction`) - Player-to-NPC dialogue
- **Room Display** (`showRoom`) - Triggers conversation start
- **Message System** (`mud-messages` collection) - Broadcasts dialogue
- **Gemini AI** (`callGeminiForText`) - Generates responses
