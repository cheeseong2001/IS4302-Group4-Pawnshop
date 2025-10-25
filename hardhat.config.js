require("@nomicfoundation/hardhat-toolbox");

require("hardhat-deploy");
require("hardhat-gui");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  deployments: "./deployments",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // first account as deployer
    },
  },
};
