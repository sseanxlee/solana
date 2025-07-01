import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

const createTables = async () => {
  try {
    console.log('Starting database migration...');

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(44) UNIQUE NOT NULL,
        email VARCHAR(255),
        telegram_chat_id VARCHAR(255),
        discord_user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create token_alerts table
    await query(`
      CREATE TABLE IF NOT EXISTS token_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_address VARCHAR(44) NOT NULL,
        token_name VARCHAR(255),
        token_symbol VARCHAR(10),
        threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('price', 'market_cap')),
        threshold_value DECIMAL(20, 8) NOT NULL,
        condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
        notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'telegram', 'discord')),
        is_active BOOLEAN DEFAULT TRUE,
        is_triggered BOOLEAN DEFAULT FALSE,
        triggered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create token_data table for caching
    await query(`
      CREATE TABLE IF NOT EXISTS token_data (
        address VARCHAR(44) PRIMARY KEY,
        name VARCHAR(255),
        symbol VARCHAR(10),
        price DECIMAL(20, 8),
        market_cap DECIMAL(30, 2),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create notification_queue table
    await query(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id UUID REFERENCES token_alerts(id) ON DELETE CASCADE,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'telegram', 'discord')),
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      );
    `);

    // Create indexes for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_token_alerts_user_id ON token_alerts(user_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_token_alerts_token_address ON token_alerts(token_address);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_token_alerts_active ON token_alerts(is_active) WHERE is_active = TRUE;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';
    `);

    // Create updated_at trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for updated_at
    await query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_token_alerts_updated_at ON token_alerts;
      CREATE TRIGGER update_token_alerts_updated_at 
        BEFORE UPDATE ON token_alerts 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Additional migration to remove NOT NULL constraint from telegram_chat_id
    // This handles existing tables that might have the constraint
    try {
      await query('ALTER TABLE users ALTER COLUMN telegram_chat_id DROP NOT NULL;');
      console.log('Successfully removed NOT NULL constraint from telegram_chat_id');
    } catch (error: any) {
      // This might fail if the constraint doesn't exist, which is fine
      console.log('Note: Could not remove NOT NULL constraint (may not exist):', error.message);
    }

    // Add new columns to token_alerts table for market cap functionality
    try {
      await query('ALTER TABLE token_alerts ADD COLUMN IF NOT EXISTS circulating_supply DECIMAL(30, 8);');
      console.log('Successfully added circulating_supply column to token_alerts');
    } catch (error: any) {
      console.log('Note: Could not add circulating_supply column (may already exist):', error.message);
    }

    try {
      await query('ALTER TABLE token_alerts ADD COLUMN IF NOT EXISTS current_market_cap DECIMAL(30, 2);');
      console.log('Successfully added current_market_cap column to token_alerts');
    } catch (error: any) {
      console.log('Note: Could not add current_market_cap column (may already exist):', error.message);
    }

    // Add discord_user_id column to users table if it doesn't exist
    try {
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_user_id VARCHAR(255);');
      console.log('Successfully added discord_user_id column to users');
    } catch (error: any) {
      console.log('Note: Could not add discord_user_id column (may already exist):', error.message);
    }

    // Add unique constraint to discord_user_id if not exists
    try {
      await query('ALTER TABLE users ADD CONSTRAINT users_discord_user_id_unique UNIQUE (discord_user_id);');
      console.log('Successfully added unique constraint to discord_user_id');
    } catch (error: any) {
      console.log('Note: Could not add unique constraint to discord_user_id (may already exist):', error.message);
    }

    // Update notification_type check constraint to include 'discord'
    try {
      await query('ALTER TABLE token_alerts DROP CONSTRAINT IF EXISTS token_alerts_notification_type_check;');
      await query('ALTER TABLE token_alerts ADD CONSTRAINT token_alerts_notification_type_check CHECK (notification_type IN (\'email\', \'telegram\', \'discord\'));');
      console.log('Successfully updated notification_type check constraint to include discord');
    } catch (error: any) {
      console.log('Note: Could not update notification_type constraint:', error.message);
    }

    // Update notification_queue type check constraint to include 'discord'
    try {
      await query('ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_type_check;');
      await query('ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_type_check CHECK (type IN (\'email\', \'telegram\', \'discord\'));');
      console.log('Successfully updated notification_queue type check constraint to include discord');
    } catch (error: any) {
      console.log('Note: Could not update notification_queue type constraint:', error.message);
    }

    // Add cleared_at column to token_alerts table
    try {
      await query('ALTER TABLE token_alerts ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;');
      console.log('Successfully added cleared_at column to token_alerts');
    } catch (error: any) {
      console.log('Note: Could not add cleared_at column (may already exist):', error.message);
    }

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('Migration finished. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export { createTables }; 