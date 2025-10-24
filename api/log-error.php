<?php
/**
 * Error Logging API Endpoint
 * Receives error logs from the game client and stores them in MySQL
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    // Get the JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data) {
        throw new Exception('Invalid JSON data');
    }
    
    // Required field
    if (empty($data['message'])) {
        throw new Exception('Error message is required');
    }
    
    // Get database connection
    $db = Database::getInstance()->getConnection();
    
    // Prepare the insert statement
    $sql = "INSERT INTO error_logs (
        severity,
        category,
        player_id,
        player_name,
        room_id,
        message,
        error_type,
        stack_trace,
        command_input,
        parsed_command,
        user_agent,
        browser_version,
        screen_resolution,
        metadata
    ) VALUES (
        :severity,
        :category,
        :player_id,
        :player_name,
        :room_id,
        :message,
        :error_type,
        :stack_trace,
        :command_input,
        :parsed_command,
        :user_agent,
        :browser_version,
        :screen_resolution,
        :metadata
    )";
    
    $stmt = $db->prepare($sql);
    
    // Bind parameters with defaults
    $stmt->bindValue(':severity', $data['severity'] ?? 'error', PDO::PARAM_STR);
    $stmt->bindValue(':category', $data['category'] ?? 'general', PDO::PARAM_STR);
    $stmt->bindValue(':player_id', $data['playerId'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':player_name', $data['playerName'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':room_id', $data['roomId'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':message', $data['message'], PDO::PARAM_STR);
    $stmt->bindValue(':error_type', $data['errorType'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':stack_trace', $data['stackTrace'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':command_input', $data['commandInput'] ?? null, PDO::PARAM_STR);
    
    // Handle JSON fields
    $parsedCommand = isset($data['parsedCommand']) ? json_encode($data['parsedCommand']) : null;
    $stmt->bindValue(':parsed_command', $parsedCommand, PDO::PARAM_STR);
    
    // System context
    $stmt->bindValue(':user_agent', $_SERVER['HTTP_USER_AGENT'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':browser_version', $data['browserVersion'] ?? null, PDO::PARAM_STR);
    $stmt->bindValue(':screen_resolution', $data['screenResolution'] ?? null, PDO::PARAM_STR);
    
    // Additional metadata
    $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
    $stmt->bindValue(':metadata', $metadata, PDO::PARAM_STR);
    
    // Execute the insert
    $stmt->execute();
    
    // Get the inserted ID
    $logId = $db->lastInsertId();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'logId' => $logId,
        'message' => 'Error logged successfully'
    ]);
    
} catch (Exception $e) {
    // Log to PHP error log as backup
    error_log("Error logging failed: " . $e->getMessage());
    error_log("Input data: " . ($input ?? 'none'));
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
