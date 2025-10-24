# Error Logging System

## Overview
Comprehensive error logging system that captures and stores detailed error information in MySQL for admin review. All errors, warnings, and issues are automatically logged with full context including player information, location, command input, stack traces, and system details.

## Features

### Automatic Logging
- **Uncaught Errors**: Automatically captures JavaScript errors
- **Promise Rejections**: Catches unhandled promise rejections
- **Command Errors**: Logs failed command executions with full context
- **Game State Errors**: Tracks issues with game mechanics
- **AI/API Errors**: Records problems with Gemini API or other external services

### Rich Context Capture
Each log entry includes:
- **Timestamp**: When the error occurred
- **Severity**: Critical, Error, Warning, or Info
- **Category**: Type of error (command, combat, inventory, npc, ai, database, etc.)
- **Player Context**: Player ID, name, current room
- **Error Details**: Message, error type, stack trace
- **Command Context**: User input and parsed command object
- **System Context**: Browser version, screen resolution, user agent
- **Custom Metadata**: Any additional data specific to the error

### MySQL Storage
- **Fast Queries**: Indexed by timestamp, severity, category, player, and room
- **Scalable**: Can handle large volumes of logs
- **Permanent**: Logs persist across server restarts
- **Offline-Safe**: Logs are queued if API is unavailable

## Files

### JavaScript Module
- **`js/error-logger.js`**: Main error logging client

### PHP API Endpoints
- **`api/log-error.php`**: Receives and stores error logs
- **`api/get-error-logs.php`**: Retrieves logs with filtering
- **`api/clear-old-logs.php`**: Cleans up old logs

### Database
- **`server/schema.sql`**: Contains `error_logs` table definition
- **`server/error-logs-schema.sql`**: Standalone schema with views

### Admin Interface
- **`error-log-viewer.html`**: Web interface for viewing and analyzing logs

## Usage

### Automatic Logging
The error logger is automatically initialized and captures errors:

```javascript
// Uncaught errors are logged automatically
throw new Error("Something went wrong");

// Unhandled promise rejections are logged automatically
Promise.reject("API call failed");
```

### Manual Logging

#### Log an Error
```javascript
await window.errorLogger.logError({
    category: 'inventory',
    message: 'Failed to add item to inventory',
    metadata: {
        itemId: 'sword_001',
        playerId: 'user123',
        reason: 'Inventory full'
    }
});
```

#### Log a Warning
```javascript
await window.errorLogger.logWarning({
    category: 'game-state',
    message: 'Player stats seem unusual',
    metadata: {
        hp: -10,
        mana: 9999
    }
});
```

#### Log Critical Error
```javascript
await window.errorLogger.logCritical({
    category: 'database',
    message: 'Complete database connection failure',
    metadata: {
        attempts: 3,
        lastError: 'Connection timeout'
    }
});
```

### Convenience Methods

#### Command Errors
```javascript
await window.errorLogger.logCommandError(
    userInput,
    parsedCommand,
    "Command execution failed",
    { reason: "Target not found" }
);
```

#### Combat Errors
```javascript
await window.errorLogger.logCombatError(
    "Damage calculation resulted in NaN",
    { attacker: 'player1', defender: 'monster1', damage: NaN }
);
```

#### Inventory Errors
```javascript
await window.errorLogger.logInventoryError(
    "Item duplication detected",
    { itemId: 'gold_001', quantity: 999999 }
);
```

#### NPC Errors
```javascript
await window.errorLogger.logNpcError(
    "NPC dialogue failed to generate",
    { npcId: 'merchant_001', aiError: 'API timeout' }
);
```

#### Database Errors
```javascript
await window.errorLogger.logDatabaseError(
    "Failed to save player data",
    { playerId: 'user123', operation: 'update', table: 'players' }
);
```

#### AI Errors
```javascript
await window.errorLogger.logAiError(
    "Gemini API rate limit exceeded",
    { endpoint: 'generateText', retries: 3 }
);
```

