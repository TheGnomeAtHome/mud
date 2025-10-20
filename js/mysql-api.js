// MySQL API Helper Module
// Provides functions to save/update/delete data via PHP MySQL API

export function initializeMySQLAPI(config) {
    const MYSQL_API_URL = config.MYSQL_API_URL || 'https://jphsoftware.com/api';
    const ADMIN_API_KEY = config.ADMIN_API_KEY || 'cu4s2YmwWdpMGZ8PfLaJC6RTje1FNSbO';
    const USE_MYSQL_BACKEND = config.USE_MYSQL_BACKEND || false;
    
    // Helper function to make authenticated API requests
    async function apiRequest(method, endpoint, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': ADMIN_API_KEY
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`${MYSQL_API_URL}/${endpoint}`, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`MySQL API Error (${method} ${endpoint}):`, error);
            throw error;
        }
    }
    
    // Save document to MySQL
    async function saveToMySQL(collection, id, data) {
        if (!USE_MYSQL_BACKEND) {
            console.log('[MySQL API] Backend disabled, skipping MySQL save');
            return null;
        }
        
        console.log(`[MySQL API] Saving ${collection}/${id} to MySQL...`);
        
        try {
            const result = await apiRequest('PUT', `${collection}/${id}`, data);
            console.log(`[MySQL API] ✓ Saved ${collection}/${id} successfully`);
            return result;
        } catch (error) {
            console.error(`[MySQL API] Failed to save ${collection}/${id}:`, error.message);
            throw error;
        }
    }
    
    // Delete document from MySQL
    async function deleteFromMySQL(collection, id) {
        if (!USE_MYSQL_BACKEND) {
            console.log('[MySQL API] Backend disabled, skipping MySQL delete');
            return null;
        }
        
        console.log(`[MySQL API] Deleting ${collection}/${id} from MySQL...`);
        
        try {
            const result = await apiRequest('DELETE', `${collection}/${id}`);
            console.log(`[MySQL API] ✓ Deleted ${collection}/${id} successfully`);
            return result;
        } catch (error) {
            console.error(`[MySQL API] Failed to delete ${collection}/${id}:`, error.message);
            throw error;
        }
    }
    
    // Get document from MySQL
    async function getFromMySQL(collection, id) {
        if (!USE_MYSQL_BACKEND) {
            console.log('[MySQL API] Backend disabled, skipping MySQL get');
            return null;
        }
        
        try {
            return await apiRequest('GET', `${collection}/${id}`);
        } catch (error) {
            console.error(`[MySQL API] Failed to get ${collection}/${id}:`, error.message);
            throw error;
        }
    }
    
    // Get all documents from collection
    async function getAllFromMySQL(collection) {
        if (!USE_MYSQL_BACKEND) {
            console.log('[MySQL API] Backend disabled, skipping MySQL getAll');
            return null;
        }
        
        try {
            return await apiRequest('GET', collection);
        } catch (error) {
            console.error(`[MySQL API] Failed to get ${collection}:`, error.message);
            throw error;
        }
    }
    
    return {
        saveToMySQL,
        deleteFromMySQL,
        getFromMySQL,
        getAllFromMySQL,
        isEnabled: () => USE_MYSQL_BACKEND
    };
}
