# MySQL Backend Integration Guide

## Overview
This guide helps you set up MySQL as the data backend for your MUD game instead of static JSON files or Firebase. This provides:

✅ **Real-time multi-admin collaboration** - Multiple admins edit simultaneously  
✅ **Centralized data storage** - All content in your existing MySQL database  
✅ **Server-side control** - Validate and secure data on your server  
✅ **Advanced queries** - Search and filter using SQL  
✅ **Easy backups** - Standard MySQL dump/restore  

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │◄───────►│  Express API │◄───────►│    MySQL     │
│ (Game Client)│  HTTP   │    Server    │   SQL   │   Database   │
└──────────────┘         └──────────────┘         └──────────────┘
     │
     │ Real-time chat/combat
     ▼
┌──────────────┐
│   Firebase   │ (Optional - for real-time features only)
└──────────────┘
```

## Step 1: Database Setup

### Create MySQL Database

Run this SQL script to create the database and tables:

\`\`\`powershell
# Using MySQL command line
mysql -u root -p < server/schema.sql

# Or run in MySQL Workbench / phpMyAdmin
\`\`\`

The schema creates 8 tables:
- `mud_rooms` - Room definitions
- `mud_items` - Item templates
- `mud_npcs` - NPC definitions
- `mud_monsters` - Monster templates
- `mud_classes` - Character classes
- `mud_spells` - Spell definitions
- `mud_quests` - Quest data
- `mud_guilds` - Guild information

Each table has:
- `id` (VARCHAR 255) - Primary key
- `data` (JSON) - Full document data
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Step 2: Install Dependencies

\`\`\`powershell
cd C:\\Users\\Paul\\Documents\\MUD
npm install
\`\`\`

This installs:
- `express` - Web server framework
- `mysql2` - MySQL database driver
- `cors` - Cross-origin requests
- `dotenv` - Environment configuration
- `nodemon` - Auto-restart during development

## Step 3: Configure Environment

1. **Copy the example file:**
   \`\`\`powershell
   copy server\\.env.example server\\.env
   \`\`\`

2. **Edit `server/.env`** with your MySQL credentials:
   \`\`\`env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=your_mysql_username
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=mud_game

   PORT=3000
   ADMIN_API_KEY=generate-a-random-secure-key-here

   ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
   \`\`\`

3. **Generate a secure admin API key:**
   \`\`\`powershell
   # PowerShell command to generate random key
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   \`\`\`

## Step 4: Migrate Data from Firebase to MySQL

Run the migration script to copy all your Firebase data to MySQL:

\`\`\`powershell
npm run migrate
\`\`\`

Expected output:
\`\`\`
🔄 Starting Firebase to MySQL migration...

✓ MySQL database connected successfully
📦 Migrating rooms...
   Found 15 documents in Firebase
   ✓ Imported 15 documents to MySQL

📦 Migrating items...
   Found 147 documents in Firebase
   ✓ Imported 147 documents to MySQL

...

✅ Migration complete! Total documents imported: 342
\`\`\`

## Step 5: Start the API Server

\`\`\`powershell
# Production mode
npm run server

# OR Development mode (auto-restarts on file changes)
npm run dev
\`\`\`

Expected output:
\`\`\`
✓ MySQL database connected successfully
🚀 MUD API Server running on http://localhost:3000
📊 Health check: http://localhost:3000/health
🎮 API endpoint: http://localhost:3000/api/{collection}
\`\`\`

**Test the API:**
\`\`\`powershell
# PowerShell command to test health endpoint
Invoke-RestMethod -Uri "http://localhost:3000/health"
\`\`\`

Should return:
\`\`\`json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-10-20T..."
}
\`\`\`

## Step 6: Configure Game Client

Edit `js/data-loader.js` to enable MySQL backend:

\`\`\`javascript
const USE_STATIC_FILES = false;  // Disable static files
const USE_MYSQL_BACKEND = true;   // Enable MySQL
const MYSQL_API_URL = 'http://localhost:3000/api';

// Configure which collections load from MySQL
const STATIC_CONFIG = {
    rooms: false,    // Load from MySQL (live editing)
    items: false,    // Load from MySQL (live editing)
    npcs: false,     // Load from MySQL (live editing)
    monsters: false, // Load from MySQL (live editing)
    classes: false,  // Load from MySQL (live editing)
    spells: false,   // Load from MySQL (live editing)
    quests: false    // Load from MySQL (live editing)
};
\`\`\`

## Step 7: Test Everything

1. **Start the API server** (if not already running):
   \`\`\`powershell
   npm run server
   \`\`\`

2. **Open game in browser:**
   - Open `index.html` or `mud.html`
   - Check browser console for loading messages

3. **Verify data loads from MySQL:**
   \`\`\`
   [DataLoader] Using hybrid/static file mode for game content
   [DataLoader] Attempting to load rooms from MySQL...
   [DataLoader] ✓ Loaded 15 rooms from MySQL
   [DataLoader] Attempting to load items from MySQL...
   [DataLoader] ✓ Loaded 147 items from MySQL
   \`\`\`

4. **Test admin editing:**
   - Login as admin
   - Edit a room, item, or NPC
   - Have another admin (different browser) check if they see the change immediately

## API Endpoints

### Public Endpoints (Read-Only)

\`\`\`
GET /health
- Check server and database status

GET /api/{collection}
- Get all documents from collection
- Example: GET /api/rooms

GET /api/{collection}/{id}
- Get single document by ID
- Example: GET /api/rooms/tavern
\`\`\`

### Admin Endpoints (Requires API Key)

\`\`\`
PUT /api/{collection}/{id}
- Create or update document
- Headers: { "x-api-key": "your-admin-key" }
- Body: { ...document data... }

DELETE /api/{collection}/{id}
- Delete document
- Headers: { "x-api-key": "your-admin-key" }
\`\`\`

## Hybrid Mode (MySQL + Static Files)

You can configure some collections to load from MySQL (for live editing) and others from static files (for performance):

\`\`\`javascript
const USE_STATIC_FILES = true;   // Enable static files
const USE_MYSQL_BACKEND = true;  // Enable MySQL
const STATIC_CONFIG = {
    rooms: false,    // MySQL - admins edit frequently
    items: true,     // Static files - rarely change
    npcs: false,     // MySQL - admins add new NPCs
    monsters: true,  // Static files - stable templates
    classes: true,   // Static files - rarely change
    spells: true,    // Static files - rarely change
    quests: false    // MySQL - admins create new quests
};
\`\`\`

**Result:** Best of both worlds!
- Frequently-edited content loads from MySQL (real-time collaboration)
- Stable content loads from static files (faster, no API calls)

## Production Deployment

### Option 1: Deploy API Server on Your Existing Server

Since you already have MySQL, you probably have a web server. Deploy the Node.js API:

\`\`\`bash
# On your server
cd /var/www/mud-game
npm install --production
npm run server
\`\`\`

Use a process manager to keep it running:
\`\`\`bash
# Install PM2
npm install -g pm2

# Start server with PM2
pm2 start server/server.js --name "mud-api"
pm2 save
pm2 startup
\`\`\`

### Option 2: Use Nginx as Reverse Proxy

Configure Nginx to proxy API requests:

\`\`\`nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve static files
    location / {
        root /var/www/mud-game;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## Troubleshooting

### Server won't start - "MySQL connection failed"
- Check credentials in `server/.env`
- Verify MySQL is running: `mysql -u root -p`
- Check firewall allows port 3306

### Browser shows "Failed to load from MySQL"
- Check API server is running: `http://localhost:3000/health`
- Check CORS settings in `server/.env`
- Check browser console for specific error

