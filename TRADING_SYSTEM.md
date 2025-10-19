# Advanced Trading System

## Overview
A comprehensive trading system with haggling mechanics, player-to-player trades, merchant relationships, and dynamic pricing.

## Features

### 1. NPC Trading
- **Buy from NPCs**: Purchase items at listed prices
- **Sell to NPCs**: Sell items from inventory (NPCs buy at 40% of item value by default)
- **Haggling**: Use charisma and speech skill to negotiate better prices
- **Merchant Reputation**: Build relationships for better deals over time
- **Dynamic Pricing**: Prices fluctuate based on supply/demand

### 2. Player-to-Player Trading
- **Trade Requests**: Initiate secure trades with other players
- **Item Exchange**: Trade multiple items + gold simultaneously
- **Trade Windows**: Both players must accept before trade completes
- **Trade History**: Track all trades for accountability
- **Anti-Scam Protection**: Both parties see exactly what they'll receive

### 3. Haggling System
- **Success Chance**: Based on CHA stat, merchant relationship, and offer amount
- **Counteroffers**: NPCs make counteroffers if initial haggle fails
- **Multiple Attempts**: Limited haggle attempts per transaction (3 max)
- **Merchant Mood**: Affects willingness to negotiate
- **Critical Success**: Occasionally get exceptional deals (10% off)
- **Critical Failure**: May offend merchant, making them refuse to trade

### 4. Merchant Relationships
- **Reputation Levels**: 
  - Stranger (0-99 points): Base prices
  - Acquaintance (100-299): 5% discount
  - Friend (300-599): 10% discount, access to rare items
  - Trusted (600-999): 15% discount, special quests
  - Partner (1000+): 20% discount, exclusive items

- **Reputation Gains**:
  - Buy item: +1 per 10 gold spent
  - Sell item: +1 per 5 gold value
  - Complete merchant quest: +50
  - Fair deal (no haggling): +2
  - Successful haggle: +1
  - Failed haggle: -1

### 5. Dynamic Pricing
- **Supply & Demand**: Prices change based on how often items are bought/sold
- **Scarcity Multiplier**: Rare items cost more
- **Bulk Discounts**: Buy 5+ of same item for 10% off
- **Time-Based**: Merchants restock weekly, prices reset

## Commands

### Buying
```
buy <item> from <npc>           - Purchase at list price
haggle <price> for <item> from <npc>  - Attempt to negotiate
appraise <item>                 - See item value and vendor prices
list                           - Show merchant's inventory with prices
```

### Selling
```
sell <item> to <npc>           - Sell at merchant's offer price
haggle <price> for <item> to <npc>  - Negotiate sell price
value <item>                   - Check how much merchants will pay
```

### Player Trading
```
trade with <player>            - Initiate trade request
accept trade                   - Accept incoming trade request
decline trade                  - Reject trade request
offer <item/gold>              - Add item or gold to trade
remove <item/gold>             - Remove from your trade offer
confirm trade                  - Lock in your offer (both must confirm)
cancel trade                   - Cancel ongoing trade
```

### Relationships
```
reputation with <npc>          - Check relationship status
merchants                      - List all known merchants and reputations
```

## Haggling Mechanics

### Success Formula
```
Base Chance = 30%
+ (CHA - 10) × 3%              (charisma modifier)
+ Reputation Bonus             (0-20% based on relationship)
+ Discount Requested Penalty   (larger discounts harder to get)
- Merchant Greed               (0-15% based on merchant type)

Discount Requested Penalty:
- 5-10% off: -5%
- 11-20% off: -15%
- 21-30% off: -30%
- 31%+ off: -50%
```

### Example
Player with 14 CHA haggles with Friend merchant:
- Base: 30%
- CHA bonus: +12% (14-10 = 4, ×3 = 12)
- Friend bonus: +10%
- Requesting 15% off: -15%
- Greedy merchant: -10%
**Final chance: 27%**

### Outcomes
- **Critical Success (5%)**: Get requested discount + 5% extra
- **Success**: Get requested discount
- **Partial Success (30%)**: Merchant counteroffers (half your request)
- **Failure**: Keep original price, lose 1 haggle attempt
- **Critical Failure (5%)**: Merchant refuses to trade for 5 minutes

## NPC Merchant Properties

### Extended NPC Data Structure
```javascript
{
  id: "blacksmith",
  name: "a burly blacksmith",
  shortName: "Gareth",
  sells: ["sword", "armor", "shield"],
  buys: ["ore", "gems", "weapons"],  // NEW: What NPC will purchase
  buyRate: 0.4,                      // NEW: Percentage of item value paid (40%)
  greed: 0.1,                        // NEW: 0-1, affects haggling difficulty
  haggleable: true,                  // NEW: Can you haggle with this NPC?
  specialItems: ["legendary-sword"], // NEW: Items available to Trusted+ friends
  restockDay: 0,                     // NEW: Day of week to restock (0=Sun, 6=Sat)
  priceModifiers: {                  // NEW: Current price multipliers
    "sword": 1.2,                    // 20% more expensive
    "ore": 0.8                       // 20% cheaper
  }
}
```

