# Container System Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PLAYER CHARACTER                        │
├─────────────────────────────────────────────────────────────┤
│ Strength: 12                                                 │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │              CARRYING CAPACITY                          │ │
│ │                                                          │ │
│ │  Base:     50 lbs                                       │ │
│ │  Strength: 12 × 5 = 60 lbs                             │ │
│ │  Backpack: +20 lbs                                      │ │
│ │  ─────────────────────                                  │ │
│ │  Total:    130 lbs                                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │              INVENTORY (45.5 / 130 lbs)                 │ │
│ │                                                          │ │
│ │  ┌──────────────────────────────────────────────────┐  │ │
│ │  │  📦 Leather Backpack [3 lbs] (equipped)          │  │ │
│ │  │  ├─ Capacity: 21.5/50 lbs                        │  │
│ │  │  ├─ Provides: +20 lbs carrying capacity          │  │
│ │  │  │                                                 │  │
│ │  │  └─ Contents:                                     │  │
│ │  │     ├─ ⚔️  Iron Sword [5 lbs]                     │  │
│ │  │     ├─ 🛡️  Steel Shield [8 lbs]                   │  │
│ │  │     ├─ 🧪 Health Potion [0.5 lbs]                 │  │
│ │  │     └─ 📜 Magic Scroll [0.5 lbs]                  │  │
│ │  └──────────────────────────────────────────────────┘  │ │
│ │                                                          │ │
│ │  🔦 Torch [1 lbs]                                       │ │
│ │  🗝️  Rusty Key [0.1 lbs]                               │ │
│ │  💰 Gold Coins (x100) [1 lbs]                          │ │
│ │  🧙 Spell Component Pouch [1 lbs]                      │ │
│ │     ├─ Capacity: 3/15 lbs                              │ │
│ │     └─ Contents:                                        │ │
│ │        ├─ ✨ Dragon Scale [1 lbs]                      │ │
│ │        └─ 🌿 Herb Bundle [0.5 lbs]                     │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Weight Calculation Flow

```
┌─────────────────┐
│  Player tries   │
│  "get sword"    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Calculate Current Weight         │
│    Loop through inventory:          │
│    - Item weight × quantity         │
│    - Include nested containers      │
│    Total: 45.5 lbs                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. Calculate Max Capacity           │
│    Base: 50                         │
│    + Strength bonus: 12 × 5 = 60    │
│    + Container bonus: 20            │
│    Total: 130 lbs                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. Check New Item Weight            │
│    Sword weighs: 5 lbs              │
│    New total: 45.5 + 5 = 50.5 lbs   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 4. Validate                         │
│    50.5 lbs <= 130 lbs?             │
│    ✅ Yes - allow pickup             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 5. Update Inventory                 │
│    Add sword to inventory           │
│    Remove from room                 │
│    Show success message             │
└─────────────────────────────────────┘
```

## Container Operations

### PUT Command Flow

```
Player: "put sword in backpack"
         │
         ▼
┌─────────────────────────────────────┐
│ Parse Command                       │
│ - Item: "sword"                     │
│ - Container: "backpack"             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Find in Inventory                   │
│ ✅ Sword found                       │
│ ✅ Backpack found                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Validate Container                  │
│ ✅ Is container type                 │
│ ✅ Not putting in itself             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Check Capacity                      │
│ Current: 14 lbs                     │
│ + Sword: 5 lbs                      │
│ = 19 lbs                            │
│ Max: 50 lbs                         │
│ ✅ Fits!                             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Update Data                         │
│ 1. Add to backpack.contents         │
│ 2. Remove from main inventory       │
│ 3. Save to database                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Success!                            │
│ "You put an Iron Sword in           │
│  a Leather Backpack."               │
└─────────────────────────────────────┘
```

### TAKE Command Flow

