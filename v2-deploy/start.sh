#!/bin/bash

echo "Starting LegalNotice v2..."
echo "Server will run at: http://localhost:8080"
echo "Press Ctrl+C to stop"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
# Check if Python 2 is available
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080
# Check if Node.js is available
elif command -v npx &> /dev/null; then
    npx http-server -p 8080
else
    echo "Error: No suitable web server found."
    echo "Please install Python or Node.js"
    exit 1
fi