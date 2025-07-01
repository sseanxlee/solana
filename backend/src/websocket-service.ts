import dotenv from 'dotenv';
import { SolanaStreamingService } from './services/solanaStreamingService';
import { query } from './config/database';
import Redis from 'ioredis';

// Load environment variables
dotenv.config();

class WebSocketService {
    private streamingService: SolanaStreamingService;
    private redis: Redis;
    private monitoringTokens: Set<string> = new Set();
    private isRunning: boolean = false;

    constructor() {
        this.streamingService = SolanaStreamingService.getInstance();
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.setupStreamingCallbacks();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting standalone WebSocket service...');

            // Connect to Redis
            await this.redis.ping();
            console.log('✅ Redis connected');

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            // Resume monitoring for existing alerts
            await this.resumeMonitoringForExistingAlerts();

            // Start health check interval
            this.startHealthCheck();

            this.isRunning = true;
            console.log('✅ WebSocket service is running');

        } catch (error) {
            console.error('❌ Failed to start WebSocket service:', error);
            process.exit(1);
        }
    }

    private setupStreamingCallbacks(): void {
        this.streamingService.setCallbacks({
            onSwap: async (notification) => {
                await this.handleSwapNotification(notification);
            },
            onPing: async () => {
                console.log('🏓 WebSocket ping received');
                await this.redis.set('websocket:last_ping', Date.now(), 'EX', 60);
            },
            onError: async (error) => {
                console.error('🚨 WebSocket error:', error);
                await this.redis.publish('websocket:error', JSON.stringify({ error, timestamp: Date.now() }));
            },
            onStatus: async (status) => {
                console.log('📡 WebSocket status:', status);
                await this.redis.set('websocket:status', status, 'EX', 300);
            }
        });
    }

    private async handleSwapNotification(notification: any): Promise<void> {
        try {
            const tokenAddress = notification.swap.baseTokenMint;
            const currentPrice = parseFloat(notification.swap.quotePrice);

            // Calculate market cap if we have the data
            const currentMarketCap = notification.swap.usdValue || 0;

            console.log(`💰 Swap detected for ${tokenAddress.slice(0, 8)}... - $${notification.swap.usdValue}`);

            // Check and trigger alerts
            await this.checkAndTriggerAlerts(tokenAddress, currentPrice, currentMarketCap);

        } catch (error) {
            console.error('Error handling swap notification:', error);
        }
    }

    private async checkAndTriggerAlerts(tokenAddress: string, currentPrice: number, currentMarketCap: number): Promise<void> {
        try {
            // Get all active alerts for this token
            const alerts = await query(`
                SELECT ta.*, u.telegram_chat_id, u.discord_user_id, u.wallet_address
                FROM token_alerts ta 
                JOIN users u ON ta.user_id = u.id 
                WHERE ta.token_address = $1 AND ta.is_active = true AND ta.is_triggered = false
            `, [tokenAddress]);

            let alertsTriggered = false;

            for (const alert of alerts.rows) {
                let shouldTrigger = false;
                let currentValue = 0;

                if (alert.threshold_type === 'market_cap') {
                    currentValue = currentMarketCap;
                }

                // Check if alert should trigger
                if (alert.condition === 'above' && currentValue >= alert.threshold_value) {
                    shouldTrigger = true;
                } else if (alert.condition === 'below' && currentValue <= alert.threshold_value) {
                    shouldTrigger = true;
                }

                if (shouldTrigger) {
                    alertsTriggered = true;

                    // Mark alert as triggered
                    await query(`
                        UPDATE token_alerts 
                        SET is_triggered = true, triggered_at = CURRENT_TIMESTAMP 
                        WHERE id = $1
                    `, [alert.id]);

                    // Publish alert trigger to Redis for bot services to pick up
                    const alertPayload = {
                        alertId: alert.id,
                        userId: alert.user_id,
                        telegramChatId: alert.telegram_chat_id,
                        discordUserId: alert.discord_user_id,
                        tokenName: alert.token_name,
                        tokenSymbol: alert.token_symbol,
                        thresholdType: alert.threshold_type,
                        thresholdValue: alert.threshold_value,
                        currentValue: currentValue,
                        condition: alert.condition,
                        notificationType: alert.notification_type
                    };

                    // Publish to different channels based on notification type
                    if (alert.notification_type === 'telegram' && alert.telegram_chat_id) {
                        await this.redis.publish('telegram:alert_triggered', JSON.stringify(alertPayload));
                    }

                    if (alert.notification_type === 'discord' && alert.discord_user_id) {
                        await this.redis.publish('discord:alert_triggered', JSON.stringify(alertPayload));
                    }

                    console.log(`🚨 Alert triggered for user ${alert.user_id}: ${alert.token_symbol} ${alert.threshold_type} ${alert.condition} ${alert.threshold_value}`);
                }
            }

            // If any alerts were triggered, check if we should continue monitoring this token
            if (alertsTriggered) {
                await this.checkAndUpdateMonitoring(tokenAddress);
            }

        } catch (error) {
            console.error('Error checking and triggering alerts:', error);
        }
    }

    private async checkAndUpdateMonitoring(triggeredTokenAddress: string): Promise<void> {
        try {
            // Check if there are any remaining active alerts for this token
            const remainingAlertsForToken = await query(`
                SELECT COUNT(*) as count 
                FROM token_alerts 
                WHERE token_address = $1 AND is_active = true AND is_triggered = false
            `, [triggeredTokenAddress]);

            const remainingCount = parseInt(remainingAlertsForToken.rows[0].count);

            if (remainingCount > 0) {
                console.log(`Token ${triggeredTokenAddress.slice(0, 8)}... still has ${remainingCount} active alerts. Continuing monitoring.`);
                return;
            }

            // No more alerts for this token, remove from monitoring
            this.monitoringTokens.delete(triggeredTokenAddress);
            console.log(`🔄 No more alerts for ${triggeredTokenAddress.slice(0, 8)}..., checking for other tokens to monitor`);

            // Get all other tokens that still have active alerts
            const otherActiveTokens = await query(`
                SELECT DISTINCT token_address, token_name, token_symbol
                FROM token_alerts 
                WHERE is_active = true AND is_triggered = false AND token_address != $1
                LIMIT 1
            `, [triggeredTokenAddress]);

            if (otherActiveTokens.rows.length > 0) {
                const nextToken = otherActiveTokens.rows[0];
                console.log(`🔄 Switching to monitor: ${nextToken.token_name} (${nextToken.token_symbol})`);
                await this.streamingService.startMonitoring(nextToken.token_address);
                this.monitoringTokens.add(nextToken.token_address);
            } else {
                console.log('🔄 No more tokens to monitor. WebSocket will idle until new alerts are created.');
                await this.streamingService.stopMonitoring();
            }

        } catch (error) {
            console.error('Error updating monitoring:', error);
        }
    }

    private async resumeMonitoringForExistingAlerts(): Promise<void> {
        try {
            console.log('[STARTUP] Resuming WebSocket monitoring for existing alerts...');

            // Get all active alerts from database
            const alertsResult = await query(`
                SELECT DISTINCT token_address, token_name, token_symbol
                FROM token_alerts 
                WHERE is_active = true AND is_triggered = false
                ORDER BY created_at ASC
                LIMIT 1
            `);

            if (alertsResult.rows.length > 0) {
                const tokenToMonitor = alertsResult.rows[0];
                console.log(`[STARTUP] Starting monitoring for: ${tokenToMonitor.token_name} (${tokenToMonitor.token_symbol})`);

                await this.streamingService.startMonitoring(tokenToMonitor.token_address);
                this.monitoringTokens.add(tokenToMonitor.token_address);

                console.log(`[STARTUP] Successfully resumed WebSocket monitoring`);
            } else {
                console.log('[STARTUP] No active alerts found - WebSocket monitoring not started');
            }
        } catch (error) {
            console.error('[STARTUP] Error resuming monitoring for existing alerts:', error);
        }
    }

    private startHealthCheck(): void {
        // Health check every 30 seconds
        setInterval(async () => {
            try {
                const health = {
                    timestamp: Date.now(),
                    isConnected: this.streamingService.isMonitoring(),
                    monitoringTokens: Array.from(this.monitoringTokens),
                    uptime: process.uptime()
                };

                await this.redis.set('websocket:health', JSON.stringify(health), 'EX', 60);
            } catch (error) {
                console.error('Health check failed:', error);
            }
        }, 30000);
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            console.log(`\n🛑 Received ${signal}, shutting down WebSocket service gracefully...`);

            this.isRunning = false;

            try {
                // Stop monitoring
                await this.streamingService.stopMonitoring();

                // Close Redis connection
                await this.redis.quit();

                console.log('✅ WebSocket service shut down gracefully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}

// Start the service
const service = new WebSocketService();
service.start().catch((error) => {
    console.error('Failed to start WebSocket service:', error);
    process.exit(1);
}); 