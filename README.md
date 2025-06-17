# Solana Token Alerts

A comprehensive token alert system for Solana blockchain tokens with real-time price monitoring and multi-channel notifications.

## Overview

This full-stack application enables users to create and manage price alerts for Solana tokens, including newly launched tokens from Pump.fun. The system provides real-time monitoring with automated notifications via email and Telegram when price or market cap thresholds are reached.

## Key Features

- **Phantom Wallet Authentication**: Secure sign-in using Solana wallet signatures with SIWS (Sign-In With Solana)
- **Real-time Token Monitoring**: Automated price checking every 60 seconds with intelligent alert triggering
- **Dual Notification System**: Email notifications via SendGrid and Telegram bot integration
- **Alert Management**: Create, update, and delete price/market cap alerts with customizable thresholds
- **Auto-cleanup**: Alerts automatically disable after triggering to prevent spam

## Technology Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Phantom Wallet Integration  
**Backend**: Node.js, Express, TypeScript, JWT Authentication  
**Database**: PostgreSQL with optimized indexes  
**Cache/Queue**: Redis for notification processing  
**External APIs**: Moralis API (primary), Jupiter API (fallback), SendGrid, Telegram Bot API  
**Security**: Rate limiting, input validation, SQL injection protection

## Architecture

```
Frontend (Next.js)     Backend (Express)     External APIs
     │                      │                     │
     ├─ Phantom Wallet ─────┼─ Auth Service ─────┤
     ├─ Dashboard ──────────┼─ Alert Service ────┼─ Moralis API
     ├─ Alert Management ───┼─ Token Service ────┼─ Jupiter API  
     └─ Profile Settings ───┼─ Notification ─────┼─ SendGrid
                             │   Service          │─ Telegram Bot
                             │                    │
                             ├─ PostgreSQL ───────┤
                             ├─ Redis Queue ──────┤
                             └─ Monitoring ───────┘
```

## Database Schema

The application uses PostgreSQL with two primary tables:

**Users**: Stores wallet addresses, email, and Telegram chat IDs for notification routing  
**Token Alerts**: Manages alert configurations including token addresses, threshold values, conditions, and trigger states

## API Endpoints

- Authentication: Nonce generation and wallet signature verification
- Alert Management: CRUD operations for user alerts with validation
- Token Data: Real-time price and market cap retrieval
- Admin: System monitoring and manual alert testing

## Security Features

- Cryptographic wallet signature verification
- JWT-based session management with secure token handling
- Comprehensive rate limiting and input validation
- Parameterized database queries preventing SQL injection
- CORS configuration for cross-origin request protection
