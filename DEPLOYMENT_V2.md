# V2 Deployment Guide

## Overview
This guide covers deploying V2 of the NFT Legal Service to production using Render (backend) and Netlify (frontend).

## Key V2 Features
- Wallet resources check before minting
- Energy rental integration (3M minimum energy requirement)
- Improved drag-and-drop document queue with reordering
- Alert NFT preview with "LEGAL NOTICE" overlay
- Document NFT preview with full PDF pages
- Disk storage for PDFs on Render

## File Structure
```
NFTServiceApp/
├── index.html (V2 frontend)
├── js-v2/ (V2 JavaScript modules)
│   ├── app.js (main application with wallet resources check)
│   ├── modules/
│   │   ├── wallet.js
│   │   ├── contract.js
│   │   ├── documents.js
│   │   ├── energy.js
│   │   └── ...
├── js/ (V1 scripts including streamlined-energy-flow.js)
├── css-v2/ (V2 styles)
├── backend/ (Node.js backend)
│   ├── server.js
│   ├── routes/
│   │   ├── pdf-disk-storage.js
│   │   └── ...
│   └── middleware/
│       └── validation.js
└── v1-backup/ (V1 backup files)
```

## Render Backend Configuration

### Environment Variables
Set these in Render dashboard:
```
DATABASE_URL=postgresql://...@oregon-postgres.render.com/nftservice_db?sslmode=require
DISK_MOUNT_PATH=/var/data
NODE_ENV=production
PORT=3001
CONTRACT_ADDRESS=<your_contract_address>
```

### Build Command
```bash
cd backend && npm install
```

### Start Command
```bash
cd backend && node server.js
```

### Disk Storage
- Mount path: `/var/data`
- Size: 10GB minimum
- Used for PDF storage

## Netlify Frontend Configuration

### Build Settings
- Base directory: (leave empty)
- Build command: (leave empty - static site)
- Publish directory: `.`

### Environment Variables
None required (frontend connects to Render backend)

### Headers (_headers file)
```
/*
  Access-Control-Allow-Origin: *
```

### Redirects (_redirects file)
```
/api/* https://your-render-backend.onrender.com/api/:splat 200
```

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Deploy V2 with wallet resources check and energy rental"
git push origin main
```

### 2. Render Backend
1. Connect GitHub repo
2. Set environment variables
3. Add disk mount at `/var/data`
4. Deploy

### 3. Netlify Frontend
1. Connect GitHub repo
2. Configure build settings
3. Update _redirects with your Render URL
4. Deploy

## Testing Production

### Verify Functionality
1. Connect TronLink wallet
2. Upload documents
3. Click "Check Wallet Resources" button
4. Verify energy rental modal appears if < 3M energy
5. Test minting process

### API Endpoints
- Backend health: `https://your-backend.onrender.com/health`
- Document upload: `https://your-backend.onrender.com/api/documents/upload`
- PDF storage: `https://your-backend.onrender.com/api/documents/serve-pdf/:filename`

## Rollback Plan
If issues occur, V1 files are backed up in `v1-backup/` directory:
```bash
cp v1-backup/index-v1-original.html index.html
git add .
git commit -m "Rollback to V1"
git push origin main
```

## Monitoring
- Check Render logs for backend errors
- Monitor Netlify deploy logs
- Verify disk usage on Render dashboard
- Check database connections

## Support
- Energy rental uses TronSave API
- Minimum 3M energy enforced
- PDFs stored on Render disk, not in database
- Base64 images only for Alert NFT first page