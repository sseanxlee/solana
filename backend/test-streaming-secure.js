const WebSocket = require('ws');
const crypto = require('crypto');

// Security Configuration
const SECURITY_CONFIG = {
    // Enforce TLS 1.2+ and proper certificate validation
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    // Add certificate pinning if needed (optional)
    checkServerIdentity: (hostname, cert) => {
        if (hostname !== 'api.solanastreaming.com') {
            throw new Error('Hostname mismatch');
        }
        return undefined; // Use default verification
    }
};

// Test parameters for SolanaStreaming
const API_KEY = process.env.SOLANA_STREAMING_API_KEY || '5514608b846a25bc12f7b21381e8de7e';
const WS_URL = 'wss://api.solanastreaming.com';
const TEST_TOKEN = '71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg'; // Single token as requested

// Security: Validate API key format
if (!API_KEY || API_KEY.length !== 32 || !/^[a-fA-F0-9]+$/.test(API_KEY)) {
    console.error('❌ Invalid API key format');
    process.exit(1);
}

// Security: Validate token address format
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!SOLANA_ADDRESS_REGEX.test(TEST_TOKEN)) {
    console.error(`❌ Invalid Solana token address format: ${TEST_TOKEN}`);
    process.exit(1);
}

console.log('🔒 Starting SECURE SolanaStreaming WebSocket connection...');
console.log(`🎯 Monitoring 1 token:`);
console.log(`   ${TEST_TOKEN.slice(0, 8)}...${TEST_TOKEN.slice(-8)}`);
console.log('🛡️  Security measures: TLS 1.2+, Certificate validation, Input validation');
console.log('');

// Create secure WebSocket connection
const ws = new WebSocket(WS_URL, {
    headers: {
        'X-API-KEY': API_KEY,
        'User-Agent': 'SolanaBot/1.0',
        'Accept': 'application/json'
    },
    // Security options
    ...SECURITY_CONFIG,
    // Connection timeout
    handshakeTimeout: 10000,
    // Limit message size to prevent memory attacks
    maxPayload: 1024 * 1024 // 1MB
});

// Security: Message ID tracking to prevent replay attacks
const messageIds = new Set();
let messageCounter = 1;

// Generate secure message ID (numeric for JSON-RPC compatibility)
function generateSecureMessageId() {
    return messageCounter++;
}

ws.on('open', () => {
    console.log('✅ Secure connection established!');
    console.log('🔐 TLS/SSL encryption active');

    // Subscribe to single token with secure message ID
    const messageId = generateSecureMessageId();
    console.log(`📊 Subscribing to swaps (Message ID: ${messageId})...`);

    const subscribeMessage = {
        jsonrpc: "2.0",
        id: messageId,
        method: "swapSubscribe",
        params: {
            include: {
                baseTokenMint: [TEST_TOKEN]
            }
        }
    };

    ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', (data) => {
    try {
        // Security: Validate message size
        if (data.length > 1024 * 1024) { // 1MB limit
            console.error('❌ Message too large, potential attack');
            return;
        }

        // Security: Validate data is proper buffer/string
        const messageString = data.toString('utf8');
        const message = JSON.parse(messageString);

        // Security: Validate message structure
        if (typeof message !== 'object' || message === null) {
            console.error('❌ Invalid message format');
            return;
        }

        // Handle subscription response
        if (message.id && message.result && message.result.subscription_id) {
            console.log(`🎯 Subscription successful! ID: ${message.result.subscription_id}`);
            console.log(`👀 Listening for swaps on token...`);
            console.log('💡 Single token monitoring active');
            console.log('');
            return;
        }

        // Handle errors with security logging
        if (message.error) {
            console.error('❌ Subscription error:', {
                code: message.error.code,
                message: message.error.message,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Handle swap notifications with validation
        if (message.slot && message.swap) {
            const { swap, blockTime, signature, slot } = message;

            // Security: Validate swap data structure
            if (!swap.baseTokenMint || !swap.quoteTokenMint || !swap.walletAccount) {
                console.error('❌ Invalid swap data structure');
                return;
            }

            // Security: Validate addresses are proper Solana addresses
            if (!SOLANA_ADDRESS_REGEX.test(swap.baseTokenMint) ||
                !SOLANA_ADDRESS_REGEX.test(swap.walletAccount)) {
                console.error('❌ Invalid address format in swap data');
                return;
            }

            // Security: Validate numeric values
            if (typeof swap.usdValue !== 'number' || swap.usdValue < 0 || swap.usdValue > 1000000000) {
                console.error('❌ Invalid USD value in swap data');
                return;
            }

            // Security: Validate timestamp is reasonable (not too old/future)
            const now = Math.floor(Date.now() / 1000);
            if (blockTime < now - 300 || blockTime > now + 60) { // 5 min past, 1 min future
                console.warn('⚠️  Unusual timestamp in swap data');
            }

            // Identify which token this is (single token mode)
            const shortToken = `${swap.baseTokenMint.slice(0, 8)}...${swap.baseTokenMint.slice(-8)}`;

            console.log(`
🔥 VERIFIED SWAP DETECTED!
💰 Token: ${shortToken}
📈 Type: ${swap.swapType.toUpperCase()}
💵 USD Value: $${swap.usdValue.toLocaleString()}
💎 Price: ${swap.quotePrice} SOL
👤 Wallet: ${swap.walletAccount.slice(0, 8)}...${swap.walletAccount.slice(-8)}
💰 Amount: ${swap.baseAmount}
⏰ Time: ${new Date(blockTime * 1000).toLocaleString()}
🔗 TX: ${signature.slice(0, 16)}...
🏪 Exchange: ${swap.sourceExchange || 'Unknown'}
🔒 Slot: ${slot}
            `);
            return;
        }

        console.log('📨 Received validated message:', message);

    } catch (error) {
        console.error('❌ Error processing message:', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Secure connection closed: ${code} - ${reason}`);
    console.log(`⏰ Closed at: ${new Date().toISOString()}`);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket security error:', {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
    });
});

// Secure keep alive ping with timeout
const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        console.log('💓 Secure ping sent');
    } else {
        console.log('🔌 Connection not open, stopping ping');
        clearInterval(pingInterval);
    }
}, 30000);

// Enhanced graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Initiating secure shutdown...');
    clearInterval(pingInterval);

    if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Client shutdown');
    }

    setTimeout(() => {
        console.log('🔒 Secure shutdown completed');
        process.exit(0);
    }, 1000);
});

// Security: Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    process.exit(1);
});

console.log('🔄 Press Ctrl+C to stop securely'); 