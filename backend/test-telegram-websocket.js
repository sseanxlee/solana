require('dotenv').config();
const { TelegramBotService } = require('./src/services/telegramBotService');

console.log('🚀 Testing Telegram + WebSocket Integration...');

async function test() {
    try {
        const telegramBot = TelegramBotService.getInstance();

        console.log('✅ Starting Telegram bot...');
        await telegramBot.start();

        console.log('🎯 Bot is running with WebSocket monitoring capabilities');
        console.log('');
        console.log('📋 Available Commands:');
        console.log('   /startmonitoring <token_address> - Start monitoring');
        console.log('   /stopmonitoring - Stop monitoring');
        console.log('   /setstreamtoken <token_address> - Change token');
        console.log('   /streamstatus - Check status');
        console.log('');
        console.log('🧪 Test with token: 71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');
        console.log('💡 You should receive ping notifications every 30 seconds');
        console.log('');
        console.log('🔄 Press Ctrl+C to stop');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    try {
        const telegramBot = TelegramBotService.getInstance();
        await telegramBot.stop();
        console.log('✅ Telegram bot stopped');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

test(); 