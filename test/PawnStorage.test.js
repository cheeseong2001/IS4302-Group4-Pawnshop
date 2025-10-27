const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test PawnStorage", function () {
  let pawnStorage, deployedPawnStorage, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.deploy();
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
      const tx = await deployedPawnStorage.createItem(
        addr1,
        "testName",
        "https://test_image.com",
        1000,
        2000,
        3000,
        7
      );

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
      const tx = await deployedPawnStorage.updateItem(
        itemId,
        "newName",
        "https://new_link.com",
        4000,
        5000,
        6000,
        10
      );
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
      const tx = await deployedPawnStorage.deleteItem(itemId);
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
});
