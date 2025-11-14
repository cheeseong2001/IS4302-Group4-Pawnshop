const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test PawnStorage", function () {
  let pawnStorage, deployedPawnStorage, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.connect(owner).deploy();
    deployedPawnStorage.connect(owner).addTrustedCaller(owner);
  });

  it("should deploy with no items", async function () {
    const allItems = await deployedPawnStorage.getAllItems();
    expect(allItems.length).to.equal(0);
  });

  it("should return default zero values for non-existent item", async function () {
    const item = await deployedPawnStorage.getItem(1);
    expect(item.owner).to.equal(ethers.ZeroAddress);
    expect(item.itemName).to.equal("");
    expect(item.itemUrl).to.equal("");
    expect(item.itemPrice).to.equal(0);
    expect(item.redemptionPrice).to.equal(0);
    expect(item.punishmentPrice).to.equal(0);
    expect(item.redemptionPeriod).to.equal(0);
    expect(item.itemStatus).to.equal(0); // LISTED
    expect(item.takenAt).to.equal(0);
    expect(item.takenBy).to.equal(ethers.ZeroAddress);
  });

  describe("Test CRUD actions", function () {
    let itemId;

    beforeEach(async function () {
      const tx = await deployedPawnStorage
        .connect(owner)
        .createItem(addr1, "testName", "https://test_image.com", 1000, 2000, 3000, 7);

      await tx.wait();
      itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    });

    it("should create an item", async function () {
      expect(itemId).to.equal(0);

      const item = await deployedPawnStorage.getItem(itemId);
      expect(item.owner).to.equal(addr1);
      expect(item.itemName).to.equal("testName");
      expect(item.itemUrl).to.equal("https://test_image.com");
      expect(item.itemPrice).to.equal(1000);
      expect(item.redemptionPrice).to.equal(2000);
      expect(item.punishmentPrice).to.equal(3000);
      expect(item.redemptionPeriod).to.equal(7);
      expect(item.itemStatus).to.equal(0); // LISTED
      expect(item.takenAt).to.equal(0);
      expect(item.takenBy).to.equal(ethers.ZeroAddress);

      const itemList = await deployedPawnStorage.getItemsByOwner(addr1);
      expect(itemList).to.deep.equal([item]);
    });

    it("should update an item's details", async function () {
      const tx = await deployedPawnStorage
        .connect(owner)
        .updateItem(itemId, "newName", "https://new_link.com", 4000, 5000, 6000, 10);
      await tx.wait();

      const item = await deployedPawnStorage.getItem(itemId);
      expect(item.owner).to.equal(addr1);
      expect(item.itemName).to.equal("newName");
      expect(item.itemUrl).to.equal("https://new_link.com");
      expect(item.itemPrice).to.equal(4000);
      expect(item.redemptionPrice).to.equal(5000);
      expect(item.punishmentPrice).to.equal(6000);
      expect(item.redemptionPeriod).to.equal(10);
      expect(item.itemStatus).to.equal(0); // LISTED
      expect(item.takenAt).to.equal(0);
      expect(item.takenBy).to.equal(ethers.ZeroAddress);
    });

    it("should delete an item", async function () {
      const tx = await deployedPawnStorage.connect(owner).deleteItem(itemId);
      await tx.wait();
      const item = await deployedPawnStorage.getItem(itemId);
      expect(item.owner).to.equal(ethers.ZeroAddress);
      expect(item.itemName).to.equal("");
      expect(item.itemUrl).to.equal("");
      expect(item.itemPrice).to.equal(0);
      expect(item.redemptionPrice).to.equal(0);
      expect(item.punishmentPrice).to.equal(0);
      expect(item.redemptionPeriod).to.equal(0);
      expect(item.itemStatus).to.equal(0); // LISTED
      expect(item.takenAt).to.equal(0);
      expect(item.takenBy).to.equal(ethers.ZeroAddress);

      const updatedItemList = await deployedPawnStorage.getItemsByOwner(addr1);
      expect(updatedItemList).to.deep.equal([]);
    });
  });

  describe("Test getAllItems function", function () {
    let itemId1, itemId2;

    beforeEach(async function () {
      const tx1 = await deployedPawnStorage
        .connect(owner)
        .createItem(addr1, "testName1", "https://test_image.com", 1000, 2000, 3000, 7);

      await tx1.wait();
      itemId1 = (await deployedPawnStorage.nextItemId()) - BigInt(1);

      const tx2 = await deployedPawnStorage
        .connect(owner)
        .createItem(addr1, "testName2", "https://test_image.org", 1000, 2000, 3000, 7);

      await tx2.wait();
      itemId2 = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    });

    it("Should return correct all items length", async function () {
      const allItemList = await deployedPawnStorage.getAllItems();
      expect(allItemList.length).to.equal(2);
    });

    it("Should return correct all items length when 1 is deleted", async function () {
      const tx = await deployedPawnStorage.deleteItem(itemId1);
      await tx.wait();

      const allItemList = await deployedPawnStorage.getAllItems();
      expect(allItemList.length).to.equal(1);
    });

    it("Should return correct all items length when 1 is not in LISTED state", async function () {
      const tx = await deployedPawnStorage.setStatus(itemId1, 1);
      await tx.wait();

      const allItemList = await deployedPawnStorage.getAllItems();
      expect(allItemList.length).to.equal(1);
    });

    it("Should return 0 length when all items are either deleted or not in LISTED state", async function () {
      const tx1 = await deployedPawnStorage.deleteItem(itemId1);
      await tx1.wait();

      const tx2 = await deployedPawnStorage.setStatus(itemId2, 1);
      await tx2.wait();

      const allItemList = await deployedPawnStorage.getAllItems();
      expect(allItemList.length).to.equal(0);
    });
  });
});
