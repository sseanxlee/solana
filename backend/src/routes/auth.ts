import { Router, Response } from 'express';
import { getNonce, signIn, authenticateToken } from '../middleware/auth';
import { query } from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import crypto from 'crypto';

const router = Router();

// GET /auth/nonce - Get nonce for wallet authentication
router.get('/nonce', getNonce);

// POST /auth/signin - Sign in with wallet signature
router.post('/signin', signIn);

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user!.id,
                walletAddress: req.user!.wallet_address,
                email: req.user!.email,
                telegramChatId: req.user!.telegram_chat_id,
                discordUserId: req.user!.discord_user_id
            }
        } as ApiResponse);
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        } as ApiResponse);
    }
});

// POST /auth/discord/generate-link-token - Generate linking token (called by Discord bot)
router.post('/discord/generate-link-token', async (req, res: Response) => {
    try {
        const { discordUserId, discordUsername } = req.body;

        if (!discordUserId || typeof discordUserId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Discord User ID is required'
            } as ApiResponse);
        }

        // Check if user is already linked
        const existingUser = await query(
            'SELECT id, wallet_address FROM users WHERE discord_user_id = $1',
            [discordUserId]
        );

        if (existingUser.rows.length > 0 && existingUser.rows[0].wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'Discord account is already linked to a wallet',
                data: { isAlreadyLinked: true }
            } as ApiResponse);
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Clean up any existing tokens for this user
        await query(
            'DELETE FROM discord_linking_tokens WHERE discord_user_id = $1',
            [discordUserId]
        );

        // Create new token
        await query(`
            INSERT INTO discord_linking_tokens (token, discord_user_id, discord_username, expires_at)
            VALUES ($1, $2, $3, $4)
        `, [token, discordUserId, discordUsername || null, expiresAt]);

        console.log(`[DISCORD LINK] Generated token for Discord user ${discordUserId} (${discordUsername})`);

        res.json({
            success: true,
            data: { token }
        } as ApiResponse);

    } catch (error) {
        console.error('Error generating Discord linking token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate linking token'
        } as ApiResponse);
    }
});

// POST /auth/discord/link-with-token - Link with token (called by frontend)
router.post('/discord/link-with-token', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { linkingToken } = req.body;

        if (!linkingToken || typeof linkingToken !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Linking token is required'
            } as ApiResponse);
        }

        // Validate token
        const tokenResult = await query(`
            SELECT * FROM discord_linking_tokens 
            WHERE token = $1 AND NOT used AND expires_at > NOW()
        `, [linkingToken]);

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired linking token'
            } as ApiResponse);
        }

        const tokenData = tokenResult.rows[0];

        // Check if this Discord user is already linked to another wallet
        const existingDiscordUser = await query(
            'SELECT id, wallet_address FROM users WHERE discord_user_id = $1',
            [tokenData.discord_user_id]
        );

        if (existingDiscordUser.rows.length > 0) {
            const existingUser = existingDiscordUser.rows[0];

            console.log(`[DISCORD LINK] Found existing Discord user: ${existingUser.id}, current user: ${req.user!.id}`);

            // If it's linked to this same user, that's fine
            if (existingUser.id === req.user!.id) {
                // Mark token as used
                await query(
                    'UPDATE discord_linking_tokens SET used = TRUE, wallet_address = $1 WHERE token = $2',
                    [req.user!.wallet_address, linkingToken]
                );

                console.log(`[DISCORD LINK] Discord account was already linked to this wallet`);

                return res.json({
                    success: true,
                    message: 'Discord account was already linked to this wallet',
                    data: { discordUsername: tokenData.discord_username }
                } as ApiResponse);
            }

            // If it's a placeholder account or has null wallet (orphaned), merge it
            if (!existingUser.wallet_address ||
                (existingUser.wallet_address.startsWith('discord_') && existingUser.wallet_address.includes('_placeholder'))) {

                console.log(`[DISCORD LINK] Merging ${!existingUser.wallet_address ? 'orphaned' : 'placeholder'} account ${existingUser.id} into wallet account ${req.user!.id}`);

                // Merge alerts from placeholder/orphaned account to real account
                await query(
                    'UPDATE token_alerts SET user_id = $1 WHERE user_id = $2',
                    [req.user!.id, existingUser.id]
                );

                // Delete the placeholder/orphaned account
                await query(
                    'DELETE FROM users WHERE id = $1',
                    [existingUser.id]
                );

                console.log(`[DISCORD LINK] Successfully merged ${!existingUser.wallet_address ? 'orphaned' : 'placeholder'} account`);

                // Now proceed to link the Discord to current user (old account was deleted)
            } else {
                // Real wallet already linked to different account
                console.log(`[DISCORD LINK] Discord ${tokenData.discord_user_id} already linked to different wallet: ${existingUser.wallet_address}`);

                return res.status(400).json({
                    success: false,
                    error: 'This Discord account is already linked to another wallet'
                } as ApiResponse);
            }
        }

        // Link Discord to current user (only executes if no existing user or placeholder was merged)
        await query(
            'UPDATE users SET discord_user_id = $1 WHERE id = $2',
            [tokenData.discord_user_id, req.user!.id]
        );

        // Mark token as used
        await query(
            'UPDATE discord_linking_tokens SET used = TRUE, wallet_address = $1 WHERE token = $2',
            [req.user!.wallet_address, linkingToken]
        );

        console.log(`[DISCORD LINK] Successfully linked Discord ${tokenData.discord_user_id} (${tokenData.discord_username}) to wallet ${req.user!.wallet_address}`);

        res.json({
            success: true,
            message: 'Discord account linked successfully',
            data: { discordUsername: tokenData.discord_username }
        } as ApiResponse);

    } catch (error) {
        console.error('Error linking Discord with token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to link Discord account'
        } as ApiResponse);
    }
});

