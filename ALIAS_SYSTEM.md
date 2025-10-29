# Command Alias System

The alias system allows players to create custom shortcuts for frequently used commands, saving time and keystrokes.

## 📋 Overview

**Aliases** are player-defined shortcuts that expand to full commands automatically. They're saved to your character and persist across sessions.

## 🎮 Commands

### Create an Alias
```
alias [shortcut] [full command]
```

**Examples:**
```
> alias gg goto graveyard
Alias created: 'gg' → 'goto graveyard'

> alias heal cast heal at me
Alias created: 'heal' → 'cast heal at me'

> alias shop goto market square

> alias gn go north
```

### List Your Aliases
```
aliases
```

Shows all your currently defined aliases:
```
> aliases
═══ Your Command Aliases ═══
  gg → goto graveyard
  heal → cast heal at me
  shop → goto market square
  gn → go north
Total: 4 aliases
```

### Remove an Alias
```
unalias [shortcut]
```

**Example:**
```
> unalias gn
Alias 'gn' removed.
```

## 💡 How Aliases Work

### Basic Expansion
When you type a command starting with an alias shortcut, it automatically expands:

```
> gg
[Alias: gg → goto graveyard]
> goto graveyard
You arrive at the Graveyard.
```

### With Additional Arguments
Aliases can accept additional arguments:

```
> alias gt goto

> gt temple
[Alias: gt → goto]
> goto temple
You arrive at the Temple.
```

### Nested Commands
You can create complex shortcuts:

```
> alias buypotion buy health potion from merchant

> buypotion
[Alias: buypotion → buy health potion from merchant]
You purchase health potion from the merchant for 25 gold.
```

## 🚫 Restrictions

### Protected Commands
You **cannot** create aliases that override core game commands:

**Protected:** `look`, `go`, `get`, `drop`, `inventory`, `i`, `inv`, `examine`, `attack`, `help`, `quit`, `say`, `score`, `stats`, `who`, `alias`, `aliases`, `unalias`, `cast`, `spells`, `quests`, `party`, `guild`, `trade`, `buy`, `sell`, `equip`, `unequip`

```
> alias look examine
Cannot create alias 'look' - it conflicts with a core command.
```

### Case Insensitive
Aliases are case-insensitive:
```
> alias gg goto graveyard
> GG
[Alias: gg → goto graveyard]
```

## 📝 Best Practices

### 1. Short & Memorable
Use 2-3 character shortcuts for frequently used commands:
```
alias gg goto graveyard
alias tt goto temple  
alias ts goto town square
```

### 2. Common Locations
Create aliases for places you visit often:
```
alias home goto my house
alias shop goto marketplace
alias bank goto bank
alias train goto training grounds
```

### 3. Spell Shortcuts
Quick access to your favorite spells:
```
alias fb cast fireball at
alias heal cast heal at me
alias shield cast shield
alias invis cast invisibility
```

### 4. Combat Macros
Speed up combat with quick aliases:
```
alias k attack
alias f flee
alias p drink health potion
```

### 5. Trading Shortcuts
```
alias ls list
alias buy1 buy health potion from merchant
alias buy5 buy health potion from merchant 5
```

## 🎯 Popular Alias Examples

### Navigation
```
alias n go north
alias s go south
alias e go east
alias w go west
alias u go up
alias d go down
```

### Combat
```
alias ka attack
alias kk kick
alias ks slash
```

### Social
```
alias w wave
alias b bow
alias l laugh
```

### Items
```
alias eq equipment
alias dr drop
alias pk get
```

### Guild/Party
```
alias gc guild chat
alias pc party chat
alias pi party invite
alias gi guild invite
```

## 🔄 Managing Aliases

### Review Regularly
Use `aliases` command to see what you have defined. Remove unused ones to keep your list clean.

### Share with Friends
Discovered a useful alias? Share it with your party or guild!

### Backup Your Aliases
Take a screenshot of your `aliases` output - it's backed up to your character but good to have a reference.

## ⚠️ Important Notes

1. **Persistence**: Aliases are saved to your character in both MySQL and Firebase
2. **Expansion Shown**: When an alias expands, you'll see a system message showing the expansion
3. **Single Word Only**: Only the first word of your command is checked for aliases
4. **No Recursion**: Aliases cannot reference other aliases
5. **Per Character**: Each character has their own set of aliases

## 🆘 Troubleshooting

### "Cannot create alias - it conflicts with a core command"
You're trying to override a protected game command. Choose a different shortcut name.

### Alias doesn't work
- Check spelling: Use `aliases` to see exact shortcut
- Make sure it's the first word of your command
- Verify it's not a protected command name

### Alias not saved
- Check your connection to the game server
- Try creating it again
- Use `aliases` to verify it was created

## 🎓 Advanced Tips

### Context-Specific Aliases
Create different shortcuts for different gameplay styles:

**For Merchants:**
```
alias checkprice appraise
alias negotiate haggle 50 for
```

**For Healers:**
```
alias h1 cast heal at
alias h2 cast greater heal at
alias cure cast cure poison at
```

**For Tanks:**
```
alias taunt say come at me!
alias defend equip shield
```

### Temporary vs Permanent
Remember: All aliases persist forever until you `unalias` them. Don't create too many niche aliases that clutter your list.

---

**Quick Reference:**
- `alias [shortcut] [command]` - Create
- `aliases` - List all
- `unalias [shortcut]` - Remove
