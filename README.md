# M.U.D. - The Digital Realm 🎮

A browser-based Multi-User Dungeon (MUD) game featuring real-time multiplayer, AI-powered NPCs, and dynamic combat.

## Copyright and License

© 2025 JPH Software (http://jphsoftware.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see [https://www.gnu.org/licenses/](https://www.gnu.org/licenses/).

**IMPORTANT:** The copyright notice and the link to jphsoftware.com must be preserved
in all copies or substantial portions of this software.

## 🌟 Features

### Core Gameplay
- **Real-time Multiplayer** - Play with others simultaneously using Firebase backend
- **Natural Language Commands** - Powered by Google's Gemini AI for intuitive gameplay
- **Character Creation** - Customizable characters with stat rolling (3d6 system)
- **Dynamic Combat System** - Fight monsters or engage in PvP battles
- **Progression System** - 30 levels with custom titles and XP requirements

### Advanced Features
- **AI-Powered NPCs** - NPCs with personalities that respond naturally using Gemini AI
- **Quest System** - Multi-objective quests with prerequisites and rewards
- **Guild System** - Player guilds with guild halls and member management
- **Party System** - Team up with other players for cooperative gameplay
- **Class System** - Multiple character classes with unique abilities and spells
- **Equipment System** - Weapons, armor, and containers with durability
- **Weather System** - Dynamic weather affecting gameplay and movement
- **Trading System** - Buy, sell, and haggle with merchants
- **Crafting** - Poison system and item interactions
- **Bot System** - Automated test players for development and ambient activity
- **News/Achievement System** - Track and share player accomplishments
- **Builder System** - Players can create and design their own rooms
- **Admin Panel** - Comprehensive content management system
- **Interactive Map** - Visual room network with relationship mapping

### Performance & Optimization
- **Modular Architecture** - Clean separation of concerns with ES6 modules
- **Hybrid Database** - MySQL for static data, Firebase for real-time updates
- **80% Cost Reduction** - Optimized Firebase usage through smart data routing
  - Phase 1: Auto-cleanup of old messages (85% storage reduction)
  - Phase 2: Static data caching from MySQL (95% read reduction)
  - Phase 3: Session vs permanent data split (75% write reduction)
- **Performance Optimized** - 54% reduction in main file size through refactoring
- **Real-time Updates** - Firebase Firestore for instant synchronization
- **Responsive Design** - Built with Tailwind CSS

## 🚀 Play Now

**🎮 Play the Game**: [http://jphsoftware.com/mud.html](http://jphsoftware.com/mud.html)

**🏠 Landing Page**: [http://jphsoftware.com](http://jphsoftware.com)

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS
- **Backend**: 
  - Firebase (Firestore, Authentication) - Real-time data
  - MySQL - Static game data and permanent player data
  - PHP API - RESTful endpoints for MySQL operations
- **AI**: Google Gemini API
- **Visualization**: vis.js for network graphs
- **Hosting**: Self-hosted at jphsoftware.com

## 📦 Project Structure

```
mud/
├── index.html              # Landing page with live stats
├── mud.html                # Main game interface
├── js/
│   ├── app.js             # Application coordinator
│   ├── game.js            # Core game logic (10,400+ lines)
│   ├── admin.js           # Admin panel (1,713 lines)
│   ├── auth.js            # Authentication module
│   ├── ui.js              # UI helper functions
│   ├── ai.js              # Gemini AI integration
│   ├── bots.js            # Automated bot system
│   ├── weather.js         # Weather system
│   ├── trading.js         # Trading mechanics
│   ├── player-persistence.js  # Dual-database player management
│   ├── data-loader.js     # Game data management with caching
│   ├── firebase-init.js   # Firebase configuration
│   └── config.js          # App configuration
├── api/
│   ├── index.php          # RESTful API endpoints
│   └── database.php       # MySQL operations
├── css/
│   └── style.css          # Custom styling
└── docs/                  # Feature documentation
```

## 🎮 How to Play

1. Visit the game URL
2. Register or login with email/password
3. Create your character (name, race, stats)
4. Type commands in natural language:
   - `look` - Examine your surroundings
   - `go north` or just `n` - Move around
   - `talk to [npc]` - Interact with NPCs
   - `attack [monster]` - Fight monsters
   - `attack [player]` - Challenge other players
   - `inventory` - Check your items
   - `help` - See all commands

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/TheGnomeAtHome/mud.git
   cd mud
   ```

2. Set up configuration files from templates:
   - Copy all template files to create your local configuration files:
     ```bash
     copy js\config.template.js js\config.js
     copy index.template.html index.html
     copy setup-default-classes.template.html setup-default-classes.html
     copy setup-default-spells.template.html setup-default-spells.html
     copy setup-default-world.template.html setup-default-world.html
     ```
   - Edit each file to add your Firebase and Gemini API credentials:
     - Replace `YOUR_APP_ID` with your Firebase App ID
     - Replace `YOUR_GEMINI_API_KEY` with your Gemini API key
     - Replace Firebase configuration values with your project values

3. Configure Firebase:
   - Set up Firestore collections (see structure below)

4. Serve locally:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node
   npx serve
   ```

5. Open `http://localhost:8000/mud.html`

## 📊 Database Architecture

### Firebase (Real-time Data)
```
/artifacts/{appId}/public/data/
├── mud-messages/        # Real-time chat (auto-cleanup >24h)
├── mud-active-monsters/ # Live monster instances
├── mud-news/            # Achievement feed
└── (Player session data: HP, MP, position, online status)
```

### MySQL (Static & Permanent Data)
```
Tables:
├── mud_rooms           # World geography (builder-created rooms)
├── mud_items           # Item definitions
├── mud_npcs            # NPC configurations
├── mud_monsters        # Monster templates
├── mud_classes         # Character classes
├── mud_spells          # Spell definitions
├── mud_guilds          # Guild data
├── mud_quests          # Quest definitions
├── mud_parties         # Party data
└── mud_players         # Player permanent data (XP, inventory, equipment, permissions)
```

### Hybrid Strategy
- **Firebase**: Real-time updates (HP, MP, chat, position) - Fast, low latency
- **MySQL**: Static game data + permanent player data - Cost-effective, reliable
- **Automatic Sync**: Session data syncs to MySQL on logout for persistence

## 🎯 Recent Updates

### Builder System (January 2025)
- **Player World-Building**: Trusted players can create and design custom rooms
- **11 Builder Commands**: buildroom, editdesc, addexit, removeexit, adddetail, builderrooms, and more
- **Approval Workflow**: Admin review system for quality control
- **Permission System**: 3-tier permissions (player/builder/admin)
- **Complete Documentation**: In-game HTML guides and markdown references

### Firebase Optimization (October 2024)
- **Phase 1**: Message cleanup - Automatic deletion of messages >24 hours old
- **Phase 2**: Data caching - Static game data loaded from MySQL once per session
- **Phase 3**: Player data split - Session data (Firebase) vs permanent data (MySQL)
- **Result**: 80% reduction in Firebase costs while maintaining real-time performance

### New Features (2024-2025)
- ✅ Builder system - Player-created rooms with approval workflow
- ✅ Quest system with prerequisites and multi-objectives
- ✅ Guild system with guild halls
- ✅ Party system for cooperative play
- ✅ Class system with unique abilities
- ✅ Equipment system with durability
- ✅ Weather system affecting gameplay
- ✅ Trading and haggling mechanics
- ✅ Poison crafting system
- ✅ Writable items (books, notes)
- ✅ Pushable objects revealing secrets
- ✅ Locked doors and keys
- ✅ Debug tools and data cleanup utilities

### Roadmap
- [ ] Mobile PWA improvements
- [ ] More spell schools and magic systems
- [ ] Advanced crafting recipes
- [ ] Dungeon instances
- [ ] PvP arenas
- [ ] Sound effects and ambient music
- [ ] Achievement system expansion

## 📝 License

This project is a work in progress and personal learning experiment. Nowhere near finished or ready. 

## 🙏 Acknowledgments

Inspired by classic MUD games and built with modern web technologies. Uses AI to bring NPCs to life and create more immersive gameplay.

---

**Note**: This is a hobby project and work in progress. Feedback and suggestions welcome!