```
Player: "take sword from backpack"
         │
         ▼
┌─────────────────────────────────────┐
│ Parse Command                       │
│ - Item: "sword"                     │
│ - Container: "backpack"             │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Find Container                      │
│ ✅ Backpack in inventory             │
│ ✅ Is container type                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Find Item in Contents               │
│ ✅ Sword in backpack.contents        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Check Weight Limit                  │
│ Current: 45.5 lbs                   │
│ + Sword: 5 lbs                      │
│ = 50.5 lbs                          │
│ Max: 130 lbs                        │
│ ✅ Can carry!                        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Update Data                         │
│ 1. Remove from backpack.contents    │
│ 2. Add to main inventory            │
│ 3. Save to database                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Success!                            │
│ "You take an Iron Sword from        │
│  a Leather Backpack."               │
└─────────────────────────────────────┘
```

## Capacity Bonus System

```
┌──────────────────────────────────────────────────────────┐
│                   Without Container                       │
├──────────────────────────────────────────────────────────┤
│  Base Capacity: 50 lbs                                   │
│  Strength (12): 60 lbs                                   │
│  ─────────────────────                                   │
│  Total: 110 lbs                                          │
│                                                           │
│  Can carry: ████████████████████░░░░░░░░░░ 45.5/110 lbs │
└──────────────────────────────────────────────────────────┘

                           ⬇️ Equip Backpack

┌──────────────────────────────────────────────────────────┐
│                    With Container                         │
├──────────────────────────────────────────────────────────┤
│  Base Capacity: 50 lbs                                   │
│  Strength (12): 60 lbs                                   │
│  Backpack Bonus: +20 lbs  ⭐                             │
│  ─────────────────────                                   │
│  Total: 130 lbs  (+18% increase!)                       │
│                                                           │
│  Can carry: ████████████░░░░░░░░░░░░░░░░░░ 45.5/130 lbs │
└──────────────────────────────────────────────────────────┘
```

## Nested Weight Example

```
┌─────────────────────────────────────────────────────────┐
│  📦 Leather Backpack                                     │
│     Base Weight: 3 lbs                                  │
│                                                          │
│     Contents:                                            │
│     ├─ ⚔️  Iron Sword: 5 lbs                            │
│     ├─ 🛡️  Steel Shield: 8 lbs                          │
│     ├─ 🧪 Health Potion: 0.5 lbs                        │
│     └─ 📜 Magic Scroll: 0.5 lbs                         │
│                                                          │
│     Contents Weight: 14 lbs                             │
│     ─────────────────────────                           │
│     Total Weight: 3 + 14 = 17 lbs                       │
│                                                          │
│     Capacity Used: 14/50 lbs (28%)                      │
│     ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │
└─────────────────────────────────────────────────────────┘
```

## Weight Warnings

```
┌─────────────────────────────────────────────────────────┐
│  Carrying: 45.5/130 lbs (35%)                           │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░                       │
│  ✅ Plenty of room                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Carrying: 98/130 lbs (75%)                             │
│  ████████████████████████░░░░░░                         │
│  ⚠️  You're carrying a heavy load.                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Carrying: 120/130 lbs (92%)                            │
│  █████████████████████████████░                         │
│  ⚠️  You're heavily encumbered!                          │
│  Consider dropping items or storing them.                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Carrying: 130/130 lbs (100%)                           │
│  ██████████████████████████████                         │
│  ❌ You can't carry any more!                            │
└─────────────────────────────────────────────────────────┘
```

## Command Examples with Output

### Opening a Container

```
> use backpack

You open Leather Backpack.
It contains:
- Iron Sword (x1) [5 lbs]
- Steel Shield (x1) [8 lbs]
- Health Potion (x1) [0.5 lbs]
- Magic Scroll (x1) [0.5 lbs]
Capacity: 14.0/50 lbs
Use 'put [item] in Leather Backpack' to store items.
Use 'take [item] from Leather Backpack' to retrieve items.
```

### Viewing Inventory

