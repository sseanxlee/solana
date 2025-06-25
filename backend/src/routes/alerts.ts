import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { TokenService } from '../services/tokenService';
import { MonitoringService } from '../services/monitoringService';
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

        // If user has telegram_chat_id, get alerts from both the wallet-based user and telegram-based user
        if (req.user!.telegram_chat_id) {
            result = await query(
                `SELECT DISTINCT ta.* FROM token_alerts ta
                 JOIN users u ON ta.user_id = u.id 
                 WHERE (ta.user_id = $1 OR u.telegram_chat_id = $2)
                 ORDER BY ta.created_at DESC`,
                [req.user!.id, req.user!.telegram_chat_id]
            );
        } else {
            // If no telegram linked, just get wallet-based alerts
            result = await query(
                `SELECT * FROM token_alerts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
                [req.user!.id]
            );
        }

        const alerts = result.rows as TokenAlert[];

        res.json({
            success: true,
            data: alerts
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
        if (!['email', 'telegram'].includes(notificationType)) {
            return res.status(400).json({
                success: false,
                error: 'Notification type must be either "email" or "telegram"'
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

        // Check if user has required notification method configured
        if (notificationType === 'email' && !req.user!.email) {
            return res.status(400).json({
                success: false,
                error: 'Email not configured. Please update your profile first.'
            } as ApiResponse);
        }

        if (notificationType === 'telegram' && !req.user!.telegram_chat_id) {
            return res.status(400).json({
                success: false,
                error: 'Telegram not configured. Please update your profile first.'
            } as ApiResponse);
        }

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

        const result = await query(
            'DELETE FROM token_alerts WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user!.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            } as ApiResponse);
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

export default router; 