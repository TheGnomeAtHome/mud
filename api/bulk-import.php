<?php
/**
 * Bulk Import API - Import multiple game entities at once
 * Supports: rooms, items, npcs, monsters, classes, quests, spells
 */

// Catch any fatal errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode(['error' => "PHP Error: $errstr in $errfile:$errline"]);
    exit();
});

require_once 'config.php';
require_once 'database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Get request body ONCE (php://input can only be read once)
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

// Debug: log the raw input
if (!$input) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid JSON',
        'raw' => substr($rawInput, 0, 200),
        'json_error' => json_last_error_msg()
    ]);
    exit();
}

// Verify admin API key - Try multiple methods to get the key
$apiKey = null;

// Method 1: Check custom header (Apache format)
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    $apiKey = $headers['X-API-Key'] ?? $headers['X-Api-Key'] ?? $headers['x-api-key'] ?? null;
}

// Method 2: Check PHP's HTTP_ format
if (!$apiKey && isset($_SERVER['HTTP_X_API_KEY'])) {
    $apiKey = $_SERVER['HTTP_X_API_KEY'];
}

// Method 3: Check POST data
if (!$apiKey && isset($_POST['api_key'])) {
    $apiKey = $_POST['api_key'];
}

// Method 4: Check JSON body
if (!$apiKey && !empty($input['api_key'])) {
    $apiKey = $input['api_key'];
}

// Validate API key with detailed debugging
if (!$apiKey || trim($apiKey) !== ADMIN_API_KEY) {
    http_response_code(403);
    echo json_encode([
        'error' => 'Invalid API key',
        'debug' => [
            'received' => $apiKey,
            'received_trimmed' => trim($apiKey ?? ''),
            'expected' => ADMIN_API_KEY,
            'match' => ($apiKey === ADMIN_API_KEY) ? 'exact' : 'no',
            'match_trimmed' => (trim($apiKey ?? '') === ADMIN_API_KEY) ? 'trimmed' : 'no',
            'method_1_getallheaders' => function_exists('getallheaders') ? 'yes' : 'no',
            'method_2_http_header' => isset($_SERVER['HTTP_X_API_KEY']) ? 'yes' : 'no',
            'method_4_json_body' => !empty($input) ? 'yes' : 'no'
        ]
    ]);
    exit();
}

// Get request data (already parsed above)
$type = $input['type'] ?? null;
$items = $input['items'] ?? [];

if (!$type || empty($items)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing type or items']);
    exit();
}

// Validate type
$validTypes = ['rooms', 'items', 'npcs', 'monsters', 'classes', 'quests', 'spells'];
if (!in_array($type, $validTypes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type. Must be one of: ' . implode(', ', $validTypes)]);
    exit();
}

try {
    $db = getDatabase();
    
    if (!$db) {
        throw new Exception('Database connection failed');
    }
    
    $db->beginTransaction();
    
    $imported = 0;
    $errors = [];
    
    foreach ($items as $item) {
        $id = $item['id'] ?? null;
        unset($item['id']); // Remove ID from data object
        
        if (!$id) {
            $errors[] = "Item missing ID: " . json_encode($item);
            continue;
        }
        
        // Validate required fields based on type
        $valid = validateItem($type, $item);
        if ($valid !== true) {
            $errors[] = "Item '$id' validation failed: $valid";
            continue;
        }
        
        // Convert item to JSON for storage in 'data' column
        $jsonData = json_encode($item);
        
        // Insert or update
        $table = 'mud_' . $type;
        
        // Check if exists
        $stmt = $db->prepare("SELECT id FROM $table WHERE id = ?");
        $stmt->execute([$id]);
        $exists = $stmt->fetch();
        
        if ($exists) {
            // Update existing - only update 'data' column
            $sql = "UPDATE $table SET data = ? WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$jsonData, $id]);
        } else {
            // Insert new - id and data columns
            $sql = "INSERT INTO $table (id, data) VALUES (?, ?)";
            $stmt = $db->prepare($sql);
            $stmt->execute([$id, $jsonData]);
        }
        
        $imported++;
    }
    
    $db->commit();
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'imported' => $imported,
        'total' => count($items),
        'errors' => $errors
    ]);
    
} catch (Exception $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'error' => 'Import failed: ' . $e->getMessage()
    ]);
}

/**
 * Validate item based on type
 */
function validateItem($type, $item) {
    switch ($type) {
        case 'rooms':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            break;
            
        case 'items':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            if (empty($item['type'])) return 'Missing type';
            break;
            
        case 'npcs':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            break;
            
        case 'monsters':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            if (!isset($item['hp'])) return 'Missing hp';
            if (!isset($item['maxHp'])) return 'Missing maxHp';
            break;
            
        case 'classes':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            break;
            
        case 'quests':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            if (empty($item['type'])) return 'Missing type';
            break;
            
        case 'spells':
            if (empty($item['name'])) return 'Missing name';
            if (empty($item['description'])) return 'Missing description';
            if (!isset($item['manaCost'])) return 'Missing manaCost';
            break;
    }
    
    return true;
}

/**
 * Prepare data for storage - convert arrays/objects to JSON
 */
function prepareDataForStorage($data) {
    $prepared = [];
    
    foreach ($data as $key => $value) {
        if (is_array($value) || is_object($value)) {
            $prepared[$key] = json_encode($value);
        } else {
            $prepared[$key] = $value;
        }
    }
    
    return $prepared;
}
