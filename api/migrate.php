<?php
// Firebase to MySQL Migration Script
// Run this once to copy all data from Firebase to MySQL

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// You'll need to export Firebase data to JSON files first
// Use the browser export panel or npm run export

$collections = [
    'rooms' => __DIR__ . '/../data/rooms.json',
    'items' => __DIR__ . '/../data/items.json',
    'npcs' => __DIR__ . '/../data/npcs.json',
    'monsters' => __DIR__ . '/../data/monsters.json',
    'classes' => __DIR__ . '/../data/classes.json',
    'spells' => __DIR__ . '/../data/spells.json',
    'quests' => __DIR__ . '/../data/quests.json',
    'guilds' => __DIR__ . '/../data/guilds.json'
];

echo "<h1>Firebase to MySQL Migration</h1>\n";
echo "<pre>\n";

try {
    $db = Database::getInstance();
    echo "✓ Connected to MySQL database\n\n";
    
    $totalImported = 0;
    
    foreach ($collections as $collectionName => $jsonFile) {
        echo "Migrating $collectionName...\n";
        
        if (!file_exists($jsonFile)) {
            echo "  ⚠ File not found: $jsonFile\n";
            echo "  Skipping...\n\n";
            continue;
        }
        
        $jsonContent = file_get_contents($jsonFile);
        $documents = json_decode($jsonContent, true);
        
        if ($documents === null) {
            echo "  ❌ Error reading JSON file\n\n";
            continue;
        }
        
        $count = count($documents);
        echo "  Found $count documents\n";
        
        if ($count > 0) {
            $tableName = 'mud_' . $collectionName;
            $imported = $db->bulkImport($tableName, $documents);
            $totalImported += $imported;
            echo "  ✓ Imported $imported documents to $tableName\n";
        } else {
            echo "  ⚠ No documents to import\n";
        }
        
        echo "\n";
    }
    
    echo "✅ Migration complete! Total documents imported: $totalImported\n";
    
} catch (Exception $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    error_log("Migration error: " . $e->getMessage());
}

echo "</pre>\n";
?>
