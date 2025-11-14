const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Claim and Delivery Workflow", function () {
  let contractsOwner, addr1, addr2; // addresses of users; addr1 is pledger, addr2 is pawnbroker
  let pledger, pawnbroker;
  let deployedPawnStorage, deployedPledger, deployedPawnbroker; // addresses of deployed contracts
  let pawnStorageAddress, pledgerAddress, pawnbrokerAddress;

  let escrowBalance, addr1BalanceBefore, addr1BalanceAfter, addr2BalanceBefore, addr2BalanceAfter;
  let itemData = {
    itemName: "Laptop",
    itemUrl: "https://example.com/laptop.jpg",
    itemPrice: ethers.parseEther("1.0"),
    redemptionPrice: ethers.parseEther("1.2"),
    punishmentPrice: ethers.parseEther("0.5"),
    redemptionPeriod: 30,
  };

  beforeEach(async function () {
    [contractsOwner, addr1, addr2] = await ethers.getSigners();

    // Deploy PawnStorage first
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.connect(contractsOwner).deploy();
    await deployedPawnStorage.waitForDeployment();
    pawnStorageAddress = await deployedPawnStorage.getAddress();

    pawnbroker = await ethers.getContractFactory("Pawnbroker");
    deployedPawnbroker = await pawnbroker.connect(contractsOwner).deploy(pawnStorageAddress);
    await deployedPawnbroker.waitForDeployment();
    pawnbrokerAddress = await deployedPawnbroker.getAddress();

    // Deploy Pledger - only needs PawnStorage address now
    pledger = await ethers.getContractFactory("Pledger");
    deployedPledger = await pledger.connect(contractsOwner).deploy(pawnStorageAddress);
    await deployedPledger.waitForDeployment();
    pledgerAddress = await deployedPledger.getAddress();

    await deployedPawnStorage.connect(contractsOwner).addTrustedCaller(pledgerAddress);
    await deployedPawnStorage.connect(contractsOwner).addTrustedCaller(pawnbrokerAddress);
  });

  it("Should be able to perform entire claim", async function () {
    // Step 1: pledger create item
    const tx1 = await deployedPledger
      .connect(addr1)
      .createMyItem(
        itemData.itemName,
        itemData.itemUrl,
        itemData.itemPrice,
        itemData.redemptionPrice,
        itemData.punishmentPrice,
        itemData.redemptionPeriod
      );
    await tx1.wait();
    const itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(0); // LISTED

    // Step2: pawnbroker claim item
    const totalCost = itemData.itemPrice + itemData.punishmentPrice;
    const tx2 = await deployedPawnbroker.connect(addr2).claimItem(itemId, { value: totalCost });
    await tx2.wait();

    // ETH should be in PawnStorage escrow
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(totalCost);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(1); // IN_NEGOTIATION

    // Step 3: pledger sees claim, and accepts, then delivers the item
    const tx3 = await deployedPledger.connect(addr1).acceptClaim(itemId);
    await tx3.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(2); // IN_DELIVERY

    // Step 4: pawnbroker confirms he received item, and releases the eth to pledger
    addr1BalanceBefore = await ethers.provider.getBalance(addr1);
    const tx4 = await deployedPawnbroker.connect(addr2).confirmItemDelivered(itemId);
    await tx4.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(3); // CLAIMED
    addr1BalanceAfter = await ethers.provider.getBalance(addr1);

    // Only punishment should remain in escrow after owner is paid
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(itemData.punishmentPrice);
    expect(addr1BalanceAfter - addr1BalanceBefore).to.be.equal(itemData.itemPrice);

    // Step 5: fast forward time 1 day later and redeem item back
    await network.provider.send("evm_increaseTime", [86400]);
    await network.provider.send("evm_mine");
    const tx5 = await deployedPledger
      .connect(addr1)
      .redeemItem(itemId, { value: itemData.redemptionPrice });
    await tx5.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(4); // IN_REDEMPTION

    // Escrow should now have redemption + punishment
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(itemData.redemptionPrice + itemData.punishmentPrice);

    // Step 6: pawnbroker sees the redemption then sends item back
    const tx6 = await deployedPawnbroker.connect(addr2).returnItem(itemId);
    await tx6.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(5); // IN_DELIVERY_RETURN

    // Step 7: pledger confirms item received, then releases eth back to pawnbroker
    addr2BalanceBefore = await ethers.provider.getBalance(addr2);
    const tx7 = await deployedPledger.connect(addr1).confirmItemDelivered(itemId);
    await tx7.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(6); // END_OF_TRANSACTION
    addr2BalanceAfter = await ethers.provider.getBalance(addr2);

    expect(addr2BalanceAfter - addr2BalanceBefore).to.be.equal(
      itemData.redemptionPrice + itemData.punishmentPrice
    );

    // Escrow should be cleared after final payout
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(0);
  });

  it("should perform full flow, but pledger fails to redeem", async function () {
    // Step 1: pledger create item
    const tx1 = await deployedPledger
      .connect(addr1)
      .createMyItem(
        itemData.itemName,
        itemData.itemUrl,
        itemData.itemPrice,
        itemData.redemptionPrice,
        itemData.punishmentPrice,
        itemData.redemptionPeriod
      );
    await tx1.wait();
    const itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(0); // LISTED

    // Step2: pawnbroker claim item
    const totalCost = itemData.itemPrice + itemData.punishmentPrice;
    const tx2 = await deployedPawnbroker.connect(addr2).claimItem(itemId, { value: totalCost });
    await tx2.wait();

    // ETH should be in PawnStorage escrow
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(totalCost);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(1); // IN_NEGOTIATION

    // Step 3: pledger sees claim, and accepts, then delivers the item
    const tx3 = await deployedPledger.connect(addr1).acceptClaim(itemId);
    await tx3.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(2); // IN_DELIVERY

    // Step 4: pawnbroker confirms he received item, and releases the eth to pledger
    addr1BalanceBefore = await ethers.provider.getBalance(addr1);
    const tx4 = await deployedPawnbroker.connect(addr2).confirmItemDelivered(itemId);
    await tx4.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(3); // CLAIMED
    addr1BalanceAfter = await ethers.provider.getBalance(addr1);

    // Only punishment should remain in escrow after owner is paid
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(itemData.punishmentPrice);
    expect(addr1BalanceAfter - addr1BalanceBefore).to.be.equal(itemData.itemPrice);

    // Step 5: fast forward time 31 days later, pledger does not redeem, pawnbroker can claim his punishment fee back
    await network.provider.send("evm_increaseTime", [86400 * 31]);
    await network.provider.send("evm_mine");

    addr2BalanceBefore = await ethers.provider.getBalance(addr2);
    const tx5 = await deployedPawnbroker.connect(addr2).getPunishmentFee(itemId);
    const receipt = await tx5.wait();
    const gasUsed = BigInt(receipt.gasUsed);
    const gasPrice = BigInt(tx5.gasPrice);
    const gasCost = gasUsed * gasPrice;
    addr2BalanceAfter = await ethers.provider.getBalance(addr2);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(6); // END_OF_TRANSACTION

    expect(addr2BalanceAfter - addr2BalanceBefore).to.be.equal(itemData.punishmentPrice - gasCost);

    // Escrow should be cleared after final payout
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(0);
  });

  it("should perform full flow, but pawnbroker fails to return item", async function () {
    // Step 1: pledger create item
    const tx1 = await deployedPledger
      .connect(addr1)
      .createMyItem(
        itemData.itemName,
        itemData.itemUrl,
        itemData.itemPrice,
        itemData.redemptionPrice,
        itemData.punishmentPrice,
        itemData.redemptionPeriod
      );
    await tx1.wait();
    const itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(0); // LISTED

    // Step2: pawnbroker claim item
    const totalCost = itemData.itemPrice + itemData.punishmentPrice;
    const tx2 = await deployedPawnbroker.connect(addr2).claimItem(itemId, { value: totalCost });
    await tx2.wait();

    // ETH should be in PawnStorage escrow
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(totalCost);
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(1); // IN_NEGOTIATION

    // Step 3: pledger sees claim, and accepts, then delivers the item
    const tx3 = await deployedPledger.connect(addr1).acceptClaim(itemId);
    await tx3.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(2); // IN_DELIVERY

    // Step 4: pawnbroker confirms he received item, and releases the eth to pledger
    addr1BalanceBefore = await ethers.provider.getBalance(addr1);
    const tx4 = await deployedPawnbroker.connect(addr2).confirmItemDelivered(itemId);
    await tx4.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(3); // CLAIMED
    addr1BalanceAfter = await ethers.provider.getBalance(addr1);

    // Only punishment should remain in escrow after owner is paid
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(itemData.punishmentPrice);
    expect(addr1BalanceAfter - addr1BalanceBefore).to.be.equal(itemData.itemPrice);

    // Step 5: fast forward time 1 day later and redeem item back
    await network.provider.send("evm_increaseTime", [86400]);
    await network.provider.send("evm_mine");
    const tx5 = await deployedPledger
      .connect(addr1)
      .redeemItem(itemId, { value: itemData.redemptionPrice });
    await tx5.wait();
    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(4); // IN_REDEMPTION

    // Escrow should now have redemption + punishment
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(itemData.redemptionPrice + itemData.punishmentPrice);

    // Step 6: Fast forward past redemption period, pawnbroker does not return the item 
    await network.provider.send("evm_increaseTime", [86400 * 31]);
    await network.provider.send("evm_mine");

    addr1BalanceBefore = await ethers.provider.getBalance(addr1);
    const tx6 = await deployedPledger.connect(addr1).getPunishmentFee(itemId);
    const receipt = await tx6.wait();
    const gasUsed = BigInt(receipt.gasUsed);
    const gasPrice = BigInt(tx6.gasPrice);
    const gasCost = gasUsed * gasPrice;

    expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(6); // END_OF_TRANSACTION
    addr1BalanceAfter = await ethers.provider.getBalance(addr1);

    expect(addr1BalanceAfter - addr1BalanceBefore).to.be.equal(itemData.redemptionPrice + itemData.punishmentPrice - gasCost);

    // Escrow should be cleared after final payout
    escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
    expect(escrowBalance).to.be.equal(0);
  });


});
