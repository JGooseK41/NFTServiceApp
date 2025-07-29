const LegalNoticeNFT = artifacts.require("LegalNoticeNFT_Complete_WithIPFS");

module.exports = function(deployer, network, accounts) {
  console.log("Deploying LegalNoticeNFT_Complete_WithIPFS...");
  console.log("Network:", network);
  console.log("Deployer account:", accounts[0]);
  
  deployer.deploy(LegalNoticeNFT)
    .then(() => {
      console.log("Contract deployed at:", LegalNoticeNFT.address);
      console.log("\nPost-deployment steps:");
      console.log("1. Update contract address in index.html");
      console.log("2. Grant admin roles if needed");
      console.log("3. Set fee collector address");
      console.log("4. Configure any law enforcement exemptions");
    });
};