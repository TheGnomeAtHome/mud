# Weather System - Quick Start (5 Minutes)

## Instant Setup

### Step 1: Update Your Rooms (2 minutes)

Go to Admin Panel → Rooms tab and add `isIndoor` property:

**Indoor Rooms (protected from weather):**
```
tavern: Add {"isIndoor": true}
storage: Add {"isIndoor": true}
shop: Add {"isIndoor": true}
smithy: Add {"isIndoor": true}
dark_cave: Add {"isIndoor": true}
```

**Outdoor Rooms (affected by weather):**
```
start: Add {"isIndoor": false}
forest_path: Add {"isIndoor": false}
forest_clearing: Add {"isIndoor": false}
woods1: Add {"isIndoor": false}
shadows: Add {"isIndoor": false}
```

### Step 2: Add Protection Items (1 minute - Optional)

In Admin Panel → Items tab, create one test item:

**Raincoat:**
```json
{
  "name": "a waterproof raincoat",
  "description": "A sturdy raincoat that repels water",
  "itemType": "clothing",
  "cost": 50,
  "movable": true,
  "weatherProtection": {
    "rainy": 0.9,
    "stormy": 0.7
  }
}
```

### Step 3: Test It! (2 minutes)

1. **Reload the game**
   
2. **Check weather:**
   ```
   > weather
   ```

3. **(Admin) Change weather:**
   ```
   > setweather rainy
   ```

4. **Go outside:**
   ```
   > look
   ```
   You'll see: "⛅ Rain falls steadily from dark clouds"

5. **Wait 2 minutes or use admin command to speed up time**
   ```
   [After 2 minutes]
   The rainy weather saps 1 HP from you.
   You are soaking wet.
   ```

6. **Go inside:**
   ```
   > south  (to tavern)
   > look
   ```
   You'll see: "You are safely indoors"

7. **Get protection (if you added the raincoat):**
   ```
   > get raincoat
   > go outside
   > weather
   ```
   You'll see: "You have some weather protection"

## That's It!

The weather system is now fully functional. Weather will change automatically every 10-30 minutes.

## Quick Command Reference

### Player Commands
- `weather` - Check current conditions and your status
- `look` - Room descriptions show weather outdoors

### Admin Commands
- `setweather [type]` - Force weather change
  - Types: sunny, cloudy, rainy, snowy, stormy, foggy, hot, cold

## Troubleshooting

**"Weather system is not initialized"**
→ Reload the game, check console for errors

**No weather showing in rooms**
→ Make sure room has `isIndoor: false`

**Not taking damage outdoors**
→ Wait 1-2 minutes for status effects to apply

**Can't move**
→ Weather penalty active (snowy/stormy), try again or go indoors

## Full Documentation

See these files for complete details:
- `WEATHER_IMPLEMENTATION_COMPLETE.md` - Full implementation guide
- `WEATHER_SYSTEM.md` - Design documentation
- `WEATHER_ROOM_UPDATES.md` - Room setup guide
- `data/weather-items-example.json` - 8 example items

Enjoy the weather! ⛅🌧️❄️⚡
