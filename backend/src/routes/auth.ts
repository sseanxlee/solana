import { Router, Response } from 'express';
import { getNonce, signIn, authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { AuthRequest, ApiResponse } from '../types';

const router = Router();

// GET /auth/nonce - Get nonce for wallet authentication
router.get('/nonce', getNonce);

// POST /auth/signin - Sign in with wallet signature
router.post('/signin', signIn);

// POST /auth/link-discord - Link Discord account to wallet
router.post('/link-discord', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { discordUserId } = req.body;

        if (!discordUserId || typeof discordUserId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Discord User ID is required'
            } as ApiResponse);
        }

        // Check if this Discord ID is already linked to another account
        const existingDiscordUser = await query(
            'SELECT id, wallet_address FROM users WHERE discord_user_id = $1',
            [discordUserId]
        );

        if (existingDiscordUser.rows.length > 0) {
            const existingUser = existingDiscordUser.rows[0];

            // Check if it's linked to this user already
            if (existingUser.id === req.user!.id) {
                return res.json({
                    success: true,
                    message: 'Discord account is already linked to this wallet'
                } as ApiResponse);
            }

            // If it's a placeholder account, we can merge it
            if (existingUser.wallet_address && existingUser.wallet_address.startsWith('discord_') && existingUser.wallet_address.includes('_placeholder')) {
                // Merge alerts from placeholder account to real account
                await query(
                    'UPDATE token_alerts SET user_id = $1 WHERE user_id = $2',
                    [req.user!.id, existingUser.id]
                );

                // Delete the placeholder account
                await query(
                    'DELETE FROM users WHERE id = $1',
                    [existingUser.id]
                );

                console.log(`[DISCORD LINK] Merged placeholder account ${existingUser.id} into wallet account ${req.user!.id}`);
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'This Discord account is already linked to another wallet'
                } as ApiResponse);
            }
        }

        // Link the Discord ID to the current user
        await query(
            'UPDATE users SET discord_user_id = $1 WHERE id = $2',
            [discordUserId, req.user!.id]
        );

        console.log(`[DISCORD LINK] Successfully linked Discord ID ${discordUserId} to wallet ${req.user!.wallet_address}`);

        res.json({
            success: true,
            message: 'Discord account linked successfully'
        } as ApiResponse);

    } catch (error) {
        console.error('Error linking Discord account:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to link Discord account'
        } as ApiResponse);
    }
});

// GET /auth/fix-orphaned-discord - Debug endpoint to show orphaned Discord users
router.get('/fix-orphaned-discord', async (req: AuthRequest, res: Response) => {
    try {
        // Find Discord users with null or invalid wallet addresses
        const orphanedUsers = await query(`
            SELECT id, discord_user_id, wallet_address, 
                   (SELECT COUNT(*) FROM token_alerts WHERE user_id = users.id) as alert_count
            FROM users 
            WHERE discord_user_id IS NOT NULL 
            AND (wallet_address IS NULL OR wallet_address LIKE 'discord_%_placeholder')
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            data: orphanedUsers.rows,
            message: `Found ${orphanedUsers.rows.length} orphaned Discord accounts`
        } as ApiResponse);

    } catch (error) {
        console.error('Error finding orphaned Discord accounts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find orphaned Discord accounts'
        } as ApiResponse);
    }
});

// GET /auth/debug-discord-alerts - Debug endpoint to show Discord alerts
router.get('/debug-discord-alerts', async (req: AuthRequest, res: Response) => {
    try {
        // Get all Discord alerts with user info
        const discordAlerts = await query(`
            SELECT ta.*, u.wallet_address, u.discord_user_id, u.telegram_chat_id
            FROM token_alerts ta
            JOIN users u ON ta.user_id = u.id 
            WHERE ta.notification_type = 'discord'
            ORDER BY ta.created_at DESC
        `);

        res.json({
            success: true,
            data: discordAlerts.rows,
            message: `Found ${discordAlerts.rows.length} Discord alerts`
        } as ApiResponse);

    } catch (error) {
        console.error('Error finding Discord alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find Discord alerts'
        } as ApiResponse);
    }
});

export default router; 