import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { TokenService } from '../services/tokenService';
import { MonitoringService } from '../services/monitoringService';
import { TelegramBotService } from '../services/telegramBotService';
import { AuthRequest, TokenAlert, ApiResponse } from '../types';

const router = Router();
const tokenService = new TokenService();
const monitoringService = new MonitoringService();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /alerts - Get user's alerts
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        let result;

        // Get alerts from all linked accounts (wallet, telegram, discord)
        // This includes a broader search to catch orphaned Discord alerts
        const conditions = ['ta.user_id = $1']; // Direct wallet-based alerts
        const params = [req.user!.id];

        if (req.user!.telegram_chat_id) {
            conditions.push('u.telegram_chat_id = $' + (params.length + 1));
            params.push(req.user!.telegram_chat_id);
        }

        if (req.user!.discord_user_id) {
            conditions.push('u.discord_user_id = $' + (params.length + 1));
            params.push(req.user!.discord_user_id);
        }

        // TEMPORARY: Include all Discord alerts for debugging
        // This helps surface orphaned Discord alerts that should be linked
        conditions.push("ta.notification_type = 'discord'");

        result = await query(
            `SELECT DISTINCT ta.*, u.wallet_address as alert_user_wallet, u.discord_user_id as alert_user_discord 
             FROM token_alerts ta
             JOIN users u ON ta.user_id = u.id 
             WHERE (${conditions.join(' OR ')})
             ORDER BY ta.created_at DESC`,
            params
        );

        const alerts = result.rows as TokenAlert[];

        // Add tracking status for each alert
        const alertsWithStatus = alerts.map(alert => ({
            ...alert,
            is_being_tracked: alert.is_active && !alert.is_triggered
        }));

        res.json({
            success: true,
            data: alertsWithStatus
        } as ApiResponse<TokenAlert[]>);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        } as ApiResponse);
    }
});

// POST /alerts - Create new alert
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            tokenAddress,
            thresholdType,
            thresholdValue,
            condition,
            notificationType
        } = req.body;

        // Validation
        if (!tokenAddress || !thresholdType || !thresholdValue || !condition || !notificationType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            } as ApiResponse);
        }

        // Validate token address
        const isValidToken = await tokenService.validateTokenAddress(tokenAddress);
        if (!isValidToken) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token address or token not found'
            } as ApiResponse);
        }

        // Validate threshold type
        if (!['price', 'market_cap'].includes(thresholdType)) {
            return res.status(400).json({
                success: false,
                error: 'Threshold type must be either "price" or "market_cap"'
            } as ApiResponse);
        }

        // Validate condition
        if (!['above', 'below'].includes(condition)) {
            return res.status(400).json({
                success: false,
                error: 'Condition must be either "above" or "below"'
            } as ApiResponse);
        }

        // Validate notification type
        if (!['email', 'telegram', 'discord'].includes(notificationType)) {
            return res.status(400).json({
                success: false,
                error: 'Notification type must be either "email", "telegram", or "discord"'
            } as ApiResponse);
        }

        // Validate threshold value
        const thresholdNum = parseFloat(thresholdValue);
        if (isNaN(thresholdNum) || thresholdNum <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Threshold value must be a positive number'
            } as ApiResponse);
        }

        // Check if user has required notification method configured (only for telegram now)
        if (notificationType === 'telegram' && !req.user!.telegram_chat_id) {
            return res.status(400).json({
                success: false,
                error: 'Telegram not configured. Please update your profile first.'
            } as ApiResponse);
        }

        // Remove email requirement for now
        // if (notificationType === 'email' && !req.user!.email) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Email not configured. Please update your profile first.'
        //     } as ApiResponse);
        // }

        // Discord alerts are handled differently - no direct user config required
        // Discord users are linked through the Discord bot service

        // Get token metadata
        const tokenData = await tokenService.getTokenData(tokenAddress);

        // Create alert
        const result = await query(
            `INSERT INTO token_alerts 
       (user_id, token_address, token_name, token_symbol, threshold_type, threshold_value, condition, notification_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                req.user!.id,
                tokenAddress,
                tokenData?.name || null,
                tokenData?.symbol || null,
                thresholdType,
                thresholdNum,
                condition,
                notificationType
            ]
        );

        const newAlert = result.rows[0] as TokenAlert;

        res.status(201).json({
            success: true,
            data: newAlert,
            message: 'Alert created successfully'
        } as ApiResponse<TokenAlert>);
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create alert'
        } as ApiResponse);
    }
});

// PUT /alerts/:id - Update alert
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { thresholdValue, condition, isActive } = req.body;

        // Check if alert exists and belongs to user
        const alertResult = await query(
            'SELECT * FROM token_alerts WHERE id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (alertResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            } as ApiResponse);
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (thresholdValue !== undefined) {
            const thresholdNum = parseFloat(thresholdValue);
            if (isNaN(thresholdNum) || thresholdNum <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Threshold value must be a positive number'
                } as ApiResponse);
            }
            updates.push(`threshold_value = $${paramIndex++}`);
            values.push(thresholdNum);
        }

        if (condition !== undefined) {
            if (!['above', 'below'].includes(condition)) {
                return res.status(400).json({
                    success: false,
                    error: 'Condition must be either "above" or "below"'
                } as ApiResponse);
            }
            updates.push(`condition = $${paramIndex++}`);
            values.push(condition);
        }

        if (isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(isActive);

            // Reset triggered status if reactivating
            if (isActive) {
                updates.push(`is_triggered = $${paramIndex++}`);
                values.push(false);
                updates.push(`triggered_at = $${paramIndex++}`);
                values.push(null);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            } as ApiResponse);
        }

        values.push(id, req.user!.id);

        const updateResult = await query(
            `UPDATE token_alerts 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
            values
        );

        const updatedAlert = updateResult.rows[0] as TokenAlert;

        // If the alert was deactivated, check if monitoring should be stopped for this token
        if (isActive === false) {
            try {
                // Check if there are any remaining active alerts for this token
                const remainingAlerts = await query(
                    'SELECT COUNT(*) as count FROM token_alerts WHERE token_address = $1 AND is_active = true AND is_triggered = false',
                    [updatedAlert.token_address]
                );

                const remainingCount = parseInt(remainingAlerts.rows[0].count);

                // If no more alerts for this token, notify telegram bot service to update monitoring
                if (remainingCount === 0) {
                    const telegramBotService = TelegramBotService.getInstance();
                    await telegramBotService.checkAndUpdateTokenMonitoring(updatedAlert.token_address);
                    console.log(`Triggered monitoring cleanup for token ${updatedAlert.token_address} (alert deactivated, no remaining alerts)`);
                }
            } catch (cleanupError) {
                console.error('Error during monitoring cleanup after deactivating alert:', cleanupError);
                // Don't fail the update if cleanup fails
            }
        }

        res.json({
            success: true,
            data: updatedAlert,
            message: 'Alert updated successfully'
        } as ApiResponse<TokenAlert>);
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert'
        } as ApiResponse);
    }
});

