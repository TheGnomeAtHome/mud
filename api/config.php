<?php
// MySQL Database Configuration
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_USER', 'jphsoftw_JPHMud');
define('DB_PASS', 'Haggis712694!!');
define('DB_NAME', 'jphsoftw_MUD');

// API Security
define('ADMIN_API_KEY', 'cu4s2YmwWdpMGZ8PfLaJC6RTje1FNSbO');

// CORS - Allowed origins
$allowedOrigins = [
    'http://jphsoftware.com',
    'https://jphsoftware.com',
    'http://www.jphsoftware.com',
    'https://www.jphsoftware.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');
?>
