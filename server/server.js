// Express API Server for MUD Game Data
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, getAll, getById, upsert, remove } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));
app.use(express.json());

// Simple API key authentication (can enhance later)
const authenticateAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Health check
app.get('/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({ 
        status: 'ok', 
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Get all documents from a collection (public read)
app.get('/api/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        const tableName = `mud_${collection}`;
        
        const data = await getAll(tableName);
        res.json(data);
    } catch (error) {
        console.error('Error fetching collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single document by ID (public read)
app.get('/api/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        const tableName = `mud_${collection}`;
        
        const data = await getById(tableName, id);
        
        if (!data) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create or update document (admin only)
app.put('/api/:collection/:id', authenticateAdmin, async (req, res) => {
    try {
        const { collection, id } = req.params;
        const tableName = `mud_${collection}`;
        const data = req.body;
        
        const result = await upsert(tableName, id, data);
        res.json(result);
    } catch (error) {
        console.error('Error upserting document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete document (admin only)
app.delete('/api/:collection/:id', authenticateAdmin, async (req, res) => {
    try {
        const { collection, id } = req.params;
        const tableName = `mud_${collection}`;
        
        await remove(tableName, id);
        res.json({ success: true, id });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
async function start() {
    // Test database connection
    const connected = await testConnection();
    
    if (!connected) {
        console.error('Failed to connect to MySQL. Please check your configuration.');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 MUD API Server running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🎮 API endpoint: http://localhost:${PORT}/api/{collection}`);
    });
}

start();
