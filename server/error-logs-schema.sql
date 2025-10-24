-- Error Logging Table for MUD Game
-- Logs all errors, warnings, and issues for admin review

CREATE TABLE IF NOT EXISTS error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Error classification
    severity ENUM('error', 'warning', 'info', 'critical') DEFAULT 'error',
    category VARCHAR(100) DEFAULT 'general',
    
    -- User context
    player_id VARCHAR(255) NULL,
    player_name VARCHAR(255) NULL,
    
    -- Location context
    room_id VARCHAR(255) NULL,
    
    -- Error details
    message TEXT NOT NULL,
    error_type VARCHAR(255) NULL,
    stack_trace TEXT NULL,
    
    -- Command context
    command_input TEXT NULL,
    parsed_command JSON NULL,
    
    -- System context
    user_agent TEXT NULL,
    browser_version VARCHAR(255) NULL,
    screen_resolution VARCHAR(50) NULL,
    
    -- Additional data (JSON for flexibility)
    metadata JSON NULL,
    
    -- Indexes for quick searching
    INDEX idx_timestamp (timestamp),
    INDEX idx_severity (severity),
    INDEX idx_category (category),
    INDEX idx_player (player_id),
    INDEX idx_room (room_id),
    INDEX idx_player_timestamp (player_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View for recent critical errors
CREATE OR REPLACE VIEW recent_critical_errors AS
SELECT 
    id,
    timestamp,
    category,
    player_name,
    room_id,
    message,
    command_input
FROM error_logs
WHERE severity = 'critical'
ORDER BY timestamp DESC
LIMIT 100;

-- View for player-reported issues
CREATE OR REPLACE VIEW player_issues AS
SELECT 
    player_id,
    player_name,
    COUNT(*) as error_count,
    MAX(timestamp) as last_error,
    GROUP_CONCAT(DISTINCT category) as categories
FROM error_logs
WHERE severity IN ('error', 'critical')
GROUP BY player_id, player_name
ORDER BY error_count DESC;

-- View for error statistics by category
CREATE OR REPLACE VIEW error_stats AS
SELECT 
    category,
    severity,
    COUNT(*) as count,
    MAX(timestamp) as last_occurrence
FROM error_logs
GROUP BY category, severity
ORDER BY count DESC;
