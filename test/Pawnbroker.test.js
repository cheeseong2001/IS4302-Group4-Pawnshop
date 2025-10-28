const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pledger Contract", function () {
  let owner, addr1, addr2;
  let pawnStorage, deployedPawnStorage;
  let pawnbroker, deployedPawnbroker, pawnbrokerAddress;
  let itemId, totalCost;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy PawnStorage first
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.connect(owner).deploy();
    await deployedPawnStorage.waitForDeployment();
    const pawnStorageAddress = await deployedPawnStorage.getAddress();

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
      const item = await deployedPawnbroker.connect(addr1).getItem(itemId);
      expect(item.itemStatus).to.be.equal(1); // status should be IN_NEGOTIATION

      const balance = await ethers.provider.getBalance(pawnbrokerAddress);
      expect(balance).to.be.equal(totalCost);
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

      const balance = await ethers.provider.getBalance(pawnbrokerAddress);
      expect(balance).to.be.equal(totalCost);
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
      await deployedPawnbroker.connect(addr1).confirmItemDelivered(itemId);
      const item = await deployedPawnbroker.connect(addr1).getItem(itemId);
      expect(item.itemStatus).to.be.equal(3);
      expect(item.takenBy).to.be.equal(addr1);
      expect(item.takenAt).to.not.be.equal(0);

      const takerList = await deployedPawnbroker.connect(addr1).getMyClaimedList();
      expect(takerList.length).to.be.equal(1);
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
});
