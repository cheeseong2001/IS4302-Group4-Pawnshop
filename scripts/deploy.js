async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("==============================================");
  console.log("Deploying Pawnshop with account:", deployer.address);
  console.log("==============================================");

  // Put your contracts here
  const Pawnshop = await ethers.getContractFactory("Pawnshop");
  const pawnshop = await Pawnshop.deploy();

  console.log("Deploying Pawnshop...");

  // v5 or v6 installation
  if (typeof pawnshop.deployed === "function") {
    await pawnshop.deployed();
  } else if (typeof pawnshop.waitForDeployment === "function") {
    await pawnshop.waitForDeployment();
  } else {
    await new Promise((r) => setTimeout(r, 2000));
  }

  const addr =
    typeof pawnshop.getAddress === "function"
      ? await pawnshop.getAddress()
      : pawnshop.address;

  console.log("Pawnshop deployed successfully!");
  console.log("Contract address:", addr);
  console.log(`ADDRESS:${addr}`);
  console.log("==============================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
