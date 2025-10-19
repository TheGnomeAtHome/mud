# Quick Start Guide - Trading System

## 🚀 Get Trading in 5 Minutes

### Step 1: Add a Simple Merchant (2 minutes)

Go to Admin Panel → NPCs → Edit an existing NPC or create new:

**Minimum required fields:**
```json
{
  "id": "shopkeeper",
  "name": "a friendly shopkeeper",
  "shortName": "Bob",
  "sells": ["health-potion", "rope", "torch"],
  "haggleable": true
}
```

Click **Save NPC**.

### Step 2: Test Buying (1 minute)

In game, go to the merchant's room and type:
```
> list
```

You should see:
```
═══ Bob's Inventory ═══
Your status: Stranger (0% discount)

  health potion - 50g
  rope - 10g
  torch - 5g

💡 Tip: Use "haggle <price> for <item> from Bob" to negotiate
```

Try buying:
```
> buy torch from Bob
You purchase a torch from Bob for 5 gold.
```

### Step 3: Try Haggling (1 minute)

```
> haggle 40 for potion from Bob
Bob considers for a moment, then nods. "Alright, 40 gold. You've got yourself a deal."

> buy potion from Bob
You purchase health potion from Bob for 40 gold (20% off)!
```

### Step 4: Enable Selling (1 minute)

Edit your merchant again, add:
```json
{
  "buys": ["all"],
  "buyRate": 0.40
}
```

Now players can sell:
```
> sell old sword to Bob
You sell old sword to Bob for 20 gold.
```

### Step 5: Test Player Trading (Optional)

If you have two test accounts:

**Player 1:**
```
> trade with Player2
You request to trade with Player2.
```

**Player 2:**
```
> accept trade
You accept the trade with Player1.
```

**Both players:**
```
> offer iron sword
> offer 50 gold
> confirm trade
✅ Trade complete!
```

---

## 📋 Common Merchant Setups

### General Store (Buys Everything)
```json
{
  "id": "general-store",
  "shortName": "Bella",
  "sells": ["torch", "rope", "bread"],
  "buys": ["all"],
  "buyRate": 0.30,
  "greed": 0.15,
  "haggleable": true
}
```

### Weapon Smith (Specialty)
```json
{
  "id": "blacksmith",
  "shortName": "Gareth",
  "sells": ["iron-sword", "steel-sword", "shield"],
  "buys": ["weapons", "armor", "ore"],
  "buyRate": 0.50,
  "greed": 0.10,
  "haggleable": true
}
```

### Alchemist (High Buyback)
```json
{
  "id": "alchemist",
  "shortName": "Morgana",
  "sells": ["health-potion", "mana-potion"],
  "buys": ["herbs", "potions", "reagents"],
  "buyRate": 0.60,
  "greed": 0.05,
  "haggleable": true
}
```

### Collector (No Haggle, High Pay)
```json
{
  "id": "collector",
  "shortName": "Lord Pemberton",
  "sells": ["rare-gem", "magic-ring"],
  "buys": ["rare-item", "legendary-item"],
  "buyRate": 0.70,
  "greed": 0.05,
  "haggleable": false
}
```

---

## 🎨 Item Properties for Trading

When creating items, add these properties:

### Basic Item (Can be bought/sold)
```json
{
  "id": "health-potion",
  "name": "a health potion",
  "cost": 50,
  "value": 50,
  "movable": true,
  "tradeable": true
}
```

### Weapon (Higher value)
```json
{
  "id": "iron-sword",
  "name": "an iron sword",
  "cost": 100,
  "value": 100,
  "category": "weapons",
  "rarity": "common",
  "movable": true,
  "tradeable": true
}
```

### Quest Item (Cannot trade)
```json
{
  "id": "magic-key",
  "name": "a magic key",
  "cost": 0,
  "movable": true,
  "tradeable": false,
  "bound": true
}
```

---

## 🔧 Property Explanations

### NPC Properties

