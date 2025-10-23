<?php
// Simple test to verify the file is accessible
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'status' => 'ok',
    'message' => 'bulk-import.php is accessible!',
    'timestamp' => date('Y-m-d H:i:s')
]);
