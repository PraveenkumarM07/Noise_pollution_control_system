// Utility functions for the AcousticGuard application

// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <div class="flex items-center space-x-2">
            ${icon}
            <span>${message}</span>
            <button onclick="removeToast(this.parentElement.parentElement)" class="ml-auto text-muted-foreground hover:text-foreground">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

function getToastIcon(type) {
    const icons = {
        success: '<i class="fas fa-check-circle text-safe"></i>',
        error: '<i class="fas fa-exclamation-circle text-destructive"></i>',
        warning: '<i class="fas fa-exclamation-triangle text-warning"></i>',
        info: '<i class="fas fa-info-circle text-primary"></i>'
    };
    return icons[type] || icons.info;
}

function removeToast(toast) {
    if (toast && toast.parentElement) {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            toast.parentElement.removeChild(toast);
        }, 300);
    }
}

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Format date and time utilities
function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

function formatDateTime(date) {
    return new Date(date).toLocaleString();
}

// API request utility
async function apiRequest(method, url, data = null) {
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
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle utility
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Local storage utilities
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Failed to read from localStorage:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
        }
    }
};

// Device utilities
function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
    };
}

// URL utilities
function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

function setQueryParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    window.history.pushState({}, '', url);
}

// Validation utilities
const validators = {
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    required(value) {
        return value !== null && value !== undefined && value !== '';
    },
    
    minLength(value, min) {
        return value && value.length >= min;
    },
    
    maxLength(value, max) {
        return value && value.length <= max;
    },
    
    number(value) {
        return !isNaN(value) && !isNaN(parseFloat(value));
    },
    
    positive(value) {
        return validators.number(value) && parseFloat(value) > 0;
    }
};

// Form utilities
function validateForm(form, rules) {
    const errors = {};
    
    for (const [field, fieldRules] of Object.entries(rules)) {
        const input = form.querySelector(`[name="${field}"]`);
        if (!input) continue;
        
        const value = input.value;
        
        for (const rule of fieldRules) {
            if (typeof rule === 'string') {
                if (!validators[rule](value)) {
                    errors[field] = `${field} is ${rule}`;
                    break;
                }
            } else if (typeof rule === 'object') {
                const { validator, message, ...params } = rule;
                if (!validators[validator](value, ...Object.values(params))) {
                    errors[field] = message;
                    break;
                }
            }
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// DOM utilities
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function createElement(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}

// Event utilities
function on(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
}

function off(element, event, handler) {
    element.removeEventListener(event, handler);
}

// Animation utilities
function fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    const start = performance.now();
    
    function animate(time) {
        const elapsed = time - start;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = progress;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function fadeOut(element, duration = 300) {
    const start = performance.now();
    const initialOpacity = parseFloat(getComputedStyle(element).opacity);
    
    function animate(time) {
        const elapsed = time - start;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = initialOpacity * (1 - progress);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.style.display = 'none';
        }
    }
    
    requestAnimationFrame(animate);
}

// Number formatting utilities
function formatNumber(num, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

function formatPercentage(num, decimals = 1) {
    return `${formatNumber(num, decimals)}%`;
}

// Color utilities
function getCategoryColor(category) {
    const colors = {
        safe: 'safe',
        moderate: 'warning',
        harmful: 'destructive'
    };
    return colors[category] || 'muted';
}

function getCategoryMessage(category, level) {
    const messages = {
        safe: `Safe noise level (${level} dB). Normal mode maintained.`,
        moderate: `Moderate noise detected (${level} dB). Suggestion: enable ANC in your earbud or lower exposure time.`,
        harmful: `Danger! Harmful noise detected (${level} dB). Reduce volume or move to a quieter area immediately.`
    };
    return messages[category] || `Current noise level: ${level} dB`;
}

// Export utilities for use in other files
window.utils = {
    showToast,
    removeToast,
    formatDate,
    formatTime,
    formatDateTime,
    apiRequest,
    debounce,
    throttle,
    storage,
    getDeviceInfo,
    getQueryParams,
    setQueryParam,
    validators,
    validateForm,
    $,
    $$,
    createElement,
    on,
    off,
    fadeIn,
    fadeOut,
    formatNumber,
    formatPercentage,
    getCategoryColor,
    getCategoryMessage
};

// Make commonly used functions globally available
window.showToast = showToast;
window.apiRequest = apiRequest;