## Error Categories

- **`command`**: Command parsing or execution errors
- **`combat`**: Battle system errors
- **`inventory`**: Item management issues
- **`npc`**: NPC interaction problems
- **`ai`**: Gemini API or AI-related errors
- **`database`**: Firebase/MySQL persistence errors
- **`game-state`**: General game logic issues
- **`uncaught`**: Uncaught JavaScript errors
- **`promise`**: Unhandled promise rejections
- **`general`**: Other errors

## Severity Levels

- **`critical`**: System-breaking errors requiring immediate attention
- **`error`**: Standard errors affecting functionality
- **`warning`**: Potential issues that don't break functionality
- **`info`**: Informational messages for tracking

## Viewing Logs

### Admin Web Interface
Open `error-log-viewer.html` in a browser:

1. **Filter by Severity**: Critical, Error, Warning, Info
2. **Filter by Category**: Command, Combat, NPC, etc.
3. **Search by Player**: Find errors for specific players
4. **Set Limit**: Control how many logs to display
5. **Click any log**: See full details including stack trace
6. **Auto-refresh**: Updates every 30 seconds

### Statistics Dashboard
The viewer shows:
- Total number of logs
- Count by severity (Critical, Error, Warning)
- Recent error trends

### Log Details Modal
Click any log to see:
- Full error message
- Complete stack trace
- Player and room context
- Command input and parsed command
- System information
- Custom metadata

## API Endpoints

### Log an Error
```
POST /api/log-error.php
Content-Type: application/json

{
    "severity": "error",
    "category": "command",
    "message": "Command failed",
    "playerId": "user123",
    "playerName": "Alice",
    "roomId": "town_square",
    "errorType": "ValidationError",
    "stackTrace": "Error: ...\n at ...",
    "commandInput": "attack dragon",
    "parsedCommand": {"action": "attack", "target": "dragon"},
    "metadata": {"additional": "data"}
}
```

### Get Logs
```
GET /api/get-error-logs.php?severity=error&category=command&limit=100
```

**Query Parameters:**
- `severity`: Filter by severity level
- `category`: Filter by error category
- `player`: Filter by player name (partial match)
- `room`: Filter by room ID
- `from_date`: Start date (YYYY-MM-DD HH:MM:SS)
- `to_date`: End date (YYYY-MM-DD HH:MM:SS)
- `limit`: Number of logs to return (max 1000)
- `offset`: Pagination offset

**Response:**
```json
{
    "success": true,
    "stats": {
        "total": 234,
        "critical": 5,
        "error": 123,
        "warning": 95,
        "info": 11
    },
    "logs": [...],
    "pagination": {
        "total": 234,
        "limit": 100,
        "offset": 0,
        "hasMore": true
    }
}
```

### Get Single Log
```
GET /api/get-error-logs.php?id=123
```

### Clear Old Logs
```
POST /api/clear-old-logs.php
```

Deletes logs older than 30 days (configurable, minimum 7 days).

## Database Schema

### error_logs Table
```sql
CREATE TABLE error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity ENUM('error', 'warning', 'info', 'critical'),
    category VARCHAR(100),
    player_id VARCHAR(255),
    player_name VARCHAR(255),
    room_id VARCHAR(255),
    message TEXT NOT NULL,
    error_type VARCHAR(255),
    stack_trace TEXT,
    command_input TEXT,
    parsed_command JSON,
    user_agent TEXT,
    browser_version VARCHAR(255),
    screen_resolution VARCHAR(50),
    metadata JSON,
    INDEX idx_timestamp (timestamp),
    INDEX idx_severity (severity),
    INDEX idx_category (category),
    INDEX idx_player (player_id),
    INDEX idx_room (room_id)
);
```

## Setup

### 1. Create Database Table
Run the schema:
```sql
-- Option 1: Full schema
source server/schema.sql

-- Option 2: Just error logs
source server/error-logs-schema.sql
```

