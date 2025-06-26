import cron from 'node-cron';
import { query } from '../config/database';
import { TokenAlert, TokenData } from '../types';
import { TokenService } from './tokenService';
import { NotificationService } from './notificationService';
import { TelegramBotService } from './telegramBotService';
import { DiscordBotService } from './discordBotService';

export class MonitoringService {
    private tokenService: TokenService;
    private notificationService: NotificationService;
    private telegramBotService: TelegramBotService;
    private discordBotService: DiscordBotService;
    private isRunning: boolean = false;

    constructor() {
        this.tokenService = new TokenService();
        this.notificationService = new NotificationService();
        this.telegramBotService = TelegramBotService.getInstance();
        this.discordBotService = DiscordBotService.getInstance();
    }

    start(): void {
        if (this.isRunning) {
            console.log('Monitoring service is already running');
            return;
        }

        console.log('Starting monitoring service...');
        this.isRunning = true;

        // Check alerts every minute
        cron.schedule('* * * * *', async () => {
            await this.checkAllAlerts();
        });

        // Process notification queue every 30 seconds
        cron.schedule('*/30 * * * * *', async () => {
            await this.notificationService.processNotificationQueue();
        });

        console.log('Monitoring service started successfully');
    }

    stop(): void {
        this.isRunning = false;
        console.log('Monitoring service stopped');
    }

