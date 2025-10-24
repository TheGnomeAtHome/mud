-- MySQL Database Schema for MUD Game
-- Run this to create all necessary tables

-- Rooms collection
CREATE TABLE IF NOT EXISTS mud_rooms (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items collection
CREATE TABLE IF NOT EXISTS mud_items (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NPCs collection
CREATE TABLE IF NOT EXISTS mud_npcs (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monsters collection
CREATE TABLE IF NOT EXISTS mud_monsters (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Classes collection
CREATE TABLE IF NOT EXISTS mud_classes (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Spells collection
CREATE TABLE IF NOT EXISTS mud_spells (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quests collection
CREATE TABLE IF NOT EXISTS mud_quests (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guilds collection
CREATE TABLE IF NOT EXISTS mud_guilds (
    id VARCHAR(255) PRIMARY KEY,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Error Logging Table
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

-- Optional: Add full-text search indexes for better querying
-- ALTER TABLE mud_rooms ADD FULLTEXT INDEX idx_room_search (data);
-- ALTER TABLE mud_items ADD FULLTEXT INDEX idx_item_search (data);
-- ALTER TABLE mud_npcs ADD FULLTEXT INDEX idx_npc_search (data);
