#!/bin/bash

echo "🚀 Setting up MQTT IoT Monitoring System..."

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Remove old farming.db if exists (fresh start)
if [ -f farming.db ]; then
    echo "🗑️  Removing old database..."
    rm farming.db
fi

# Initialize database
echo "🗄️  Initializing database..."
node -e "require('./common/db')"

echo "✅ Setup complete!"
echo "📌 Run the following commands in separate terminals:"
echo "   1. npm start        (Backend server)"
echo "   2. npm run pub      (Publishers)"
echo "   3. npm run sub      (Subscribers)"
echo "   4. Open http://localhost:3001 (Web dashboard)"
