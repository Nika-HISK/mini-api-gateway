const express = require('express');

const usersApp = express();
usersApp.use(express.json());

const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
];

usersApp.get('/', (req, res) => {
  console.log('Users service: GET /');
  res.json({ 
    service: 'users', 
    users,
    timestamp: new Date().toISOString()
  });
});

usersApp.get('/:id', (req, res) => {
  console.log(`Users service: GET /${req.params.id}`);
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ 
    service: 'users', 
    user,
    timestamp: new Date().toISOString()
  });
});

usersApp.post('/', (req, res) => {
  console.log('Users service: POST /');
  const newUser = {
    id: users.length + 1,
    name: req.body.name,
    email: req.body.email
  };
  users.push(newUser);
  res.status(201).json({ 
    service: 'users', 
    user: newUser,
    timestamp: new Date().toISOString()
  });
});

const ordersApp = express();
ordersApp.use(express.json());

const orders = [
  { id: 1, userId: 1, product: 'Laptop', amount: 1299.99, status: 'completed' },
  { id: 2, userId: 2, product: 'Mouse', amount: 29.99, status: 'pending' },
  { id: 3, userId: 1, product: 'Keyboard', amount: 79.99, status: 'shipped' }
];

ordersApp.get('/', (req, res) => {
  console.log('Orders service: GET /');
  res.json({ 
    service: 'orders', 
    orders,
    timestamp: new Date().toISOString()
  });
});

ordersApp.get('/:id', (req, res) => {
  console.log(`Orders service: GET /${req.params.id}`);
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ 
    service: 'orders', 
    order,
    timestamp: new Date().toISOString()
  });
});

ordersApp.post('/', (req, res) => {
  console.log('Orders service: POST /');
  const newOrder = {
    id: orders.length + 1,
    userId: req.body.userId,
    product: req.body.product,
    amount: req.body.amount,
    status: 'pending'
  };
  orders.push(newOrder);
  res.status(201).json({ 
    service: 'orders', 
    order: newOrder,
    timestamp: new Date().toISOString()
  });
});

const productsApp = express();
productsApp.use(express.json());

const products = [
  { id: 1, name: 'Laptop', price: 1299.99, category: 'Electronics' },
  { id: 2, name: 'Mouse', price: 29.99, category: 'Accessories' },
  { id: 3, name: 'Keyboard', price: 79.99, category: 'Accessories' }
];

productsApp.get('/', (req, res) => {
  console.log('Products service: GET /');
  setTimeout(() => {
    res.json({ 
      service: 'products', 
      products,
      timestamp: new Date().toISOString()
    });
  }, 100);
});

productsApp.get('/:id', (req, res) => {
  console.log(`Products service: GET /${req.params.id}`);
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ 
    service: 'products', 
    product,
    timestamp: new Date().toISOString()
  });
});

const authApp = express();
authApp.use(express.json());

authApp.post('/login', (req, res) => {
  console.log('Auth service: POST /login');
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'secret') {
    res.json({
      service: 'auth',
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
      user: { username: 'admin', role: 'administrator' },
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(401).json({
      service: 'auth',
      error: 'Invalid credentials',
      timestamp: new Date().toISOString()
    });
  }
});

authApp.post('/verify', (req, res) => {
  console.log('Auth service: POST /verify');
  const token = req.headers.authorization;
  
  if (token && token.startsWith('Bearer mock-jwt-token')) {
    res.json({
      service: 'auth',
      valid: true,
      user: { username: 'admin', role: 'administrator' },
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(401).json({
      service: 'auth',
      error: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }
});

const servers = [
  { app: usersApp, port: 5001, name: 'Users' },
  { app: ordersApp, port: 5002, name: 'Orders' },
  { app: productsApp, port: 5003, name: 'Products' },
  { app: authApp, port: 5004, name: 'Auth' }
];

console.log('Starting mock backend services...\n');

servers.forEach(({ app, port, name }) => {
  app.listen(port, () => {
    console.log(`${name} service running on http://localhost:${port}`);
  });
});

console.log('\nTest endpoints through gateway:');
console.log('  GET  http://localhost:3000/api/users (with x-api-key header)');
console.log('  GET  http://localhost:3000/api/orders (with x-api-key header)');
console.log('  GET  http://localhost:3000/api/products (with x-api-key header)');
console.log('  POST http://localhost:3000/api/auth/login (with x-api-key header)');
console.log('\nGateway health: http://localhost:3000/health');
console.log('Gateway stats: http://localhost:3000/gateway/stats');

process.on('SIGINT', () => {
  console.log('\nShutting down mock services...');
  process.exit(0);
});
