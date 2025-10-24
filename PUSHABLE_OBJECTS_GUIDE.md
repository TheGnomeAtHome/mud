# Pushable Objects System Guide

## Overview
The pushable objects system allows you to create interactive environmental puzzles in rooms. Objects can be pushed, pulled, or moved to reveal hidden items, require multiple party members for heavy objects, and provide immersive storytelling through room interactions.

## Perfect for Your Tomb Quest!

### Example: The Tomb Puzzle

**Scenario**: A tomb with a heavy stone lid that takes 2 people to move. Inside is a skeleton holding a dusty magic book.

## Room Setup in Admin Panel

### 1. Room Details (JSON)
Add these to your room's `details` field:

```json
{
  "tomb": "An ancient stone tomb sits in the corner. The heavy stone lid appears slightly ajar, as if not fully closed.",
  "lid": "The massive stone lid of the tomb is slightly displaced. It would take considerable strength to move it.",
  "cover": "The massive stone lid of the tomb is slightly displaced. It would take considerable strength to move it.",
  "skeleton": "The skeleton lies peacefully within the tomb, still clutching something in its bony fingers."
}
```

This allows players to:
- `examine tomb` - See initial description
- `examine lid` or `examine cover` - Get hint about moving it
- After pushing: `examine skeleton` - See the skeleton description

### 2. Pushables Configuration (JSON)
Add this to your room's `pushables` field:

```json
{
  "tomb": {
    "requiredPeople": 2,
    "needHelpMessage": "The tomb's stone lid is far too heavy for one person. You need help to move it.",
    "successMessage": "You and your companion(s) strain against the heavy stone lid. With a grinding scrape, it slowly slides aside, revealing the tomb's dark interior.",
    "revealMessage": "Inside the tomb, you see a skeletal form still clutching something in its bony grasp - a dusty, ancient book!",
    "revealsItems": ["dusty-spellbook"],
    "broadcastMessage": "works together with others to push aside the heavy tomb lid.",
    "alreadyPushedMessage": "The tomb lid has already been moved aside. The skeleton within still holds the dusty book."
  },
  "lid": {
    "requiredPeople": 2,
    "needHelpMessage": "The stone lid is far too heavy for one person. You need help to move it.",
    "successMessage": "You and your companion(s) strain against the heavy stone lid. With a grinding scrape, it slowly slides aside.",
    "revealMessage": "Inside the tomb, you see a skeletal form still clutching a dusty, ancient book!",
    "revealsItems": ["dusty-spellbook"],
    "broadcastMessage": "works together with others to push aside the heavy tomb lid.",
    "alreadyPushedMessage": "The tomb lid has already been moved aside."
  },
  "cover": {
    "requiredPeople": 2,
    "needHelpMessage": "The stone cover is far too heavy for one person. You need help to move it.",
    "successMessage": "You and your companion(s) strain against the heavy stone cover. With a grinding scrape, it slowly slides aside.",
    "revealMessage": "Inside the tomb, you see a skeletal form still clutching a dusty, ancient book!",
    "revealsItems": ["dusty-spellbook"],
    "broadcastMessage": "works together with others to push aside the heavy tomb cover.",
    "alreadyPushedMessage": "The tomb cover has already been moved aside."
  }
}
```

**Note**: All three entries (`tomb`, `lid`, `cover`) point to the same puzzle so players can use any term they think of.

### 3. Create the Dusty Book Item
In the Items admin panel, create an item with ID `dusty-spellbook`:

```json
{
  "id": "dusty-spellbook",
  "name": "dusty spellbook",
  "description": "An ancient leather-bound tome, covered in decades of tomb dust. Its pages crackle with residual magical energy. The skeletal guardian must have been a powerful mage in life.",
  "type": "magic",
  "isQuestItem": true,
  "cost": 0,
  "weight": 3,
  "teachesSpell": "your-spell-id-here"
}
```

## Pushable Object Properties

### Required Properties
- **None required** - All properties are optional with sensible defaults

### Core Properties

#### `requiredPeople` (number)
- Default: `1`
- How many people must be in the room to move the object
- For party-required objects, set to `2` or higher
- Only counts party members in the same room

#### `needHelpMessage` (string)
- Default: `"You need help to [action] this. It's too heavy for one person."`
- Message shown when player doesn't have enough party members
- Use `[action]` placeholder for the command used (push/pull/move)

#### `successMessage` (string)
- Default: `"You [action] the [object]."`
- Message shown to the player who pushes when successful
- Use `[action]` and `[object]` placeholders

#### `alreadyPushedMessage` (string)
- Default: `"The [object] has already been moved."`
- Message when trying to push an already-activated object

### Reveal Properties

#### `revealsItems` (array of strings)
- Default: `[]`
- Array of item IDs to add to the room when pushed
- Items appear in the room and can be picked up
- Example: `["dusty-spellbook", "ancient-key", "gold-coins"]`

#### `revealMessage` (string)
- Default: `"You discover something hidden!"`
- Message shown when items are revealed
- Displayed after successMessage

### Broadcast Properties

#### `broadcastMessage` (string)
- Default: `"[playername] pushes the [object]."`
- Message sent to other players in the room
- Player name is automatically prepended

