module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying contracts with account:", deployer);

  // Deploy Dice
  const pawnShopItems = await deploy("PawnshopItems", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log("pawnShopItems deployed to:", pawnShopItems.address);
  const pawnShop = await deploy("Pawnshop", {
    from: deployer,
    args: [pawnShopItems.address],
    log: true,
  });
  console.log("pawnShop deployed to:", pawnShop.address);

  // Set authorized pawnshop in PawnshopItems contract
  const pawnShopItemsContract = await ethers.getContractAt(
    "PawnshopItems",
    pawnShopItems.address
  );
  await pawnShopItemsContract.setAuthorizedPawnshop(pawnShop.address);
  console.log("Set authorized pawnshop to:", pawnShop.address);
};

module.exports.tags = ["PawnshopItems", "Pawnshop"];