### Merchant Types
- **General Store**: Buys everything at low rate (30%), sells basics
- **Specialist**: Buys related items at good rate (50%), sells specialty goods
- **Fence**: Buys stolen goods at low rate (25%), no questions asked
- **Collector**: Buys rare items at high rate (70%), doesn't haggle

## Player Trading Flow

### Initiation
1. Player A: `trade with PlayerB`
2. System: Creates trade session, notifies Player B
3. Player B: `accept trade` or `decline trade`

### Negotiation
4. Both players add items/gold:
   - Player A: `offer sword`
   - Player A: `offer 50 gold`
   - Player B: `offer health potion`
   - Player B: `offer 100 gold`

5. Players can see each other's offers in real-time

### Confirmation
6. When ready:
   - Player A: `confirm trade`
   - Player B: `confirm trade`

7. Both must confirm within 60 seconds

### Completion
8. System verifies both players have offered items
9. Exchanges items atomically (all or nothing)
10. Logs trade to history
11. Notifies both players

### Security
- Items locked during trade (can't be used/dropped)
- Trade cancels if either player moves rooms
- Trade cancels if either player logs out
- Both parties see exactly what they're getting

## Item Properties for Trading

### Extended Item Data
```javascript
{
  id: "ruby",
  name: "a glowing ruby",
  cost: 500,                    // Base merchant price
  value: 500,                   // Intrinsic value (for selling)
  rarity: "rare",              // common|uncommon|rare|epic|legendary
  tradeable: true,             // Can be traded to players?
  merchantWants: ["jeweler", "collector"], // Which NPCs want this
  stolen: false,               // If true, only fences will buy
  bound: false                 // If true, cannot be traded
}
```

## Trade History

### Stored Per Player
```javascript
{
  tradeHistory: [
    {
      timestamp: 1729389600000,
      type: "npc_buy",
      npc: "blacksmith",
      item: "sword",
      price: 80,          // Final haggled price
      listPrice: 100,     // Original price
      haggled: true
    },
    {
      timestamp: 1729389700000,
      type: "player_trade",
      partner: "PlayerName",
      gave: ["sword", "50 gold"],
      received: ["health potion", "100 gold"]
    }
  ]
}
```

## Implementation Files

### New Files
1. **js/trading.js** - Core trading logic
2. **js/haggling.js** - Haggling calculations
3. **js/merchant-rep.js** - Reputation system

### Modified Files
1. **js/game.js** - Add trade commands to executeParsedCommand
2. **js/data-loader.js** - Load merchant reputation data
3. **mud.html** - Import new modules

### Firestore Collections
1. **mud-merchant-reputation** - Player reputation with each NPC
2. **mud-active-trades** - Ongoing player-to-player trades
3. **mud-trade-history** - Completed trade logs

## UI Enhancements

### Trade Window (when trading with player)
```
╔════════════════════════════════════════════╗
║        Trading with PlayerName             ║
╠════════════════════════════════════════════╣
║  Your Offer:          Their Offer:         ║
║  - Iron Sword         - Health Potion ×3   ║
║  - 50 gold            - 120 gold           ║
║                                            ║
║  [Confirm] [Cancel]   [Waiting...]         ║
╚════════════════════════════════════════════╝
```

### Haggling Dialog
```
You: "How about 80 gold for the sword?"
Blacksmith: "Ha! You must be joking. The lowest I'll go is 90 gold."
[Accept 90] [Counter: ___ gold] [Give Up]
```

## Configuration

### Game Balance Settings
```javascript
// In js/config.js or settings collection
export const TRADE_SETTINGS = {
  DEFAULT_BUY_RATE: 0.40,        // NPCs pay 40% of value
  HAGGLE_ATTEMPTS: 3,             // Max haggle tries per transaction
  TRADE_TIMEOUT: 60,              // Seconds before trade auto-cancels
  REPUTATION_DECAY: 0.01,         // Daily decay (1% per day)
  PRICE_VOLATILITY: 0.1,          // How much prices fluctuate
  BULK_DISCOUNT_THRESHOLD: 5,     // Items needed for bulk discount
  BULK_DISCOUNT_RATE: 0.10        // 10% off bulk purchases
};
```

## Future Enhancements
- Auction house for player sales
- Trade skills (merchant class bonus)
- Black market with illegal goods
- Item durability affecting resale value
- Seasonal pricing (holiday sales)
- NPC merchant personalities (chatty, gruff, suspicious)
- Trade caravans between towns
- Player-run shops
