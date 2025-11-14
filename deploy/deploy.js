module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying contracts with account:", deployer);

  const pawnStorageContract = await deploy("PawnStorage", {
    from: deployer,
    args: [],
    log: true,
  });
  console.log("pawnStorageContract deployed to:", pawnStorageContract.address);

  const pawnbrokerContract = await deploy("Pawnbroker", {
    from: deployer,
    args: [pawnStorageContract.address],
    log: true,
  });
  console.log("pawnbrokerContract deployed to:", pawnbrokerContract.address);

  const pledgerContract = await deploy("Pledger", {
    from: deployer,
    args: [pawnStorageContract.address],
    log: true,
  });
  console.log("pledgerContract deployed to:", pledgerContract.address);

  await execute("PawnStorage", { from: deployer }, "addTrustedCaller", pledgerContract.address);
  await execute("PawnStorage", { from: deployer }, "addTrustedCaller", pawnbrokerContract.address);
  
  // Ideally this should not be the case, but it is required for the demo to alter recorded times in PawnItem
  await execute("PawnStorage", { from: deployer }, "addTrustedCaller", deployer); 
};

module.exports.tags = ["Pawnshop"];
