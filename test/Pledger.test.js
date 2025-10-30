const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pledger Contract", function () {
  let owner, addr1, addr2;
  let pawnStorage, deployedPawnStorage;
  let pledger, deployedPledger;
  let pawnbroker, deployedPawnbroker, pawnbrokerAddress;

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

    pledger = await ethers.getContractFactory("Pledger");
    deployedPledger = await pledger.connect(owner).deploy(pawnStorageAddress, pawnbrokerAddress);
    await deployedPledger.waitForDeployment();

    await deployedPawnStorage.connect(owner).addTrustedCaller(await deployedPledger.getAddress());
    await deployedPawnStorage.connect(owner).addTrustedCaller(owner);
  });

  describe("test Pledger CRUDs", function () {
    let itemData, itemId;
    let receipt;

    this.beforeEach(async function () {
      itemData = {
        itemName: "Laptop",
        itemUrl: "https://example.com/laptop.jpg",
        itemPrice: ethers.parseEther("1.0"),
        redemptionPrice: ethers.parseEther("1.2"),
        punishmentPrice: ethers.parseEther("0.5"),
        redemptionPeriod: 30,
      };

      const tx = await deployedPledger
        .connect(addr1)
        .createMyItem(
          itemData.itemName,
          itemData.itemUrl,
          itemData.itemPrice,
          itemData.redemptionPrice,
          itemData.punishmentPrice,
          itemData.redemptionPeriod
        );

      receipt = await tx.wait();
      itemId = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    });

    it("Should create a new item with correct details", async function () {
      expect(receipt).to.emit(deployedPledger, "ItemCreated");

      // Verify item details
      const item = await deployedPledger.getItem(itemId);
      expect(item.itemId).to.equal(0);
      expect(item.owner).to.equal(addr1);
      expect(item.itemName).to.equal(itemData.itemName);
      expect(item.itemUrl).to.equal(itemData.itemUrl);
      expect(item.itemPrice).to.equal(itemData.itemPrice);
      expect(item.redemptionPrice).to.equal(itemData.redemptionPrice);
      expect(item.punishmentPrice).to.equal(itemData.punishmentPrice);
      expect(item.redemptionPeriod).to.equal(itemData.redemptionPeriod);
      expect(item.itemStatus).to.equal(0); // LISTED
      expect(item.takenAt).to.equal(0);
      expect(item.takenBy).to.equal(ethers.ZeroAddress);
    });

    it("Should update item owner's list of items", async function () {
      const itemList = await deployedPledger.connect(addr1).getMyList();
      expect(itemList[0]).to.deep.equal(await deployedPledger.getItem(itemId));
    });

    it("Should update item details", async function () {
      const updateData = {
        itemName: "Updated Name",
        itemUrl: "updated-url",
        itemPrice: ethers.parseEther("2.0"),
        redemptionPrice: ethers.parseEther("2.5"),
        punishmentPrice: ethers.parseEther("1.0"),
        redemptionPeriod: 60,
      };

      const tx = await deployedPledger.connect(addr1).updateMyItem(itemId, updateData);
      const receipt = await tx.wait();
      expect(receipt).to.emit(deployedPledger, "ItemUpdated");

      const item = await deployedPledger.getItem(itemId);
      expect(item.itemName).to.equal(updateData.itemName);
      expect(item.itemUrl).to.equal(updateData.itemUrl);
      expect(item.itemPrice).to.equal(updateData.itemPrice);
      expect(item.redemptionPrice).to.equal(updateData.redemptionPrice);
      expect(item.punishmentPrice).to.equal(updateData.punishmentPrice);
      expect(item.redemptionPeriod).to.equal(updateData.redemptionPeriod);
    });

    it("Should revert updating if not owner", async function () {
      const updateData = {
        itemName: "Hacked",
        itemUrl: "url",
        itemPrice: 100,
        redemptionPrice: 120,
        punishmentPrice: 50,
        redemptionPeriod: 30,
      };

      await expect(
        deployedPledger.connect(addr2).updateMyItem(itemId, updateData)
      ).to.be.revertedWith("Sender must be the item owner");
    });

    it("Should delete item from allItems list", async function () {
      const tx = await deployedPledger.connect(addr1).deleteMyItem(itemId);
      const receipt = await tx.wait();

      expect(receipt).to.emit(deployedPledger, "ItemDeleted");

      const item = await deployedPledger.getItem(itemId);
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

    it("Should remove item from owner's list", async function () {
      const tx = await deployedPledger.connect(addr1).deleteMyItem(itemId);
      const receipt = await tx.wait();

      const myList = await deployedPledger.getMyList();
      expect(myList.length).to.equal(0);
    });

    it("Should revert deleting if not owner", async function () {
      await expect(deployedPledger.connect(addr2).deleteMyItem(itemId)).to.be.revertedWith(
        "Sender must be the item owner"
      );
    });

    describe("test claim processes", function () {
      this.beforeEach(async function () {
        await deployedPawnStorage.connect(owner).setStatus(itemId, 1);
      });

      it("Should correctly update item status to IN_DELIVERY upon accepting claim", async function () {
        await deployedPledger.connect(addr1).acceptClaim(itemId);
        expect(await deployedPawnStorage.getItemStatus(itemId)).to.be.equal(2);
      });

      it("Should revert if another user attempts to accept claim on item he does not own", async function () {
        await expect(deployedPledger.connect(addr2).acceptClaim(itemId)).to.be.revertedWith(
          "Sender must be the item owner"
        );
      });
    });

    describe("test redemption process", function () {
      this.beforeEach(async function () {
        await deployedPawnStorage.connect(owner).setStatus(itemId, 3);
        await deployedPawnStorage.connect(owner).setTakenBy(itemId, owner);

        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        const currentTimestamp = block.timestamp;
        await deployedPawnStorage.connect(owner).setTakenAt(itemId, currentTimestamp);
      });

      it("Should correctly update item to IN_REDEMPTION upon initiating redemption", async function () {
        await deployedPledger
          .connect(addr1)
          .redeemItem(itemId, { value: itemData.redemptionPrice });
        const updatedStatus = await deployedPawnStorage.getItemStatus(itemId);
        expect(updatedStatus).to.be.equal(4);

        const pawnbrokerBalance = await ethers.provider.getBalance(pawnbrokerAddress);
        expect(pawnbrokerBalance).to.be.equal(itemData.redemptionPrice);
      });

      it("Should revert if another user attempts to initiate claim on item he does not own", async function () {
        await expect(
          deployedPledger.connect(addr2).redeemItem(itemId, { value: itemData.redemptionPrice })
        ).to.be.revertedWith("Sender must be the item owner");
      });
    });
  });

  describe("multi-users scenario", function () {
    let item1, item2, item1Id, item2Id;
    this.beforeEach(async function () {
      item1 = {
        itemName: "item1",
        itemUrl: "https://example.com/item1.jpg",
        itemPrice: ethers.parseEther("1.0"),
        redemptionPrice: ethers.parseEther("1.2"),
        punishmentPrice: ethers.parseEther("0.5"),
        redemptionPeriod: 30,
      };

      item2 = {
        itemName: "item2",
        itemUrl: "https://example.com/item2.jpg",
        itemPrice: ethers.parseEther("2.0"),
        redemptionPrice: ethers.parseEther("2.4"),
        punishmentPrice: ethers.parseEther("1.0"),
        redemptionPeriod: 7,
      };

      const tx1 = await deployedPledger
        .connect(addr1)
        .createMyItem(
          item1.itemName,
          item1.itemUrl,
          item1.itemPrice,
          item1.redemptionPrice,
          item1.punishmentPrice,
          item1.redemptionPeriod
        );

      const tx2 = await deployedPledger
        .connect(addr2)
        .createMyItem(
          item2.itemName,
          item2.itemUrl,
          item2.itemPrice,
          item2.redemptionPrice,
          item2.punishmentPrice,
          item2.redemptionPeriod
        );

      const [receipt1, receipt2] = await Promise.all([tx1.wait(), tx2.wait()]);

      item1Id = (await deployedPawnStorage.nextItemId()) - BigInt(2);
      item2Id = (await deployedPawnStorage.nextItemId()) - BigInt(1);
    });

    it("Should handle multiple users creating items", async function () {
      const addr1List = await deployedPledger.connect(addr1).getMyList();
      const addr2List = await deployedPledger.connect(addr2).getMyList();

      expect(addr1List.length).to.equal(1);
      expect(addr2List.length).to.equal(1);

      expect(addr1List[0].itemName).to.equal(item1.itemName);
      expect(addr2List[0].itemName).to.equal(item2.itemName);

      expect(addr1List[0].owner).to.equal(addr1);
      expect(addr2List[0].owner).to.equal(addr2);
    });

    it("should not affect other users when deleting", async function () {
      await deployedPledger.connect(addr1).deleteMyItem(item1Id);

      const addr1List = await deployedPledger.connect(addr1).getMyList();
      const addr2List = await deployedPledger.connect(addr2).getMyList();

      expect(addr1List.length).to.equal(0);
      expect(addr2List.length).to.equal(1);
    });
  });
});