### Admin edits don't save
- Check admin API key in requests
- Look at server console for errors
- Verify table exists: `SHOW TABLES LIKE 'mud_%';`

### Data appears empty after migration
- Re-run migration: `npm run migrate`
- Check Firebase config in `js/config.js` is correct
- Verify data in MySQL: `SELECT COUNT(*) FROM mud_rooms;`

## Benefits vs. Static Files / Firebase

| Feature | Static Files | Firebase | MySQL Backend |
|---------|-------------|----------|---------------|
| **Real-time collaboration** | ❌ | ✅ | ✅ |
| **Performance** | ✅ (fastest) | ⚠️ (medium) | ✅ (fast) |
| **Cost** | ✅ (free) | ❌ (pay per read) | ✅ (your server) |
| **Offline support** | ✅ | ❌ | ❌ |
| **Version control** | ✅ (git) | ❌ | ⚠️ (SQL dumps) |
| **Advanced queries** | ❌ | ⚠️ (limited) | ✅ (full SQL) |
| **Multi-admin editing** | ❌ | ✅ | ✅ |
| **Server required** | ❌ | ❌ | ✅ |

## Next Steps

1. **Update admin panel** to send edits to MySQL API instead of Firebase
2. **Add authentication** - Connect API key to Firebase user auth
3. **Enable real-time updates** - Add WebSocket support for instant admin sync
4. **Optimize queries** - Add indexes for common search patterns
5. **Add caching** - Redis cache for frequently-accessed data
6. **Backup automation** - Schedule MySQL dumps to S3/backup server

Need help with any of these steps? Let me know!
