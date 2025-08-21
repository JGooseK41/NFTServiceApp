#!/bin/bash
# Build script for Render to install PDF tools

echo "📦 Installing PDF processing tools..."

# Update package list
apt-get update -qq

# Install PDF tools
apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    poppler-utils \
    wkhtmltopdf \
    chromium-browser \
    chromium-chromedriver \
    || echo "⚠️ Some tools failed to install, continuing..."

# Set Chromium path for Puppeteer
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install Node dependencies
npm ci --only=production

echo "✅ Build complete!"