#### `newRoomDescription` (string)
- Optional: Updates the room's visible state
- Not implemented in current version but reserved for future use

## Player Commands

Players can interact with pushable objects using:
- `push [object]` - Push an object
- `pull [object]` - Pull an object  
- `move [object]` - Move an object

All three commands work identically - use whichever feels natural!

## Gameplay Flow Example

### Solo Player Attempt:
```
> examine tomb
An ancient stone tomb sits in the corner. The heavy stone lid appears slightly ajar, as if not fully closed.

> push tomb
The tomb's stone lid is far too heavy for one person. You need help to move it.
```

### With Party (2+ Members):
```
> party invite Bob
You invite Bob to join your party.

[Bob joins the party]

> push tomb
You and your companion(s) strain against the heavy stone lid. With a grinding scrape, it slowly slides aside, revealing the tomb's dark interior.
Inside the tomb, you see a skeletal form still clutching a dusty, ancient book!

> look
[Room description]
You see here: a dusty spellbook.

> get dusty spellbook
You pick up the dusty spellbook.

> examine dusty spellbook
An ancient leather-bound tome, covered in decades of tomb dust. Its pages crackle with residual magical energy.
```

### Bob's Perspective:
```
[Bob sees]
Alice works together with others to push aside the heavy tomb lid.
```

## Advanced Examples

### Simple Single-Person Object
```json
{
  "bookshelf": {
    "requiredPeople": 1,
    "successMessage": "You slide the bookshelf aside, revealing a hidden passage!",
    "revealMessage": "A dark stairway descends into the depths.",
    "revealsItems": ["brass-key"]
  }
}
```

### Heavy Group Object with Multiple Items
```json
{
  "boulder": {
    "requiredPeople": 3,
    "needHelpMessage": "This massive boulder would require at least 3 strong adventurers to budge.",
    "successMessage": "Your party strains together. The boulder rolls aside with a thunderous rumble!",
    "revealMessage": "Behind the boulder, you discover a cache of ancient treasures!",
    "revealsItems": ["gold-crown", "silver-sword", "healing-potion"],
    "broadcastMessage": "and their companions roll the massive boulder aside!"
  }
}
```

### Lever/Switch
```json
{
  "lever": {
    "requiredPeople": 1,
    "successMessage": "You pull the ancient lever. You hear a distant grinding sound...",
    "alreadyPushedMessage": "The lever has already been pulled and won't budge.",
    "broadcastMessage": "pulls the ancient lever."
  }
}
```

## Technical Details

### Persistent State
- Push state is saved per room in `/artifacts/{appId}/public/data/mud-room-states/{roomId}`
- State persists across server restarts
- Once pushed, the object stays pushed for all players
- Revealed items remain in the room until picked up

### Party Requirements
- System checks for active party using `gameParties` collection
- Counts only party members in the same room as the pusher
- Solo players can't push objects requiring 2+ people
- Party members don't need to actively type the command together

### Item Revelation
- Revealed items are added to room's `revealedItems` array
- These items appear in the room description alongside regular items
- Items can be picked up using normal `get` command
- Once picked up, items follow normal inventory rules

### Aliases
You can create multiple pushable entries that all refer to the same puzzle (as shown in the tomb example with "tomb", "lid", and "cover" all having the same configuration).

## Tips for Quest Design

1. **Provide Hints**: Use room details to hint at pushable objects
   - "The bookshelf looks slightly out of place..."
   - "You notice scratches on the floor near the statue..."

2. **Multiple Interactions**: Make objects examinable first
   - `examine tomb` → player sees it's ajar
   - `push tomb` → player moves it

3. **Reward Cooperation**: Use party requirements for valuable loot
   - Encourages multiplayer interaction
   - Makes finding party members rewarding

4. **Tell a Story**: Use messages to create atmosphere
   - "Dust billows out as you disturb the ancient seal..."
   - "The skeleton still clutches its treasure after all these years..."

5. **Quest Integration**: Combine with quest system
   - Quest objective: "Discover the secret of the tomb"
   - Push tomb → reveal quest item
   - Turn in item to complete quest

## Common Issues

**Q: The push command isn't working**
- Make sure the room has a `pushables` field with valid JSON
- Check that the object key matches what the player typed
- Verify JSON syntax is correct (no trailing commas)

**Q: Items aren't appearing after push**
- Ensure `revealsItems` array contains valid item IDs
- Check that items exist in the `mud-items` collection
- Try typing `look` to refresh the room

**Q: Party requirement not working**
- Verify all party members are in the same room
- Check that a party actually exists (use `party` command)
- Make sure `requiredPeople` is set to 2 or higher

**Q: Object can be pushed multiple times**
- This shouldn't happen - the state is persistent
- If it does, check browser console for errors
- May indicate Firebase permission issue

## Next Steps

1. Go to Admin Panel → Rooms tab
2. Find or create your tomb room
3. Add the `details` JSON (for examine commands)
4. Add the `pushables` JSON (for push mechanics)
5. Create the dusty spellbook item in Items tab
6. Test with a friend or second browser window!

Enjoy creating immersive interactive puzzles! 🎮✨
