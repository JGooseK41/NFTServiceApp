# Docker Deployment on Render

## What Changed

Your backend will now run in a Docker container with all PDF processing tools pre-installed:
- **Chromium**: For print-to-PDF functionality (bypasses encryption)
- **Ghostscript**: For PDF repair and conversion
- **QPDF**: For cleaning corrupt PDFs
- **Poppler**: Additional PDF utilities

## Deployment Steps

### 1. Deploy to Render

Since you already have a Render deployment:

1. Go to your Render dashboard
2. Navigate to your `nft-legal-service-backend` service
3. The next deploy will automatically detect the Docker configuration
4. Render will build the Docker image (takes ~5-10 minutes first time)
5. Your service will restart with full PDF processing capabilities

### 2. Verify Deployment

After deployment, your PDF processing will have these strategies available:
- ✅ Print-to-PDF (Puppeteer with Chromium)
- ✅ Ghostscript conversion
- ✅ QPDF cleaning
- ✅ PDF reconstruction for severely corrupted files

### 3. What to Expect

**Build Time**: 
- First Docker build: 5-10 minutes
- Subsequent builds: 2-3 minutes (cached)

**Memory Usage**:
- Slightly higher due to Chromium (~200MB more)
- Still within free tier limits

**PDF Processing**:
- Encrypted PDFs: Will be properly decrypted
- Corrupt PDFs: Will be repaired or reconstructed
- All pages will be extracted correctly

## Troubleshooting

If the Docker build fails:

1. **Check Build Logs**: Look for any package installation errors
2. **Memory Issues**: Ensure your Render plan has enough memory
3. **Fallback**: You can revert by changing `runtime: docker` back to `runtime: node` in render.yaml

## Testing After Deployment

Test with your problematic PDFs:
- "3 Complaint.pdf" - Should extract all 37 pages with content
- "7 NFT Summons Issued.pdf" - Should properly handle all 5 pages

## Environment Variables

No new environment variables needed. The Dockerfile sets:
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` 
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

These tell Puppeteer to use the system-installed Chromium instead of downloading its own.