### 2. Include Error Logger
Already included in `index.html` and `mud.html`:
```html
<script src="js/error-logger.js"></script>
```

### 3. Configure API URL
Edit `js/error-logger.js` if needed:
```javascript
this.apiUrl = 'https://jphsoftware.com/api/log-error.php';
```

### 4. Use in Game Code
The logger is available globally as `window.errorLogger`.

## Integration Examples

### In Command Execution
```javascript
try {
    await executeParsedCommand(parsed);
} catch (error) {
    await window.errorLogger.logCommandError(
        userInput,
        parsed,
        error.message,
        { stack: error.stack }
    );
    displayMessage("An error occurred. It has been logged.");
}
```

### In Combat System
```javascript
function calculateDamage(attacker, defender) {
    try {
        const damage = /* calculation */;
        if (isNaN(damage)) {
            window.errorLogger.logCombatError(
                "Damage calculation resulted in NaN",
                { attacker, defender }
            );
            return 0;
        }
        return damage;
    } catch (error) {
        window.errorLogger.logCombatError(
            "Combat calculation failed: " + error.message,
            { attacker, defender, error: error.stack }
        );
        return 0;
    }
}
```

### In AI Calls
```javascript
async function callGeminiAPI(prompt) {
    try {
        const response = await fetch(/* ... */);
        if (!response.ok) {
            await window.errorLogger.logAiError(
                `Gemini API returned ${response.status}`,
                { prompt, status: response.status }
            );
        }
        return await response.json();
    } catch (error) {
        await window.errorLogger.logAiError(
            "Gemini API call failed: " + error.message,
            { prompt, error: error.stack }
        );
        throw error;
    }
}
```

## Maintenance

### View Logs
```
Open error-log-viewer.html in browser
```

### Clear Old Logs
In the viewer, click "🗑️ Clear Old Logs" to delete logs older than 30 days.

### Direct SQL Queries
```sql
-- Count errors by category
SELECT category, COUNT(*) as count
FROM error_logs
GROUP BY category
ORDER BY count DESC;

-- Recent critical errors
SELECT timestamp, player_name, message
FROM error_logs
WHERE severity = 'critical'
ORDER BY timestamp DESC
LIMIT 20;

-- Errors for specific player
SELECT timestamp, category, message
FROM error_logs
WHERE player_name = 'PlayerName'
ORDER BY timestamp DESC;

-- Errors in specific room
SELECT timestamp, player_name, message
FROM error_logs
WHERE room_id = 'town_square'
ORDER BY timestamp DESC;
```

## Performance Considerations

- **Batching**: Non-critical logs are queued and sent in batches every 5 seconds
- **Critical Priority**: Critical errors are sent immediately
- **Queue Limit**: Max 50 logs queued before auto-flush
- **Indexes**: All common query fields are indexed
- **Cleanup**: Auto-cleanup of logs older than 30 days

## Privacy & Security

- **No Sensitive Data**: Don't log passwords or API keys
- **User Agent**: Captured automatically but can be disabled
- **IP Address**: Not logged by default
- **Player Data**: Only player ID and name, no personal info

## Troubleshooting

### Logs Not Appearing
1. Check browser console for API errors
2. Verify MySQL table exists
3. Check API endpoint is accessible
4. Ensure `error-logger.js` is loaded

### API Errors
1. Check PHP error log: `/var/log/apache2/error.log`
2. Verify database credentials in `api/config.php`
3. Test endpoint directly: `curl -X POST https://jphsoftware.com/api/log-error.php`

### Viewer Not Loading
1. Open browser dev tools
2. Check network tab for failed requests
3. Verify API endpoints are accessible
4. Check CORS headers if hosted on different domain

## Future Enhancements

- **Email Alerts**: Send email for critical errors
- **Error Trends**: Graph errors over time
- **Player Patterns**: Identify players experiencing frequent errors
- **Room Heatmap**: Visualize problem areas in the game world
- **Export Logs**: Download as CSV/JSON for analysis
- **Search**: Full-text search across all log fields
