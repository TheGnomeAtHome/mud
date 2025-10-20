# Weather System Design

## Overview
Dynamic weather system that affects gameplay based on current conditions, player location (indoor/outdoor), and protective equipment.

## Weather Types

### Sunny
- **Effect**: Normal conditions, slight warmth buildup over time
- **Status**: None (baseline)
- **Outdoor Penalty**: +1 heat every 5 minutes

### Rainy
- **Effect**: Players get wet, reduced visibility
- **Status**: `wet` (lose 1 HP every 2 minutes if no protection)
- **Outdoor Penalty**: Cannot see players/items in adjacent rooms

### Snowy
- **Effect**: Players get cold, movement penalties
- **Status**: `cold` (lose 2 HP every minute if no protection)
- **Movement**: 50% chance of movement delay

### Stormy
- **Effect**: Heavy rain + lightning danger
- **Status**: `wet` + `cold`, 10% chance of lightning strike (5-15 damage)
- **Outdoor Penalty**: Movement blocked to some directions

### Foggy
- **Effect**: Very low visibility
- **Status**: None
- **Outdoor Penalty**: Cannot see room descriptions clearly, NPCs/players hidden

### Hot
- **Effect**: Extreme heat, exhaustion
- **Status**: `overheated` (lose 3 HP every minute, -2 to all stats)
- **Outdoor Penalty**: Movement costs double stamina

### Cold
- **Effect**: Freezing temperatures
- **Status**: `freezing` (lose 2 HP every minute, -1 to dexterity)
- **Outdoor Penalty**: Chance of frostbite

## Room Properties

### Indoor vs Outdoor
Rooms should have an `isIndoor` boolean property:
- `isIndoor: true` - Buildings, caves, protected areas (weather has no effect)
- `isIndoor: false` - Open areas, forests, fields (full weather effects)

### Partially Covered
Optional `partialCover` property (0.0 - 1.0):
- `1.0` = Fully covered (indoor)
- `0.5` = Partial protection (reduces weather effects by 50%)
- `0.0` = No protection (outdoor)

## Player Status Effects

### wet
- Applied in: Rain, Storm
- Duration: Until dried (5 minutes indoors, or use "dry off" command)
- Effect: -1 HP every 2 minutes
- Visual: "[You are soaking wet]"

### cold
- Applied in: Snow, Storm, Cold weather
- Duration: Until warmed (indoors + 3 minutes, or near fire)
- Effect: -2 HP every minute, -1 Dexterity
- Visual: "[You are shivering with cold]"

### overheated
- Applied in: Hot weather
- Duration: Until cooled (3 minutes indoors or in shade)
- Effect: -3 HP every minute, -2 to all combat stats
- Visual: "[You are suffering from heat exhaustion]"

### freezing
- Applied in: Prolonged cold exposure
- Duration: Until warmed significantly
- Effect: -3 HP every minute, -2 Dexterity, 25% chance to fail actions
- Visual: "[Your fingers are numb with cold]"

## Protection Items

### Weather Protection Properties
Items can have these protection properties:

```javascript
weatherProtection: {
    rain: 0.8,      // 80% protection from rain
    cold: 0.6,      // 60% protection from cold
    heat: 0.3,      // 30% protection from heat
    snow: 0.5       // 50% protection from snow
}
```

### Example Items

**Raincoat**
```javascript
{
    name: "a waterproof raincoat",
    itemType: "clothing",
    slot: "body",
    weatherProtection: { rain: 0.9, cold: 0.2 }
}
```

**Warm Cloak**
```javascript
{
    name: "a thick woolen cloak",
    itemType: "clothing",
    slot: "body",
    weatherProtection: { cold: 0.8, snow: 0.7, rain: 0.4 }
```

**Desert Robes**
```javascript
{
    name: "light desert robes",
    itemType: "clothing",
    slot: "body",
    weatherProtection: { heat: 0.85, sun: 0.9 }
}
```

## Weather Cycle System

### Global Weather State
Stored in Firebase at `/artifacts/{appId}/public/data/mud-weather`:
```javascript
{
    currentWeather: "rainy",
    startTime: timestamp,
    duration: 600000,  // 10 minutes in ms
    region: "global"   // Future: support multiple regions
}
```

### Weather Transitions
- Weather changes every 10-30 minutes (random)
- Smooth transitions: "The rain begins to fall..." "The storm is clearing..."
- Players in outdoor rooms receive weather change notifications

### Weather Probability
```javascript
const WEATHER_PROBABILITIES = {
    sunny: 0.30,
    rainy: 0.20,
    cloudy: 0.25,
    foggy: 0.10,
    snowy: 0.05,  // Seasonal
    stormy: 0.05,
    hot: 0.03,    // Seasonal
    cold: 0.02    // Seasonal
};
```

## Commands

### weather
Display current weather and player status:
```
> weather
The weather is currently rainy.
You are soaking wet. [-1 HP every 2 minutes]
You are adequately protected with your raincoat.
```

### seek shelter
Attempt to find protection:
```
> seek shelter
You duck under a large tree, gaining some protection from the rain.
```

### dry off
Remove wet status (requires towel or time indoors):
```
> dry off
You dry yourself with a towel.
You are no longer wet.
```

## Admin Commands

### setweather [type]
Force weather change:
```
> setweather stormy
The weather suddenly shifts to a raging storm!
```

### weathercycle [on/off]
Enable/disable automatic weather changes:
```
> weathercycle off
Weather changes are now disabled.
```

## Implementation Files

1. **js/weather.js** - New module for weather system
2. **js/game.js** - Add weather checks to movement, status updates
3. **js/ui.js** - Display weather status in UI
4. **Firebase collection**: `mud-weather` - Current weather state
5. **Room updates**: Add `isIndoor` property to all rooms
6. **Item updates**: Add `weatherProtection` to clothing items

## Future Enhancements

- **Seasonal weather**: Different probabilities by season
- **Regional weather**: Different weather in different zones
- **Weather-based events**: Floods, avalanches, heatwaves
- **Crops/farming**: Weather affects plant growth
- **Fire mechanics**: Rain puts out fires, dry weather increases fire risk
- **Wind**: Affects projectile weapons
- **Temperature system**: More granular than just hot/cold
