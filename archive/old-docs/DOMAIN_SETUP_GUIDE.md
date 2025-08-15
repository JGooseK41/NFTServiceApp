# Custom Domain Setup Guide for NFTServiceApp

This guide will help you link **theblockservice.com** and **blockserved.com** to your Netlify deployment.

## Prerequisites
- Access to your Netlify account
- Access to your domain registrar (where you purchased the domains)
- Both domains: theblockservice.com and blockserved.com

## Step 1: Add Custom Domains in Netlify

1. **Log into Netlify** and navigate to your site (nftserviceapp)

2. **Go to Domain Settings**:
   - Click on your site
   - Navigate to "Site settings" → "Domain management"

3. **Add Both Domains**:
   - Click "Add custom domain"
   - Add `theblockservice.com`
   - Click "Add custom domain" again
   - Add `blockserved.com`

4. **Set Primary Domain** (Optional):
   - Choose which domain should be primary
   - The other will redirect to the primary
   - For your use case, you might want to keep them separate

## Step 2: Configure DNS

You have two options:

### Option A: Use Netlify DNS (Recommended)
1. In Netlify domain settings, click "Set up Netlify DNS" for each domain
2. Netlify will provide nameservers (usually 4)
3. Go to your domain registrar and update nameservers to Netlify's

**Netlify Nameservers (example):**
```
dns1.p01.nsone.net
dns2.p01.nsone.net
dns3.p01.nsone.net
dns4.p01.nsone.net
```

### Option B: Use Your Current DNS Provider
Add these records at your DNS provider:

**For theblockservice.com:**
```
Type: A
Name: @
Value: 75.2.60.5

Type: CNAME
Name: www
Value: nftserviceapp.netlify.app
```

**For blockserved.com:**
```
Type: A
Name: @
Value: 75.2.60.5

Type: CNAME
Name: www
Value: nftserviceapp.netlify.app
```

## Step 3: SSL Certificate Setup

1. **Wait for DNS Propagation** (5 minutes to 48 hours)
2. In Netlify, go to "Domain settings" → "HTTPS"
3. Click "Verify DNS configuration"
4. Once verified, click "Provision certificate"
5. Netlify will automatically provision Let's Encrypt SSL certificates

## Step 4: Configure Redirects

Your `_redirects` file already handles the short URL format:
```
/n/*  /#notice-:splat  200!
```

This means `blockserved.com/n/123` will work automatically.

## Step 5: Verify Everything Works

### Test Each Domain:
1. **Basic Access**:
   - Visit https://theblockservice.com
   - Visit https://blockserved.com

2. **Feature Visibility**:
   - theblockservice.com should show process server features
   - blockserved.com should show recipient features

3. **Short URLs**:
   - Test a notice URL: https://blockserved.com/n/123

4. **SSL/HTTPS**:
   - Ensure padlock icon appears
   - Check that HTTP redirects to HTTPS

## Common Issues & Solutions

### DNS Not Propagating
- Use https://dnschecker.org to verify DNS propagation
- Can take up to 48 hours, but usually much faster

### SSL Certificate Errors
- Ensure DNS is properly configured first
- Click "Renew certificate" in Netlify if needed
- Clear browser cache

### Wrong Features Showing
- Clear browser cache
- Check browser console for JavaScript errors
- Verify SITE_CONFIG in index.html is working

### Email Not Working
If you use email with these domains:
- Keep MX records at your current provider
- Only change A and CNAME records
- Or use Netlify DNS and add MX records there

## Quick Commands for Testing

**Check DNS Records:**
```bash
# Windows
nslookup theblockservice.com
nslookup blockserved.com

# Mac/Linux
dig theblockservice.com
dig blockserved.com
```

**Test HTTPS:**
```bash
curl -I https://theblockservice.com
curl -I https://blockserved.com
```

## Timeline
- DNS changes: 5 minutes to 48 hours (usually 1-4 hours)
- SSL certificates: Automatic after DNS verification
- Full propagation: 24-48 hours globally

## Support Resources
- Netlify Support: https://www.netlify.com/support/
- Netlify Docs: https://docs.netlify.com/domains-https/custom-domains/
- Your registrar's support (for nameserver changes)

## Next Steps
After domains are connected:
1. Test all features on both domains
2. Update any hardcoded URLs in your app
3. Monitor for any issues in the first 48 hours
4. Set up domain monitoring (optional)

Remember: The app automatically adapts based on the domain, so once DNS is configured, the different features will show automatically!