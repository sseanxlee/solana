-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) UNIQUE,
  email VARCHAR(255),
  telegram_chat_id VARCHAR(255) UNIQUE,
  discord_user_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create token_alerts table
CREATE TABLE IF NOT EXISTS token_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_address VARCHAR(44) NOT NULL,
  token_name VARCHAR(255),
  token_symbol VARCHAR(10),
  threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('price', 'market_cap')),
  threshold_value DECIMAL(20, 8) NOT NULL,
  condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'telegram', 'discord', 'extension')),
  circulating_supply DECIMAL(30, 8),
  current_market_cap DECIMAL(30, 2),
  is_active BOOLEAN DEFAULT TRUE,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP,
  cleared_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create token_data table for caching
CREATE TABLE IF NOT EXISTS token_data (
  address VARCHAR(44) PRIMARY KEY,
  name VARCHAR(255),
  symbol VARCHAR(10),
  price DECIMAL(20, 8),
  market_cap DECIMAL(30, 2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES token_alerts(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'telegram', 'discord', 'extension')),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

-- Create user_presets table for customizable percentage buttons
CREATE TABLE IF NOT EXISTS user_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preset_type VARCHAR(20) NOT NULL CHECK (preset_type IN ('price_increase', 'price_decrease')),
  percentages INTEGER[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, preset_type)
);

-- Create discord_linking_tokens table for seamless Discord account linking
CREATE TABLE IF NOT EXISTS discord_linking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  discord_user_id VARCHAR(255) NOT NULL,
  discord_username VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  wallet_address VARCHAR(44),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create extension_linking_tokens table for Chrome extension linking
CREATE TABLE IF NOT EXISTS extension_linking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  connection_id VARCHAR(100) NOT NULL,
  extension_id VARCHAR(100),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  wallet_address VARCHAR(44),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_extensions table to track linked Chrome extensions
CREATE TABLE IF NOT EXISTS user_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  connection_id VARCHAR(100) NOT NULL,
  extension_token VARCHAR(512) NOT NULL,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_alerts_user_id ON token_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_token_alerts_token_address ON token_alerts(token_address);
CREATE INDEX IF NOT EXISTS idx_token_alerts_active ON token_alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_presets_user_id ON user_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_linking_tokens_token ON discord_linking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_discord_linking_tokens_expires ON discord_linking_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_discord_linking_tokens_discord_user_id ON discord_linking_tokens(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_extension_linking_tokens_token ON extension_linking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_extension_linking_tokens_expires ON extension_linking_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_extension_linking_tokens_connection_id ON extension_linking_tokens(connection_id);
CREATE INDEX IF NOT EXISTS idx_user_extensions_user_id ON user_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_extensions_connection_id ON user_extensions(connection_id);
CREATE INDEX IF NOT EXISTS idx_user_extensions_extension_token ON user_extensions(extension_token);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_token_alerts_updated_at ON token_alerts;
CREATE TRIGGER update_token_alerts_updated_at 
  BEFORE UPDATE ON token_alerts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_presets_updated_at ON user_presets;
CREATE TRIGGER update_user_presets_updated_at 
  BEFORE UPDATE ON user_presets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 