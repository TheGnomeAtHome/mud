# MUD Game Development Guide

## Project Overview
This is a browser-based Multi-User Dungeon (MUD) game built as a single HTML file with embedded JavaScript modules and Firebase backend. The game features real-time multiplayer text adventure gameplay with AI-powered NPCs using Google's Gemini API.

## Architecture

### Single-File Structure
- **`index.html`**: Contains all HTML, CSS, and JavaScript in one file
- **Firebase Integration**: Real-time multiplayer via Firestore collections
- **Gemini AI**: Natural language command parsing and NPC dialogue generation

### Core Game Systems

#### Data Collections (Firebase Firestore)
```
/artifacts/{appId}/public/data/
├── mud-rooms/          # World geography and room definitions
├── mud-items/          # Item templates with properties
├── mud-npcs/           # NPC definitions with AI settings
├── mud-monsters/       # Monster templates for spawning
├── mud-active-monsters/ # Live monster instances in rooms
├── mud-players/        # Player character data and progress
└── mud-messages/       # Real-time chat messages by room
```

#### Command Processing Flow
1. Player input → Gemini API for natural language parsing
2. Parse to structured command object: `{action, target, npc_target, topic}`
3. Execute via `executeParsedCommand()` with game state validation
4. Update Firebase collections and trigger real-time UI updates

### Key Patterns

#### AI Integration Points
- **Command Parsing**: Convert natural language to game actions via Gemini
- **NPC Dialogue**: AI NPCs use personality prompts with item-giving triggers
- **Room Descriptions**: Admin panel generates atmospheric text from keywords

#### Admin Panel Architecture
- Tab-based editor panels for each game entity type
- Real-time Firebase listeners update selectors automatically
- JSON editing for complex properties (exits, triggers, details)

#### State Management
- Game state synchronized via Firebase `onSnapshot()` listeners
- Local caches: `gameWorld`, `gameItems`, `gameNpcs`, `gameMonsters`, `gamePlayers`
- Player actions update both local state and Firebase atomically

## Development Workflows

### Adding New Game Features
1. Update data structure in Firebase collection
2. Add real-time listener in `main()` authentication handler
3. Implement command logic in `executeParsedCommand()` switch statement
4. Add admin panel UI if entity requires editing

### NPC Behavior Modification
- **Traditional NPCs**: Edit `dialogue` array for random responses
- **AI NPCs**: Modify personality prompt in `dialogue[0]`, configure `triggers` for item gifts
- **Item Triggers**: Use JSON format `{"keyword": "itemId"}` for AI item dispensing

### Room Design
- **Exits**: JSON object mapping directions to room IDs
- **Details**: JSON object for examinable features beyond basic description
- **Monster Spawns**: Array with `{monsterId, respawnTime}` for automatic respawning

## Important Conventions

### Firebase Security
- Collections under `/artifacts/{appId}/public/data/` for read/write access
- First registered user automatically becomes admin
- Admin status controls visibility of admin panel and editing permissions

### Natural Language Commands
- Support synonyms: "purchase" = "buy", "fight" = "attack"
- NPC interaction: "talk to [npc]", "ask [npc] about [topic]", "buy [item] from [npc]"
- Fallback: If command parsing fails and player was talking to AI NPC, treat as reply

### Real-time Features
- Chat messages broadcast to players in same room
- Monster spawning/combat visible to all room occupants
- Player movement triggers room display updates for other players

## Critical Files & Entry Points
- **Firebase Config**: Lines 1086-1093 in `main()` function
- **Command Parser**: `parseCommandWithGemini()` around line 349
- **Game Logic Hub**: `executeParsedCommand()` starting line 401
- **Admin Panel**: Event listeners starting around line 1350
- **AI Integration**: `callGeminiForText()` and `handleAiNpcInteraction()`

## Testing & Debugging
- Use browser dev tools for Firebase connection issues
- Admin panel provides live editing without code changes
- Monitor Firestore rules and quotas for multiplayer limits
- Gemini API key required for command parsing and AI NPCs