const LegalNoticeNFT_Lite_v2 = artifacts.require("LegalNoticeNFT_Lite_v2");

module.exports = function(deployer, network, accounts) {
  // Fee configuration (in SUN: 1 TRX = 1,000,000 SUN)
  const serviceFee = process.env.SERVICE_FEE || '10000000';        // 10 TRX
  const recipientFunding = process.env.RECIPIENT_FUNDING || '10000000'; // 10 TRX

  console.log("Deploying LegalNoticeNFT_Lite_v2...");
  console.log("Network:", network);
  console.log("Deployer:", accounts[0]);
  console.log("Service Fee:", serviceFee, "SUN (" + (serviceFee / 1000000) + " TRX)");
  console.log("Recipient Funding:", recipientFunding, "SUN (" + (recipientFunding / 1000000) + " TRX)");

  deployer.deploy(LegalNoticeNFT_Lite_v2, serviceFee, recipientFunding)
    .then(async () => {
      const instance = await LegalNoticeNFT_Lite_v2.deployed();
      console.log("\n✅ Contract deployed at:", instance.address);
      console.log("\nPost-deployment steps:");
      console.log("1. Update contractAddress in js-v2/config.js (mainnet section)");
      console.log("2. Authorize process server wallets with setServer()");
      console.log("3. Verify fee configuration with getFeeConfig()");
    });
};
