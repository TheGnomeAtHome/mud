# MUD Game - Data Import System

## Quick Start

1. Open `import-data.html` in your browser
2. Click on the tab for the data type you want to import (Rooms, Items, NPCs, etc.)
3. Either:
   - Click "📋 Load Template" to see an example
   - Paste your own JSON data
4. Click "✓ Validate JSON" to check for errors
5. Click "⬆️ Import to Firebase" to upload to your database

## Creating Your Own Data

### Option 1: Copy and Modify Templates
1. Look at the example files in `data/templates/`
2. Copy the JSON structure
3. Modify the IDs and values for your content
4. Paste into the importer

### Option 2: Create from Scratch
Use this basic structure for each data type:

#### Rooms
```json
{
  "room-id": {
    "name": "Room Name",
    "description": "Room description",
    "exits": {"north": "other-room-id"},
    "details": {"object": "description"},
    "monsters": [{"monsterId": "monster-id", "respawnTime": 300000}],
    "items": ["item-id"]
  }
}
```

#### Items
```json
{
  "item-id": {
    "name": "Item Name",
    "description": "Item description",
    "type": "weapon",
    "value": 50,
    "cost": 75,
    "damage": 10,
    "weight": 3,
    "movable": true,
    "aliases": ["alias1", "alias2"]
  }
}
```

#### NPCs
```json
{
  "npc-id": {
    "name": "NPC Full Name",
    "shortName": "NPC",
    "description": "NPC description",
    "roomId": "room-id",
    "dialogue": ["Line 1", "Line 2"],
    "sells": ["item-id"],
    "buys": ["item-id"],
    "aiEnabled": false
  }
}
```

#### Monsters
```json
{
  "monster-id": {
    "name": "Monster Name",
    "description": "Monster description",
    "hp": 30,
    "maxHp": 30,
    "damage": 8,
    "xpReward": 50,
    "loot": ["item-id"],
    "aggressive": true
  }
}
```

#### Classes
```json
{
  "class-id": {
    "name": "Class Name",
    "description": "Class description",
    "statBonuses": {"str": 3, "dex": 0, "con": 2, "int": 0, "wis": 0, "cha": 0},
    "hpBonus": 20,
    "mpBonus": 10,
    "abilities": ["Ability 1", "Ability 2"]
  }
}
```

#### Quests
```json
{
  "quest-id": {
    "name": "Quest Name",
    "description": "Quest description",
    "type": "kill",
    "objectives": [
      {"type": "kill", "target": "monster-id", "count": 5}
    ],
    "rewards": {
      "xp": 100,
      "gold": 50,
      "items": ["item-id"]
    },
    "requiredLevel": 1,
    "giver": "npc-id"
  }
}
```

## Working with Spreadsheets

### Excel/Google Sheets → JSON
1. Create your spreadsheet with columns for each property
2. Use a CSV to JSON converter (many free online tools)
3. Or use Excel formulas to generate JSON strings
4. Copy the JSON into the importer

### Example Spreadsheet Structure for Items
| id | name | description | type | value | damage | weight |
|----|------|-------------|------|-------|--------|--------|
| sword1 | Iron Sword | A basic sword | weapon | 50 | 10 | 3 |
| potion1 | Health Potion | Restores HP | consumable | 20 | 0 | 1 |

Then convert to JSON format using a converter.

## Tips

- **IDs must be unique** - Use descriptive IDs like `iron-sword-01` instead of just `sword`
- **Validate first** - Always click "Validate" before importing to catch errors
- **Batched imports** - The system automatically handles large imports (up to 500 items per batch)
- **Backup your data** - Use `export-to-json.html` to export existing data before making bulk changes
- **Test incrementally** - Import a few items first to test, then import the rest

## Features

✅ **Validation** - Checks for required fields and proper JSON format  
✅ **Batched writes** - Efficiently handles large imports  
✅ **Templates** - Built-in examples for each data type  
✅ **Visual feedback** - Clear success/error messages  
✅ **Flexible** - Works with any valid JSON structure  

## Troubleshooting

**"Invalid JSON" error**
- Check for missing commas, quotes, or brackets
- Use a JSON validator (jsonlint.com)
- Make sure the data is an object `{}` not an array `[]`

**"Missing required field" warning**
- Each data type has minimum required fields
- Check the info box in each tab for requirements

**Import seems stuck**
- Large imports (100+ items) may take 10-20 seconds
- Check browser console for errors
- Refresh and try again with a smaller batch

## Next Steps

After importing:
1. Refresh your main game to see the new content
2. Use the admin panel to fine-tune individual entries
3. Export your data periodically as backups
