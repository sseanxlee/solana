#!/bin/bash

# Solana Token Alerts - Setup Script
echo "🚨 Setting up Solana Token Alerts MVP..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Copy environment template
if [ ! -f ".env" ]; then
    echo "📝 Creating environment configuration..."
    cp env.example .env
    echo "✅ Environment file created at .env"
    echo "⚠️  Please edit .env with your configuration values"
else
    echo "ℹ️  Environment file already exists"
fi

# Create frontend environment file
if [ ! -f "frontend/.env.local" ]; then
    echo "📝 Creating frontend environment configuration..."
    cat > frontend/.env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
EOL
    echo "✅ Frontend environment file created"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env with your configuration:"
echo "   - DATABASE_URL (PostgreSQL)"
echo "   - REDIS_URL"
echo "   - MORALIS_API_KEY"
echo "   - SENDGRID_API_KEY"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - JWT_SECRET"
echo ""
echo "2. Set up your database:"
echo "   cd backend && npm run migrate"
echo ""
echo "3. Start the development servers:"
echo "   npm run dev"
echo ""
echo "🌐 The app will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "📖 For detailed setup instructions, see README.md" 