```
> inventory

You are carrying:
- Leather Backpack (equipped) [3 lbs] (contains 4 items)
- Torch [1 lbs]
- Rusty Key [0.1 lbs]
- Gold Coin (x100) [1 lbs]
- Spell Component Pouch [1 lbs] (contains 2 items)

Carrying: 45.5/130 lbs (35%)
```

### Over-encumbered

```
> get treasure chest

You can't carry that! (Current: 125.0/130 lbs, item weighs 20 lbs)
Try dropping some items first, or store items in a container.
```

## Container Size Comparison

```
┌─────────────────────────────────────────────────────────┐
│               CONTAINER SIZE CHART                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Small Pouch                                            │
│  Capacity: 10 lbs                                       │
│  ██                                                     │
│                                                          │
│  Spell Component Pouch                                  │
│  Capacity: 15 lbs                                       │
│  ███                                                    │
│                                                          │
│  Adventurer's Satchel                                   │
│  Capacity: 30 lbs                                       │
│  ██████                                                 │
│                                                          │
│  Leather Backpack                                       │
│  Capacity: 50 lbs                                       │
│  ██████████                                             │
│                                                          │
│  Military Duffel Bag                                    │
│  Capacity: 100 lbs                                      │
│  ████████████████████                                   │
│                                                          │
│  Wooden Chest                                           │
│  Capacity: 200 lbs                                      │
│  ████████████████████████████████████████               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Strength Impact

```
┌──────────────────────────────────────────────────────────┐
│              CARRYING CAPACITY BY STRENGTH                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  STR 8  (Weak):     50 + (8×5)  = 90 lbs                │
│  ██████████████████                                      │
│                                                           │
│  STR 10 (Average):  50 + (10×5) = 100 lbs               │
│  ████████████████████                                    │
│                                                           │
│  STR 12 (Strong):   50 + (12×5) = 110 lbs               │
│  ██████████████████████                                  │
│                                                           │
│  STR 15 (Very Strong): 50 + (15×5) = 125 lbs           │
│  █████████████████████████                               │
│                                                           │
│  STR 18 (Mighty):   50 + (18×5) = 140 lbs               │
│  ████████████████████████████                            │
│                                                           │
│  STR 20 (Heroic):   50 + (20×5) = 150 lbs               │
│  ██████████████████████████████                          │
│                                                           │
│  + Leather Backpack: +20 lbs additional capacity         │
│  + Military Duffel:  +50 lbs additional capacity         │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Data Structure Diagram

```
Player Document (Firebase/MySQL)
├─ name: "PlayerName"
├─ strength: 12
├─ level: 5
└─ inventory: [
    ├─ {
    │   id: "leather_backpack",
    │   name: "Leather Backpack",
    │   equipped: true,
    │   contents: [
    │       {id: "iron_sword", name: "Iron Sword", ...},
    │       {id: "health_potion", name: "Health Potion", ...}
    │   ]
    │  }
    ├─ {id: "torch", name: "Torch", ...}
    └─ {id: "gold_coin", name: "Gold Coin", quantity: 100, ...}
   ]

Item Definition (Firebase/MySQL)
├─ id: "leather_backpack"
├─ name: "Leather Backpack"
├─ itemType: "container"
├─ weight: 3
├─ value: 25
└─ specialData: {
    ├─ capacity: 50
    ├─ capacityBonus: 20
    └─ description: "..."
   }
```

## Summary

```
┌─────────────────────────────────────────────────────────┐
│              CONTAINER SYSTEM SUMMARY                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ Weight-based inventory management                    │
│  ✅ Strength affects carrying capacity                   │
│  ✅ Containers store and organize items                  │
│  ✅ Capacity bonuses from equipped containers            │
│  ✅ Nested weight calculations                           │
│  ✅ Automatic weight validation                          │
│  ✅ Clear player feedback                                │
│  ✅ Multiple container types                             │
│                                                          │
│  Commands: use, put, take, inventory                     │
│  Formula: 50 + (Strength × 5) + Container Bonuses       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
