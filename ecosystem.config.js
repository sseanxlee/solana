module.exports = {
    apps: [{
        name: 'solana-alerts-api',
        script: 'dist/index.js',
        instances: 2,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        // Restart settings
        max_restarts: 10,
        restart_delay: 5000,
        // Logs
        log_file: './logs/api.log',
        out_file: './logs/api-out.log',
        error_file: './logs/api-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        // Memory management
        max_memory_restart: '500M',
        // Health monitoring
        kill_timeout: 5000,
        listen_timeout: 10000
    }, {
        name: 'websocket-service',
        script: 'dist/websocket-service.js',
        instances: 1, // Single instance for WebSocket coordination
        env: {
            NODE_ENV: 'production',
            WS_PORT: 3001
        },
        env_production: {
            NODE_ENV: 'production',
            WS_PORT: 3001
        },
        // Restart settings
        max_restarts: 10,
        restart_delay: 5000,
        // Logs
        log_file: './logs/websocket.log',
        out_file: './logs/websocket-out.log',
        error_file: './logs/websocket-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        // Memory management
        max_memory_restart: '300M',
        // Health monitoring
        kill_timeout: 10000,
        listen_timeout: 15000,
        // Auto restart on file changes (disable in production)
        watch: false,
        // Cron restart (optional - restart daily at 3 AM)
        cron_restart: '0 3 * * *'
    }, {
        name: 'telegram-bot',
        script: 'dist/telegram-bot.js',
        instances: 1,
        env: {
            NODE_ENV: 'production'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        // Restart settings
        max_restarts: 10,
        restart_delay: 5000,
        // Logs
        log_file: './logs/telegram-bot.log',
        out_file: './logs/telegram-bot-out.log',
        error_file: './logs/telegram-bot-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        // Memory management
        max_memory_restart: '200M'
    }, {
        name: 'discord-bot',
        script: 'dist/discord-bot.js',
        instances: 1,
        env: {
            NODE_ENV: 'production'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        // Restart settings
        max_restarts: 10,
        restart_delay: 5000,
        // Logs
        log_file: './logs/discord-bot.log',
        out_file: './logs/discord-bot-out.log',
        error_file: './logs/discord-bot-error.log',
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        // Memory management
        max_memory_restart: '200M'
    }],

    // Deployment configuration
    deploy: {
        production: {
            user: 'deploy',
            host: 'your-server.com',
            ref: 'origin/main',
            repo: 'git@github.com:username/solana-alerts.git',
            path: '/var/www/solana-alerts',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
}; 