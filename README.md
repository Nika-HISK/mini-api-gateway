# Mini API Gateway

A lightweight, production-ready API Gateway built with Node.js and Express. This gateway provides request routing, authentication, rate limiting, caching, and monitoring capabilities for microservices architectures.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Middleware Features](#middleware-features)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Security](#security)
- [Performance](#performance)
- [Deployment](#deployment)


## Features

- **Request Routing**: Dynamic proxy routing based on URL patterns
- **API Key Authentication**: Secure access control with API key validation
- **Rate Limiting**: Per-client rate limiting with configurable windows
- **Response Caching**: Intelligent caching for GET requests
- **Health Monitoring**: Health check and statistics endpoints
- **Request Logging**: Comprehensive HTTP request logging
- **Error Handling**: Graceful error handling with proper HTTP status codes
- **Graceful Shutdown**: Clean shutdown handling for production deployments
- **Header Management**: Automatic forwarding and custom header injection
- **Path Rewriting**: Automatic route prefix stripping for backend services

## Architecture

The gateway acts as a reverse proxy that sits between clients and your microservices:

```
Client → API Gateway → Backend Services
                ↓
        [Auth, Rate Limiting, Caching, Logging]
```

### Core Components

- **Proxy Middleware**: Routes requests to appropriate backend services
- **Authentication Layer**: Validates API keys before forwarding requests
- **Rate Limiter**: Prevents abuse with per-client request limits
- **Cache Layer**: Stores responses for improved performance
- **Monitoring**: Provides insights into gateway operation

## Installation

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn package manager

### Quick Start

1. **Clone or download the project**
   ```bash
   git clone https://github.com/Nika-HISK/mini-api-gateway
   cd mini-api-gateway
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your routes**
   Edit `config.json` to define your service mappings:
   ```json
   {
     "/api/users": "http://localhost:5001",
     "/api/orders": "http://localhost:5002",
     "/api/products": "http://localhost:5003",
     "/api/auth": "http://localhost:5004"
   }
   ```

4. **Set environment variables** (optional)
   ```bash
   export API_KEY=your-secret-api-key
   export PORT=3000
   ```

5. **Start the gateway**
   ```bash
   npm start
   ```

## Configuration

### Route Configuration (`config.json`)

The gateway routes are defined in a simple JSON configuration file:

```json
{
  "/api/users": "http://localhost:5001",
  "/api/orders": "http://orders-service:8080",
  "/api/products": "https://products.example.com",
  "/api/auth": "http://auth-service:3000"
}
```

**Configuration Rules:**
- Keys represent the route prefixes that the gateway will match
- Values are the target backend service URLs
- Route matching is prefix-based (longest match wins)
- Routes are processed in the order they appear in the configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port number for the gateway server |
| `API_KEY` | `gateway-secret-key` | API key required for authentication |

## Usage

### Starting the Gateway

**Development mode with auto-restart:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**Testing with mock backends:**
```bash
# Terminal 1: Start mock backend services
npm test

# Terminal 2: Start the gateway
npm start
```

### Making Requests

All requests to the gateway require an API key:

```bash
# Get all users
curl -H "x-api-key: gateway-secret-key" \
     http://localhost:3000/api/users

# Get specific user
curl -H "x-api-key: gateway-secret-key" \
     http://localhost:3000/api/users/1

# Create new user
curl -H "x-api-key: gateway-secret-key" \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice","email":"alice@example.com"}' \
     http://localhost:3000/api/users

# Login request
curl -H "x-api-key: gateway-secret-key" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"secret"}' \
     http://localhost:3000/api/auth/login
```

## API Endpoints

### Gateway Management Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "routes": ["/api/users", "/api/orders", "/api/products", "/api/auth"]
}
```

#### Gateway Statistics
```http
GET /gateway/stats
```

**Response:**
```json
{
  "activeConnections": 5,
  "cacheSize": 12,
  "configuration": {
    "/api/users": "http://localhost:5001",
    "/api/orders": "http://localhost:5002"
  },
  "memory": {
    "rss": 45678912,
    "heapTotal": 20971520,
    "heapUsed": 15234816,
    "external": 1234567
  }
}
```

### Proxied Endpoints

All configured routes are automatically proxied. For example, with the default configuration:

- `GET /api/users` → `http://localhost:5001/`
- `GET /api/users/123` → `http://localhost:5001/123`
- `POST /api/orders` → `http://localhost:5002/`
- `GET /api/products/search?q=laptop` → `http://localhost:5003/search?q=laptop`

## Middleware Features

### Authentication

**API Key Required**: All requests must include the `x-api-key` header.

**Error Responses:**
- `401 Unauthorized`: Missing or invalid API key
- Headers: `x-api-key: your-secret-key`

### Rate Limiting

**Limits**: 10 requests per minute per client IP address

**Headers Added:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets

**Error Response (429):**
```json
{
  "error": "Rate limit exceeded. Maximum 10 requests per minute.",
  "retryAfter": 30
}
```

### Response Caching

**Cached Requests**: Only GET requests are cached
**Cache Duration**: 30 seconds
**Cache Key**: Method + URL + API Key

**Cached Response Headers:**
```json
{
  "data": "...",
  "_cached": true,
  "_cachedAt": "2024-01-15T10:30:00.000Z"
}
```

### Request Logging

Uses Morgan middleware with 'combined' format:
```
127.0.0.1 - - [15/Jan/2024:10:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "curl/7.68.0"
```

### Header Management

**Headers Added to Backend Requests:**
- `x-forwarded-by`: mini-api-gateway
- `x-forwarded-for`: Client IP address
- `x-forwarded-api-key`: Original API key

**Headers Added to Responses:**
- `x-gateway`: mini-api-gateway
- `x-response-time`: Request processing time in milliseconds

## Testing

### Mock Backend Services

The project includes a comprehensive test suite with mock backend services:

```bash
npm test
```

This starts four mock services:
- **Users Service** (Port 5001): CRUD operations for user management
- **Orders Service** (Port 5002): Order processing and retrieval
- **Products Service** (Port 5003): Product catalog with search
- **Auth Service** (Port 5004): Authentication and token validation

### Manual Testing Examples

**Test Authentication:**
```bash
# Valid API key
curl -H "x-api-key: gateway-secret-key" http://localhost:3000/api/users

# Invalid API key
curl -H "x-api-key: wrong-key" http://localhost:3000/api/users
```

**Test Rate Limiting:**
```bash
# Make multiple rapid requests to trigger rate limiting
for i in {1..12}; do
  curl -H "x-api-key: gateway-secret-key" http://localhost:3000/api/users
done
```

**Test Caching:**
```bash
# First request (not cached)
curl -H "x-api-key: gateway-secret-key" http://localhost:3000/api/users

# Second request within 30 seconds (cached)
curl -H "x-api-key: gateway-secret-key" http://localhost:3000/api/users
```

## Monitoring

### Health Monitoring

The gateway provides detailed health information:

```bash
curl http://localhost:3000/health
```

Monitor this endpoint to ensure the gateway is operational.

### Performance Metrics

Access detailed statistics:

```bash
curl -H "x-api-key: gateway-secret-key" http://localhost:3000/gateway/stats
```

### Logging

The gateway logs all requests and errors to the console. In production, redirect to appropriate log files:

```bash
npm start > gateway.log 2>&1
```

## Security

### API Key Management

- Store API keys securely using environment variables
- Use different keys for different environments
- Rotate keys regularly
- Consider implementing key expiration

### Production Security Recommendations

1. **HTTPS Only**: Use HTTPS in production environments
2. **Rate Limiting**: Adjust rate limits based on your requirements
3. **API Key Rotation**: Implement regular key rotation
4. **Network Security**: Deploy behind a firewall/VPN
5. **Monitoring**: Implement comprehensive logging and alerting

### Security Headers

Consider adding security headers in production:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

## Performance

### Optimization Features

- **Connection Pooling**: Automatic connection reuse for backend services
- **Response Caching**: 30-second cache for GET requests
- **Request Deduplication**: Prevents duplicate concurrent requests
- **Memory Management**: Automatic cleanup of expired cache entries

### Performance Tuning

**Cache Configuration:**
```javascript
// Adjust cache duration (default: 30 seconds)
const CACHE_DURATION = 60000; // 1 minute

// Adjust max cache size (default: 100 entries)
const MAX_CACHE_SIZE = 200;
```

**Rate Limiting Configuration:**
```javascript
// Adjust rate limits (default: 10 requests/minute)
const maxRequests = 20;
const windowMs = 60 * 1000;
```

### Scaling Considerations

- Deploy multiple gateway instances behind a load balancer
- Use Redis for shared rate limiting and caching
- Implement health checks for automatic failover
- Monitor resource usage and scale horizontally

## Deployment

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
USER node

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t mini-api-gateway .
docker run -p 3000:3000 -e API_KEY=your-secret-key mini-api-gateway
```

### Docker Compose

```yaml
version: '3.8'
services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_KEY=your-secret-key
      - NODE_ENV=production
    restart: unless-stopped
```

### Production Environment

**Process Management with PM2:**
```bash
npm install -g pm2
pm2 start server.js --name "api-gateway"
pm2 startup
pm2 save
```

**Environment Variables:**
```bash
export NODE_ENV=production
export API_KEY=your-production-api-key
export PORT=3000
```

### Load Balancer Configuration

When running multiple instances, configure your load balancer:

**Nginx Configuration:**
```nginx
upstream api_gateway {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Error Handling

The gateway provides comprehensive error handling:

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Invalid API key."
}
```

**404 Not Found:**
```json
{
  "error": "Route not found",
  "message": "No proxy configuration found for /api/invalid",
  "availableRoutes": ["/api/users", "/api/orders"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Rate Limited:**
```json
{
  "error": "Rate limit exceeded. Maximum 10 requests per minute.",
  "retryAfter": 45
}
```

**502 Bad Gateway:**
```json
{
  "error": "Bad Gateway",
  "message": "The upstream service is unavailable",
  "service": "http://localhost:5001",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines


## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## Quick Reference

### Essential Commands
```bash
npm install          # Install dependencies
npm start           # Start production server
npm run dev         # Start development server
npm test            # Start mock backends
```

### Default Ports
- Gateway: `3000`
- Mock Users Service: `5001`
- Mock Orders Service: `5002`
- Mock Products Service: `5003`
- Mock Auth Service: `5004`
