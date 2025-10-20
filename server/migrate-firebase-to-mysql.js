// Migrate data from Firebase to MySQL
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { bulkImport, testConnection } from './database.js';

dotenv.config();

// Read Firebase config from js/config.js
const configContent = readFileSync('./js/config.js', 'utf-8');

// Extract Firebase config
const firebaseConfigMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);
if (!firebaseConfigMatch) {
    throw new Error('Could not find firebaseConfig in js/config.js');
}
const firebaseConfig = eval('(' + firebaseConfigMatch[1] + ')');

// Extract APP_ID
const appIdMatch = configContent.match(/const APP_ID = ['"](.+?)['"]/);
if (!appIdMatch) {
    throw new Error('Could not find APP_ID in js/config.js');
}
const APP_ID = appIdMatch[1];

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
    { name: 'rooms', firebase: 'mud-rooms', mysql: 'mud_rooms' },
    { name: 'items', firebase: 'mud-items', mysql: 'mud_items' },
    { name: 'npcs', firebase: 'mud-npcs', mysql: 'mud_npcs' },
    { name: 'monsters', firebase: 'mud-monsters', mysql: 'mud_monsters' },
    { name: 'classes', firebase: 'mud-classes', mysql: 'mud_classes' },
    { name: 'spells', firebase: 'mud-spells', mysql: 'mud_spells' },
    { name: 'quests', firebase: 'mud-quests', mysql: 'mud_quests' },
    { name: 'guilds', firebase: 'mud-guilds', mysql: 'mud_guilds' }
];

async function migrate() {
    console.log('\n🔄 Starting Firebase to MySQL migration...\n');
    
    // Test MySQL connection
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ MySQL connection failed. Please check your .env configuration.');
        process.exit(1);
    }
    
    let totalImported = 0;
    
    for (const col of collections) {
        try {
            console.log(`📦 Migrating ${col.name}...`);
            
            // Fetch from Firebase
            const collectionRef = collection(db, `/artifacts/${APP_ID}/public/data/${col.firebase}`);
            const snapshot = await getDocs(collectionRef);
            
            // Convert to object format
            const documents = {};
            snapshot.forEach(doc => {
                documents[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            const count = Object.keys(documents).length;
            console.log(`   Found ${count} documents in Firebase`);
            
            // Import to MySQL
            if (count > 0) {
                await bulkImport(col.mysql, documents);
                totalImported += count;
                console.log(`   ✓ Imported ${count} documents to MySQL`);
            } else {
                console.log(`   ⚠ No documents to import`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error migrating ${col.name}:`, error.message);
        }
        
        console.log('');
    }
    
    console.log(`\n✅ Migration complete! Total documents imported: ${totalImported}\n`);
    process.exit(0);
}

migrate();