// GET /auth/discord/token-info/:token - Check if token exists and get Discord info
router.get('/discord/token-info/:token', async (req, res: Response) => {
    try {
        const { token } = req.params;

        const result = await query(`
            SELECT discord_username, discord_user_id, expires_at, used 
            FROM discord_linking_tokens 
            WHERE token = $1
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Token not found'
            } as ApiResponse);
        }

        const tokenData = result.rows[0];
        const isExpired = new Date() > new Date(tokenData.expires_at);

        res.json({
            success: true,
            data: {
                discordUsername: tokenData.discord_username,
                discordUserId: tokenData.discord_user_id,
                isExpired,
                isUsed: tokenData.used
            }
        } as ApiResponse);

    } catch (error) {
        console.error('Error getting token info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get token info'
        } as ApiResponse);
    }
});

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

            // If it's a placeholder account or has null wallet (orphaned), we can merge it
            if (!existingUser.wallet_address ||
                (existingUser.wallet_address.startsWith('discord_') && existingUser.wallet_address.includes('_placeholder'))) {
                // Merge alerts from placeholder/orphaned account to real account
                await query(
                    'UPDATE token_alerts SET user_id = $1 WHERE user_id = $2',
                    [req.user!.id, existingUser.id]
                );

                // Delete the placeholder/orphaned account
                await query(
                    'DELETE FROM users WHERE id = $1',
                    [existingUser.id]
                );

                console.log(`[DISCORD LINK] Merged ${!existingUser.wallet_address ? 'orphaned' : 'placeholder'} account ${existingUser.id} into wallet account ${req.user!.id}`);
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

// GET /auth/discord-status - Check Discord linking status
router.get('/discord-status', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userResult = await query(
            'SELECT discord_user_id FROM users WHERE id = $1',
            [req.user!.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            } as ApiResponse);
        }

        const user = userResult.rows[0];
        const isLinked = !!user.discord_user_id;

        res.json({
            success: true,
            data: {
                isLinked,
                discordUserId: user.discord_user_id || undefined
            }
        } as ApiResponse);

    } catch (error) {
        console.error('Error checking Discord status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check Discord status'
        } as ApiResponse);
    }
});

export default router; 