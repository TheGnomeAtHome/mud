# Builder Quick Reference

## 🛠️ Builder Commands Cheat Sheet

### Basic Building
```bash
buildroom [id] [name]           # Create new room
editdesc [description]          # Edit room description  
builderrooms                    # List your rooms
```

### Exits & Navigation
```bash
addexit [dir] [room-id]        # Add exit (n/s/e/w/up/down/ne/nw/se/sw)
removeexit [direction]          # Remove exit
```

### Room Details
```bash
adddetail [keyword] [desc]     # Add examinable detail
```

## 👑 Admin Commands

```bash
makebuilder [player]           # Grant builder status
removebuilder [player]         # Revoke builder status
reviewrooms                    # List pending rooms
approveroom [room-id]          # Approve pending room
rejectroom [room-id]           # Delete pending room
```

## 📝 Quick Tips

**Room IDs:**
- Lowercase only
- Use hyphens, no spaces
- Example: `dark-forest-clearing`

**Descriptions:**
- 2-4 sentences
- Sensory details
- Set the mood
- Mention key features

**Details:**
- 3-5 per room
- Make them interesting
- Reward curiosity

**Exits:**
- Create two-way connections
- Think about geography
- Avoid dead ends

## 🔄 Builder Workflow

1. **Create** → `buildroom cottage-1 My Cottage`
2. **Describe** → `editdesc [your description]`
3. **Add Details** → `adddetail fireplace [description]`
4. **Wait for Approval** → Admin runs `approveroom cottage-1`
5. **Connect** → `addexit north city-square`
6. **Done!** → Players can now visit

## ⚠️ Restrictions

**You CAN:**
- Create unlimited rooms
- Edit your own rooms
- Add exits to your rooms
- Add details to your rooms

**You CANNOT:**
- Edit other players' rooms
- Add NPCs/monsters/items
- Approve your own rooms
- Connect to pending rooms

## 💡 Examples

### Create a Forest Room
```
buildroom dark-woods Dark Woods
editdesc The trees grow so close together here that barely any light 
reaches the forest floor. Strange sounds echo through the darkness, and 
you feel watched.
adddetail trees Ancient oaks with twisted, gnarled branches.
adddetail sounds You hear rustling, snapping twigs, and distant howls.
```

### Create a Shop
```
buildroom magic-shop Mystical Emporium  
editdesc Crystals hang from the ceiling, casting rainbow patterns across 
shelves filled with strange potions and mysterious artifacts. The air 
smells of incense and old parchment.
adddetail crystals They pulse with inner light, each a different color.
adddetail shelves Dusty bottles and ancient books compete for space.
```

### Connect Rooms
```
# In room A, add exit to room B
addexit south forest-clearing

# In room B, add exit back to room A  
addexit north dark-woods
```

## 🎯 Status Meanings

- **[PENDING]** - Waiting for admin approval
- **[APPROVED]** - Live and accessible to players

## 🆘 Need Help?

Type `help` in game to see all available commands!
