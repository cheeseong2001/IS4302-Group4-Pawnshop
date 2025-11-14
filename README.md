# IS4302 Group 4 Pawnshop

This project is a P2P Pawnshop on Ethereum. 

## File Structure

### /contracts
This folder defines all the contracts needed to run the application. 
- PawnStorage.sol: The contract defines the storage layer that handles item states and ethers
- PawnCommon.sol: This contract lists common interfaces for both Pledger and Pawnbroker contracts
- Pledger.sol: This contract lists functions that are specific to Pledger's use cases
- Pawnbroker.sol: This contract lists functions that are specific to the Pawnbroker's use cases

### /deploy
This folder contains the deploy.js script, which deploys and initialises the contract permissions. The contracts are only deployed to local network.

### /test
This folder contains all the test files and test cases for the contracts in the /contracts directory.

## Commands
To deploy locally: `npx hardhat deploy`

To run tests: `npx hardhat test` or `npx hardhat test test/<test file>.test.js`

## GUI
After deploying locally, you can use it together with the GUI for the application. [https://github.com/sunclb/blockchain-pawnshop-ui]
