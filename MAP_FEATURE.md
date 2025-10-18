# 🗺️ Interactive World Map Feature

## What Was Added

A fully interactive, visual map of your MUD game world using the vis.js network visualization library.

## Features

### Visual Elements
- **🟢 Green Nodes**: Standard rooms
- **🔵 Blue Nodes**: Rooms with items (🎒)
- **🟣 Purple Nodes**: Rooms with NPCs (👤)
- **🔴 Red Nodes**: Rooms with monsters (👹)
- **🟡 Yellow Nodes**: Rooms with active players (⭐)

### Interactivity
- **Pan**: Click and drag anywhere
- **Zoom**: Mouse wheel / trackpad pinch
- **Click Room**: Opens room editor for that room
- **Hover**: See room description tooltip
- **Navigation Buttons**: Built-in zoom and fit controls

### Connection Lines
- **Arrows**: Show exit directions
- **Labels**: Display direction (north, south, east, west, etc.)
- **Color**: Green lines, yellow when highlighted

## How to Use

1. **Open Admin Panel**: Click the "Admin Panel" button (admins only)
2. **Click Map Tab**: Click the "🗺️ Map" tab in the admin panel
3. **Wait for Layout**: The map will auto-generate and stabilize (2-3 seconds)
4. **Explore**: 
   - Pan around to see all rooms
   - Zoom in/out to see details
   - Click any room to edit it
5. **Refresh**: Click "Refresh Map" button to reload after changes

## Technical Details

### Libraries Used
- **vis.js Network**: Professional graph visualization
- CDN: `https://unpkg.com/vis-network/standalone/umd/vis-network.min.js`

### Physics Engine
- Automatic layout using Barnes-Hut simulation
- Nodes repel each other to avoid overlap
- Stabilizes after ~200 iterations
- Physics disabled after stabilization for performance

### Performance
- Handles 100+ rooms easily
- Auto-layout ensures no overlapping
- Click events for instant room editing
- Lightweight: ~100KB library size

## Files Modified

1. **index.html**:
   - Added vis.js CDN link
   - Added map CSS styles
   - Added "Map" tab button
   - Added map visualization panel HTML

2. **js/admin.js**:
   - Added map tab to panel switcher
   - Added `generateMap()` function
   - Added click handler for room editing
   - Added refresh map button handler
   - Auto-generates map when tab is opened

## Future Enhancements

Possible additions:
- [ ] Save/load custom node positions
- [ ] Filter view by room type (items/npcs/monsters)
- [ ] Search/highlight specific rooms
- [ ] Show player movement in real-time
- [ ] Minimap overview
- [ ] Export map as image
- [ ] Show shortest path between rooms

## Troubleshooting

**Map not appearing?**
- Check browser console for errors
- Ensure vis.js CDN is loading (check Network tab)
- Try refreshing the map manually

**Nodes overlapping?**
- Wait for stabilization (2-3 seconds)
- Click "Refresh Map" button
- Zoom out to see full layout

**Can't click rooms?**
- Make sure you're clicking the node itself
- Check if room exists in database
- Try refreshing the map

## Usage Tips

1. **Best Practices**:
   - Create rooms with meaningful names for better labels
   - Use bidirectional exits (north/south pairs) for cleaner layout
   - Start with a central "hub" room and branch out

2. **Designing World Layout**:
   - Use the map to visualize your world structure
   - Identify isolated areas (no connections)
   - Balance item/NPC/monster distribution visually

3. **Quick Editing**:
   - Click a room on the map to instantly open its editor
   - Much faster than scrolling through dropdown!

## Credits

- vis.js: https://visjs.org/
- Network visualization by vis.js community