// DELETE /alerts/:id - Delete alert
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // First get the alert info before deleting
        const alertInfo = await query(
            'SELECT token_address FROM token_alerts WHERE id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (alertInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            } as ApiResponse);
        }

        const tokenAddress = alertInfo.rows[0].token_address;

        const result = await query(
            'DELETE FROM token_alerts WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user!.id]
        );

        // Check if there are any remaining active alerts for this token
        const remainingAlerts = await query(
            'SELECT COUNT(*) as count FROM token_alerts WHERE token_address = $1 AND is_active = true AND is_triggered = false',
            [tokenAddress]
        );

        const remainingCount = parseInt(remainingAlerts.rows[0].count);

        // If no more alerts for this token, notify telegram bot service to update monitoring
        if (remainingCount === 0) {
            try {
                const telegramBotService = TelegramBotService.getInstance();
                // Trigger monitoring cleanup for this token
                await telegramBotService.checkAndUpdateTokenMonitoring(tokenAddress);
                console.log(`Triggered monitoring cleanup for token ${tokenAddress} (no remaining alerts)`);
            } catch (cleanupError) {
                console.error('Error during monitoring cleanup:', cleanupError);
                // Don't fail the deletion if cleanup fails
            }
        }

        res.json({
            success: true,
            message: 'Alert deleted successfully'
        } as ApiResponse);
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete alert'
        } as ApiResponse);
    }
});

// POST /alerts/:id/test - Test alert notification
router.post('/:id/test', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Check if alert exists and belongs to user
        const alertResult = await query(
            'SELECT * FROM token_alerts WHERE id = $1 AND user_id = $2',
            [id, req.user!.id]
        );

        if (alertResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            } as ApiResponse);
        }

        const testResult = await monitoringService.testAlert(id);

        if (testResult.success) {
            res.json({
                success: true,
                message: testResult.message
            } as ApiResponse);
        } else {
            res.status(400).json({
                success: false,
                error: testResult.message
            } as ApiResponse);
        }
    } catch (error) {
        console.error('Error testing alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test alert'
        } as ApiResponse);
    }
});

// GET /alerts/monitoring/status - Get monitoring system status
router.get('/monitoring/status', async (req: AuthRequest, res: Response) => {
    try {
        const telegramBotService = TelegramBotService.getInstance();

        // Get active alerts count across all users
        const activeAlertsResult = await query(`
            SELECT COUNT(*) as count, 
                   COUNT(DISTINCT token_address) as unique_tokens
            FROM token_alerts 
            WHERE is_active = true AND is_triggered = false
        `);

        const totalActiveAlerts = parseInt(activeAlertsResult.rows[0].count);
        const uniqueTokens = parseInt(activeAlertsResult.rows[0].unique_tokens);

        // Get user's active alerts
        let userActiveAlerts;
        if (req.user!.telegram_chat_id) {
            userActiveAlerts = await query(`
                SELECT DISTINCT ta.token_address, ta.token_name, ta.token_symbol
                FROM token_alerts ta
                JOIN users u ON ta.user_id = u.id 
                WHERE ta.is_active = true AND ta.is_triggered = false 
                AND (ta.user_id = $1 OR u.telegram_chat_id = $2)
            `, [req.user!.id, req.user!.telegram_chat_id]);
        } else {
            userActiveAlerts = await query(`
                SELECT DISTINCT ta.token_address, ta.token_name, ta.token_symbol
                FROM token_alerts ta
                WHERE ta.is_active = true AND ta.is_triggered = false 
                AND ta.user_id = $1
            `, [req.user!.id]);
        }

        const status = {
            system: {
                totalActiveAlerts,
                uniqueTokens,
                botRunning: telegramBotService.isRunningBot()
            },
            user: {
                activeAlerts: userActiveAlerts.rows.length,
                tokens: userActiveAlerts.rows
            }
        };

        res.json({
            success: true,
            data: status
        } as ApiResponse);
    } catch (error) {
        console.error('Error getting monitoring status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get monitoring status'
        } as ApiResponse);
    }
});

export default router; 