# Example Merchant NPCs with Trading Properties

These are example NPCs configured for the advanced trading system. You can create these through the admin panel or import them directly.

## 1. Blacksmith (General Merchant)

```json
{
  "id": "blacksmith",
  "name": "a burly blacksmith",
  "shortName": "Gareth",
  "description": "A muscular blacksmith with soot-stained arms and a friendly smile. His shop is filled with the sound of hammer on anvil.",
  "currentRoom": "town-square",
  "sells": [
    "iron-sword",
    "steel-sword",
    "iron-armor",
    "steel-armor",
    "shield",
    "iron-helmet"
  ],
  "buys": [
    "iron-sword",
    "steel-sword",
    "iron-ore",
    "steel-ore",
    "gems",
    "weapons",
    "armor"
  ],
  "buyRate": 0.50,
  "greed": 0.10,
  "haggleable": true,
  "specialItems": [
    "legendary-sword",
    "dragon-scale-armor"
  ],
  "restockDay": 1,
  "priceModifiers": {
    "iron-sword": 1.0,
    "steel-sword": 1.2
  },
  "dialogue": [
    "Need something forged? I've got the best metalwork in town!",
    "That's quality steel right there, friend.",
    "Been smithing for twenty years. You won't find better."
  ],
  "aiEnabled": false
}
```

## 2. Alchemist (Specialist)

```json
{
  "id": "alchemist",
  "name": "a mysterious alchemist",
  "shortName": "Morgana",
  "description": "A hooded figure surrounded by bubbling potions and strange herbs. The air smells of sulfur and lavender.",
  "currentRoom": "alchemy-shop",
  "sells": [
    "health-potion",
    "mana-potion",
    "antidote",
    "strength-elixir",
    "invisibility-potion"
  ],
  "buys": [
    "herbs",
    "mushrooms",
    "monster-parts",
    "potions",
    "reagents"
  ],
  "buyRate": 0.60,
  "greed": 0.05,
  "haggleable": true,
  "specialItems": [
    "philosophers-stone",
    "dragons-breath-potion"
  ],
  "restockDay": 3,
  "priceModifiers": {
    "health-potion": 0.9,
    "mana-potion": 1.1
  },
  "dialogue": [
    "The ingredients you bring me could create miracles... or disasters.",
    "My potions are the finest in the realm, I assure you.",
    "Alchemy is not magic, it is science. Ancient science."
  ],
  "aiEnabled": true
}
```

## 3. General Store Owner (Everything)

```json
{
  "id": "shopkeeper",
  "name": "a cheerful shopkeeper",
  "shortName": "Bella",
  "description": "A portly woman with rosy cheeks and a warm smile. Her shop is crammed with every imaginable supply.",
  "currentRoom": "general-store",
  "sells": [
    "torch",
    "rope",
    "bread",
    "water-flask",
    "backpack",
    "bandage",
    "map"
  ],
  "buys": [
    "all"
  ],
  "buyRate": 0.30,
  "greed": 0.15,
  "haggleable": true,
  "specialItems": [],
  "restockDay": 0,
  "priceModifiers": {
    "torch": 1.0,
    "rope": 1.0
  },
  "dialogue": [
    "Welcome! We've got everything you need for your adventure!",
    "Lowest prices in town, I promise!",
    "Buying or selling? Either way, you came to the right place!"
  ],
  "aiEnabled": false
}
```

## 4. Fence (Black Market)

```json
{
  "id": "fence",
  "name": "a shady figure",
  "shortName": "Slim",
  "description": "A thin man with shifty eyes who speaks in hushed tones. His shop is in a dark alley.",
  "currentRoom": "dark-alley",
  "sells": [
    "lockpick-set",
    "poison",
    "smoke-bomb",
    "disguise-kit"
  ],
  "buys": [
    "all"
  ],
  "buyRate": 0.25,
  "greed": 0.20,
  "haggleable": true,
  "specialItems": [
    "master-lockpick",
    "deadly-poison"
  ],
  "restockDay": 6,
  "priceModifiers": {
    "lockpick-set": 1.5,
    "poison": 2.0
  },
  "dialogue": [
    "I don't ask questions, and you don't tell lies. Deal?",
    "Got something... special? I buy things others won't.",
    "Keep your voice down. Walls have ears."
  ],
  "aiEnabled": false,
  "acceptsStolenGoods": true
}
```

## 5. Collector (Rare Items)

```json
{
  "id": "collector",
  "name": "an eccentric collector",
  "shortName": "Lord Pemberton",
  "description": "A well-dressed nobleman with a monocle, surrounded by shelves of curiosities and artifacts.",
  "currentRoom": "collectors-mansion",
  "sells": [
    "ancient-artifact",
    "rare-gem",
    "magic-ring",
    "enchanted-amulet"
  ],
  "buys": [
    "rare-gem",
    "ancient-artifact",
    "magic-item",
    "legendary-item",
    "quest-item"
  ],
  "buyRate": 0.70,
  "greed": 0.05,
  "haggleable": false,
  "specialItems": [
    "crown-of-kings",
    "staff-of-power"
  ],
  "restockDay": 5,
  "priceModifiers": {
    "rare-gem": 1.3,
    "ancient-artifact": 1.5
  },
  "dialogue": [
    "Ah, a fellow connoisseur of the rare and beautiful!",
    "I pay top dollar for truly unique items.",
    "My collection is the finest in the realm. Only the best will do."
  ],
  "aiEnabled": true
}
```

## 6. Traveling Merchant (Dynamic)

