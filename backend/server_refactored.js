const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import route modules
const loansRoutes = require('./src/routes/loans');
const remindersRoutes = require('./src/routes/reminders');
const cashflowRoutes = require('./src/routes/cashflow');
const debugRoutes = require('./src/routes/debug');

// Import utilities
const db = require('./src/database/connection');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'connected',
    features: [
      'modular_architecture',
      'prorated_payments',
      'payment_synchronization_debug',
      'comprehensive_reminders'
    ]
  });
});

// API Routes
app.use('/api/loans', loansRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/debug', debugRoutes);

// Static file serving for production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.path} not found`,
    availableRoutes: [
      '/api/health',
      '/api/loans',
      '/api/reminders',
      '/api/reminders/investors',
      '/api/cashflow/monthly',
      '/api/debug/payment-sync/{projectName}',
      '/api/debug/prorated-payments/{stageId}/{investorId}',
      '/api/debug/duplicates/{projectName}'
    ]
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('💤 Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('💤 Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Goodland LMS Backend v2.0 running on port ${PORT}`);
  console.log(`🏗️  Modular Architecture Enabled`);
  console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Loans Data: http://localhost:${PORT}/api/loans`);
  console.log(`📍 Cashflow Data: http://localhost:${PORT}/api/cashflow/monthly`);
  console.log(`📍 Reminders: http://localhost:${PORT}/api/reminders`);
  console.log(`📍 Investor Reminders: http://localhost:${PORT}/api/reminders/investors`);
  console.log(`📍 Payment Sync Debug: http://localhost:${PORT}/api/debug/payment-sync/{projectName}`);
  console.log(`📍 Prorated Payments Debug: http://localhost:${PORT}/api/debug/prorated-payments/{stageId}/{investorId}`);
  console.log(`\n✅ Features: Modular Architecture + Prorated Payments + Payment Sync Debug + Comprehensive Reminders`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 