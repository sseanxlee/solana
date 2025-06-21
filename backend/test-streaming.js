const WebSocket = require('ws');

// Test parameters for SolanaStreaming
const API_KEY = '5514608b846a25bc12f7b21381e8de7e';
const WS_URL = 'wss://api.solanastreaming.com';
const TEST_TOKEN = 'BtoVudqcKLhtBp84hBeXV7Jone2r1EMSnZhHB1ispump'; // Back to single token

console.log('🚀 Testing SolanaStreaming WebSocket connection...');
console.log(`🎯 Monitoring 1 token (subscription limit):`);
console.log(`   ${TEST_TOKEN}`);
console.log('');

// Create WebSocket connection with API key
const ws = new WebSocket(WS_URL, {
    headers: {
        'X-API-KEY': API_KEY
    }
});

ws.on('open', () => {
    console.log('✅ Connected to SolanaStreaming!');

    // Subscribe to single token (subscription level limitation)
    console.log(`📊 Subscribing to swaps for 1 token...`);
    const subscribeMessage = {
        jsonrpc: "2.0",
        id: 1,
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
        const message = JSON.parse(data.toString());

        // Handle subscription response
        if (message.id && message.result && message.result.subscription_id) {
            console.log(`🎯 Subscription successful! ID: ${message.result.subscription_id}`);
            console.log(`👀 Listening for swaps on token...`);
            console.log('💡 Current plan allows 1 token monitoring only');
            console.log('');
            return;
        }

        // Handle errors
        if (message.error) {
            console.error('❌ Subscription error:', message.error);
            return;
        }

        // Handle swap notifications
        if (message.slot && message.swap) {
            const { swap, blockTime, signature } = message;

            const shortToken = `${swap.baseTokenMint.slice(0, 8)}...${swap.baseTokenMint.slice(-8)}`;

            console.log(`
🔥 SWAP DETECTED!
💰 Token: ${shortToken}
📈 Type: ${swap.swapType.toUpperCase()}
💵 USD Value: $${swap.usdValue.toLocaleString()}
💎 Price: ${swap.quotePrice} SOL
👤 Wallet: ${swap.walletAccount.slice(0, 8)}...${swap.walletAccount.slice(-8)}
💰 Amount: ${swap.baseAmount}
⏰ Time: ${new Date(blockTime * 1000).toLocaleString()}
🔗 TX: ${signature.slice(0, 16)}...
🏪 Exchange: ${swap.sourceExchange || 'Unknown'}
            `);
            return;
        }

        console.log('📨 Received:', message);
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${code} - ${reason}`);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
});

// Keep alive ping
setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        console.log('💓 Ping sent');
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    ws.close();
    process.exit(0);
});

console.log('🔄 Press Ctrl+C to stop'); 