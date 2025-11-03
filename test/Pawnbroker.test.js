const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pawnbroker Contract", function () {
  let owner, addr1, addr2;
  let pawnStorage, deployedPawnStorage, pawnStorageAddress;
  let pawnbroker, deployedPawnbroker, pawnbrokerAddress;
  let itemId, totalCost;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy PawnStorage first
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.connect(owner).deploy();
    await deployedPawnStorage.waitForDeployment();
    pawnStorageAddress = await deployedPawnStorage.getAddress();

    pawnbroker = await ethers.getContractFactory("Pawnbroker");
    deployedPawnbroker = await pawnbroker.connect(owner).deploy(pawnStorageAddress);
    await deployedPawnbroker.waitForDeployment();
    pawnbrokerAddress = await deployedPawnbroker.getAddress();

    await deployedPawnStorage.connect(owner).addTrustedCaller(pawnbrokerAddress);
    await deployedPawnStorage.connect(owner).addTrustedCaller(owner); // allow owner to have permissions create items

    // we assume the item is already there
    // since Pawnbroker only can perform actions when items are listed
    itemData = {
      itemName: "Laptop",
      itemUrl: "https://example.com/laptop.jpg",
      itemPrice: ethers.parseEther("1.0"),
      redemptionPrice: ethers.parseEther("1.2"),
      punishmentPrice: ethers.parseEther("0.5"),
      redemptionPeriod: 30,
    };

    const tx = await deployedPawnStorage
      .connect(owner)
      .createItem(
        owner,
        itemData.itemName,
        itemData.itemUrl,
        itemData.itemPrice,
        itemData.redemptionPrice,
        itemData.punishmentPrice,
        itemData.redemptionPeriod
      );

    await tx.wait();
    itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    totalCost = itemData.punishmentPrice + itemData.itemPrice;
  });

  describe("test Pawnbroker claim", function () {
    it("Should be able to request to claim item", async function () {
      await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      const itemStatus = await deployedPawnStorage.getItemStatus(itemId);
      expect(itemStatus).to.be.equal(1); // status should be IN_NEGOTIATION

      // ETH should be in PawnStorage escrow, not Pawnbroker contract
      const escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
      expect(escrowBalance).to.be.equal(totalCost);
    });

    it("Should revert when insufficent ether provided", async function () {
      await expect(
        deployedPawnbroker.connect(addr1).claimItem(itemId, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Insufficient ether to claim");
    });

    it("Should return excess ether when more than sufficient ether provided", async function () {
      await deployedPawnbroker
        .connect(addr1)
        .claimItem(itemId, { value: ethers.parseEther("2.0") });

      // ETH should be in PawnStorage escrow, not Pawnbroker contract
      const escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
      expect(escrowBalance).to.be.equal(totalCost);
    });

    it("Should be able to withdraw claim after claim declaration", async function () {
      const tx1 = await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      await tx1.wait();

      const itemStatus = await deployedPawnStorage.getItemStatus(itemId);
      expect(itemStatus).to.be.equal(1); // status should be IN_NEGOTIATION

      const addr1BalanceBeforeWithdraw = await ethers.provider.getBalance(addr1);

      const tx2 = await deployedPawnbroker.connect(addr1).withdrawClaim(itemId);
      const receipt = await tx2.wait();
      
      // Escrow should be empty after withdrawal
      const escrowBalanceAfterWithdraw = await deployedPawnStorage.getEscrowBalance(itemId);
      expect(escrowBalanceAfterWithdraw).to.be.equal(0);

      // calculate addr1 change in amount should only be gas
      const addr1BalanceAfterWithdraw = await ethers.provider.getBalance(addr1);
      const gasUsed = BigInt(receipt.gasUsed);
      const gasPrice = BigInt(tx2.gasPrice);
      const gasCost = gasUsed * gasPrice;

      expect(addr1BalanceAfterWithdraw).to.be.equal(
        addr1BalanceBeforeWithdraw - gasCost + totalCost
      );
    });
  });

  describe("test Pawnbroker confirmed delivery", function () {
    beforeEach(async function () {
      // assume the item claim has been accepted
      // use owner account to explicitly set item status to be IN_DELIVERY
      await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      await deployedPawnStorage.connect(owner).setStatus(itemId, 2); // set status to IN_DELIVERY
    });

    it("Should update item details upon delivery confirmation", async function () {
      const ownerBalanceBefore = await ethers.provider.getBalance(owner);
      
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId);
      const item = await deployedPawnbroker.connect(addr1).getItem(itemId);
      expect(item.itemStatus).to.be.equal(3);
      expect(item.takenBy).to.be.equal(addr1);
      expect(item.takenAt).to.not.be.equal(0);

      const takerList = await deployedPawnbroker.connect(addr1).getMyClaimedList();
      expect(takerList.length).to.be.equal(1);

      // Owner should have received the itemPrice
      const ownerBalanceAfter = await ethers.provider.getBalance(owner);
      expect(ownerBalanceAfter).to.be.equal(ownerBalanceBefore + itemData.itemPrice);

      // Punishment should still be in escrow
      const escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
      expect(escrowBalance).to.be.equal(itemData.punishmentPrice);
    });

    it("Should revert if item status is not IN_DELIVERY", async function () {
      await deployedPawnStorage.connect(owner).setStatus(itemId, 0);
      await expect(
        deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId)
      ).to.be.revertedWith("Item status incorrect");
    });
  });

  describe("test Pawnbroker return item", function () {
    beforeEach(async function () {
      // assume the item claim has been accepted
      // use owner account to explicitly set item status to be IN_REDEMPTION
      await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      await deployedPawnStorage.connect(owner).setStatus(itemId, 2); // set status to IN_DELIVERY
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId);
      await deployedPawnStorage.connect(owner).setStatus(itemId, 4); // set status to IN_REDEMPTION
    });

    it("Should update item details on return", async function () {
      await deployedPawnbroker.connect(addr1).returnItem(itemId);
      const item = await deployedPawnbroker.connect(addr1).getItem(itemId);
      expect(item.itemStatus).to.be.equal(5);

      const takerList = await deployedPawnbroker.connect(addr1).getMyClaimedList();
      expect(takerList.length).to.be.equal(0);
    });

    it("Should revert if item status is not IN_DELIVERY", async function () {
      await deployedPawnStorage.connect(owner).setStatus(itemId, 0);
      await expect(
        deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId)
      ).to.be.revertedWith("Item status incorrect");
    });
  });

  describe("test Pawnbroker claim amount after return", function () {
    beforeEach(async function () {
      // Set up complete flow: claim -> deliver -> redeem -> return -> returned
      await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      await deployedPawnStorage.connect(owner).setStatus(itemId, 2); // IN_DELIVERY
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId);
      await deployedPawnStorage.connect(owner).setStatus(itemId, 4); // IN_REDEMPTION
      
      // Simulate owner redeeming by depositing redemption price to escrow
      await deployedPawnStorage.connect(owner).depositToEscrow(itemId, { value: itemData.redemptionPrice });
      
      await deployedPawnbroker.connect(addr1).returnItem(itemId);
      await deployedPawnStorage.connect(owner).setStatus(itemId, 6); // RETURNED
    });

    it("Should allow taker to claim redemption amount + punishment", async function () {
      const addr1BalanceBefore = await ethers.provider.getBalance(addr1);
      
      const tx = await deployedPawnbroker.connect(addr1).claimAmount(itemId);
      const receipt = await tx.wait();
      
      const addr1BalanceAfter = await ethers.provider.getBalance(addr1);
      const gasUsed = BigInt(receipt.gasUsed);
      const gasPrice = BigInt(tx.gasPrice);
      const gasCost = gasUsed * gasPrice;

      const expectedAmount = itemData.redemptionPrice + itemData.punishmentPrice;
      expect(addr1BalanceAfter).to.be.equal(addr1BalanceBefore - gasCost + expectedAmount);

      // Escrow should be cleared
      const escrowBalance = await deployedPawnStorage.getEscrowBalance(itemId);
      expect(escrowBalance).to.be.equal(0);

      // Status should be END_OF_TRANSACTION
      const item = await deployedPawnbroker.getItem(itemId);
      expect(item.itemStatus).to.be.equal(7);
    });
  });

  describe("test illegal actions", function () {
    it("Should revert if item taker is item owner", async function () {
      await expect(deployedPawnbroker.connect(owner).claimItem(itemId)).to.be.revertedWith(
        "Taker must not be the item owner"
      );
    });

    it("Should revert when another account tries to confirm delivery of claim he did not initiate", async function () {
      await deployedPawnStorage.connect(owner).setStatus(itemId, 2); // set status to IN_DELIVERY
      await expect(
        deployedPawnbroker.connect(addr2).confirmItemDelivered(itemId)
      ).to.be.revertedWith("Sender must be the claim initiator");
      const takerList = await deployedPawnbroker.connect(addr2).getMyClaimedList();
      expect(takerList.length).to.be.equal(0);
    });

    it("Should revert when another account tries to return an item not taken by him", async function () {
      await deployedPawnbroker.connect(addr1).claimItem(itemId, { value: totalCost });
      await deployedPawnStorage.connect(owner).setStatus(itemId, 2); // set status to IN_DELIVERY
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId);
      await deployedPawnStorage.connect(owner).setStatus(itemId, 4); // set status to IN_REDEMPTION

      await expect(deployedPawnbroker.connect(addr2).returnItem(itemId)).to.be.revertedWith(
        "Sender must be the item taker"
      );
    });
  });

  describe("test retrievePunishmentFee", function () {
    let punishmentItemId;

    beforeEach(async function () {
      // Create a new item for punishment fee tests
      const tx = await deployedPawnStorage
        .connect(owner)
        .createItem(
          owner,
          itemData.itemName,
          itemData.itemUrl,
          itemData.itemPrice,
          itemData.redemptionPrice,
          itemData.punishmentPrice,
          itemData.redemptionPeriod
        );
      await tx.wait();
      punishmentItemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);

      const totalCost = itemData.itemPrice + itemData.punishmentPrice;
      await deployedPawnbroker.connect(addr1).claimItem(punishmentItemId, { value: totalCost });
      await deployedPawnStorage.connect(owner).setStatus(punishmentItemId, 2); // IN_DELIVERY
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(punishmentItemId);
      // Now status is CLAIMED and punishment is in escrow
    });

    it("Should allow taker to retrieve punishment fee after redemption period", async function () {
      await network.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");

      const addr1BalanceBefore = await ethers.provider.getBalance(addr1);

      const tx = await deployedPawnbroker.connect(addr1).retrievePunishmentFee(punishmentItemId);
      const receipt = await tx.wait();

      const addr1BalanceAfter = await ethers.provider.getBalance(addr1);
      const gasUsed = BigInt(receipt.gasUsed);
      const gasPrice = BigInt(tx.gasPrice);
      const gasCost = gasUsed * gasPrice;

      expect(addr1BalanceAfter).to.be.equal(
        addr1BalanceBefore - gasCost + itemData.punishmentPrice
      );

      const escrowBalance = await deployedPawnStorage.getEscrowBalance(punishmentItemId);
      expect(escrowBalance).to.be.equal(0);

      const item = await deployedPawnbroker.getItem(punishmentItemId);
      expect(item.itemStatus).to.be.equal(7);

      const takerList = await deployedPawnbroker.connect(addr1).getMyClaimedList();
      expect(takerList.length).to.be.equal(0);
    });

    it("Should revert if called during redemption period", async function () {
      await expect(
        deployedPawnbroker.connect(addr1).retrievePunishmentFee(punishmentItemId)
      ).to.be.revertedWith("Cannot retrieve punishment fee during redemption period");
    });

    it("Should revert if called by non-taker", async function () {
      await network.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");

      await expect(
        deployedPawnbroker.connect(addr2).retrievePunishmentFee(punishmentItemId)
      ).to.be.revertedWith("Sender must be the item taker");
    });

    it("Should revert if item status is not CLAIMED", async function () {
      await deployedPawnStorage.connect(owner).setStatus(punishmentItemId, 0); // LISTED

      await network.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");

      await expect(
        deployedPawnbroker.connect(addr1).retrievePunishmentFee(punishmentItemId)
      ).to.be.revertedWith("Item status incorrect");
    });
  });
});