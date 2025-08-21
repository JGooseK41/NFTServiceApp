# Use Node.js 18 Alpine as base
FROM node:18-slim

# Install dependencies for Puppeteer, Ghostscript, and QPDF
RUN apt-get update && apt-get install -y \
    # Puppeteer dependencies
    chromium \
    chromium-sandbox \
    fonts-liberation \
    fonts-noto-color-emoji \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    # PDF processing tools
    ghostscript \
    qpdf \
    poppler-utils \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium instead of downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /opt/render/project/src

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create uploads directory for PDFs
RUN mkdir -p uploads/pdfs

# Expose port
EXPOSE 10000

# Start the application
CMD ["node", "server.js"]