```json
{
  "id": "traveling-merchant",
  "name": "a traveling merchant",
  "shortName": "Rashid",
  "description": "A weathered traveler with a pack full of exotic goods from distant lands.",
  "currentRoom": "town-square",
  "sells": [
    "spice",
    "silk",
    "exotic-fruit",
    "foreign-weapon",
    "treasure-map"
  ],
  "buys": [
    "gems",
    "jewelry",
    "rare-items"
  ],
  "buyRate": 0.45,
  "greed": 0.12,
  "haggleable": true,
  "specialItems": [
    "magic-carpet",
    "djinn-lamp"
  ],
  "restockDay": 2,
  "priceModifiers": {
    "spice": 0.8,
    "silk": 1.4,
    "treasure-map": 2.0
  },
  "dialogue": [
    "Greetings, friend! I bring wonders from across the desert!",
    "You won't find these goods anywhere else, I swear it!",
    "A special price, just for you, my friend!"
  ],
  "aiEnabled": true,
  "wanders": true,
  "wanderInterval": {
    "min": 300,
    "max": 600
  }
}
```

## 7. Innkeeper (Services + Items)

```json
{
  "id": "innkeeper",
  "name": "a jovial innkeeper",
  "shortName": "Harold",
  "description": "A robust man with a barrel chest and infectious laugh. The smell of ale and roasted meat fills the air.",
  "currentRoom": "tavern",
  "sells": [
    "ale",
    "bread",
    "roasted-meat",
    "room-key"
  ],
  "buys": [
    "food",
    "drinks"
  ],
  "buyRate": 0.40,
  "greed": 0.08,
  "haggleable": true,
  "specialItems": [
    "legendary-ale"
  ],
  "restockDay": 0,
  "priceModifiers": {
    "ale": 0.9,
    "bread": 0.8
  },
  "dialogue": [
    "Welcome to the Prancing Pony! Best ale in the kingdom!",
    "Hungry? Thirsty? We've got you covered!",
    "Pull up a stool and tell me about your adventures!"
  ],
  "aiEnabled": true
}
```

## Trading Property Explanations

### Core Properties
- **sells**: Array of item IDs this NPC sells
- **buys**: Array of item IDs or categories this NPC purchases ("all" for everything)
- **buyRate**: Percentage of item value NPC pays (0.40 = 40%)
- **greed**: 0-1 scale, increases prices (0.10 = 10% markup)
- **haggleable**: Can players negotiate with this NPC?

### Advanced Properties
- **specialItems**: Only available to high-reputation customers
- **restockDay**: Day of week to reset inventory (0=Sunday, 6=Saturday)
- **priceModifiers**: Item-specific price multipliers
- **acceptsStolenGoods**: Will buy items marked as stolen

### Merchant Personality
- **greed: 0.05-0.10**: Fair merchant, easy to negotiate
- **greed: 0.10-0.15**: Normal merchant
- **greed: 0.15-0.25**: Greedy merchant, hard to negotiate
- **haggleable: false**: Fixed prices only

### Buy Rates by Type
- **General Store**: 0.30 (buys anything cheap)
- **Specialized Shop**: 0.50 (fair rate for related items)
- **Collector**: 0.70 (high rate for rare items)
- **Fence**: 0.25 (low rate, no questions)

## Item Categories for "buys" Field

Instead of listing every item, use categories:
- `"all"` - Buys everything
- `"weapons"` - Swords, axes, bows
- `"armor"` - All protective gear
- `"potions"` - Consumable liquids
- `"food"` - Edible items
- `"herbs"` - Alchemical ingredients
- `"gems"` - Precious stones
- `"jewelry"` - Rings, amulets, necklaces
- `"tools"` - Lockpicks, ropes, torches
- `"magic-items"` - Enchanted objects
- `"rare-items"` - High-value unique items

## Creating Merchants in Admin Panel

1. Go to Admin Panel → NPCs tab
2. Click "New NPC"
3. Fill in basic info (name, description, room)
4. Set sells array (items you want them to sell)
5. Set buys array (categories or specific items)
6. Set buyRate (0.30-0.70 depending on merchant type)
7. Set greed (0.05-0.20, lower = easier haggling)
8. Check "haggleable" if you want negotiation enabled
9. Add specialItems for high-reputation rewards
10. Save NPC

## Testing Your Merchants

```
1. Go to merchant's room
2. Type: list
   Should show inventory with prices

3. Type: reputation with <merchant>
   Should show Stranger (0 points) initially

4. Type: buy <item> from <merchant>
   Should work at list price

5. Type: haggle 50 for <item> from <merchant>
   Should get response based on offer

6. Type: sell <item> to <merchant>
   Should work if merchant buys that type

7. Buy more items, check reputation again
   Should see points increasing
```

## Balancing Tips

### Price Setting
- Common items: 10-50 gold
- Uncommon: 50-200 gold
- Rare: 200-1000 gold
- Epic: 1000-5000 gold
- Legendary: 5000+ gold

### Buy Rates
- Low value items: 30-40% (not worth much used)
- Specialized items: 50-60% (merchant wants them)
- Rare/quest items: 70-80% (collector's value)

### Reputation Gains
Default system:
- +1 per 10 gold spent (buying)
- +1 per 5 gold value (selling)
- Requires 100+ transactions to reach Acquaintance
- Encourages repeat business

### Haggling Difficulty
Set greed based on merchant personality:
- Friendly merchant: 0.05
- Normal merchant: 0.10
- Greedy merchant: 0.15
- Very greedy: 0.20+

Players with 14 CHA can typically get 10-15% off with normal merchants.
