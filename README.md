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
- **Bot System** - Automated test players for development and ambient activity
- **News/Achievement System** - Track and share player accomplishments
- **Admin Panel** - Comprehensive content management system
- **Interactive Map** - Visual room network with relationship mapping

### Technical Highlights
- **Modular Architecture** - Clean separation of concerns with ES6 modules
- **Performance Optimized** - 54% reduction in main file size through refactoring
- **Real-time Updates** - Firebase Firestore for instant synchronization
- **Responsive Design** - Built with Tailwind CSS

## 🚀 Play Now

**🎮 Play the Game**: [http://jphsoftware.com/mud.html](http://jphsoftware.com/mud.html)

**🏠 Landing Page**: [http://jphsoftware.com](http://jphsoftware.com)

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication)
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
│   ├── game.js            # Core game logic (1,730 lines)
│   ├── admin.js           # Admin panel (1,713 lines)
│   ├── auth.js            # Authentication module
│   ├── ui.js              # UI helper functions
│   ├── ai.js              # Gemini AI integration
│   ├── bots.js            # Automated bot system
│   ├── firebase-init.js   # Firebase configuration
│   ├── data-loader.js     # Game data management
│   └── config.js          # App configuration
├── css/
│   └── style.css          # Custom styling
└── .github/
    └── copilot-instructions.md
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

## 🔧 Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/TheGnomeAtHome/mud.git
   cd mud
   ```

2. Configure Firebase:
   - Update `js/config.js` with your Firebase credentials
   - Set up Firestore collections (see structure below)

3. Configure Gemini API:
   - Add your API key to `js/config.js`

4. Serve locally:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node
   npx serve
   ```

5. Open `http://localhost:8000/mud.html`

## 📊 Firebase Collections

```
/artifacts/{appId}/public/data/
├── mud-rooms/           # World geography
├── mud-items/           # Item definitions
├── mud-npcs/            # NPC configurations
├── mud-monsters/        # Monster templates
├── mud-active-monsters/ # Live monster instances
├── mud-players/         # Player data
├── mud-messages/        # Real-time chat
├── mud-news/            # Achievement feed
├── mud-levels/          # Level configuration
└── mud-actions/         # Custom emotes
```

## 🎯 Roadmap

- [ ] Mobile-responsive UI improvements
- [ ] More combat mechanics (armor, magic)
- [ ] Guild/party system
- [ ] Quests and storylines
- [ ] Crafting system
- [ ] Improved map visualization
- [ ] Sound effects and music
- [ ] Player trading system

## 📝 License

This project is a work in progress and personal learning experiment. Nowhere near finished or ready. 

## 🙏 Acknowledgments

Inspired by classic MUD games and built with modern web technologies. Uses AI to bring NPCs to life and create more immersive gameplay.

---

**Note**: This is a hobby project and work in progress. Feedback and suggestions welcome!
