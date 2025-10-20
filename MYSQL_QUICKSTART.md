# MySQL Backend - Quick Start

## TL;DR - Get MySQL backend running in 5 minutes

### 1. Install Dependencies
\`\`\`powershell
npm install
\`\`\`

### 2. Create MySQL Database
\`\`\`sql
CREATE DATABASE mud_game;
\`\`\`

Then run the schema:
\`\`\`powershell
mysql -u root -p mud_game < server/schema.sql
\`\`\`

### 3. Configure
\`\`\`powershell
copy server\\.env.example server\\.env
\`\`\`

Edit `server/.env`:
\`\`\`env
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=mud_game
ADMIN_API_KEY=your-random-key-here
\`\`\`

### 4. Migrate Data
\`\`\`powershell
npm run migrate
\`\`\`

### 5. Start Server
\`\`\`powershell
npm run server
\`\`\`

### 6. Enable MySQL in Game

Edit `js/data-loader.js` line 9:
\`\`\`javascript
const USE_MYSQL_BACKEND = true;
\`\`\`

### 7. Done!

Open game in browser, check console for:
\`\`\`
[DataLoader] ✓ Loaded 15 rooms from MySQL
\`\`\`

---

## What This Gives You

✅ Multiple admins edit simultaneously  
✅ Changes visible immediately to everyone  
✅ No Firebase costs for content data  
✅ Your existing MySQL infrastructure  
✅ Standard SQL backups  

## Full Documentation

See `MYSQL_BACKEND_GUIDE.md` for complete setup, troubleshooting, and production deployment.
