import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { query } from '../config/database';
import { User, AuthRequest } from '../types';

declare module 'express-serve-static-core' {
    interface Request {
        get(name: string): string | undefined;
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const verifySignature = (
    message: string,
    signature: string,
    publicKey: string
): boolean => {
    try {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = new Uint8Array(signature.split(',').map(Number));
        const publicKeyBytes = new PublicKey(publicKey).toBytes();

        return nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

export const generateAuthMessage = (walletAddress: string, nonce: string): string => {
    return `Sign this message to authenticate with Solana Token Alerts.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This request will not trigger a blockchain transaction or cost any gas fees.`;
};

export const signIn = async (req: Request, res: Response) => {
    try {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: walletAddress, signature, message'
            });
        }

        // Verify the signature
        const isValidSignature = verifySignature(message, signature, walletAddress);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }

        // Check if user exists, if not create one
        let result = await query(
            'SELECT * FROM users WHERE wallet_address = $1',
            [walletAddress]
        );

        let user: User;
        if (result.rows.length === 0) {
            // Create new user
            const insertResult = await query(
                'INSERT INTO users (wallet_address) VALUES ($1) RETURNING *',
                [walletAddress]
            );
            user = insertResult.rows[0];
        } else {
            user = result.rows[0];
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, walletAddress: user.wallet_address },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    email: user.email,
                    telegramChatId: user.telegram_chat_id
                }
            }
        });
    } catch (error) {
        console.error('Sign in error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

export const authenticateToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.get('authorization');
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Get user from database
        const result = await query(
            'SELECT * FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

export const generateNonce = (): string => {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
};

export const getNonce = (req: Request, res: Response) => {
    const nonce = generateNonce();
    const { walletAddress } = req.query;

    if (!walletAddress) {
        return res.status(400).json({
            success: false,
            error: 'Wallet address required'
        });
    }

    const message = generateAuthMessage(walletAddress as string, nonce);

    res.json({
        success: true,
        data: {
            message,
            nonce
        }
    });
}; 