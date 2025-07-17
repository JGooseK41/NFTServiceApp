const TronWeb = require('tronweb');
require('dotenv').config();

const hexAddress = '4154ec9a7b77c8caae5d2e8f1ce3663d80d417ff0f';
const base58Address = TronWeb.address.fromHex(hexAddress);

console.log('Hex Address:', hexAddress);
console.log('Base58 Address:', base58Address);
console.log('Explorer URL:', `https://nile.tronscan.org/#/contract/${base58Address}`);