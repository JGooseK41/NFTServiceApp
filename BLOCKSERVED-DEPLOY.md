# BlockServed.com Deployment Instructions

## The Problem
BlockServed.com is currently showing the old purple `recipient.html` file instead of the new professional `index-blockserved.html` file.

## Solution - Separate Netlify Site for BlockServed

### Option 1: Update Existing BlockServed Netlify Site

1. Go to your BlockServed Netlify site dashboard
2. Go to **Site configuration** → **Build & deploy** → **Continuous deployment**
3. Update the build settings:
   - **Base directory**: (leave blank)
   - **Build command**: (leave blank)
   - **Publish directory**: `.`

4. Go to **Deploys** → **Deploy settings**
5. Create a new file called `_redirects` in the root with this content:
```
# API proxy to Render backend
/api/* https://nftserviceapp.onrender.com/api/:splat 200

# Main app serves the new professional BlockServed interface
/* /index-blockserved.html 200
```

### Option 2: Create New Netlify Site for BlockServed

1. Create a new folder with just the BlockServed files:
```bash
mkdir blockserved-site
cp index-blockserved.html blockserved-site/index.html
cp blockserved-redirects blockserved-site/_redirects
```

2. Deploy to Netlify:
```bash
cd blockserved-site
npx netlify-cli deploy --prod
```

3. Add custom domain `blockserved.com` to this new site

### Option 3: Use Netlify.toml Domain Routing (Current Setup Fix)

If BlockServed.com is pointing to the same Netlify site as TheBlockService.com, you need domain-based routing:

1. Create/update `netlify.toml` in the root:
```toml
# Domain-based routing
[[redirects]]
  from = "https://blockserved.com/*"
  to = "/index-blockserved.html"
  status = 200
  force = true
  
[[redirects]]
  from = "https://www.blockserved.com/*"
  to = "/index-blockserved.html"
  status = 200
  force = true

# API proxy for BlockServed
[[redirects]]
  from = "https://blockserved.com/api/*"
  to = "https://nftserviceapp.onrender.com/api/:splat"
  status = 200
  
[[redirects]]
  from = "https://www.blockserved.com/api/*"
  to = "https://nftserviceapp.onrender.com/api/:splat"
  status = 200
```

## Verification

After deployment, visit https://blockserved.com and you should see:
- Professional white/gray design with navy blue header
- "BlockServed - Official Legal Notice Portal" title
- Clear messaging about legal documents
- Step-by-step instructions for recipients

## Testing Recipient Access

To test if recipients can see their notices:

1. Ensure the notice was properly served and stored in backend
2. Connect with the exact wallet address that was listed as a recipient
3. Check browser console for any errors
4. The API endpoint should be: `/api/recipient-access/recipient/{wallet}/notices`

## Troubleshooting

If notices aren't showing:
1. Check that the wallet address matches exactly (case-sensitive)
2. Verify the case was stored in `case_service_records` table in backend
3. Check that recipients array includes the wallet address
4. Look for CORS errors in browser console
5. Ensure backend is running and accessible