# Party System Documentation

## Overview
The party system allows players to team up, share quest progress, and work together on party quests. Parties have a leader who can manage membership, and all members benefit from shared quest objectives and rewards.

## Party Structure

### Firebase Collection
**Collection**: `/artifacts/{appId}/public/data/mud-parties/{partyId}`

### Party Data Format
```json
{
  "id": "party-1698765432000",
  "leaderId": "user123",
  "leaderName": "JohnTheWarrior",
  "members": {
    "user123": {
      "name": "JohnTheWarrior",
      "isLeader": true,
      "joinedAt": "timestamp"
    },
    "user456": {
      "name": "SarahTheMage",
      "isLeader": false,
      "joinedAt": "timestamp"
    }
  },
  "invitations": {
    "user789": {
      "name": "BobTheRogue",
      "invitedAt": "timestamp",
      "invitedBy": "JohnTheWarrior"
    }
  },
  "createdAt": "timestamp"
}
```

## Player Commands

### View Current Party
```
party
```
- Shows current party information
- Lists all party members with their levels
- Shows who the leader is (👑 icon)

### Create a Party
```
party create
```
- Forms a new party with you as the leader
- You can only be in one party at a time
- Must leave current party before creating a new one

### Invite Player
```
party invite [player name]
```
- **Leader only** - invites another player to join the party
- Target player must not be in another party
- Invited player receives a notification with instructions to join

### Join a Party
```
party join [leader name]
```
- Accepts a pending invitation from a party leader
- Must have a pending invitation from that leader
- Can only join if not already in a party

### Leave Party
```
party leave
```
- **Members**: Removes you from the party
- **Leader**: Disbands the entire party
- All party members are notified when someone leaves

### Kick Member
```
party kick [player name]
```
- **Leader only** - removes a member from the party
- Cannot kick yourself (use `party leave` instead)
- Kicked player is notified

### List All Parties
```
party list
```
- Shows all active parties in the game
- Displays leader name and member count for each party

### Party Chat
```
pc [message]
```
- Sends a message to all party members
- Messages are visible only to party members
- Works across different rooms
- Format: `[Party] Name: message`

## Party Quest Integration

### Shared Quest Progress
When a party member completes an objective on a **party quest**, ALL party members' progress is updated:

- **Kill objectives**: Any party member's kill counts for everyone
- **Collect objectives**: Any party member picking up items updates everyone
- **Visit objectives**: Any party member visiting a location updates everyone
- **Talk objectives**: Any party member talking to NPCs updates everyone

### Quest Acceptance
- Any party member can accept a party quest
- The quest becomes active for all members if they meet requirements
- Level requirements are checked individually

### Quest Rewards
When a party quest is completed and turned in:
- **ALL party members** receive the full rewards
- Each member gets: XP, gold, and items
- Party members in different rooms are notified
- Level-ups are checked for each member

### Party Quest Requirements
In the quest editor, set `isPartyQuest: true` to make a quest party-enabled:
```json
{
  "id": "quest-raid-dungeon",
  "title": "Raid the Ancient Dungeon",
  "isPartyQuest": true,
  "levelRequired": 10,
  "objectives": [
    {"type": "kill", "target": "dungeon-boss", "count": 1}
  ],
  "rewards": {
    "xp": 1000,
    "gold": 500,
    "items": ["legendary-armor"]
  }
}
```

## Party Management Flow

### 1. Forming a Party
```
Player A: party create
System: You have formed a new party!

Player A: party invite Player B
System: Party invitation sent to Player B!
```

### 2. Joining a Party
```
Player B: party join Player A
System: You have joined Player A's party!

[Party members notified]
System: Player B has joined the party!
```

