module.exports = {
  networks: {
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1500000000,
      fullHost: 'https://nile.trongrid.io',
      network_id: '3'
    },
    shasta: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1000000000,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '2'
    },
    mainnet: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1500000000,
      fullHost: 'https://api.trongrid.io',
      network_id: '1'
    }
  },

  // Compiler configuration
  compilers: {
    solc: {
      version: '0.8.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  // Contract build directory
  contracts_build_directory: './build/contracts',
  contracts_directory: './contracts',
  
  // Migrations directory
  migrations_directory: './migrations',
  
  // Network configuration for development
  development: {
    host: "127.0.0.1",
    port: 9090,
    network_id: "*"
  }
};