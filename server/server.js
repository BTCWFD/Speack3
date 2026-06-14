require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// Using NeDB instead of MongoDB for quick development
const mongoose = require('./config/nedb');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./api/auth');
const userRoutes = require('./api/users');
const groupRoutes = require('./api/groups');
const messageRoutes = require('./api/messages');

// Import socket handlers
const setupSocketHandlers = require('./sockets/messageHandler');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Resolve allowed CORS origins.
// In production we fail closed: if ALLOWED_ORIGINS is not set we deny all
// cross-origin requests rather than falling back to a permissive wildcard.
// In development we keep localhost-friendly defaults for convenience.
const resolveCorsOrigins = () => {
    const configured = process.env.ALLOWED_ORIGINS?.split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    if (configured && configured.length > 0) {
        return configured;
    }

    if (process.env.NODE_ENV === 'production') {
        // Fail closed: no origins allowed when none are configured.
        return false;
    }

    // Development defaults
    return ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];
};

const corsOrigins = resolveCorsOrigins();

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Rate limiting
// Global limiter applied to all requests.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // don't rate-limit the test suite
    message: { error: 'Too many requests, please try again later' }
});

// Stricter limiter for authentication routes to slow down brute-force attempts.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // don't rate-limit the test suite
    message: { error: 'Too many authentication attempts, please try again later' }
});

app.use(globalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// NeDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect();
    } catch (error) {
        console.error('❌ NeDB connection error:', error);
        process.exit(1);
    }
};

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();

    server.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Health check: http://localhost:${PORT}/health`);
        console.log(`   WebSocket: ws://localhost:${PORT}`);
        console.log('\n📡 Ready to accept connections...\n');
    });
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Only auto-start the server when this file is run directly. When the app is
// imported (e.g. by the test suite) we expose `app`/`io` without binding a port.
if (require.main === module) {
    startServer();
}

module.exports = { app, io };