### 3. Party Quest Completion
```
# Any party member accepts quest
Player A: quest accept raid dungeon
System: Quest accepted: Raid the Ancient Dungeon

# Party member makes progress
Player B kills dungeon-boss
[All party members see progress update]
System: 🎉 Quest Objectives Complete: Raid the Ancient Dungeon!

# Any party member can turn in
Player A talks to NPC
System: 🎉 Quest Complete: Raid the Ancient Dungeon!
System: All party members have been rewarded!
[Everyone receives: 1000 XP, 500 gold, legendary-armor]
```

### 4. Party Communication
```
Player A: pc Found the boss room!
[Party] Player A: Found the boss room!

Player B: pc On my way!
[Party] Player B: On my way!
```

### 5. Leaving/Disbanding
```
# Member leaves
Player B: party leave
System: You have left the party.
[Party notified: Player B has left the party]

# Leader disbands
Player A: party leave
System: You have disbanded the party.
[All members notified: The party has been disbanded by the leader]
```

## Technical Implementation

### Data Structures

#### Player Party Tracking
Players are tracked by their presence in a party's `members` object:
```javascript
// Find player's party
const playerParty = Object.values(gameParties).find(p => 
    p.members && Object.keys(p.members).includes(userId)
);
```

#### Party Invitations
Pending invitations are stored in the party's `invitations` object:
```javascript
invitations: {
    "targetUserId": {
        name: "TargetPlayer",
        invitedAt: serverTimestamp(),
        invitedBy: "InviterName"
    }
}
```

### Quest Progress Sharing

When a party member makes quest progress:
1. The function `updateQuestProgress()` is called
2. It checks if the quest is a party quest (`isPartyQuest: true`)
3. If yes, it updates ALL party members' quest progress
4. All members are notified when objectives complete

```javascript
// Update party members' quest progress
if (questData && questData.isPartyQuest && playerParty) {
    for (const memberId of Object.keys(playerParty.members)) {
        // Update each member's activeQuests
        await updateDoc(memberRef, {
            activeQuests: updatedQuests
        });
    }
}
```

### Quest Turn-In Distribution

When a party quest is turned in:
1. All party members' quests are removed from active
2. All party members receive full rewards
3. Remote party members get system notifications
4. Level-ups are checked for each member individually

```javascript
const rewardRecipients = isPartyQuest 
    ? Object.keys(playerParty.members) 
    : [userId];

for (const recipientId of rewardRecipients) {
    // Award XP, gold, items to each recipient
    await updateDoc(recipientRef, updates);
    await checkLevelUp(recipientRef, updates.xp, level);
}
```

## Party Chat Implementation

Party chat messages are broadcast to all party members' current rooms:
```javascript
// Send to all party members
for (const memberId of Object.keys(playerParty.members)) {
    const member = gamePlayers[memberId];
    if (member && member.roomId) {
        await addDoc(collection(db, 'mud-messages'), {
            senderId: userId,
            senderName: playerName,
            roomId: member.roomId,
            text: message,
            isPartyChat: true,
            timestamp: serverTimestamp()
        });
    }
}
```

Messages are styled differently in the UI:
```javascript
if (msg.isPartyChat) {
    logToTerminal(`[Party] ${sender}: ${msg.text}`, 'party');
}
```

## Integration with Quest System

### Quest Acceptance Check
```javascript
// Party quests can be accepted by any party member
if (quest.isPartyQuest) {
    // Check if player is in a party
    const playerParty = Object.values(gameParties).find(p => 
        p.members && Object.keys(p.members).includes(userId)
    );
    
    if (!playerParty) {
        logToTerminal("This is a party quest. You need to be in a party.", "error");
        break;
    }
}
```

### Progress Updates
All four objective types support party sharing:
- **Kill**: Triggered in combat when monster defeated
- **Collect**: Triggered when item picked up with `get` command
- **Visit**: Triggered when entering room with `go` command
- **Talk**: Triggered when talking to NPC

Each trigger calls `updateQuestProgress(playerId, type, target)` which handles party distribution.

## Best Practices

