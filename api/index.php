<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// Set headers for CORS and JSON
header('Content-Type: application/json');

// Handle CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $GLOBALS['allowedOrigins'])) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Parse request URI
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = dirname($_SERVER['SCRIPT_NAME']);
$path = str_replace($scriptName, '', $requestUri);
$path = trim(parse_url($path, PHP_URL_PATH), '/');
$pathParts = explode('/', $path);

// Remove 'api' if it's the first part
if (isset($pathParts[0]) && $pathParts[0] === 'api') {
    array_shift($pathParts);
}

$method = $_SERVER['REQUEST_METHOD'];

// Health check endpoint
if ($path === 'health' || $path === 'api/health') {
    try {
        $db = Database::getInstance();
        $connected = $db->testConnection();
        
        echo json_encode([
            'status' => 'ok',
            'database' => $connected ? 'connected' : 'disconnected',
            'timestamp' => date('c')
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'database' => 'disconnected',
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Main API routes
try {
    $db = Database::getInstance();
    
    // GET /api/{collection} - Get all documents
    if ($method === 'GET' && count($pathParts) === 1) {
        $collection = $pathParts[0];
        $tableName = 'mud_' . $collection;
        
        $data = $db->getAll($tableName);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // GET /api/{collection}/{id} - Get single document
    if ($method === 'GET' && count($pathParts) === 2) {
        $collection = $pathParts[0];
        $id = $pathParts[1];
        $tableName = 'mud_' . $collection;
        
        $data = $db->getById($tableName, $id);
        
        if ($data === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Document not found']);
            exit;
        }
        
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // PUT /api/{collection}/{id} - Create or update document (admin only)
    if ($method === 'PUT' && count($pathParts) === 2) {
        // Check authentication
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if ($apiKey !== ADMIN_API_KEY) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        
        $collection = $pathParts[0];
        $id = $pathParts[1];
        $tableName = 'mud_' . $collection;
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }
        
        $result = $db->upsert($tableName, $id, $input);
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // PATCH /api/{collection}/{id} - Partial update document (admin only)
    if ($method === 'PATCH' && count($pathParts) === 2) {
        // Check authentication
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if ($apiKey !== ADMIN_API_KEY) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        
        $collection = $pathParts[0];
        $id = $pathParts[1];
        $tableName = 'mud_' . $collection;
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }
        
        $result = $db->patch($tableName, $id, $input);
        
        if ($result === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Document not found']);
            exit;
        }
        
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // DELETE /api/{collection}/{id} - Delete document (admin only)
    if ($method === 'DELETE' && count($pathParts) === 2) {
        // Check authentication
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if ($apiKey !== ADMIN_API_KEY) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        
        $collection = $pathParts[0];
        $id = $pathParts[1];
        $tableName = 'mud_' . $collection;
        
        $result = $db->delete($tableName, $id);
        echo json_encode($result);
        exit;
    }
    
    // Route not found
    http_response_code(404);
    echo json_encode([
        'error' => 'Not found',
        'path' => $path,
        'method' => $method
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    error_log("API Error: " . $e->getMessage());
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>
