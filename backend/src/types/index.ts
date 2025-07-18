export interface User {
    id: string;
    wallet_address: string;
    email?: string;
    telegram_chat_id?: string;
    discord_user_id?: string;
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
    notification_type: 'email' | 'telegram' | 'discord';
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

export interface TokenMetadata {
    mint: string;
    standard: string;
    name: string;
    symbol: string;
    logo: string;
    decimals: string;
    metaplex: {
        metadataUri: string;
        masterEdition: boolean;
        isMutable: boolean;
        sellerFeeBasisPoints: number;
        updateAuthority: string;
        primarySaleHappened: number;
    };
    fullyDilutedValue: string;
    totalSupply: string;
    totalSupplyFormatted: string;
    links: {
        moralis: string;
    };
    description: string | null;
    isVerifiedContract: boolean;
    possibleSpam: boolean;
}

export interface TokenPair {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenLogo: string;
    tokenDecimals: string;
    pairTokenType: string;
    liquidityUsd: number;
}

export interface TokenPairData {
    exchangeAddress: string;
    exchangeName: string;
    exchangeLogo: string;
    pairLabel: string;
    pairAddress: string;
    usdPrice: number;
    usdPrice24hrPercentChange: number;
    usdPrice24hrUsdChange: number;
    liquidityUsd: number;
    baseToken: string;
    quoteToken: string;
    pair: TokenPair[];
}

export interface TokenPairsResponse {
    cursor?: string;
    pageSize: number;
    page: number;
    pairs: TokenPairData[];
}

export interface NotificationQueue {
    id: string;
    alert_id: string;
    type: 'email' | 'telegram' | 'discord';
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

export interface TokenAnalytics {
    tokenAddress: string;
    totalBuyVolume: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSellVolume: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalBuyers: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSellers: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalBuys: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSells: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    uniqueWallets: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    pricePercentChange: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    usdPrice: string;
    totalLiquidityUsd: string;
    totalFullyDilutedValuation: string;
}

export interface TokenPairStats {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenLogo: string;
    pairCreated: string | null;
    pairLabel: string;
    pairAddress: string;
    exchange: string;
    exchangeAddress: string;
    exchangeLogo: string;
    exchangeUrl: string | null;
    currentUsdPrice: string;
    currentNativePrice: string;
    totalLiquidityUsd: string;
    pricePercentChange: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    liquidityPercentChange: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buys: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sells: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    totalVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buyVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sellVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buyers: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sellers: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
} 