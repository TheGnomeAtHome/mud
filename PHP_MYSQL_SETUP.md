# PHP + MySQL Backend Setup Guide

## Overview

Since your hosting (jphsoftware.com) supports PHP and MySQL (like WordPress), we can use a **PHP API** instead of Node.js to connect your game to MySQL!

## What You Get

✅ **Multi-admin real-time collaboration** - Multiple admins edit simultaneously  
✅ **MySQL backend** - All data in your existing database  
✅ **No Firebase costs** - Self-hosted on your server  
✅ **Works on your current hosting** - No Node.js or special setup needed  
✅ **Same as WordPress** - Uses PHP + MySQL like your other sites  

---

## Quick Setup (5 Steps)

### Step 1: Create Database Tables (phpMyAdmin)

1. Login to **phpMyAdmin** (jphsoftware.com/phpmyadmin or your control panel link)
2. Select or create database: `mud_game` (or use existing database)
3. Click **SQL** tab
4. Copy and paste the SQL from `server/schema.sql`
5. Click **Go**
6. Verify 8 tables created: `mud_rooms`, `mud_items`, `mud_npcs`, etc.

### Step 2: Configure API

Edit `api/config.php` with your MySQL credentials:

```php
<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_mysql_username');      // ← Your MySQL username
define('DB_PASS', 'your_mysql_password');      // ← Your MySQL password
define('DB_NAME', 'mud_game');                 // ← Your database name

// Generate random admin key (use PowerShell command below)
define('ADMIN_API_KEY', 'your-secret-key-here');

// Your domain
$allowedOrigins = [
    'https://jphsoftware.com',
    'http://jphsoftware.com'
];
?>
```

**Generate secure admin key** (run on your PC):
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Step 3: Upload Files via FTP

Upload the `/api/` folder to your server:

```
/api/
  ├── config.php       (with your MySQL credentials)
  ├── database.php
  ├── index.php
  ├── migrate.php
  └── .htaccess
```

Upload location: `public_html/api/` (or wherever your website files are)

### Step 4: Export Firebase Data to JSON

On your PC, run:
```powershell
npm run export
```

This creates JSON files in `/data/` folder. Upload these to your server at:
```
public_html/data/
  ├── rooms.json
  ├── items.json
  ├── npcs.json
  ├── monsters.json
  ├── classes.json
  ├── spells.json
  ├── quests.json
  └── guilds.json
```

### Step 5: Run Migration

Visit in your browser:
```
https://jphsoftware.com/api/migrate.php
```

You should see:
```
✓ Connected to MySQL database
Migrating rooms...
  Found 15 documents
  ✓ Imported 15 documents to mud_rooms
...
✅ Migration complete! Total documents imported: 342
```

### Step 6: Enable MySQL Backend in Game

Edit `js/data-loader.js` line 9:
```javascript
const USE_MYSQL_BACKEND = true;
```

Upload the updated file to your server.

### Step 7: Test!

1. **Test API health:**
   Visit: `https://jphsoftware.com/api/health`
   
   Should see:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "timestamp": "2025-10-20T..."
   }
   ```

2. **Test data loading:**
   - Open your game: `https://jphsoftware.com/`
   - Open browser console (F12)
   - Should see: `[DataLoader] ✓ Loaded 15 rooms from MySQL`

3. **Test admin editing:**
   - Login as admin
   - Edit a room or NPC
   - Open game in another browser/incognito
   - Verify changes appear immediately

---

## How It Works

```
Browser (JavaScript) ←→ PHP API ←→ MySQL Database
                      (index.php)
```

### API Endpoints

**Public (No Authentication):**
- `GET /api/health` - Check server status
- `GET /api/rooms` - Get all rooms
- `GET /api/items` - Get all items
- `GET /api/npcs` - Get all NPCs
- `GET /api/{collection}/{id}` - Get single document

**Admin Only (Requires API Key):**
- `PUT /api/rooms/tavern` - Create/update room
- `DELETE /api/rooms/tavern` - Delete room

Headers for admin requests:
```
X-API-Key: your-admin-api-key-here
Content-Type: application/json
```

---

## Troubleshooting

### "Database connection failed"

**Problem:** Can't connect to MySQL

**Solutions:**
1. Check credentials in `api/config.php`
2. Verify database exists in phpMyAdmin
3. Check MySQL user has permissions
4. Contact hosting support if needed

### "CORS error in browser"

**Problem:** Browser blocked request from different origin

**Solutions:**
1. Update `$allowedOrigins` in `api/config.php`
2. Include both http:// and https:// versions
3. Check `.htaccess` file uploaded correctly

### "500 Internal Server Error"

**Problem:** PHP error

