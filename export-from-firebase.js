// export-from-firebase.js - Export Firebase data to local JSON files
// Run with: node export-from-firebase.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Firebase config from config.js
const configPath = join(__dirname, 'js', 'config.js');
let firebaseConfig, APP_ID;

try {
    const configContent = readFileSync(configPath, 'utf8');
    
    // Extract firebaseConfig
    const configMatch = configContent.match(/export const firebaseConfig = ({[\s\S]*?});/);
    if (configMatch) {
        firebaseConfig = eval('(' + configMatch[1] + ')');
    }
    
    // Extract APP_ID
    const appIdMatch = configContent.match(/export const APP_ID = ['"](.+?)['"]/);
    if (appIdMatch) {
        APP_ID = appIdMatch[1];
    }
    
    if (!firebaseConfig || !APP_ID) {
        throw new Error('Could not parse Firebase config or APP_ID');
    }
} catch (error) {
    console.error('Error reading config.js:', error.message);
    console.log('\nPlease ensure js/config.js exists and contains firebaseConfig and APP_ID');
    process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
    { name: 'rooms', path: 'mud-rooms' },
    { name: 'items', path: 'mud-items' },
    { name: 'npcs', path: 'mud-npcs' },
    { name: 'monsters', path: 'mud-monsters' },
    { name: 'classes', path: 'mud-classes' },
    { name: 'spells', path: 'mud-spells' },
    { name: 'quests', path: 'mud-quests' },
    { name: 'guilds', path: 'mud-guilds' }
];

async function exportCollection(collectionName, collectionPath) {
    try {
        console.log(`📦 Exporting ${collectionName}...`);
        
        const collectionRef = collection(db, `/artifacts/${APP_ID}/public/data/${collectionPath}`);
        const snapshot = await getDocs(collectionRef);
        
        const data = {};
        snapshot.forEach(doc => {
            data[doc.id] = doc.data();
        });
        
        const outputPath = join(__dirname, 'data', `${collectionName}.json`);
        writeFileSync(outputPath, JSON.stringify(data, null, 2));
        
        console.log(`✅ Exported ${snapshot.size} ${collectionName} to data/${collectionName}.json`);
        return snapshot.size;
    } catch (error) {
        console.error(`❌ Error exporting ${collectionName}:`, error.message);
        return 0;
    }
}

async function exportAll() {
    console.log('🚀 Starting Firebase export...\n');
    console.log(`App ID: ${APP_ID}\n`);
    
    let totalExported = 0;
    
    for (const col of collections) {
        const count = await exportCollection(col.name, col.path);
        totalExported += count;
    }
    
    console.log(`\n✨ Export complete! ${totalExported} total documents exported.`);
    console.log(`📁 Files saved to: ${join(__dirname, 'data')}/`);
    process.exit(0);
}

exportAll().catch(error => {
    console.error('❌ Export failed:', error);
    process.exit(1);
});
