// Main application logic for AcousticGuard

// Global application state
window.appState = {
    currentUser: null,
    isAuthenticated: false,
    currentNoiseLevel: 54,
    currentCategory: 'safe',
    activeTab: 'overview',
    devices: [],
    noiseReadings: [],
    healthScore: null,
    exposureStats: null,
    preferences: null,
    isLoading: false
};

// Application initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Check authentication status
        await checkAuthStatus();
        
        // Initialize real-time sync
        if (window.appState.isAuthenticated) {
            window.realTimeSync.connect();
            setupRealTimeListeners();
        }
        
        // Initialize noise simulator if on dashboard
        if (window.location.pathname === '/' && window.appState.isAuthenticated) {
            initializeNoiseSimulator();
        }
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to initialize application', 'error');
    }
}

async function checkAuthStatus() {
    try {
        const user = await window.api.getCurrentUser();
        window.appState.currentUser = user;
        window.appState.isAuthenticated = true;
        
        // Update UI if on dashboard
        if (typeof updateUserInfo === 'function') {
            updateUserInfo();
        }
        
        return true;
    } catch (error) {
        window.appState.isAuthenticated = false;
        window.appState.currentUser = null;
        
        // Redirect to landing page if not already there
        if (window.location.pathname === '/' && !window.location.pathname.includes('landing')) {
            // Stay on current page, might be landing page
        }
        
        return false;
    }
}

function setupRealTimeListeners() {
    // Listen for noise reading updates
    window.realTimeSync.on('noise_reading', (data) => {
        console.log('Real-time noise reading:', data);
        
        // Update app state
        window.appState.currentNoiseLevel = parseInt(data.noiseLevel);
        window.appState.currentCategory = data.category;
        
        // Update UI if dashboard is loaded
        if (typeof updateNoiseDisplay === 'function') {
            updateNoiseDisplay();
        }
        
        // Refresh noise readings list
        if (typeof loadNoiseReadings === 'function') {
            loadNoiseReadings();
        }
        
        // Update exposure stats
        if (typeof loadExposureStats === 'function') {
            loadExposureStats();
        }
    });

    // Listen for device status updates
    window.realTimeSync.on('device_status', (data) => {
        console.log('Real-time device status:', data);
        
        // Update devices list
        if (typeof loadDevices === 'function') {
            loadDevices();
        }
    });

    // Listen for health score updates
    window.realTimeSync.on('health_score_update', (data) => {
        console.log('Real-time health score update:', data);
        
        // Update health score display
        if (typeof updateHealthScore === 'function') {
            updateHealthScore(data.score);
        }
    });

    // Listen for connection status
    window.realTimeSync.on('connected', () => {
        showToast('Real-time updates enabled', 'success');
    });

    window.realTimeSync.on('disconnected', () => {
        showToast('Real-time updates disconnected', 'warning');
    });
}

function initializeNoiseSimulator() {
    // Start the noise simulator for demo purposes
    window.noiseSimulator.start(5000);
    
    window.noiseSimulator.onNoiseUpdate(async (noiseData) => {
        try {
            // Send to server
            await window.api.createNoiseReading(noiseData);
            
            // Update local state
            window.appState.currentNoiseLevel = noiseData.noiseLevel;
            window.appState.currentCategory = noiseData.category;
            
            // Update UI
            if (typeof updateNoiseDisplay === 'function') {
                updateNoiseDisplay();
            }
            
        } catch (error) {
            console.error('Failed to record noise reading:', error);
        }
    });
}

// Global utility functions
function handleLogout() {
    if (window.realTimeSync) {
        window.realTimeSync.disconnect();
    }
    
    if (window.noiseSimulator) {
        window.noiseSimulator.stop();
    }
    
    window.appState.isAuthenticated = false;
    window.appState.currentUser = null;
    
    window.location.href = '/api/logout';
}

function showLoading(show = true) {
    window.appState.isLoading = show;
    
    // Update loading indicators in UI
    const loadingElements = document.querySelectorAll('.loading-indicator');
    loadingElements.forEach(el => {
        el.style.display = show ? 'block' : 'none';
    });
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('A network error occurred', 'error');
});

