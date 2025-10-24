<?php
/**
 * Get Error Logs API Endpoint
 * Retrieves error logs from MySQL with filtering options
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    $db = Database::getInstance()->getConnection();
    
    // Get specific log by ID
    if (isset($_GET['id'])) {
        $stmt = $db->prepare("SELECT * FROM error_logs WHERE id = :id");
        $stmt->bindValue(':id', $_GET['id'], PDO::PARAM_INT);
        $stmt->execute();
        $log = $stmt->fetch();
        
        if (!$log) {
            throw new Exception('Log not found');
        }
        
        echo json_encode([
            'success' => true,
            'log' => $log
        ]);
        exit();
    }
    
    // Build WHERE clause based on filters
    $where = [];
    $params = [];
    
    if (!empty($_GET['severity'])) {
        $where[] = "severity = :severity";
        $params[':severity'] = $_GET['severity'];
    }
    
    if (!empty($_GET['category'])) {
        $where[] = "category = :category";
        $params[':category'] = $_GET['category'];
    }
    
    if (!empty($_GET['player'])) {
        $where[] = "player_name LIKE :player";
        $params[':player'] = '%' . $_GET['player'] . '%';
    }
    
    if (!empty($_GET['room'])) {
        $where[] = "room_id = :room";
        $params[':room'] = $_GET['room'];
    }
    
    if (!empty($_GET['from_date'])) {
        $where[] = "timestamp >= :from_date";
        $params[':from_date'] = $_GET['from_date'];
    }
    
    if (!empty($_GET['to_date'])) {
        $where[] = "timestamp <= :to_date";
        $params[':to_date'] = $_GET['to_date'];
    }
    
    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM error_logs $whereClause";
    $countStmt = $db->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalCount = $countStmt->fetch()['total'];
    
    // Get stats by severity
    $statsSql = "
        SELECT 
            severity,
            COUNT(*) as count
        FROM error_logs 
        $whereClause
        GROUP BY severity
    ";
    $statsStmt = $db->prepare($statsSql);
    foreach ($params as $key => $value) {
        $statsStmt->bindValue($key, $value);
    }
    $statsStmt->execute();
    $statsRows = $statsStmt->fetchAll();
    
    $stats = [
        'total' => $totalCount,
        'critical' => 0,
        'error' => 0,
        'warning' => 0,
        'info' => 0
    ];
    
    foreach ($statsRows as $row) {
        $stats[$row['severity']] = (int)$row['count'];
    }
    
    // Get logs
    $limit = isset($_GET['limit']) ? min(intval($_GET['limit']), 1000) : 100;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    
    $logsSql = "
        SELECT 
            id,
            timestamp,
            severity,
            category,
            player_id,
            player_name,
            room_id,
            message,
            error_type,
            command_input
        FROM error_logs 
        $whereClause
        ORDER BY timestamp DESC
        LIMIT :limit OFFSET :offset
    ";
    
    $logsStmt = $db->prepare($logsSql);
    foreach ($params as $key => $value) {
        $logsStmt->bindValue($key, $value);
    }
    $logsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $logsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $logsStmt->execute();
    $logs = $logsStmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'logs' => $logs,
        'pagination' => [
            'total' => $totalCount,
            'limit' => $limit,
            'offset' => $offset,
            'hasMore' => ($offset + $limit) < $totalCount
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Get error logs failed: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
