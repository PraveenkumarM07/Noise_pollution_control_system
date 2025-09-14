// API client for AcousticGuard application

class ApiClient {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Request failed' }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return response;
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Auth endpoints
    async login(credentials) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    async logout() {
        window.location.href = '/api/logout';
    }

    async getCurrentUser() {
        return this.request('/api/auth/user');
    }

    // Noise readings endpoints
    async createNoiseReading(data) {
        return this.request('/api/noise-readings', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getNoiseReadings(limit = 50) {
        return this.request(`/api/noise-readings?limit=${limit}`);
    }

    async getNoiseReadingsRange(startDate, endDate) {
        return this.request(`/api/noise-readings/range?startDate=${startDate}&endDate=${endDate}`);
    }

    // Device endpoints
    async createDevice(data) {
        return this.request('/api/devices', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getDevices() {
        return this.request('/api/devices');
    }

    async updateDeviceStatus(deviceId, data) {
        return this.request(`/api/devices/${deviceId}/status`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    // Health score endpoints
    async createHealthScore(data) {
        return this.request('/api/health-scores', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getLatestHealthScore() {
        return this.request('/api/health-scores/latest');
    }

    async getHealthScores(limit = 30) {
        return this.request(`/api/health-scores?limit=${limit}`);
    }

    // Exposure stats endpoints
    async getTodayExposureStats() {
        return this.request('/api/exposure-stats/today');
    }

    // AI reduction logs endpoints
    async createAiReductionLog(data) {
        return this.request('/api/ai-reduction-logs', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getAiReductionLogs(limit = 100) {
        return this.request(`/api/ai-reduction-logs?limit=${limit}`);
    }

    // User preferences endpoints
    async getPreferences() {
        return this.request('/api/preferences');
    }

    async updatePreferences(data) {
        return this.request('/api/preferences', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }
}

// Create global API client instance
window.api = new ApiClient();

// Legacy API functions for backward compatibility
window.apiRequest = async function(method, url, data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
};

// Data management utilities
class DataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    set(key, data, ttl = this.cacheTimeout) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    clear() {
        this.cache.clear();
    }

    delete(key) {
        this.cache.delete(key);
    }
}

window.dataManager = new DataManager();

// Real-time data synchronization
class RealTimeSync {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.listeners = new Map();
    }

    connect() {
        if (this.socket && this.isConnected) return;

        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
            });

            this.socket.on('disconnect', () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.emit('disconnected');
                this.attemptReconnect();
            });

            this.socket.on('noise_reading', (data) => {
                this.emit('noise_reading', data);
            });

            this.socket.on('device_status', (data) => {
                this.emit('device_status', data);
            });

            this.socket.on('health_score_update', (data) => {
                this.emit('health_score_update', data);
            });

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect();
        }, delay);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

window.realTimeSync = new RealTimeSync();

// Noise level simulator for demo purposes
class NoiseSimulator {
    constructor() {
        this.isRunning = false;
        this.interval = null;
        this.callbacks = [];
    }

    start(intervalMs = 5000) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.interval = setInterval(() => {
            const noiseData = this.generateNoiseReading();
            this.callbacks.forEach(callback => callback(noiseData));
        }, intervalMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
        }
    }

    generateNoiseReading() {
        const random = Math.random();
        let level, category;
        
        if (random < 0.6) {
            // 60% chance of safe level
            level = 45 + Math.random() * 20; // 45-65 dB
            category = 'safe';
        } else if (random < 0.85) {
            // 25% chance of moderate level
            level = 65 + Math.random() * 15; // 65-80 dB
            category = 'moderate';
        } else {
            // 15% chance of harmful level
            level = 80 + Math.random() * 20; // 80-100 dB
            category = 'harmful';
        }
        
        return {
            noiseLevel: Math.round(level),
            category,
            timestamp: new Date().toISOString(),
            location: 'Simulated monitoring'
        };
    }

    onNoiseUpdate(callback) {
        this.callbacks.push(callback);
    }

    removeCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
}

window.noiseSimulator = new NoiseSimulator();

// Health score calculator
class HealthScoreCalculator {
    static calculate(exposureStats) {
        if (!exposureStats) return 87; // Default score

        const totalTime = exposureStats.totalSafeTime + 
                         exposureStats.totalModerateTime + 
                         exposureStats.totalHarmfulTime;
        
        if (totalTime === 0) return 87;

        const safePercentage = exposureStats.totalSafeTime / totalTime;
        const moderatePercentage = exposureStats.totalModerateTime / totalTime;
        const harmfulPercentage = exposureStats.totalHarmfulTime / totalTime;

        const score = Math.round(
            safePercentage * 100 + 
            moderatePercentage * 70 + 
            harmfulPercentage * 30
        );

        return Math.max(0, Math.min(100, score));
    }

    static getRating(score) {
        if (score >= 90) return { rating: 'Excellent', color: 'safe' };
        if (score >= 75) return { rating: 'Good', color: 'primary' };
        if (score >= 60) return { rating: 'Fair', color: 'warning' };
        return { rating: 'Needs Attention', color: 'destructive' };
    }
}

window.healthScoreCalculator = HealthScoreCalculator;

// Export for use in other modules
window.ApiClient = ApiClient;
window.DataManager = DataManager;
window.RealTimeSync = RealTimeSync;
window.NoiseSimulator = NoiseSimulator;
