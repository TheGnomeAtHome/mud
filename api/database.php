<?php
require_once __DIR__ . '/config.php';

class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $this->connection = new PDO(
                "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed");
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    // Get all documents from a collection
    public function getAll($tableName) {
        $stmt = $this->connection->prepare("SELECT * FROM " . $tableName);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        
        $result = [];
        foreach ($rows as $row) {
            $data = json_decode($row['data'], true);
            $data['id'] = $row['id'];
            $result[$row['id']] = $data;
        }
        
        return $result;
    }
    
    // Get single document by ID
    public function getById($tableName, $id) {
        $stmt = $this->connection->prepare("SELECT * FROM " . $tableName . " WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        
        if (!$row) {
            return null;
        }
        
        $data = json_decode($row['data'], true);
        $data['id'] = $row['id'];
        
        return $data;
    }
    
    // Insert or update document
    public function upsert($tableName, $id, $data) {
        // Remove 'id' from data if it exists to avoid duplication
        unset($data['id']);
        
        $jsonData = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
        $sql = "INSERT INTO " . $tableName . " (id, data, updated_at) 
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    data = VALUES(data),
                    updated_at = NOW()";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->execute([$id, $jsonData]);
        
        $data['id'] = $id;
        return $data;
    }
    
    // Delete document
    public function delete($tableName, $id) {
        $stmt = $this->connection->prepare("DELETE FROM " . $tableName . " WHERE id = ?");
        $stmt->execute([$id]);
        
        return ['success' => true, 'id' => $id];
    }
    
    // Bulk import (for migration)
    public function bulkImport($tableName, $documents) {
        $this->connection->beginTransaction();
        
        try {
            $count = 0;
            foreach ($documents as $id => $data) {
                $this->upsert($tableName, $id, $data);
                $count++;
            }
            
            $this->connection->commit();
            return $count;
        } catch (Exception $e) {
            $this->connection->rollBack();
            throw $e;
        }
    }
    
    // Test connection
    public function testConnection() {
        try {
            $stmt = $this->connection->query("SELECT 1");
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
}

// Helper function for bulk-import.php
function getDatabase() {
    return Database::getInstance()->getConnection();
}
?>