| Property | Required? | Example | Description |
|----------|-----------|---------|-------------|
| `sells` | Yes | `["sword", "potion"]` | Items NPC sells |
| `buys` | For selling | `["all"]` or `["weapons"]` | What NPC purchases |
| `buyRate` | For selling | `0.40` | % of value NPC pays (40%) |
| `greed` | Optional | `0.10` | Makes haggling harder (0-0.25) |
| `haggleable` | Optional | `true` | Can negotiate prices |
| `specialItems` | Optional | `["legendary-sword"]` | High-rep only items |

### Item Properties

| Property | Required? | Example | Description |
|----------|-----------|---------|-------------|
| `cost` | Yes | `100` | Sell price in gold |
| `value` | Optional | `100` | Resale value (defaults to cost) |
| `movable` | Yes | `true` | Can be picked up |
| `tradeable` | Optional | `true` | Can be traded to players |
| `category` | Optional | `"weapons"` | For merchant buy filters |
| `rarity` | Optional | `"uncommon"` | Affects pricing |
| `bound` | Optional | `false` | If true, can't sell/trade |

---

## 💡 Quick Tips

### For Easy Haggling
- Set `greed: 0.05` (friendly merchant)
- Players with 12+ CHA will succeed often
- Start with 10-15% discount requests

### For Hard Haggling  
- Set `greed: 0.20` (greedy merchant)
- Requires high CHA or reputation
- Makes 20%+ discounts very difficult

### Buy Rates by Merchant Type
- **General Store**: 0.30 (cheap, buys anything)
- **Specialist**: 0.50 (fair for relevant items)
- **Collector**: 0.70 (expensive, rare items only)
- **Fence**: 0.25 (very cheap, no questions)

### Make Items Valuable
- Set `value` higher than `cost` for good resale
- Use `rarity` to make items worth more
- Add to specialist's `buys` list for better rates

---

## 🐛 Troubleshooting

### "No merchants here"
✅ NPC needs `sells` array with at least one item

### "Merchant isn't selling that"
✅ Item ID must be in NPC's `sells` array
✅ Check spelling of item ID exactly

### "Merchant doesn't buy items"
✅ Add `buys` array to NPC
✅ Set `buyRate` (recommend 0.30-0.70)

### "Can't afford that"
✅ Players start with little gold
✅ Give starter gold with `money: 100` in player data
✅ Or lower item prices

### Haggling always fails
✅ Set `greed` lower (0.05-0.10 for easy)
✅ Increase player's CHA stat
✅ Request smaller discounts (10-15%)
✅ Check `haggleable: true` is set

### Players can't trade each other
✅ Both players must be in same room
✅ Items must have `tradeable: true`
✅ Items can't be `bound: true`
✅ Check Firestore rules allow writes

---

## 📖 Full Documentation

For complete details, see:
- **TRADING_SYSTEM.md** - Technical specifications
- **TRADING_COMMANDS.md** - All commands with examples
- **MERCHANT_EXAMPLES.md** - 7 complete merchant templates
- **TRADING_IMPLEMENTATION.md** - Deployment checklist

---

## 🎯 Your First Trading Quest

Create this simple quest to teach players:

**Quest: "A Fair Trade"**
1. Talk to shopkeeper Bob
2. Buy a rope (list, buy rope from Bob)
3. Haggle for a torch (haggle 3 for torch from Bob)
4. Sell an old item (sell <item> to Bob)
5. Check your reputation (reputation with Bob)

**Rewards:**
- 50 XP
- 25 gold
- "Apprentice Merchant" title

---

## 🚀 Ready to Launch?

✅ At least one merchant with `sells` array
✅ Tested `list` command
✅ Tested `buy` command  
✅ Tested `haggle` command
✅ (Optional) Tested player trading
✅ Upload js/trading.js
✅ Upload js/player-trading.js
✅ Upload modified js/game.js
✅ Upload mud.html
✅ Clear cache (Ctrl+F5)

You're ready! Your players can now trade! 🎉

Need help? Check the other documentation files or review the code comments in js/trading.js.
