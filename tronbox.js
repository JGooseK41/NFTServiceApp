module.exports = {
    networks: {
        nile: {
            privateKey: process.env.NILE_PRIVATE_KEY || process.env.PRIVATE_KEY,
            fullHost: "https://nile.trongrid.io",
            network_id: "3"
        },
        mainnet: {
            privateKey: process.env.PRIVATE_KEY,
            fullHost: "https://api.trongrid.io",
            network_id: "1"
        }
    },
    compilers: {
        solc: {
            version: "0.8.6",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    }
};
