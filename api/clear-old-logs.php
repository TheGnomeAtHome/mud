<?php
/**
 * Clear Old Error Logs API Endpoint
 * Deletes error logs older than a specified number of days
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
    $db = Database::getInstance()->getConnection();
    
    // Default: delete logs older than 30 days
    $days = isset($_POST['days']) ? intval($_POST['days']) : 30;
    
    // Safety check: don't allow deleting logs newer than 7 days
    if ($days < 7) {
        throw new Exception('Cannot delete logs newer than 7 days');
    }
    
    $sql = "DELETE FROM error_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL :days DAY)";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':days', $days, PDO::PARAM_INT);
    $stmt->execute();
    
    $deletedCount = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'deleted' => $deletedCount,
        'days' => $days,
        'message' => "Deleted $deletedCount logs older than $days days"
    ]);
    
} catch (Exception $e) {
    error_log("Clear old logs failed: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
