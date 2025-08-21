#!/bin/bash
# Render build script - installs dependencies including Puppeteer with Chromium

echo "📦 Installing Node dependencies and Puppeteer..."

# Remove any Puppeteer cache to ensure clean install
rm -rf ~/.cache/puppeteer

# Install all dependencies including Puppeteer
# This will download Chromium automatically
npm ci

# Try to install additional PDF tools if possible
if command -v apt-get &> /dev/null; then
    echo "📦 Attempting to install system PDF tools..."
    # These might fail due to permissions, but that's OK
    apt-get update 2>/dev/null || true
    apt-get install -y ghostscript qpdf poppler-utils 2>/dev/null || true
fi

echo "✅ Build complete!"
echo "📋 Checking installed tools..."

# Check what's available
command -v gs && echo "✅ Ghostscript installed" || echo "❌ Ghostscript not available"
command -v qpdf && echo "✅ QPDF installed" || echo "❌ QPDF not available"
command -v pdfinfo && echo "✅ Poppler installed" || echo "❌ Poppler not available"

# Check if Puppeteer's Chromium was downloaded
if [ -d ~/.cache/puppeteer ]; then
    echo "✅ Puppeteer Chromium downloaded"
    ls -la ~/.cache/puppeteer/
fi