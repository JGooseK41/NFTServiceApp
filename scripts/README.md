# Auto-Faucet Script for Nile Testnet

This script automatically requests TRX tokens from the Nile testnet faucet every 24 hours to keep your contract funded.

## Features

- Automatically checks contract balance every 24 hours
- Requests TRX when balance falls below threshold
- Backup checks every 6 hours in case of failures
- Comprehensive logging
- Manual trigger option
- Configurable balance threshold

## Setup

1. Install dependencies:
```bash
cd scripts
npm install
```

2. Set your contract address:
```bash
export CONTRACT_ADDRESS="your_nile_contract_address_here"
```

Or create a `.env` file:
```env
CONTRACT_ADDRESS=your_nile_contract_address_here
TRON_API_KEY=your_trongrid_api_key_if_needed
```

## Usage

### Start the automated service:
```bash
npm run faucet
```

### Manual faucet request:
```bash
npm run faucet:manual
```

### Check current balance:
```bash
npm run faucet:check
```

## Running as a Background Service

### Using PM2 (recommended):
```bash
npm install -g pm2
pm2 start auto-faucet.js --name "nile-faucet"
pm2 save
pm2 startup
```

### Using systemd (Linux):
Create `/etc/systemd/system/nile-faucet.service`:
```ini
[Unit]
Description=Nile Testnet Auto Faucet
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/NFTServiceApp/scripts
Environment="CONTRACT_ADDRESS=your_contract_address"
ExecStart=/usr/bin/node /path/to/NFTServiceApp/scripts/auto-faucet.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable nile-faucet
sudo systemctl start nile-faucet
```

### Using Docker:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY auto-faucet.js ./
ENV CONTRACT_ADDRESS=your_contract_address
CMD ["node", "auto-faucet.js"]
```

## Configuration

Edit the CONFIG object in `auto-faucet.js`:

- `MIN_BALANCE_THRESHOLD`: Request when balance falls below this (default: 100 TRX)
- `FAUCET_AMOUNT`: Expected amount from faucet (default: 10,000 TRX)
- `LOG_FILE`: Location of log file

## Logs

Logs are saved to `faucet-requests.log` and include:
- Balance checks
- Faucet requests
- Success/failure status
- Timestamps

## Troubleshooting

### Faucet rate limiting
The Nile faucet has rate limits (usually once per day per address). The script handles this gracefully and will retry in the next cycle.

### Connection issues
The script will log errors and continue running. Check logs for details.

### Balance not updating
Faucet transactions may take a few minutes to confirm. The script checks balance 30 seconds after requesting.

## Security Notes

- This is for TESTNET only
- Never share your private keys
- The script only needs your contract address (public)
- No private keys are required for faucet requests

## Alternative Faucets

If the primary faucet fails, you can modify the script to use alternative sources:
- Manual web faucet: https://nileex.io/join/getJoinPage
- Discord faucets
- Telegram bots

## Monitoring

Monitor the service:
```bash
# View logs
tail -f faucet-requests.log

# Check service status (if using PM2)
pm2 status nile-faucet

# Check service logs (if using PM2)
pm2 logs nile-faucet
```