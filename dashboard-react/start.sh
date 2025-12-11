#!/bin/sh
set -e

# Start mock server in background
node mock-server.js &
MOCK_PID=$!

# Wait for mock server to start
sleep 2

# Start Vite
npm run dev

# Keep processes alive
wait $MOCK_PID