1. **Party Size**: No hard limit, but 3-5 members is recommended for balanced gameplay
2. **Party Quests**: Design challenging quests that require teamwork
3. **Reward Scaling**: Party quest rewards can be higher since multiple players are working together
4. **Communication**: Encourage use of party chat for coordination
5. **Leadership**: Leader has control over membership - choose wisely
6. **Quest Design**: Use `isPartyQuest: true` for raids, dungeons, and group challenges

## Example Party Quest

### Dungeon Raid Quest
```json
{
  "id": "quest-crystal-caverns-raid",
  "title": "Crystal Caverns Raid",
  "description": "A powerful crystal guardian protects ancient treasure. Gather your party and defeat it!",
  "levelRequired": 15,
  "isRepeatable": false,
  "isPartyQuest": true,
  "giverNpcId": "expedition-leader",
  "objectives": [
    {"type": "visit", "room": "crystal-caverns", "count": 1},
    {"type": "kill", "target": "crystal-guardian", "count": 1},
    {"type": "collect", "item": "ancient-crystal", "count": 1}
  ],
  "rewards": {
    "xp": 2000,
    "gold": 1000,
    "items": ["crystal-sword", "crystal-armor"]
  },
  "prerequisites": ["quest-explore-caves"]
}
```

### Usage Flow
```
# Form party
Player1: party create
Player1: party invite Player2
Player1: party invite Player3

Player2: party join Player1
Player3: party join Player1

# Accept party quest
Player1: quest accept crystal caverns raid
System: Quest accepted for all party members!

# Coordinate via party chat
Player1: pc Let's head to the caverns
Player2: pc Ready!
Player3: pc Following you

# Complete objectives together
[Any member visits crystal-caverns] → All progress: Visit 1/1
[Any member kills crystal-guardian] → All progress: Kill 1/1  
[Any member collects ancient-crystal] → All progress: Collect 1/1

# Turn in quest
Player1: talk to expedition leader
System: 🎉 Quest Complete: Crystal Caverns Raid!
System: All party members have been rewarded!
[Everyone receives: 2000 XP, 1000 gold, crystal-sword, crystal-armor]
```

## Admin Features

### Monitoring Parties
Admins can view active parties using `party list` to see:
- How many parties are active
- Who the leaders are
- How many members in each party

### Future Enhancements
- **Party admin panel**: View and manage all parties in admin interface
- **Party size limits**: Configure max party size
- **Party roles**: Tank, healer, DPS role assignments
- **Party buffs**: Stat bonuses for being in a party
- **Party loot distribution**: Options for how items are distributed
- **Party formation requirements**: Require specific classes or levels

## AI Parser Support

The Gemini AI parser understands natural language party commands:
- "create a group" → `{"action": "party", "target": "create"}`
- "invite Sarah to party" → `{"action": "party", "target": "invite", "npc_target": "Sarah"}`
- "join John's team" → `{"action": "party", "target": "join", "npc_target": "John"}`
- "leave the party" → `{"action": "party", "target": "leave"}`
- "tell party we're ready" → `{"action": "pc", "target": "we're ready"}`

Synonyms supported:
- "group" = "party"
- "team" = "party"

## Troubleshooting

### Can't Create Party
- ✅ Make sure you're not already in a party
- ✅ Use `party leave` first if needed

### Can't Invite Player
- ✅ You must be the party leader
- ✅ Target player must not be in another party
- ✅ Check spelling of player name

### Can't Join Party
- ✅ You must have a pending invitation
- ✅ Use exact leader's name
- ✅ Make sure you're not already in a party

### Quest Progress Not Sharing
- ✅ Check quest has `isPartyQuest: true`
- ✅ Verify all members accepted the quest
- ✅ Confirm all members are still in the party

### Party Chat Not Working
- ✅ You must be in a party to use `pc`
- ✅ Messages are sent to all party members' current rooms
- ✅ Recipients will see messages even if in different locations