**Solutions:**
1. Check `api/error.log` file on server (created automatically)
2. Verify PHP version is 7.4+ (check in cPanel)
3. Check file permissions: 644 for .php files, 755 for directories

### "Migration shows 'File not found'"

**Problem:** JSON files not in correct location

**Solutions:**
1. Run `npm run export` on your PC first
2. Upload `/data/*.json` files to server
3. Check paths in `api/migrate.php` match your file locations

### "Data doesn't load in game"

**Problem:** Game can't reach API

**Solutions:**
1. Visit `https://jphsoftware.com/api/health` - should return JSON
2. Check `USE_MYSQL_BACKEND = true` in `js/data-loader.js`
3. Check browser console for specific error messages
4. Verify `MYSQL_API_URL` matches your domain

---

## Configuration Options

### Hybrid Mode (Recommended)

Load some collections from MySQL (live editing) and others from static files (performance):

```javascript
// js/data-loader.js
const USE_STATIC_FILES = true;
const USE_MYSQL_BACKEND = true;

const STATIC_CONFIG = {
    rooms: false,    // MySQL - admins edit frequently
    items: true,     // Static files - rarely change
    npcs: false,     // MySQL - admins add NPCs
    monsters: true,  // Static files - stable
    classes: true,   // Static files - rarely change
    spells: true,    // Static files - rarely change
    quests: false    // MySQL - admins create quests
};
```

When `USE_MYSQL_BACKEND = true` and `STATIC_CONFIG.rooms = false`, rooms load from MySQL API.

### Full MySQL Mode

Everything from MySQL:

```javascript
const USE_STATIC_FILES = false;
const USE_MYSQL_BACKEND = true;

const STATIC_CONFIG = {
    rooms: false,
    items: false,
    npcs: false,
    monsters: false,
    classes: false,
    spells: false,
    quests: false
};
```

**Note:** This uses more API calls but gives real-time updates for everything.

---

## Security Best Practices

1. **Secure your admin API key:**
   - Use long random string (32+ characters)
   - Never commit to git (add `api/config.php` to `.gitignore`)
   - Rotate key periodically

2. **HTTPS only:**
   - Always use `https://` not `http://`
   - Get free SSL certificate from Let's Encrypt (usually in cPanel)

3. **Rate limiting** (optional):
   Add to `api/index.php` to prevent abuse:
   ```php
   // Simple rate limiting (300 requests per minute)
   session_start();
   $_SESSION['requests'] = ($_SESSION['requests'] ?? 0) + 1;
   if ($_SESSION['requests'] > 300) {
       http_response_code(429);
       die(json_encode(['error' => 'Too many requests']));
   }
   ```

4. **Database backups:**
   - Use phpMyAdmin: Export → SQL → Save
   - Or setup automatic backups in cPanel
   - Backup before major changes

---

## Maintenance

### Backup Database

**Via phpMyAdmin:**
1. Select database
2. Click **Export** tab
3. Choose **Quick** or **Custom**
4. Click **Go**
5. Save SQL file

**Via cPanel:**
- Most cPanel installations have automatic backups
- Check "Backup" or "Backup Wizard" section

### Update Game Content

**For collections in MySQL (rooms, npcs):**
1. Edit in admin panel
2. Changes save automatically
3. Visible immediately to all players

**For collections in static files (items, monsters):**
1. Edit in admin panel
2. Run `npm run export` locally
3. Upload updated JSON files via FTP
4. Players see changes on next page refresh

### Monitor Performance

Check `api/error.log` for issues:
```bash
# Via SSH or File Manager
tail -f api/error.log
```

---

## Comparison

| Feature | Firebase + Static | MySQL + PHP API |
|---------|------------------|-----------------|
| **Setup complexity** | Low | Medium |
| **Hosting requirements** | Any | PHP + MySQL |
| **Real-time collaboration** | ✅ Yes | ✅ Yes |
| **Cost** | Free tier limits | Free (your hosting) |
| **Performance** | Fast | Fast |
| **Data ownership** | Google | You |
| **Backup** | Export required | Standard SQL dump |
| **Query capabilities** | Limited | Full SQL |

---

## Need Help?

1. **Check logs:** `api/error.log` on server
2. **Test API:** Visit `/api/health` endpoint
3. **Browser console:** Check for error messages (F12)
4. **Contact support:** Your hosting provider can help with PHP/MySQL issues

## Next Steps

Once working:
1. ✅ Test multi-admin editing
2. ✅ Setup automatic database backups
3. ✅ Configure SSL certificate (HTTPS)
4. ✅ Add rate limiting if needed
5. ✅ Update admin panel to use MySQL API for saves

Enjoy your self-hosted MUD game! 🎉
