/**
 * Error Logger Module
 * Centralized error logging to MySQL database
 * Captures errors, warnings, and user issues for admin review
 */

class ErrorLogger {
    constructor() {
        this.apiUrl = 'https://jphsoftware.com/api/log-error.php';
        this.enabled = true; // Can be toggled via settings
        this.queuedLogs = [];
        this.maxQueueSize = 50;
        this.flushInterval = 5000; // Flush every 5 seconds
        
        // Start periodic flush
        setInterval(() => this.flushQueue(), this.flushInterval);
        
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.logError({
                category: 'uncaught',
                message: event.message,
                errorType: 'UncaughtError',
                stackTrace: event.error?.stack,
                metadata: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                category: 'promise',
                message: event.reason?.message || String(event.reason),
                errorType: 'UnhandledPromiseRejection',
                stackTrace: event.reason?.stack,
                metadata: {
                    promise: String(event.promise)
                }
            });
        });
    }
    
    /**
     * Log an error to the database
     */
    async logError(options) {
        if (!this.enabled) return;
        
        const logEntry = this._createLogEntry('error', options);
        await this._sendLog(logEntry);
    }
    
    /**
     * Log a warning
     */
    async logWarning(options) {
        if (!this.enabled) return;
        
        const logEntry = this._createLogEntry('warning', options);
        await this._sendLog(logEntry);
    }
    
    /**
     * Log informational message
     */
    async logInfo(options) {
        if (!this.enabled) return;
        
        const logEntry = this._createLogEntry('info', options);
        await this._sendLog(logEntry);
    }
    
    /**
     * Log a critical error that needs immediate attention
     */
    async logCritical(options) {
        const logEntry = this._createLogEntry('critical', options);
        // Critical errors are sent immediately, not queued
        await this._sendLogImmediately(logEntry);
    }
    
    /**
     * Log a command error (when a command fails)
     */
    async logCommandError(commandInput, parsedCommand, errorMessage, errorDetails = {}) {
        await this.logError({
            category: 'command',
            message: errorMessage,
            commandInput: commandInput,
            parsedCommand: parsedCommand,
            metadata: errorDetails
        });
    }
    
    /**
     * Log a game state error
     */
    async logGameStateError(message, stateDetails = {}) {
        await this.logError({
            category: 'game-state',
            message: message,
            metadata: stateDetails
        });
    }
    
    /**
     * Log a combat error
     */
    async logCombatError(message, combatDetails = {}) {
        await this.logError({
            category: 'combat',
            message: message,
            metadata: combatDetails
        });
    }
    
    /**
     * Log an inventory error
     */
    async logInventoryError(message, inventoryDetails = {}) {
        await this.logError({
            category: 'inventory',
            message: message,
            metadata: inventoryDetails
        });
    }
    
    /**
     * Log an NPC interaction error
     */
    async logNpcError(message, npcDetails = {}) {
        await this.logError({
            category: 'npc',
            message: message,
            metadata: npcDetails
        });
    }
    
    /**
     * Log a database/persistence error
     */
    async logDatabaseError(message, dbDetails = {}) {
        await this.logError({
            category: 'database',
            message: message,
            metadata: dbDetails
        });
    }
    
    /**
     * Log an AI/Gemini error
     */
    async logAiError(message, aiDetails = {}) {
        await this.logError({
            category: 'ai',
            message: message,
            metadata: aiDetails
        });
    }
    
    /**
     * Create a standardized log entry
     */
    _createLogEntry(severity, options) {
        const entry = {
            severity: severity,
            category: options.category || 'general',
            message: options.message,
            errorType: options.errorType || null,
            stackTrace: options.stackTrace || null,
            commandInput: options.commandInput || null,
            parsedCommand: options.parsedCommand || null,
            metadata: options.metadata || null,
            timestamp: new Date().toISOString()
        };
        
        // Add player context if available
        if (window.currentPlayer) {
            entry.playerId = window.currentPlayer.id || null;
            entry.playerName = window.currentPlayer.name || null;
        }
        
        // Add room context if available
        if (window.currentRoom) {
            entry.roomId = window.currentRoom.id || null;
        }
        
        // Add browser context
        entry.browserVersion = this._getBrowserInfo();
        entry.screenResolution = `${window.screen.width}x${window.screen.height}`;
        
        return entry;
    }
    
    /**
     * Send log immediately (for critical errors)
     */
    async _sendLogImmediately(logEntry) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry)
            });
            
            if (!response.ok) {
                console.error('Failed to send error log:', response.statusText);
                // Fallback to console
                console.error('[Error Log Failed]', logEntry);
            }
        } catch (error) {
            console.error('Error sending log:', error);
            console.error('[Error Log Failed]', logEntry);
        }
    }
    
    /**
     * Queue log for batch sending
     */
    async _sendLog(logEntry) {
        this.queuedLogs.push(logEntry);
        
        // If queue is full, flush immediately
        if (this.queuedLogs.length >= this.maxQueueSize) {
            await this.flushQueue();
        }
    }
    
    /**
     * Flush queued logs to the server
     */
    async flushQueue() {
        if (this.queuedLogs.length === 0) return;
        
        const logsToSend = [...this.queuedLogs];
        this.queuedLogs = [];
        
        // Send each log (could batch these in the future)
        for (const log of logsToSend) {
            try {
                await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(log)
                });
            } catch (error) {
                console.error('Failed to send queued log:', error);
            }
        }
    }
    
    /**
     * Get browser information
     */
    _getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = '';
        
        if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || '';
        } else if (ua.indexOf('Chrome') > -1) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || '';
        } else if (ua.indexOf('Safari') > -1) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+\.\d+)/)?.[1] || '';
        } else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+\.\d+)/)?.[1] || '';
        }
        
        return `${browser} ${version}`;
    }
    
    /**
     * Enable or disable logging
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueSize: this.queuedLogs.length,
            maxQueueSize: this.maxQueueSize,
            enabled: this.enabled
        };
    }
}

// Create global error logger instance
window.errorLogger = new ErrorLogger();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorLogger;
}
