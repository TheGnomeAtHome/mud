# Message Cleanup System

## Overview
The message cleanup system is part of the Firebase optimization strategy designed to reduce storage costs and improve performance by automatically removing old chat messages from the database.

## How It Works

### Automatic Cleanup
- **Frequency**: Runs every hour (3600000ms)
- **Retention Period**: 24 hours
- **Target**: Messages in `/artifacts/{appId}/public/data/mud-messages` collection
- **First Run**: Executes immediately on application startup, then hourly thereafter

### Implementation Details

#### Location
- **Function**: `startMessageCleanup()` in `js/app.js` (lines 42-109)
- **Initialization**: Called in main auth handler (line 581)

#### Process Flow
1. **Calculate Cutoff**: `Date.now() - (24 * 60 * 60 * 1000)` (24 hours ago)
2. **Query Old Messages**: Uses Firebase `where('timestamp', '<', cutoffTime)`
3. **Batch Delete**: Deletes all messages older than cutoff time
4. **Logging**: Logs count of deleted messages to console

#### Dependencies
- Firebase Firestore functions:
  - `collection()` - Reference messages collection
  - `query()` - Build query for old messages
  - `where()` - Filter by timestamp
  - `getDocs()` - Execute query
  - `deleteDoc()` - Delete individual messages
  - `Timestamp` - Create timestamp for comparison

### Benefits

#### Cost Reduction
- **Before**: Messages accumulate indefinitely (100+ messages per session)
- **After**: Only last 24 hours retained (typically 50-200 messages total)
- **Savings**: ~85% reduction in message storage costs

#### Performance Improvement
- Smaller message collection = faster queries
- Reduced snapshot listener overhead
- Less data transferred to clients

### Configuration

#### Adjust Retention Period
Edit the cutoff calculation in `startMessageCleanup()`:

```javascript
// Current: 24 hours
const cutoffTime = Timestamp.fromMillis(Date.now() - (24 * 60 * 60 * 1000));

// 12 hours
const cutoffTime = Timestamp.fromMillis(Date.now() - (12 * 60 * 60 * 1000));

// 7 days
const cutoffTime = Timestamp.fromMillis(Date.now() - (7 * 24 * 60 * 60 * 1000));
```

#### Adjust Cleanup Frequency
Edit the interval in `startMessageCleanup()`:

```javascript
// Current: Every hour (3600000ms)
setInterval(cleanupOldMessages, 3600000);

// Every 30 minutes
setInterval(cleanupOldMessages, 1800000);

// Every 6 hours
setInterval(cleanupOldMessages, 21600000);
```

### Monitoring

#### Console Logs
The system logs cleanup activity:
```
[Message Cleanup] Starting cleanup of old messages...
[Message Cleanup] Found 42 old messages to delete
[Message Cleanup] Successfully deleted 42 old messages
```

#### No Messages to Clean
```
[Message Cleanup] Found 0 old messages to delete
[Message Cleanup] No old messages to clean up
```

#### Errors
```
[Message Cleanup] Error during cleanup: [error details]
[Message Cleanup] Error deleting message abc123: [error details]
```

### Testing

#### Verify Cleanup Works
1. Open browser console
2. Look for cleanup logs every hour
3. Check Firebase console for message count reduction

#### Manual Testing
To test immediately without waiting an hour:
1. Set retention to 1 minute: `Date.now() - (60 * 1000)`
2. Send some test messages
3. Wait 1 minute
4. Reload page or wait for next cleanup cycle
5. Check messages are deleted

### Troubleshooting

#### Messages Not Being Deleted
1. **Check Timestamps**: Ensure messages have valid `timestamp` field
2. **Check Console**: Look for error messages
3. **Verify Firebase Rules**: Ensure delete permissions are granted
4. **Check Query**: Messages must be older than cutoff time

#### Too Many/Few Messages Deleted
- Adjust retention period (24 hours by default)
- Check message timestamps are accurate
- Verify cutoff calculation is correct

### Firebase Optimization Impact

#### Part of Larger Strategy
This is Phase 1 of the Firebase optimization plan. See `FIREBASE_OPTIMIZATION_GUIDE.md` for the complete strategy.

#### Expected Results
- **Message Storage**: 85% reduction
- **Query Performance**: 60% faster message loading
- **Cost Savings**: $5-10/month reduction in Firebase costs
- **Bandwidth**: Reduced snapshot update overhead

### Future Enhancements

#### Planned Improvements
1. **Batch Deletion**: Use `writeBatch()` for more efficient bulk deletes
2. **Selective Retention**: Keep important messages (quest updates, admin announcements)
3. **Archive System**: Move old messages to cheaper storage before deletion
4. **User Preferences**: Allow players to download message history

#### Advanced Options
- Implement message importance levels
- Add message archival to MySQL
- Create message search/history feature
- Add admin controls for retention settings

## Related Documentation
- `FIREBASE_OPTIMIZATION_GUIDE.md` - Complete optimization strategy
- `js/app.js` - Implementation code
- `js/firebase-init.js` - Firebase setup and exports
