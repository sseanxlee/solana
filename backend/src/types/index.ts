export interface User {
    id: string;
    wallet_address: string;
    email?: string;
    telegram_chat_id?: string;
    created_at: Date;
    updated_at: Date;
}

export interface TokenAlert {
    id: string;
    user_id: string;
    token_address: string;
    token_name?: string;
    token_symbol?: string;
    threshold_type: 'price' | 'market_cap';
    threshold_value: number;
    condition: 'above' | 'below';
    notification_type: 'email' | 'telegram';
    is_active: boolean;
    is_triggered: boolean;
    triggered_at?: Date;
    created_at: Date;
    updated_at: Date;
}

export interface TokenData {
    address: string;
    name: string;
    symbol: string;
    price: number;
    market_cap?: number;
    logo?: string;
    last_updated: Date;
}

export interface NotificationQueue {
    id: string;
    alert_id: string;
    type: 'email' | 'telegram';
    recipient: string;
    subject: string;
    message: string;
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
    created_at: Date;
    sent_at?: Date;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

import { Request } from 'express';

export interface AuthRequest extends Request {
    user?: User;
}

export interface MoralisTokenData {
    token_address: string;
    name: string;
    symbol: string;
    logo?: string;
    thumbnail?: string;
    decimals: number;
    balance: string;
    usd_price?: number;
    usd_value?: number;
    possible_spam: boolean;
    verified_contract: boolean;
}

export interface JupiterPriceData {
    data: {
        [tokenAddress: string]: {
            id: string;
            mintSymbol: string;
            vsToken: string;
            vsTokenSymbol: string;
            price: number;
        };
    };
    timeTaken: number;
} 