// Network status monitoring
window.addEventListener('online', function() {
    showToast('Connection restored', 'success');
    if (window.realTimeSync && !window.realTimeSync.isConnected) {
        window.realTimeSync.connect();
    }
});

window.addEventListener('offline', function() {
    showToast('Connection lost', 'warning');
});

// Performance monitoring
function measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    console.log(`${name} took ${end - start} milliseconds`);
    return result;
}

// Data persistence utilities
function saveAppState() {
    try {
        const stateToSave = {
            currentNoiseLevel: window.appState.currentNoiseLevel,
            currentCategory: window.appState.currentCategory,
            activeTab: window.appState.activeTab,
            lastUpdate: Date.now()
        };
        
        window.utils.storage.set('appState', stateToSave);
    } catch (error) {
        console.error('Failed to save app state:', error);
    }
}

function loadAppState() {
    try {
        const savedState = window.utils.storage.get('appState');
        if (savedState && savedState.lastUpdate) {
            const age = Date.now() - savedState.lastUpdate;
            // Only use saved state if it's less than 1 hour old
            if (age < 60 * 60 * 1000) {
                window.appState.currentNoiseLevel = savedState.currentNoiseLevel || 54;
                window.appState.currentCategory = savedState.currentCategory || 'safe';
                window.appState.activeTab = savedState.activeTab || 'overview';
            }
        }
    } catch (error) {
        console.error('Failed to load app state:', error);
    }
}

// Auto-save app state periodically
setInterval(saveAppState, 30000); // Save every 30 seconds

// Load saved state on initialization
loadAppState();

// Export global functions
window.handleLogout = handleLogout;
window.showLoading = showLoading;
window.measurePerformance = measurePerformance;

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when not in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Ctrl/Cmd + R: Refresh data
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        if (typeof refreshData === 'function') {
            refreshData();
        }
    }
    
    // Escape: Close modals
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('[onclick*="close"]');
            if (closeBtn) {
                closeBtn.click();
            }
        });
    }
    
    // Tab navigation shortcuts
    if (event.altKey) {
        switch (event.key) {
            case '1':
                event.preventDefault();
                if (typeof setActiveTab === 'function') {
                    setActiveTab('overview');
                }
                break;
            case '2':
                event.preventDefault();
                if (typeof setActiveTab === 'function') {
                    setActiveTab('analytics');
                }
                break;
            case '3':
                event.preventDefault();
                if (typeof setActiveTab === 'function') {
                    setActiveTab('devices');
                }
                break;
            case '4':
                event.preventDefault();
                if (typeof setActiveTab === 'function') {
                    setActiveTab('health');
                }
                break;
            case '5':
                event.preventDefault();
                if (typeof setActiveTab === 'function') {
                    setActiveTab('settings');
                }
                break;
        }
    }
});

// Theme management (for future dark mode support)
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    window.utils.storage.set('theme', newTheme);
}

// Load saved theme
const savedTheme = window.utils.storage.get('theme', 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

window.toggleTheme = toggleTheme;

// Analytics and telemetry (privacy-friendly)
function trackEvent(eventName, properties = {}) {
    // Only track if user has consented (you might want to add a consent mechanism)
    const analyticsEnabled = window.utils.storage.get('analyticsEnabled', false);
    
    if (analyticsEnabled) {
        console.log('Analytics event:', eventName, properties);
        // Here you would send to your analytics service
        // Example: gtag('event', eventName, properties);
    }
}

window.trackEvent = trackEvent;

// Track page views
function trackPageView(pageName) {
    trackEvent('page_view', {
        page_name: pageName,
        timestamp: Date.now(),
        user_agent: navigator.userAgent
    });
}

// Track when user changes tabs
if (typeof setActiveTab === 'function') {
    const originalSetActiveTab = window.setActiveTab;
    window.setActiveTab = function(tabName) {
        originalSetActiveTab(tabName);
        trackEvent('tab_change', { tab_name: tabName });
    };
}

// Export for use in templates
window.trackPageView = trackPageView;
