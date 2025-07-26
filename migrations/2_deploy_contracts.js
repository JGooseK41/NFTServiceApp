const LegalNoticeNFT_Simplified = artifacts.require("LegalNoticeNFT_Simplified");

module.exports = function(deployer, network, accounts) {
  // Deploy the contract
  deployer.deploy(LegalNoticeNFT_Simplified).then(async () => {
    const instance = await LegalNoticeNFT_Simplified.deployed();
    console.log("Contract deployed at:", instance.address);
    
    // If we have a fee collector address set, update it
    const feeCollector = process.env.FEE_COLLECTOR_ADDRESS;
    if (feeCollector && feeCollector !== accounts[0]) {
      console.log("Setting fee collector to:", feeCollector);
      await instance.updateFeeCollector(feeCollector);
    }
  });
};