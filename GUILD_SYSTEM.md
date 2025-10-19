# Guild System - Complete Feature Guide

## Overview
The MUD now has a comprehensive guild system with player organizations, treasury management, leveling, perks, and private guild halls.

## 🎮 Player Commands

### Basic Guild Commands
- **`guild`** - View your current guild information (level, exp, members, perks)
- **`guild create [name]`** - Create a new guild (you become the leader)
- **`guild list`** - See all active guilds with member counts
- **`guild invite [playername]`** - Invite a player to your guild (leader/officer only)
- **`guild accept [guildname]`** - Accept a guild invitation
- **`guild leave`** - Leave your current guild

### Guild Treasury
- **`guild deposit [amount]`** - Deposit gold into guild treasury (any member)
- **`guild withdraw [amount]`** - Withdraw gold from treasury (leader/officer only)

### Guild Management (Leader Only)
- **`guild promote [playername]`** - Promote member to officer
- **`guild demote [playername]`** - Demote officer to member
- **`guild disband`** - Shows confirmation prompt
- **`guild disband confirm`** - Permanently disbands the guild

### Guild Communication
- **`guild chat [message]`** - Send message to all guild members
- **`gc [message]`** - Quick guild chat shortcut

## 🏰 Admin Panel Features

### Guild Management Tab (🏰 Guilds)
New admin panel tab with full guild editor:

**Fields:**
- **Guild ID** - Unique identifier (auto-generated)
- **Guild Name** - Display name
- **Description** - Guild lore/description
- **Motto** - Guild slogan (optional)
- **Leader Name** - Current guild leader (read-only from members)
- **Treasury** - Gold in guild bank
- **Guild Level** - Current level (1-10)
- **Guild Experience** - Progress to next level
- **Guild Hall Room ID** - Private room restricted to members (optional)
- **Guild Perks** - JSON bonuses for members
- **Members** - Read-only member list with ranks

**Actions:**
- **Save Guild** - Update guild data
- **New Guild** - Create fresh guild
- **Delete Guild** - Remove guild and clear all member associations

## 📊 Guild System Mechanics

### Guild Leveling
- **Experience Gain**: Guilds earn 10% of all member XP from combat
- **Level Requirements**: 1000 XP per level (Level 2 = 1000 XP, Level 3 = 2000 XP, etc.)
- **Max Level**: 10
- **Level Up**: Automatic when XP threshold reached, announced to member

### Guild Perks System
Guilds can have perks that benefit all members:

```json
{
  "expBonus": 10,
  "statBonus": {
    "str": 2,
    "dex": 2,
    "int": 1
  }
}
```

**Experience Bonus:**
- Percentage increase to all XP gained (10 = +10% XP)
- Applied during combat victories
- Displayed in combat log

**Stat Bonuses:**
- Added to member's base attributes
- Active in all combat calculations (damage, dodge, defense)
- Shown in `stats` command with "(+X guild bonus)" indicator
- Affects both PvE and PvP combat

### Guild Hall Rooms
- **Restriction**: Only guild members (and admins) can enter
- **Setup**: Set `guildHallRoomId` in admin panel to any room ID
- **Access**: Attempted entry by non-members shows error message
- **Use Cases**: Private meeting rooms, storage areas, quest hubs

### Member Ranks
Three rank levels with different permissions:

1. **Leader** (👑)
   - All permissions
   - Can promote/demote officers
   - Can withdraw from treasury
   - Can disband guild
   - Only one per guild

2. **Officer** (⭐)
   - Can invite members
   - Can withdraw from treasury
   - Cannot promote/demote
   - Cannot disband

3. **Member** (•)
   - Can deposit to treasury
   - Can use guild chat
   - Can leave guild
   - No management permissions

## 🔧 Firebase Data Structure

### Collection: `mud-guilds/{guildId}`
```javascript
{
  name: "Guild Name",
  description: "Guild description",
  motto: "Optional motto",
  leader: "LeaderPlayerName",
  leaderId: "userId",
  level: 1,
  exp: 0,
  treasury: 0,
  guildHallRoomId: "optional-room-id",
  perks: {
    expBonus: 10,
    statBonus: { str: 2, dex: 2 }
  },
  members: {
    "userId": {
      name: "PlayerName",
      rank: "leader" | "officer" | "member",
      joinedAt: Timestamp
    }
  },
  createdAt: Timestamp
}
```

### Player Data Extension
```javascript
{
  guildId: "guild-id",
  guildInvites: [
    {
      guildId: "guild-id",
      guildName: "Guild Name",
      invitedBy: "PlayerName",
      timestamp: number
    }
  ]
}
```

## 💡 Usage Examples

### Creating and Managing a Guild
```
> guild create The Dragon Slayers
Guild "The Dragon Slayers" has been created! You are the guild leader.

> guild
=== The Dragon Slayers ===
Level: 1 (0/1000 XP)
Leader: YourName
Members: 1
Treasury: 0 gold

> guild invite Bob
Guild invitation sent to Bob.

> guild deposit 500
You deposited 500 gold into the guild treasury.
```

### Using Admin Panel to Add Perks
1. Open Admin Panel → 🏰 Guilds tab
2. Select your guild from dropdown
3. Add perks JSON:
```json
{
  "expBonus": 15,
  "statBonus": {
    "str": 3,
    "dex": 2,
    "con": 2
  }
}
```
4. Click 💾 Save Guild

### Guild Level Progression
- Members defeat monsters → Earn XP → Guild gets 10% of XP
- Guild reaches 1000 XP → Levels up to Level 2
- Higher guild levels = more prestige (perks set manually by admin)

### Setting Up Guild Hall
1. Create a room in Rooms tab (e.g., `dragons-hall`)
2. In Guilds tab, set "Guild Hall Room ID" to `dragons-hall`
3. Only guild members can enter that room
4. Connect to world with normal exits

## 🔍 Technical Implementation

### Files Modified
- **mud.html**: Added guild editor panel UI
- **js/admin.js**: Guild CRUD operations and admin handlers
- **js/game.js**: Guild commands, perks system, hall restrictions
- **js/ai.js**: Updated command parser for new guild commands
- **js/data-loader.js**: Guild collection listener (already existed)

### Key Functions
- `getEffectiveAttributes(entity)` - Applies guild stat bonuses to combat
- Guild XP gain - Handled in combat victory messages
- Guild level up - Checked after XP award
- Room restriction - Checked in `go` command

## 🎯 Future Enhancement Ideas
- Guild quests (shared objectives)
- Guild vs Guild wars/competitions
- Guild rankings/leaderboards
- Guild crafting bonuses
- Guild mounts/pets
- Alliance system between guilds
- Guild territory control
- Seasonal guild competitions

## 📝 Notes
- All existing guilds created before this update will still work
- New fields (level, exp, perks, guildHallRoomId) are optional
- Guild perks require manual admin configuration
- Guild exp accumulates automatically from member activities
- Maximum guild level is 10 (can be increased in code if needed)
