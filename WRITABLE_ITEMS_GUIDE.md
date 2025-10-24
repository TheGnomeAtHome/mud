# Writable Items System Guide

## Overview
The writable items system allows players to write custom messages in items like books, journals, scrolls, and signs. These messages persist forever and can be read by any player who obtains the item.

## How It Works

### For Players

**Writing Messages:**
```
write book Hello, future readers! This is my story...
write journal Day 1: I found a mysterious cave today.
write in scroll This scroll contains ancient wisdom.
```

**Reading Messages:**
```
read book
read journal
read the scroll
```

The read command will show:
- All entries written in the item
- Author name for each entry
- Timestamp for each entry
- The message content

**Natural Language Variants:**
- "I want to write something in the book"
- "scribe in journal My adventures continue"
- "what does the book say"
- "check what's written in the journal"

### For Admins

**Creating a Writable Item:**

In the admin panel, create an item with these properties:

```json
{
  "id": "leather_journal",
  "name": "A Leather Journal",
  "description": "A well-worn leather journal with blank pages waiting to be filled.",
  "weight": 0.5,
  "movable": true,
  "isReadable": true,
  "isWritable": true,
  "maxWriteLength": 500,
  "maxEntries": 50,
  "readableText": "The pages are blank, waiting for someone to write their story."
}
```

**Key Properties:**

- **`isReadable`**: `true` - Makes the item readable with the `read` command
- **`isWritable`**: `true` - Makes the item writable with the `write` command
- **`maxWriteLength`**: Number (default: 500) - Maximum characters per entry
- **`maxEntries`**: Number (default: 50) - Maximum number of entries before oldest is removed
- **`readableText`**: String - Default text shown if no entries have been written

## Example Writable Items

### Personal Journal
```json
{
  "id": "journal",
  "name": "Personal Journal",
  "description": "A small journal perfect for recording your adventures.",
  "weight": 0.3,
  "movable": true,
  "isReadable": true,
  "isWritable": true,
  "maxWriteLength": 500,
  "maxEntries": 100,
  "readableText": "The journal is empty, ready for your first entry."
}
```

### Guild Logbook
```json
{
  "id": "guild_logbook",
  "name": "Guild Logbook",
  "description": "A thick book used to record guild activities and member contributions.",
  "weight": 2,
  "movable": true,
  "isReadable": true,
  "isWritable": true,
  "maxWriteLength": 1000,
  "maxEntries": 200,
  "readableText": "This logbook chronicles the history of the guild."
}
```

### Message Scroll
```json
{
  "id": "message_scroll",
  "name": "Message Scroll",
  "description": "A rolled parchment scroll for leaving messages.",
  "weight": 0.1,
  "movable": true,
  "isReadable": true,
  "isWritable": true,
  "maxWriteLength": 200,
  "maxEntries": 5,
  "readableText": "The scroll is blank."
}
```

### Community Guestbook
```json
{
  "id": "guestbook",
  "name": "Tavern Guestbook",
  "description": "A guestbook where travelers leave their mark.",
  "weight": 3,
  "movable": false,
  "isReadable": true,
  "isWritable": true,
  "maxWriteLength": 300,
  "maxEntries": 500,
  "readableText": "Many travelers have signed this guestbook over the years."
}
```

### Ancient Tome (Read-Only)
```json
{
  "id": "ancient_tome",
  "name": "Ancient Tome",
  "description": "A dusty old book with yellowed pages.",
  "weight": 2,
  "movable": true,
  "isReadable": true,
  "isWritable": false,
  "readableText": "The tome contains ancient wisdom about the old magic..."
}
```

## Use Cases

### 1. Player Journals
- Players document their adventures
- Track quest progress personally
- Leave notes for themselves

### 2. Communication
- Leave messages for other players
- Guild coordination and planning
- Trading notes and offers

### 3. World Building
- Players contribute to world lore
- Community storytelling
- Historical records