    async checkAllAlerts(): Promise<void> {
        try {
            console.log('Checking all active alerts...');

            // Get all active alerts
            const result = await query(
                `SELECT ta.*, u.email, u.telegram_chat_id 
         FROM token_alerts ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.is_active = TRUE AND ta.is_triggered = FALSE`
            );

            const alerts = result.rows as TokenAlert[];

            if (alerts.length === 0) {
                console.log('No active alerts found');
                return;
            }

            console.log(`Found ${alerts.length} active alerts to check`);

            // Group alerts by token address for efficient batch processing
            const tokenGroups = this.groupAlertsByToken(alerts);

            for (const [tokenAddress, tokenAlerts] of tokenGroups.entries()) {
                await this.checkTokenAlerts(tokenAddress, tokenAlerts);
            }

            console.log('Alert check completed');
        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    }

    private groupAlertsByToken(alerts: TokenAlert[]): Map<string, TokenAlert[]> {
        const groups = new Map<string, TokenAlert[]>();

        for (const alert of alerts) {
            if (!groups.has(alert.token_address)) {
                groups.set(alert.token_address, []);
            }
            groups.get(alert.token_address)!.push(alert);
        }

        return groups;
    }

    private async checkTokenAlerts(tokenAddress: string, alerts: TokenAlert[]): Promise<void> {
        try {
            // Get current token data
            const tokenData = await this.tokenService.getTokenData(tokenAddress);

            if (!tokenData) {
                console.error(`Failed to fetch data for token: ${tokenAddress}`);
                return;
            }

            console.log(`Checking ${alerts.length} alerts for ${tokenData.symbol} (${tokenAddress})`);

            for (const alert of alerts) {
                await this.checkSingleAlert(alert, tokenData);
            }
        } catch (error) {
            console.error(`Error checking alerts for token ${tokenAddress}:`, error);
        }
    }

    private async checkSingleAlert(alert: TokenAlert, tokenData: TokenData): Promise<void> {
        try {
            const currentValue = alert.threshold_type === 'price'
                ? tokenData.price
                : tokenData.market_cap;

            if (currentValue === undefined || currentValue === null) {
                console.warn(`No ${alert.threshold_type} data available for ${alert.token_symbol}`);
                return;
            }

            const isTriggered = this.isAlertTriggered(alert, currentValue);

            if (isTriggered) {
                console.log(`Alert triggered for ${alert.token_symbol}: ${alert.threshold_type} ${alert.condition} $${alert.threshold_value} (current: $${currentValue})`);

                // Mark alert as triggered
                await this.markAlertAsTriggered(alert.id);

                // Send notification
                await this.notificationService.sendAlertNotification(alert, currentValue);

                // Update token metadata if needed
                await this.updateAlertTokenInfo(alert.id, tokenData);

                // Check if monitoring should be updated after this alert was triggered
                try {
                    await this.telegramBotService.checkAndUpdateTokenMonitoring(alert.token_address);
                    await this.discordBotService.checkAndUpdateTokenMonitoring(alert.token_address);
                    console.log(`Triggered monitoring cleanup check for token ${alert.token_address}`);
                } catch (cleanupError) {
                    console.error('Error during post-trigger monitoring cleanup:', cleanupError);
                }
            }
        } catch (error) {
            console.error(`Error checking alert ${alert.id}:`, error);
        }
    }

    private isAlertTriggered(alert: TokenAlert, currentValue: number): boolean {
        if (alert.condition === 'above') {
            return currentValue > alert.threshold_value;
        } else {
            return currentValue < alert.threshold_value;
        }
    }

    private async markAlertAsTriggered(alertId: string): Promise<void> {
        await query(
            `UPDATE token_alerts 
       SET is_triggered = TRUE, triggered_at = CURRENT_TIMESTAMP, is_active = FALSE
       WHERE id = $1`,
            [alertId]
        );
    }

    private async updateAlertTokenInfo(alertId: string, tokenData: TokenData): Promise<void> {
        await query(
            `UPDATE token_alerts 
       SET token_name = $1, token_symbol = $2
       WHERE id = $3 AND (token_name IS NULL OR token_symbol IS NULL)`,
            [tokenData.name, tokenData.symbol, alertId]
        );
    }

    async getMonitoringStats(): Promise<{
        totalAlerts: number;
        activeAlerts: number;
        triggeredAlerts: number;
        uniqueTokens: number;
        lastCheckTime: string;
    }> {
        try {
            const [totalResult, activeResult, triggeredResult, tokensResult] = await Promise.all([
                query('SELECT COUNT(*) as count FROM token_alerts'),
                query('SELECT COUNT(*) as count FROM token_alerts WHERE is_active = TRUE'),
                query('SELECT COUNT(*) as count FROM token_alerts WHERE is_triggered = TRUE'),
                query('SELECT COUNT(DISTINCT token_address) as count FROM token_alerts WHERE is_active = TRUE')
            ]);

            return {
                totalAlerts: parseInt(totalResult.rows[0].count),
                activeAlerts: parseInt(activeResult.rows[0].count),
                triggeredAlerts: parseInt(triggeredResult.rows[0].count),
                uniqueTokens: parseInt(tokensResult.rows[0].count),
                lastCheckTime: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting monitoring stats:', error);
            return {
                totalAlerts: 0,
                activeAlerts: 0,
                triggeredAlerts: 0,
                uniqueTokens: 0,
                lastCheckTime: new Date().toISOString()
            };
        }
    }

    async testAlert(alertId: string): Promise<{ success: boolean; message: string }> {
        try {
            // Get the alert
            const alertResult = await query(
                'SELECT * FROM token_alerts WHERE id = $1',
                [alertId]
            );

            if (alertResult.rows.length === 0) {
                return { success: false, message: 'Alert not found' };
            }

            const alert = alertResult.rows[0] as TokenAlert;

            // Get current token data
            const tokenData = await this.tokenService.getTokenData(alert.token_address);

            if (!tokenData) {
                return { success: false, message: 'Failed to fetch token data' };
            }

            const currentValue = alert.threshold_type === 'price'
                ? tokenData.price
                : tokenData.market_cap;

            if (currentValue === undefined || currentValue === null) {
                return {
                    success: false,
                    message: `No ${alert.threshold_type} data available for this token`
                };
            }

            // Force send notification (for testing)
            const notificationSent = await this.notificationService.sendAlertNotification(alert, currentValue);

            if (notificationSent) {
                return {
                    success: true,
                    message: `Test notification sent successfully. Current ${alert.threshold_type}: $${currentValue.toLocaleString()}`
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to send test notification'
                };
            }
        } catch (error) {
            console.error('Error testing alert:', error);
            return {
                success: false,
                message: 'Internal error occurred while testing alert'
            };
        }
    }

    async forceCheck(tokenAddress?: string): Promise<{ success: boolean; message: string; alertsChecked: number }> {
        try {
            let whereClause = 'WHERE ta.is_active = TRUE AND ta.is_triggered = FALSE';
            let params: any[] = [];

            if (tokenAddress) {
                whereClause += ' AND ta.token_address = $1';
                params.push(tokenAddress);
            }

            const result = await query(
                `SELECT ta.*, u.email, u.telegram_chat_id 
         FROM token_alerts ta
         JOIN users u ON ta.user_id = u.id
         ${whereClause}`,
                params
            );

            const alerts = result.rows as TokenAlert[];

            if (alerts.length === 0) {
                return {
                    success: true,
                    message: 'No active alerts found to check',
                    alertsChecked: 0
                };
            }

            // Group alerts by token for efficient checking
            const tokenGroups = this.groupAlertsByToken(alerts);

            for (const [tokenAddr, tokenAlerts] of tokenGroups.entries()) {
                await this.checkTokenAlerts(tokenAddr, tokenAlerts);
            }

            return {
                success: true,
                message: `Force check completed successfully`,
                alertsChecked: alerts.length
            };
        } catch (error) {
            console.error('Error during force check:', error);
            return {
                success: false,
                message: 'Error occurred during force check',
                alertsChecked: 0
            };
        }
    }
} 