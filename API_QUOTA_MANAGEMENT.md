# API Quota Management

## Gemini API Limits

### Free Tier Limits
- **Rate Limit**: 15 requests per minute
- **Daily Quota**: 200 requests per day
- **Resets**: Midnight Pacific Time (PT)

### What Consumes Quota
1. **Command Parsing**: Every natural language command (typing in-game)
2. **AI NPC Interactions**: Talking to AI NPCs (`talk to`, `ask about`)
3. **NPC Conversations**: Background NPC-to-NPC dialogue (2-3 calls per cycle)
4. **Room Descriptions**: AI-generated room descriptions (admin panel)

## Quota Exhaustion Behavior

When you hit the daily quota limit:

### Automatic Protection
- ✅ NPC conversations **automatically disable** when quota is exhausted
- ✅ Error messages shown: "The AI is silent for now."
- ✅ All NPC conversation timers stopped to prevent further API calls
- ✅ Command parsing falls back to "unknown" action

### What Still Works
- ✅ Traditional NPCs with random dialogue (not AI)
- ✅ All game commands (movement, combat, items, etc.)
- ✅ Multiplayer features (chat, parties, guilds)
- ✅ Quest system
- ✅ Everything that doesn't require AI

### What Stops Working
- ❌ Natural language command parsing (type exact commands)
- ❌ AI NPC conversations (background chatter)
- ❌ Talking to AI NPCs
- ❌ AI-powered room generation

## Managing Quota

### Admin Commands

#### Check NPC Conversation Status
```
npcchats
```
Shows current status (ENABLED/DISABLED) and if quota is exhausted.

#### Disable NPC Conversations
```
npcchats off
```
- Stops all NPC background conversations
- Saves quota for player interactions
- Can re-enable later

#### Enable NPC Conversations
```
npcchats on
```
- Restarts NPC background conversations
- Resets quota exhaustion flag
- NPCs will start chatting when you enter rooms

### Best Practices

#### If Running Low on Quota:
1. **Disable NPC conversations** (`npcchats off`)
2. **Use direct commands** instead of natural language:
   - Type `north` instead of `go north`
   - Type `get sword` instead of `pick up the sword`
3. **Limit AI NPC interactions** (save them for important moments)
4. **Wait until tomorrow** for quota reset

#### For Maximum Quota Efficiency:
- Keep NPC conversations disabled during development
- Enable only when showcasing the game
- Use traditional NPCs for most characters
- Reserve AI NPCs for key story characters

#### For Production Use:
Consider upgrading to a paid Gemini API plan:
- Higher rate limits
- No daily quota
- Better reliability
- See: https://ai.google.dev/pricing

## Quota Monitoring

### Console Messages
Watch for these in browser console:

**Quota Exhausted:**
```
AI Error: You exceeded your current quota...
[NPC Conversations] API limit reached - disabling NPC conversations
```

**Rate Limit Hit:**
```
429 (Too Many Requests)
[NPC Conversations] Rate limit hit, using fallback dialogue
```

**NPC Conversations Disabled:**
```
[NPC Conversations] Disabled or quota exhausted
```

## Recovery

### After Quota Reset (Next Day):
1. Refresh the page OR
2. Type `npcchats on` to re-enable
3. NPC conversations will resume automatically

### Manual Reset:
As admin, you can force-enable even if quota was exhausted:
```
npcchats off
npcchats on
```
⚠️ Warning: This will attempt to use API again, may fail if quota still exhausted.

## Alternative Solutions

### Reduce API Usage

#### Option 1: Slower NPC Conversations
Already implemented:
- 60-120 seconds between cycles (was 45-90)
- 2-3 exchanges per cycle (was 3-5)
- 3-6 second delays between exchanges

#### Option 2: Disable During Idle Times
Manually disable when no players are active:
```
npcchats off
```

#### Option 3: Use Traditional NPCs
Instead of AI personality strings, use random dialogue arrays:
```javascript
// AI NPC (uses quota)
{
  "dialogue": "You are a grumpy blacksmith..."
}

// Traditional NPC (no quota usage)
{
  "dialogue": [
    "Welcome to my shop.",
    "Need anything forged?",
    "Good day to you."
  ]
}
```

### Upgrade Options

For unlimited usage, consider:
- **Gemini API Paid Tier**: $0.0025 per 1K characters (very affordable)
- **Gemini Advanced**: $19.99/month (includes API access)
- See pricing: https://ai.google.dev/pricing

## Technical Details

### Quota Detection
The system detects quota exhaustion by:
1. Catching API error responses
2. Checking for "quota" in error message
3. Setting `quotaExhausted = true` flag
4. Stopping all conversation timers

### State Management
```javascript
npcConversationsEnabled = true;  // Admin control
quotaExhausted = false;          // Auto-detected
```

Both must be `true` for conversations to run.

### Firebase Impact
Note: Disabling NPC conversations does NOT reduce Firebase usage:
- Player data still synced
- Messages still sent
- Real-time listeners still active
- Only Gemini API calls are reduced

## Summary

**Current Settings (Optimized for Free Tier):**
- ⏱️ Conversations every 60-120 seconds
- 💬 2-3 exchanges per conversation  
- 🔄 ~3-6 API calls per hour per room
- 📊 ~75-150 calls per day with 1 active room

**If Quota Exhausted:**
- Use `npcchats off` to preserve remaining quota
- Wait until tomorrow for reset
- Game fully playable without AI features

**For Heavy Usage:**
- Upgrade to paid Gemini API tier
- Costs ~$1-2/month for typical MUD usage
- Unlimited daily quota
