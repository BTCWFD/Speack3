require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// Using NeDB instead of MongoDB for quick development
const mongoose = require('./config/nedb');
const cors = require('cors');
const helmet = require('helmet');

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

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
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
app.use('/api/auth', authRoutes);
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

startServer();

module.exports = { app, io };
