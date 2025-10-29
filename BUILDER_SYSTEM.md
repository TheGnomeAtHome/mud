# Builder System Documentation

## Overview
The Builder System allows trusted players to create and design rooms without needing full admin access. All builder-created rooms require admin approval before becoming accessible to players.

## Builder Permissions

### Getting Builder Status
- Only admins can grant builder permissions
- Command: `makebuilder [player name]`
- Example: `makebuilder John`

### Losing Builder Status
- Admins can revoke builder permissions
- Command: `removebuilder [player name]`

## Builder Commands

### 1. Create a Room
```
buildroom [room-id] [room name]
```
**Example:** `buildroom my-cottage My Cozy Cottage`

**Notes:**
- Room ID must be unique and lowercase
- Only letters, numbers, and hyphens allowed in ID
- Builder-created rooms are marked as "pending" until approved
- Admin-created rooms are auto-approved

**What happens:**
- Creates a new room in the database
- Room starts with basic description
- No exits initially
- Pending approval (unless you're an admin)

### 2. Edit Room Description
```
editdesc [description]
```
**Example:** `editdesc A warm and inviting cottage with wooden beams and a stone fireplace.`

**Restrictions:**
- Can only edit rooms you created (or any room if admin)
- Can edit while room is pending approval

### 3. Add Exit
```
addexit [direction] [room-id]
```
**Example:** `addexit north forest-clearing`

**Valid Directions:**
- north, south, east, west
- up, down
- northeast (ne), northwest (nw), southeast (se), southwest (sw)

**Restrictions:**
- Target room must exist
- Can only add exits to your own rooms
- Cannot add exits to pending rooms (wait for approval)

### 4. Remove Exit
```
removeexit [direction]
```
**Example:** `removeexit north`

**Restrictions:**
- Can only remove exits from your own rooms

### 5. Add Examinable Details
```
adddetail [keyword] [description]
```
**Example:** `adddetail fireplace A warm fire crackles invitingly in the stone hearth.`

**Notes:**
- Players can examine details with `examine [keyword]`
- Adds depth to your room without cluttering the main description
- Can add multiple details to one room

**Good Uses:**
- Furniture: fireplace, table, bed, bookshelf
- Decorations: painting, statue, tapestry
- Features: window, door, floor, ceiling

### 6. List Your Rooms
```
builderrooms
```
Shows all rooms you've created with their approval status.

## Admin Commands

### Review Pending Rooms
```
reviewrooms
```
Lists all rooms waiting for approval with creator info and descriptions.

### Approve a Room
```
approveroom [room-id]
```
**Example:** `approveroom johns-cottage`

**What happens:**
- Room becomes accessible to all players
- Pending status removed
- Creator is notified in-game
- Builders can now add exits to/from the room

### Reject a Room
```
rejectroom [room-id]
```
**Example:** `rejectroom bad-room`

**What happens:**
- Room is deleted from database
- Creator is notified in-game
- Cannot be undone

### Grant Builder Permissions
```
makebuilder [player name]
```

### Revoke Builder Permissions
```
removebuilder [player name]
```

## Builder Workflow Example

### Step 1: Create the Room
```
> buildroom cottage-1 Cozy Cottage
✓ Room created: Cozy Cottage (cottage-1)
⏳ Room is pending admin approval.
```

### Step 2: Add Description
```
> editdesc A small but comfortable cottage with wooden beams overhead and a warm stone fireplace. Sunlight streams through the windows.
✓ Room description updated!
```

### Step 3: Add Details
```
> adddetail fireplace Flames dance merrily in the stone hearth, filling the room with warmth.
✓ Detail added: "fireplace"

> adddetail window Through the glass you can see the forest outside.
✓ Detail added: "window"
```

### Step 4: Wait for Approval
- Admin runs `reviewrooms` to see your room
- Admin approves with `approveroom cottage-1`
- You receive notification: "🎉 Your room 'Cozy Cottage' has been approved!"

### Step 5: Connect to World
```
> go city-square
> addexit south cottage-1
✓ Exit added: south → Cozy Cottage
```

Now players can visit your room!

## Best Practices

### Room Naming
- **Good IDs:** `dark-forest`, `elven-temple`, `mystic-shop-1`
- **Bad IDs:** `Room1`, `MyRoom`, `AWESOME_PLACE`

### Descriptions
- Write 2-4 sentences
- Include sensory details (sight, sound, smell)
- Set the mood/atmosphere
- Mention notable features

**Example:**
```
The ancient library smells of old parchment and dust. Towering bookshelves 
line the walls, reaching up into the shadowy rafters. A single desk sits 
in the center, illuminated by flickering candlelight. The silence here is 
almost reverent.
```

### Details
- Add 3-5 examinable details per room
- Make them interactive and interesting
- Reward player curiosity
- Can hide quest clues in details

### Connecting Rooms
- Think about logical geography
- Create coherent areas/neighborhoods
- Don't create dead-ends unless intentional
- Consider two-way connections (if you go north, there should be a south exit back)

## Limitations & Rules

### What Builders CAN Do:
✅ Create new rooms
✅ Edit their own rooms
✅ Add/remove exits to their rooms
✅ Add details to their rooms
✅ View their room list

### What Builders CANNOT Do:
❌ Edit other players' rooms
❌ Add NPCs or monsters to rooms
❌ Add items to rooms
❌ Approve their own rooms
❌ Edit approved rooms (must ask admin)
❌ Delete rooms

### Admin Intervention Needed For:
- Approving/rejecting rooms
- Adding NPCs, monsters, or items
- Editing room properties beyond description/exits/details
- Deleting rooms
- Fixing mistakes in approved rooms

## Security & Quality Control

### Automatic Checks:
- Room ID validation (alphanumeric + hyphens only)
- Duplicate ID prevention
- Permission checks on all operations
- Target room existence validation

### Manual Review (Admin):
- Room description quality
- Appropriate content
- Fits the game world
- No exploits or rule-breaking

### Builder Privileges Can Be Revoked For:
- Creating inappropriate content
- Spam rooms
- Breaking game lore/theme
- Exploiting the system
- Creating rooms to gain unfair advantages

## Technical Details

### Database Storage
- Rooms stored in MySQL via API
- Pending flag: `pending: true/false`
- Creator tracking: `createdBy: userId`
- Timestamps: `createdAt`, `approvedAt`

### Room Object Structure
```json
{
  "id": "my-cottage",
  "name": "My Cozy Cottage",
  "description": "A warm and inviting space...",
  "exits": {
    "north": "forest-path",
    "south": "village-square"
  },
  "items": [],
  "npcs": [],
  "monsterSpawns": [],
  "details": {
    "fireplace": "A warm fire crackles...",
    "window": "You see the forest outside..."
  },
  "createdBy": "user123",
  "createdAt": 1730234567890,
  "pending": false,
  "approvedBy": "admin456",
  "approvedAt": 1730235678901,
  "isIndoor": false
}
```

## Future Enhancements

Planned features:
- Builder quota system (max rooms per builder)
- Room categories/tags
- Collaborative building (multiple builders on one room)
- Builder achievements/ranks
- Room templates
- Bulk operations
- Room preview mode
- Building tutorials in-game

## Support

### For Builders:
- Type `help` to see all builder commands
- Use `builderrooms` to track your creations
- Ask admins for help or special requests

### For Admins:
- Regular review of pending rooms keeps builders motivated
- Provide constructive feedback when rejecting rooms
- Consider builder permissions as a reward for active, creative players
- Monitor for abuse of the system

## Examples of Great Rooms

### Example 1: Atmospheric Location
```
Room: The Whispering Woods
Description: Ancient trees tower overhead, their branches creating a 
canopy so thick that only dim, green-filtered light reaches the forest 
floor. The air is cool and damp, heavy with the scent of moss and 
decaying leaves. Strange whispers seem to echo between the trees, though 
no wind stirs the branches.

Details:
- trees: Gnarled oaks, hundreds of years old, with twisted roots 
- moss: Thick, soft moss covers every surface like a green blanket
- whispers: You strain to hear... are those voices, or just the wind?
```

### Example 2: Shop/Service Location
```
Room: The Rusty Anvil Smithy
Description: The heat from the forge hits you like a physical force. A 
burly dwarf hammers away at a glowing piece of metal, sparks flying with 
each strike. Weapons and armor hang on the walls, ranging from simple 
daggers to ornate full plate. The smell of hot metal and coal fills the air.

Details:
- forge: A massive stone forge, its coals glowing white-hot
- weapons: An impressive array of blades, all bearing the smith's mark
- dwarf: He barely glances up from his work, focused and intense
```

### Example 3: Quest Location
```
Room: The Sealed Tomb
Description: Dust thick as snow covers every surface in this ancient 
burial chamber. Stone sarcophagi line the walls, their lids carved with 
forgotten kings and queens. At the far end, a larger tomb sits on a raised 
platform, sealed with chains and arcane symbols that still glow faintly.

Details:
- sarcophagi: The carvings are beautiful but weathered, faces worn smooth
- symbols: You recognize some as protective wards against the undead
- chains: Massive iron chains, covered in runes you cannot read
- platform: Three steps lead up to the sealed tomb
```
