# NPC Conversation Settings - Admin Controls

## Overview
Added admin panel controls for managing NPC-to-NPC conversations with both manual toggle and automatic player-based threshold controls.

## Features

### 1. Manual Toggle
- Enable/disable NPC conversations with a simple toggle switch
- Settings persist across sessions using localStorage
- Can also be controlled via the `npcchats on/off` command

### 2. Player Count Threshold
- Auto-disable NPC conversations when player count exceeds a configurable limit
- Helps manage API usage and server load during peak times
- Set to 0 for no limit (default)
- Recommended threshold: 10-20 players

### 3. Real-time Status Display
- Shows current enabled/disabled state
- Displays active player count
- Visual warning when threshold is exceeded
- Updates every 5 seconds

### 4. Status Indicators
- **ENABLED** (green) - NPC conversations are active
- **DISABLED** (gray) - Manually disabled
- **AUTO-DISABLED** (yellow) - Disabled due to player count threshold
- **QUOTA EXHAUSTED** (red) - Gemini API quota limit reached

## Admin Panel Location
Navigate to: **Admin Panel → ⚙️ Settings Tab**

## Settings Panel Controls

### NPC Conversations Section
- **Enable NPC Conversations Toggle** - Master on/off switch
- **Player Count Threshold** - Number input (0 = no limit)
- **Current Status Display**:
  - Active Players count
  - Threshold setting
  - Warning when threshold exceeded
- **Save Settings Button** - Persist changes
- **Test Button** - Run status check via console

## Implementation Details

### Files Modified

#### `mud.html`
- Added "⚙️ Settings" tab to admin panel navigation
- Created settings panel UI with toggle, threshold input, and status display

#### `js/game.js`
- Added `npcChatPlayerThreshold` variable (default: 0)
- Added `npcConversationsAutoDisabled` flag
- Created `loadNpcConversationSettings()` - Load from localStorage
- Created `saveNpcConversationSettings()` - Save to localStorage
- Created `checkNpcConversationPlayerThreshold()` - Monitor player count and auto-disable
- Updated `startNpcConversationsInRoom()` - Check threshold before starting
- Updated `npcchats` command - Display threshold info and auto-disable status
- Exported new functions: `getNpcConversationSettings()`, `setNpcConversationSettings()`, `checkNpcConversationPlayerThreshold()`

#### `js/admin.js`
- Added 'settings-tab-btn' to admin tab panels
- Created `initializeSettingsPanel()` function
- Exported `setGameLogicForSettings()` to connect game logic after initialization
- Settings panel includes:
  - Real-time player count monitoring (updates every 5 seconds)
  - Toggle for enabling/disabling conversations
  - Number input for player threshold
  - Status badge showing current state
  - Save button to persist settings
  - Test button to check current status

#### `js/app.js`
- Imported `setGameLogicForSettings` from admin.js
- Called `setGameLogicForSettings(gameLogic)` after game initialization
- Exposed `gamePlayers` globally via `window.gamePlayers` for admin panel access

### Settings Storage
Settings are stored in browser localStorage:
- Key: `npcConversationsEnabled` (boolean as string)
- Key: `npcChatPlayerThreshold` (number as string)

Settings are loaded on game initialization and persist across sessions.

### Automatic Threshold Behavior

When player count exceeds threshold:
1. `npcConversationsAutoDisabled` flag set to `true`
2. All active conversation timers stopped via `stopNpcConversationsInRoom()`
3. System message logged to terminal
4. Conversations prevented from starting in new rooms

When player count drops below threshold:
1. `npcConversationsAutoDisabled` flag set to `false`
2. System message logged to terminal
3. Conversations restart in current room if manually enabled
4. New room entries will trigger conversations normally

### Admin Commands
The existing `npcchats` command was enhanced:
```
npcchats on        - Enable conversations
npcchats off       - Disable conversations
npcchats           - Show status including threshold and player count
```

## Usage Examples

### Scenario 1: Reduce API Usage During Peak Hours
1. Open Admin Panel → Settings
2. Set Player Count Threshold to 15
3. Click "Save Settings"
4. When 16+ players are online, NPC conversations auto-disable
5. When player count drops to 15 or below, conversations re-enable

### Scenario 2: Completely Disable NPC Conversations
1. Open Admin Panel → Settings
2. Toggle "Enable NPC Conversations" to OFF
3. Click "Save Settings"
4. NPC conversations stopped immediately

### Scenario 3: Check Current Status
1. Open Admin Panel → Settings
2. View the "Current Status" section
3. Click "Test" button to see detailed info in console
4. Or use terminal command: `npcchats`

## Benefits

1. **Cost Control** - Automatically reduce Gemini API calls during high player counts
2. **Performance** - Reduce server load when many players are online
3. **Flexibility** - Admin can manually override at any time
4. **Visibility** - Real-time status display shows exactly what's happening
5. **Persistence** - Settings survive browser refreshes and new sessions

## Future Enhancements (Potential)

- Schedule-based auto-disable (e.g., disable during specific hours)
- Per-room conversation limits
- Conversation frequency throttling based on player count
- Conversation history management (clear/reset button)
- Export/import conversation logs
