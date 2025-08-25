const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Storage for rate limiting and caching
const rateLimitStore = new Map();
const cacheStore = new Map();

// Load route configuration
let config;
try {
  const configPath = path.join(__dirname, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Configuration loaded:', config);
} catch (error) {
  console.error('Failed to load config.json:', error.message);
  process.exit(1);
}

// HTTP request logging
app.use(morgan('combined'));

// JSON parsing middleware
app.use(express.json());

// API key authentication middleware
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'gateway-secret-key';
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing API key. Please provide x-api-key header.' 
    });
  }
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: 'Invalid API key.' 
    });
  }
  
  next();
}

// Rate limiting middleware
function rateLimiter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10;
  
  // Clean expired entries
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > windowMs) {
      rateLimitStore.delete(ip);
    }
  }
  
  let ipData = rateLimitStore.get(clientIp);
  if (!ipData || (now - ipData.windowStart) > windowMs) {
    ipData = { count: 0, windowStart: now };
  }
  
  ipData.count++;
  rateLimitStore.set(clientIp, ipData);
  
  if (ipData.count > maxRequests) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Maximum 10 requests per minute.',
      retryAfter: Math.ceil((windowMs - (now - ipData.windowStart)) / 1000)
    });
  }
  
  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': Math.max(0, maxRequests - ipData.count),
    'X-RateLimit-Reset': new Date(ipData.windowStart + windowMs).toISOString()
  });
  
  next();
}

// Caching middleware for GET requests
function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }
  
  const cacheKey = `${req.method}:${req.originalUrl}:${req.headers['x-api-key']}`;
  const cached = cacheStore.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < 30000) {
    return res.json({
      ...cached.data,
      _cached: true,
      _cachedAt: new Date(cached.timestamp).toISOString()
    });
  }
  
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 200) {
      cacheStore.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      
      // Basic cache cleanup
      if (cacheStore.size > 100) {
        const oldestKeys = Array.from(cacheStore.keys()).slice(0, 10);
        oldestKeys.forEach(key => cacheStore.delete(key));
      }
    }
    return originalJson.call(this, data);
  };
  
  next();
}

// Request timing
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Apply middleware stack
app.use(authenticateApiKey);
app.use(rateLimiter);
app.use(cacheMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    routes: Object.keys(config)
  });
});

// Stats endpoint
app.get('/gateway/stats', (req, res) => {
  res.json({
    activeConnections: rateLimitStore.size,
    cacheSize: cacheStore.size,
    configuration: config,
    memory: process.memoryUsage()
  });
});

// Configure proxy middleware
const proxyOptions = {
  router: (req) => {
    for (const [route, target] of Object.entries(config)) {
      if (req.path.startsWith(route)) {
        return target;
      }
    }
    return null;
  },
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error(`Proxy error for ${req.originalUrl}:`, err.message);
    if (!res.headersSent) {
      let target = 'unknown';
      for (const [route, targetUrl] of Object.entries(config)) {
        if (req.path.startsWith(route)) {
          target = targetUrl;
          break;
        }
      }
      
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'The upstream service is unavailable',
        service: target,
        timestamp: new Date().toISOString()
      });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    // Strip route prefix from path
    let newPath = req.path;
    for (const [route] of Object.entries(config)) {
      if (req.path.startsWith(route)) {
        newPath = req.path.replace(route, '') || '/';
        break;
      }
    }
    
    proxyReq.path = newPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    
    // Forward original API key
    if (req.headers['x-api-key']) {
      proxyReq.setHeader('x-forwarded-api-key', req.headers['x-api-key']);
    }
    
    // Add forwarding headers
    proxyReq.setHeader('x-forwarded-by', 'mini-api-gateway');
    proxyReq.setHeader('x-forwarded-for', req.ip);
  },
  onProxyRes: (proxyRes, req, res) => {
    const target = proxyRes.req.protocol + '//' + proxyRes.req.host;
    
    res.setHeader('x-gateway', 'mini-api-gateway');
    res.setHeader('x-response-time', Date.now() - req.startTime);
  }
};

const proxy = createProxyMiddleware(proxyOptions);

// Setup proxy routes
Object.keys(config).forEach(route => {
  console.log(`Setting up proxy route: ${route}`);
  app.use(route, proxy);
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `No proxy configuration found for ${req.originalUrl}`,
    availableRoutes: Object.keys(config),
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(PORT, () => {
  console.log('Mini API Gateway started');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Key: ${process.env.API_KEY || 'gateway-secret-key'}`);
  console.log('Available routes:');
  Object.entries(config).forEach(([route, target]) => {
    console.log(`  ${route} -> ${target}`);
  });
  console.log('Health check: GET /health');
  console.log('Gateway stats: GET /gateway/stats');
});

module.exports = app;