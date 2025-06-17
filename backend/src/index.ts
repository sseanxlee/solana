import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import alertRoutes from './routes/alerts';
import tokenRoutes from './routes/tokens';
import { MonitoringService } from './services/monitoringService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3002;

// Initialize monitoring service
const monitoringService = new MonitoringService();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3002', // Allow frontend on port 3002
        'http://localhost:3001'  // Allow frontend on port 3001 as backup
    ],
    credentials: true
}));

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (disabled for development)
if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        message: {
            success: false,
            error: 'Too many requests from this IP, please try again later.'
        }
    });
    app.use(limiter);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/tokens', tokenRoutes);

// User profile routes
app.use('/api/profile', (req, res, next) => {
    // Profile routes will be handled here
    res.status(404).json({
        success: false,
        error: 'Profile endpoints not yet implemented'
    });
});

// Token routes are now handled by tokenRoutes

// Admin routes (for monitoring stats)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await monitoringService.getMonitoringStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monitoring statistics'
        });
    }
});

// Force check endpoint (for testing)
app.post('/api/admin/force-check', async (req, res) => {
    try {
        const { tokenAddress } = req.body;
        const result = await monitoringService.forceCheck(tokenAddress);

        res.json({
            success: result.success,
            message: result.message,
            data: {
                alertsChecked: result.alertsChecked
            }
        });
    } catch (error) {
        console.error('Error during force check:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform force check'
        });
    }
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`
    });
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    monitoringService.stop();

    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
    console.log(`[STRIDE] Server running on port ${PORT}`);
    console.log(`[STRIDE] Health check: http://localhost:${PORT}/health`);
    console.log(`[STRIDE] API base URL: http://localhost:${PORT}/api`);

    // Start monitoring service
    monitoringService.start();
});

export default app; 