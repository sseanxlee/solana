# Stride - Solana Token Alert System

A token alert platform for Solana that monitors price movements and sends notifications across Discord, Telegram, email, and browser extension.

## What it does

Set price alerts for any Solana token. Get notified when thresholds are hit via:
- Discord bot with slash commands
- Telegram bot
- Email notifications
- Chrome extension overlay

Connect your Phantom wallet to manage alerts through the web dashboard or create alerts directly from token pages using the browser extension.

## Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Phantom wallet integration  
**Backend**: Node.js/Express, TypeScript, PostgreSQL, Redis  
**Bots**: Discord.js, Telegram Bot API  
**Extension**: Chrome Extension API  
**APIs**: Moralis, Jupiter, Birdeye, Solana streaming  
**Notifications**: SendGrid, WebSockets
