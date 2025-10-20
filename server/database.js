// MySQL Database Connection and Query Functions
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✓ MySQL database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('✗ MySQL connection failed:', error.message);
        return false;
    }
}

// Generic query function
async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Database query error:', error.message);
        throw error;
    }
}

// Get all documents from a collection
async function getAll(tableName) {
    const sql = `SELECT * FROM ${tableName}`;
    const rows = await query(sql);
    
    // Convert to object with id as key (match Firebase format)
    const result = {};
    rows.forEach(row => {
        const { id, data } = row;
        result[id] = typeof data === 'string' ? JSON.parse(data) : data;
        result[id].id = id;
    });
    
    return result;
}

// Get single document by ID
async function getById(tableName, id) {
    const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
    const rows = await query(sql, [id]);
    
    if (rows.length === 0) return null;
    
    const { data } = rows[0];
    const doc = typeof data === 'string' ? JSON.parse(data) : data;
    doc.id = id;
    
    return doc;
}

// Insert or update document
async function upsert(tableName, id, data) {
    const jsonData = JSON.stringify(data);
    const sql = `
        INSERT INTO ${tableName} (id, data, updated_at) 
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            data = VALUES(data),
            updated_at = NOW()
    `;
    
    await query(sql, [id, jsonData]);
    return { id, ...data };
}

// Delete document
async function remove(tableName, id) {
    const sql = `DELETE FROM ${tableName} WHERE id = ?`;
    await query(sql, [id]);
    return true;
}

// Bulk import (for migration from Firebase)
async function bulkImport(tableName, documents) {
    const entries = Object.entries(documents);
    
    for (const [id, data] of entries) {
        await upsert(tableName, id, data);
    }
    
    console.log(`Imported ${entries.length} documents into ${tableName}`);
    return entries.length;
}

export {
    pool,
    testConnection,
    query,
    getAll,
    getById,
    upsert,
    remove,
    bulkImport
};
