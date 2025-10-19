# Trading Commands - Quick Reference

## Buying from NPCs

### Basic Commands
```
list                              - Show what merchants in room are selling
list <merchant>                   - Show specific merchant's inventory
buy <item> from <merchant>        - Purchase at current price
appraise <item>                   - Check item's value
```

### Haggling
```
haggle <price> for <item> from <merchant>    - Try to negotiate lower price
```

**Example:**
```
> list
Blacksmith's Inventory
Your status: Friend (10% discount)

  iron sword - 90g (was 100g)
  steel armor - 450g (was 500g)

> haggle 80 for sword from blacksmith
Blacksmith: "I can't go that low, but how about 85 gold?"

> buy sword from blacksmith
You purchase iron sword from Blacksmith for 85 gold (15% off)!
```

## Selling to NPCs

```
sell <item> to <merchant>         - Sell item at merchant's rate
value <item>                      - See what merchants will pay
```

**Example:**
```
> value old sword
═══ Appraisal: old sword ═══
Base value: 50 gold

Merchants who might buy this:
  Blacksmith: 20g (40% of value)
  Collector: 35g (70% of value)

> sell old sword to collector
You sell old sword to Collector for 35 gold.
```

## Merchant Reputation

```
reputation with <merchant>        - Check your standing
merchants                         - List all known merchants
```

**Reputation Levels:**
- **Stranger** (0-99): Base prices
- **Acquaintance** (100-299): 5% discount
- **Friend** (300-599): 10% discount, rare items
- **Trusted** (600-999): 15% discount, special quests
- **Partner** (1000+): 20% discount, exclusive items

**How to Gain Reputation:**
- Buy items: +1 per 10 gold spent
- Sell items: +1 per 5 gold value
- Fair trade (no haggling): +2 bonus
- Successful haggle: +1
- Failed haggle: -1

## Player-to-Player Trading

### Initiate Trade
```
trade with <player>               - Request to trade
accept trade                      - Accept incoming request
decline trade                     - Reject request
```

### During Trade
```
offer <item>                      - Add item to your offer
offer <amount> gold               - Add gold to your offer
remove <item>                     - Remove item from offer
confirm trade                     - Lock in your offer
cancel trade                      - Cancel the trade
```

**Complete Trading Example:**
```
> trade with Sarah
You request to trade with Sarah.
Waiting for Sarah to respond...

[Sarah accepts]

Trading with Sarah
┌─────────────────┬─────────────────┐
│ Your Offer      │ Their Offer     │
│ Nothing yet     │ Nothing yet     │
└─────────────────┴─────────────────┘

> offer iron sword
You add iron sword to the trade.

> offer 50 gold
You offer 50 gold.

Trading with Sarah
┌─────────────────┬─────────────────┐
│ Your Offer      │ Their Offer     │
│ • iron sword    │ • health potion │
│ • 50 gold       │ • 100 gold      │
└─────────────────┴─────────────────┘

> confirm trade
You confirm the trade.
Waiting for Sarah to confirm...

✅ Trade complete with Sarah!
You received: health potion, 100 gold
```

## Haggling Tips

### Success Factors
1. **Charisma** - Higher CHA = better chance
2. **Reputation** - Better standing = easier haggling
3. **Discount Size** - Small discounts easier to get
4. **Merchant Greed** - Some merchants harder than others

### Haggling Outcomes
- **Critical Success (5%)** - Get discount + 5% extra!
- **Success** - Get your requested discount
- **Counteroffer (30%)** - Merchant meets you halfway
- **Failure** - Price stays same, lose attempt
- **Critical Failure (5%)** - Merchant refuses to trade!

### Strategy
- Start with 10-15% off (easiest)
- Build reputation first for better success
- Merchants counteroffer - accept or try again
- You get 3 haggle attempts per transaction

## Merchant Types

### General Store
- Buys everything at low rate (30%)
- Sells basic supplies
- Good for unloading junk

### Specialist (Blacksmith, Alchemist, etc.)
- Buys related items at good rate (50%)
- Sells specialty goods
- Best for selling relevant items

### Fence
- Buys stolen goods (25% rate)
- No questions asked
- Lower prices but accepts everything

### Collector
- Buys rare items at high rate (70%)
- Doesn't haggle
- Best for valuable items

## Trade Safety

### Player Trading
- Both players must confirm before trade completes
- Items locked during trade (can't be used/dropped)
- Trade cancels if either player:
  - Moves to different room
  - Logs out
  - Doesn't confirm within 60 seconds
- Both see exactly what they'll receive

### NPC Trading
- Items can't be bound (quest items stay with you)
- Check reputation for best prices
- Haggle before buying for discounts
- Merchants restock weekly

## Advanced Features

### Bulk Buying
Buy 5+ of same item → 10% discount automatically

### Dynamic Pricing
Prices fluctuate based on supply/demand over time

### Special Items
High reputation unlocks rare items from merchants

### Trade History
All trades logged for your records

## Common Questions

**Q: Why can't I haggle with this merchant?**
A: Some merchants have fixed prices (haggleable: false)

**Q: My trade with another player timed out**
A: Both players must confirm within 60 seconds

**Q: How do I see what I can afford?**
A: Use `inventory` to check your gold, then `list` at merchants

**Q: Can I trade quest items?**
A: No, bound items cannot be traded

**Q: Why does this merchant pay so little?**
A: Build reputation! Higher rep = better sell prices

**Q: Can I haggle when selling?**
A: Not yet, but build reputation for better base rates

## Pro Tips

1. **Build reputation early** - Discounts save lots of gold long-term
2. **Appraise before selling** - Different merchants pay different rates
3. **Bulk buy consumables** - 5+ items = automatic 10% off
4. **Use player trading** - Often better deals than NPC shops
5. **Haggle on expensive items** - More gold saved
6. **Check reputation regularly** - Know when you'll hit next tier
7. **Specialize merchants** - Sell weapons to blacksmith, not grocer
8. **Don't offend merchants** - Critical failures hurt reputation
9. **Fair trades build rep faster** - Sometimes just buy normally
10. **Save rare items** - Collectors pay 70%, don't sell to general store!