### 4. Quest Items
- Collect clues written in journals
- Deliver messages via scrolls
- Decode ancient texts

### 5. Social Hubs
- Tavern guestbooks
- Guild notice boards (as items)
- Community bulletin boards

## Technical Details

### Data Structure

Each writable item stores entries as an array in the player's inventory:

```javascript
{
  "id": "journal",
  "name": "Personal Journal",
  // ... other item properties ...
  "entries": [
    {
      "author": "PlayerName",
      "authorId": "user123",
      "text": "Today I defeated the dragon!",
      "timestamp": 1234567890000
    },
    {
      "author": "AnotherPlayer",
      "authorId": "user456",
      "text": "Found this journal. Interesting story!",
      "timestamp": 1234567890001
    }
  ]
}
```

### Entry Limits

- **Character Limit**: Prevents spam and keeps messages concise
- **Entry Limit**: Oldest entries are removed when limit is reached
- Both limits are customizable per item

### Persistence

- Entries are stored with the item in the player's inventory
- When dropped, the item retains all entries
- When picked up by another player, they can read all entries
- Entries survive server restarts (stored in Firebase)

## Player Commands

### Writing
```
write [item] [your message]
write book This is my first entry
write in journal Day 5 of my journey
```

### Reading
```
read [item]
read book
read the journal
```

### Natural Language
```
I want to write in the book about my adventure today
what does the scroll say
check the journal entries
```

## Tips for Game Masters

### Encourage Usage
- Place writable items in starting areas
- Make some quests require reading/writing
- Create community items (guestbooks) in social hubs

### Set Appropriate Limits
- **Short messages** (200-300 chars): Scrolls, notes, signs
- **Medium messages** (500-1000 chars): Journals, letters
- **Long messages** (1000+ chars): Books, tomes, guild logbooks

### Create Quest Hooks
- Mysterious journal found in dungeon
- Decode messages in ancient scrolls
- Deliver sealed letters between NPCs
- Collect diary pages scattered across world

### Moderation
- Monitor for inappropriate content
- Set reasonable character limits
- Use `maxEntries` to prevent item bloat
- Consider making some items non-droppable to prevent spam

## Examples in Gameplay

**Player 1 writes in journal:**
```
> write journal Day 1: Found a cave full of goblins. Need backup!

You write in Personal Journal: "Day 1: Found a cave full of goblins. Need backup!"
Your message has been recorded.
```

**Player 1 drops journal:**
```
> drop journal

You drop Personal Journal.
```

**Player 2 picks up journal:**
```
> get journal

You pick up Personal Journal.

> read journal

You read Personal Journal:

=== Entries in Personal Journal ===

Entry 1 - PlayerOne (10/23/2025 2:30:00 PM):
"Day 1: Found a cave full of goblins. Need backup!"

=== End of Entries ===
```

**Player 2 adds their own entry:**
```
> write journal I'm here to help! Let's go get those goblins.

You write in Personal Journal: "I'm here to help! Let's go get those goblins."
Your message has been recorded.
```

Now the journal has two entries from different players, creating a collaborative story!

## Advanced Features

### Quest Integration
Create quests that require:
- Writing specific keywords in books
- Reading certain journals to progress
- Collecting multiple written items

### Trading
Writable items are perfect for:
- IOUs and promises
- Trade agreements
- Reputation tracking

### Events
Use writable items for:
- Treasure hunts (clues in journals)
- Murder mysteries (diary entries)
- Historical events (witness accounts)

## Troubleshooting

### "You can't write on [item]"
- Check that `isWritable: true` is set on the item
- Verify the item is in your inventory

### "What do you want to write?"
- Include your message after the item name
- Example: `write book Your message here`

### Messages getting truncated
- Check the item's `maxWriteLength` setting
- Write shorter messages or increase the limit

### Oldest entries disappearing
- This is normal when `maxEntries` is reached
- Increase `maxEntries` for items that need more storage
