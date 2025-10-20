# Room Weather Property Updates

## Adding Indoor/Outdoor Status to Rooms

To enable weather effects, each room needs an `isIndoor` property.

### Indoor Rooms (isIndoor: true)
These are protected from weather:
- Buildings (taverns, shops, houses)
- Caves and caverns
- Temples and churches
- Underground areas
- Tents and shelters

### Outdoor Rooms (isIndoor: false)
These experience full weather effects:
- Forest paths
- Open fields
- Mountains
- Roads and streets
- Rivers and lakes
- Clearings

### Example Room Updates

**Before:**
```javascript
{
  "tavern": {
    "name": "The Coach and Horses Tavern",
    "description": "The tavern is warm and filled with the smell of old wood...",
    "exits": { "north": "start", "east": "storage" },
    "npcs": ["barman", "colin"],
    "items": []
  }
}
```

**After:**
```javascript
{
  "tavern": {
    "name": "The Coach and Horses Tavern",
    "description": "The tavern is warm and filled with the smell of old wood...",
    "exits": { "north": "start", "east": "storage" },
    "npcs": ["barman", "colin"],
    "items": [],
    "isIndoor": true  // ← Added property
  }
}
```

## Current Room Updates Needed

Based on your existing rooms, here's how they should be classified:

### Indoor Rooms
```javascript
{
  "tavern": { "isIndoor": true },
  "storage": { "isIndoor": true },
  "shop": { "isIndoor": true },
  "smithy": { "isIndoor": true },
  "dark_cave": { "isIndoor": true }  // Caves count as indoor
}
```

### Outdoor Rooms
```javascript
{
  "start": { "isIndoor": false },  // The Beginning (outdoor portal area)
  "forest_path": { "isIndoor": false },
  "forest_clearing": { "isIndoor": false },
  "woods1": { "isIndoor": false },
  "shadows": { "isIndoor": false }
}
```

## How to Update in Admin Panel

1. Go to Admin Panel → Rooms tab
2. Select each room
3. Add the property: `"isIndoor": true` or `"isIndoor": false`
4. Click "Save Room"

## Bulk Update via Firebase Console

You can also update multiple rooms at once in Firebase:

1. Go to Firebase Console
2. Navigate to Firestore → `artifacts/[your-app]/public/data/mud-rooms`
3. For each room document, add the `isIndoor` field

## Optional: Partial Cover

For advanced usage, you can add partial weather protection:

```javascript
{
  "covered_bridge": {
    "name": "A Covered Bridge",
    "isIndoor": false,
    "partialCover": 0.5,  // 50% weather protection
    // ... other properties
  }
}
```

Values:
- `0.0` = No protection (fully exposed)
- `0.5` = 50% protection (partial cover like bridge, gazebo)
- `1.0` = Full protection (same as isIndoor: true)

## Testing

After updating rooms, test with these commands:

```
> weather              # Check current weather
> setweather rainy     # (Admin) Change to rainy
> go [direction]       # Move between indoor/outdoor
> weather              # Should show different status
```

## Default Behavior

If a room doesn't have the `isIndoor` property:
- The weather system assumes it's **outdoor** (isIndoor: false)
- Players in those rooms will be affected by weather
- You should update all rooms to be explicit about their status
