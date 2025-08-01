# Netlify Custom Domain Setup Guide

This comprehensive guide will walk you through linking **theblockservice.com** and **blockserved.com** to your NFTServiceApp on Netlify.

## Prerequisites

Before starting, ensure you have:
- Access to your Netlify account with the NFTServiceApp deployed
- Access to your domain registrar's DNS management panel
- Administrative access to your domain settings

## Table of Contents

1. [Adding Custom Domains in Netlify](#1-adding-custom-domains-in-netlify)
2. [DNS Configuration Requirements](#2-dns-configuration-requirements)
3. [SSL Certificate Setup](#3-ssl-certificate-setup)
4. [Domain Ownership Verification](#4-domain-ownership-verification)
5. [Common Issues and Troubleshooting](#5-common-issues-and-troubleshooting)
6. [Best Practices](#6-best-practices)

---

## 1. Adding Custom Domains in Netlify

### Step 1: Access Domain Settings

1. **Log into Netlify**: Go to [netlify.com](https://netlify.com) and sign in
2. **Select Your Site**: Navigate to your NFTServiceApp site dashboard
3. **Open Domain Settings**: Click on "Domain settings" in the left sidebar

### Step 2: Add Your First Custom Domain

1. **Add Domain**: Click the "Add custom domain" button
2. **Enter Domain**: Type `theblockservice.com` and click "Verify"
3. **Confirm Ownership**: Netlify will ask if you own this domain - click "Yes, add domain"
4. **Set as Primary** (Optional): If this should be your primary domain, click "Options" → "Set as primary domain"

### Step 3: Add Your Second Custom Domain

1. **Add Another Domain**: Click "Add custom domain" again
2. **Enter Domain**: Type `blockserved.com` and click "Verify"
3. **Confirm Ownership**: Click "Yes, add domain"

### Step 4: Configure Domain Redirects (Optional)

If you want one domain to redirect to the other:
1. **Access Redirects**: Go to "Site settings" → "Build & deploy" → "Post processing"
2. **Add Redirect Rule**: Add a redirect rule like:
   ```
   https://blockserved.com/* https://theblockservice.com/:splat 301!
   ```

---

## 2. DNS Configuration Requirements

### For theblockservice.com

#### Option A: Using Netlify DNS (Recommended)
1. **Change Nameservers**: Update your domain's nameservers to Netlify's:
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`
   - `dns3.p01.nsone.net`
   - `dns4.p01.nsone.net`

#### Option B: Using External DNS
Add these DNS records at your domain registrar:

**For Root Domain (theblockservice.com):**
```
Type: A
Name: @ (or leave blank)
Value: 75.2.60.5
TTL: 3600
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www
Value: your-site-name.netlify.app
TTL: 3600
```

### For blockserved.com

Follow the same DNS configuration as above, using the same Netlify IP address and your site's Netlify URL.

### Advanced DNS Records (Optional)

**Email Forwarding (if needed):**
```
Type: MX
Name: @
Value: 10 mail.example.com
TTL: 3600
```

**Subdomain Setup:**
```
Type: CNAME
Name: app
Value: your-site-name.netlify.app
TTL: 3600
```

---

## 3. SSL Certificate Setup

Netlify automatically handles SSL certificates for custom domains using Let's Encrypt.

### Automatic SSL Certificate Provisioning

1. **Wait for DNS Propagation**: After adding your domains, wait 24-48 hours for DNS changes to propagate
2. **Certificate Generation**: Netlify will automatically generate SSL certificates
3. **Verify HTTPS**: Check that your domains work with `https://`

### Force HTTPS Redirect

1. **Enable HTTPS**: In your Netlify site settings, go to "Domain settings"
2. **Force HTTPS**: Toggle on "Force HTTPS" to redirect all HTTP traffic to HTTPS
3. **HSTS** (Optional): Enable HTTP Strict Transport Security for additional security

### Certificate Renewal

- Netlify automatically renews SSL certificates before expiration
- No manual intervention required
- Certificates are valid for 90 days and renewed every 60 days

---

## 4. Domain Ownership Verification

### Method 1: DNS Verification (Recommended)

1. **Verification Record**: Netlify will provide a TXT record for verification
2. **Add TXT Record**: Add this record to your DNS:
   ```
   Type: TXT
   Name: _netlify
   Value: [provided verification code]
   TTL: 3600
   ```
3. **Verify**: Click "Verify DNS configuration" in Netlify

### Method 2: File Upload Verification

1. **Download File**: Netlify provides a verification file
2. **Upload to Root**: Place the file in your site's root directory
3. **Deploy**: Push changes or manually deploy
4. **Verify**: Netlify will check for the file at your domain

### Method 3: HTML Meta Tag

1. **Get Meta Tag**: Netlify provides an HTML meta tag
2. **Add to HTML**: Add the tag to your `index.html` file's `<head>` section:
   ```html
   <meta name="netlify-domain-verification" content="[verification-code]" />
   ```
3. **Deploy and Verify**: Deploy your site and verify in Netlify

---

## 5. Common Issues and Troubleshooting

### Issue 1: DNS Not Propagating

**Symptoms:**
- Domain shows "Site not found" error
- DNS changes not taking effect

**Solutions:**
1. **Check DNS Propagation**: Use [whatsmydns.net](https://whatsmydns.net) to check global DNS propagation
2. **Clear DNS Cache**: 
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemctl restart systemd-resolved`
3. **Wait Longer**: DNS propagation can take up to 48 hours

### Issue 2: SSL Certificate Not Provisioning

**Symptoms:**
- "Not secure" warning in browser
- SSL certificate errors

**Solutions:**
1. **Check DNS Configuration**: Ensure A records point to Netlify's IP
2. **Verify Domain Ownership**: Complete domain verification process
3. **Check CAA Records**: Ensure no conflicting Certificate Authority Authorization records
4. **Contact Support**: If issues persist after 48 hours

### Issue 3: Mixed Content Warnings

**Symptoms:**
- HTTPS pages loading HTTP resources
- Browser security warnings

**Solutions:**
1. **Update Resource URLs**: Change all HTTP links to HTTPS in your HTML/JS
2. **Use Protocol-Relative URLs**: Use `//` instead of `http://` or `https://`
3. **Check Third-Party Scripts**: Ensure all external scripts support HTTPS

### Issue 4: Redirect Loops

**Symptoms:**
- "Too many redirects" error
- Pages continuously redirecting

**Solutions:**
1. **Check Redirect Rules**: Review your `_redirects` file for conflicts
2. **Disable Force HTTPS Temporarily**: Test without HTTPS redirect
3. **Clear Browser Cache**: Clear cache and cookies for affected domains

### Issue 5: Email Not Working

**Symptoms:**
- Emails not being received
- Mail server errors

**Solutions:**
1. **Check MX Records**: Ensure MX records point to correct mail servers
2. **SPF Records**: Add SPF record for email authentication:
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.example.com ~all
   ```
3. **Contact Email Provider**: Verify settings with your email service provider

---

## 6. Best Practices

### Domain Management

1. **Use Primary Domain**: Set one domain as primary to avoid duplicate content issues
2. **Implement Redirects**: Redirect secondary domains to primary domain
3. **Monitor Certificates**: Regularly check SSL certificate status
4. **Keep DNS Simple**: Use minimal DNS records for better reliability

### Security Best Practices

1. **Enable HSTS**: Force secure connections for better security
2. **Set Security Headers**: Your `netlify.toml` already includes good security headers:
   ```toml
   [headers.values]
     X-Frame-Options = "DENY"
     X-Content-Type-Options = "nosniff"
     X-XSS-Protection = "1; mode=block"
   ```
3. **Regular Updates**: Keep your site and dependencies updated
4. **Monitor Access**: Regularly review Netlify access logs

### Performance Optimization

1. **Use CDN**: Netlify's global CDN automatically serves your content
2. **Enable Caching**: Your current cache headers are well-configured
3. **Compress Assets**: Enable asset optimization in Netlify settings
4. **Monitor Performance**: Use tools like Google PageSpeed Insights

### Monitoring and Maintenance

1. **Set Up Alerts**: Configure uptime monitoring
2. **Regular Backups**: Keep backups of your DNS configuration
3. **Document Changes**: Keep a record of all DNS and domain changes
4. **Test Regularly**: Periodically test all domain configurations

---

## Quick Reference Commands

### DNS Troubleshooting Commands

```bash
# Check DNS resolution
nslookup theblockservice.com
dig theblockservice.com

# Check specific record types
dig theblockservice.com A
dig theblockservice.com CNAME
dig theblockservice.com TXT

# Trace DNS resolution
dig +trace theblockservice.com
```

### Testing Your Setup

1. **Test Domain Resolution**: Visit both domains in your browser
2. **Check HTTPS**: Ensure both `http://` and `https://` work correctly
3. **Test Redirects**: Verify www redirects work if configured
4. **Mobile Testing**: Test on mobile devices and different networks

---

## Support and Resources

- **Netlify Documentation**: [docs.netlify.com](https://docs.netlify.com)
- **Netlify Support**: Available through your Netlify dashboard
- **DNS Propagation Checker**: [whatsmydns.net](https://whatsmydns.net)
- **SSL Checker**: [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/)

---

## Conclusion

Following this guide should successfully link both theblockservice.com and blockserved.com to your NFTServiceApp on Netlify. The process typically takes 24-48 hours for full propagation, but most changes are visible within a few hours.

Remember to:
- Be patient with DNS propagation
- Test thoroughly after setup
- Monitor for any issues in the first few days
- Keep your domain registrar and Netlify settings documented

If you encounter any issues not covered in this guide, don't hesitate to contact Netlify support or consult their comprehensive documentation.