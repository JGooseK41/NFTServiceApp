# Backend Deployment Guide

## Overview

The NFT Legal Service now includes an optional backend service that provides:
- IP tracking and audit trails for legal compliance
- Process server registry
- Notice view and acceptance tracking
- Export capabilities for legal documentation

## Deployment Steps

### 1. Deploy Backend on Render

1. **Create Render Account**
   - Sign up at [render.com](https://render.com)
   - Connect your GitHub account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository
   - Select the `/backend` directory as the root directory
   - Use these settings:
     - Name: `nft-legal-service-backend`
     - Runtime: Node
     - Build Command: `npm install`
     - Start Command: `npm start`

3. **Add PostgreSQL Database**
   - In your Render dashboard, click "New +" → "PostgreSQL"
   - Name: `nft-legal-service-db`
   - Choose the Starter plan (free tier)
   - Click "Create Database"

4. **Configure Environment Variables**
   In your web service settings, add:
   - `DATABASE_URL`: Click "Add from database" and select your PostgreSQL instance
   - `FRONTEND_URL`: Your Netlify URL (e.g., `https://nft-legal-service.netlify.app`)
   - `NODE_ENV`: `production`

5. **Initialize Database**
   - After deployment, go to the "Shell" tab in your Render service
   - Run: `npm run init-db`
   - This creates all necessary tables

### 2. Update Frontend Configuration

1. **Edit Backend URL in Frontend**
   In `index.html`, update line 4603:
   ```javascript
   window.BACKEND_API_URL = window.location.hostname === 'localhost' 
       ? 'http://localhost:3001' 
       : 'https://your-backend-url.onrender.com'; // Replace with your Render URL
   ```

2. **Commit and Push Changes**
   ```bash
   git add index.html
   git commit -m "Update backend URL for production"
   git push
   ```

3. **Netlify Auto-Deploy**
   - Netlify will automatically detect the push and redeploy
   - The frontend will now connect to your backend

## Features Enabled by Backend

### 1. IP Tracking & Audit Trails
- Every notice view is logged with IP and location data
- Process servers can view complete audit trails
- Export audit reports for legal proceedings

### 2. Process Server Registry
- Approved process servers listed in the app
- Contact information and jurisdictions
- Performance metrics and ratings

### 3. Enhanced Legal Compliance
- Proof of viewing with IP/location data
- Acceptance tracking with cryptographic proof
- Exportable reports for court submissions

## Testing the Integration

1. **View a Notice**
   - Visit your app as a recipient
   - View a notice
   - Check backend logs to confirm tracking

2. **Check Audit Trail**
   - As a process server, click "Audit Trail" on a served notice
   - Verify IP and location data appears
   - Test export functionality

3. **Database Verification**
   - In Render dashboard, go to your database
   - Click "Connect" → "PSQL Command"
   - Run: `SELECT * FROM notice_views;`

## Costs

- **Render Free Tier**: 
  - 750 hours/month (enough for 1 service)
  - PostgreSQL: 1GB storage, 90 days retention
  - Suitable for testing and small scale

- **Production Recommendations**:
  - Upgrade to Starter plan ($7/month) for:
    - Always-on service (no sleep)
    - Better performance
    - Automatic backups

## Security Considerations

1. **API Security**
   - Currently uses CORS for basic protection
   - Consider adding API keys for production
   - Implement rate limiting for public endpoints

2. **Data Privacy**
   - IP addresses are stored for legal compliance
   - Ensure compliance with local privacy laws
   - Consider data retention policies

3. **Database Backups**
   - Enable automatic backups in Render
   - Download periodic backups for legal records

## Monitoring

1. **Render Dashboard**
   - Monitor service health
   - Check logs for errors
   - Track resource usage

2. **Database Monitoring**
   - Monitor connection count
   - Check storage usage
   - Review slow queries

## Troubleshooting

### Backend Not Responding
1. Check Render dashboard for service status
2. View logs for error messages
3. Verify environment variables are set
4. Check database connection

### CORS Errors
1. Verify `FRONTEND_URL` is set correctly
2. Include protocol (https://) in the URL
3. No trailing slash on the URL

### Database Connection Failed
1. Check `DATABASE_URL` is properly set
2. Verify database is running
3. Check connection limits

## Optional Enhancements

1. **Custom Domain**
   - Add custom domain in Render settings
   - Update frontend to use custom API URL

2. **Enhanced Security**
   - Add authentication for process servers
   - Implement API rate limiting
   - Add request validation

3. **Performance**
   - Add Redis for caching
   - Implement database indexes
   - Use connection pooling

## Support

For issues with:
- Backend code: Check `/backend/README.md`
- Deployment: Refer to Render documentation
- Database: PostgreSQL documentation
- Frontend integration: See main README.md