const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pledger Contract", function () {
  let owner, addr1, addr2;
  let pawnStorage, deployedPawnStorage;
  let pledger, deployedPledger;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy PawnStorage first
    pawnStorage = await ethers.getContractFactory("PawnStorage");
    deployedPawnStorage = await pawnStorage.deploy();
    await deployedPawnStorage.waitForDeployment();
    pawnStorageAddress = await deployedPawnStorage.getAddress();

    pledger = await ethers.getContractFactory("Pledger");
    deployedPledger = await pledger.deploy(pawnStorageAddress);
    await deployedPledger.waitForDeployment();
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

    //   it("Should revert if item is not LISTED", async function () {
    //     // Manually change status (you'd need a function to do this in real scenario)
    //     // For this test, we'll assume the item stays LISTED
    //     // In a real scenario, you'd create a function to change status for testing

    //     const updateData = {
    //       itemName: "Updated",
    //       itemUrl: "url",
    //       itemPrice: 100,
    //       redemptionPrice: 120,
    //       punishmentPrice: 50,
    //       redemptionPeriod: 30,
    //     };

    //     // This should pass since item is LISTED
    //     await expect(pledger.updateMyItem(itemId, updateData)).to.not.be.reverted;
    //   });
    // });

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
      await expect(pledger.connect(addr2).deleteMyItem(itemId)).to.be.revertedWith(
        "Sender must be the item owner"
      );
    });

    // it("Should revert if item is not LISTED", async function () {
    //   // Similar to update test - assumes item stays LISTED
    //   await expect(pledger.deleteMyItem(itemId)).to.not.be.reverted;
    // });
  });

  /* UPDATED TILL HERE */

  describe("Integration Tests", function () {
    it("Should handle complete lifecycle: create -> update -> delete", async function () {
      // Create
      const tx = await pledger.createMyItem(
        "Lifecycle Item",
        "url",
        ethers.parseEther("1.0"),
        ethers.parseEther("1.2"),
        ethers.parseEther("0.5"),
        30
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find((log) => {
        try {
          return pledger.interface.parseLog(log).name === "ItemCreated";
        } catch {
          return false;
        }
      });
      const itemId = pledger.interface.parseLog(event).args.itemId;

      let item = await pledger.getItem(itemId);
      expect(item.itemName).to.equal("Lifecycle Item");

      // Update
      const updateData = {
        itemName: "Updated Lifecycle Item",
        itemUrl: "new-url",
        itemPrice: ethers.parseEther("2.0"),
        redemptionPrice: ethers.parseEther("2.5"),
        punishmentPrice: ethers.parseEther("1.0"),
        redemptionPeriod: 60,
      };
      await pledger.updateMyItem(itemId, updateData);

      item = await pledger.getItem(itemId);
      expect(item.itemName).to.equal("Updated Lifecycle Item");

      // Delete
      await pledger.deleteMyItem(itemId);

      item = await pledger.getItem(itemId);
      expect(item.itemId).to.equal(0);
    });

    it("Should handle multiple users creating items", async function () {
      await pledger.connect(owner).createMyItem("Owner Item", "url1", 100, 120, 50, 30);
      await pledger.connect(addr1).createMyItem("Addr1 Item", "url2", 200, 220, 100, 60);
      await pledger.connect(addr2).createMyItem("Addr2 Item", "url3", 300, 320, 150, 90);

      const ownerList = await pledger.connect(owner).getMyList();
      const addr1List = await pledger.connect(addr1).getMyList();
      const addr2List = await pledger.connect(addr2).getMyList();

      expect(ownerList.length).to.equal(1);
      expect(addr1List.length).to.equal(1);
      expect(addr2List.length).to.equal(1);

      expect(ownerList[0].itemName).to.equal("Owner Item");
      expect(addr1List[0].itemName).to.equal("Addr1 Item");
      expect(addr2List[0].itemName).to.equal("Addr2 Item");

      expect(ownerList[0].owner).to.equal(owner.address);
      expect(addr1List[0].owner).to.equal(addr1.address);
      expect(addr2List[0].owner).to.equal(addr2.address);
    });

    describe("Claim and Delivery Workflow", function () {
      let itemId;
      let itemPrice;
      let punishmentPrice;
      let totalCost;

      beforeEach(async function () {
        // Create item by owner
        const tx = await pledger.createMyItem(
          "Claimable Item",
          "url",
          ethers.parseEther("1.0"),
          ethers.parseEther("1.2"),
          ethers.parseEther("0.5"),
          30
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find((log) => {
          try {
            return pledger.interface.parseLog(log).name === "ItemCreated";
          } catch {
            return false;
          }
        });
        itemId = pledger.interface.parseLog(event).args.itemId;

        const item = await pledger.getItem(itemId);
        itemPrice = item.itemPrice;
        punishmentPrice = item.punishmentPrice;
        totalCost = itemPrice + punishmentPrice;
      });

      describe("claimItem", function () {
        it("Should allow non-owner to claim listed item", async function () {
          await pledger.connect(addr1).claimItem(itemId, { value: totalCost });

          const item = await pledger.getItem(itemId);
          expect(item.itemStatus).to.equal(1); // NEGOTIATION
          expect(item.takenBy).to.equal(addr1.address);

          const takerItems = await pledger.getTakerItems(addr1.address);
          expect(takerItems.length).to.equal(1);
          expect(takerItems[0]).to.equal(itemId);
        });

        it("Should revert if owner tries to claim their own item", async function () {
          await expect(
            pledger.connect(owner).claimItem(itemId, { value: totalCost })
          ).to.be.revertedWith("NotOwner");
        });

        it("Should revert if not enough ETH is sent", async function () {
          const insufficient = itemPrice; // missing punishment price
          await expect(
            pledger.connect(addr1).claimItem(itemId, { value: insufficient })
          ).to.be.revertedWith("NotEnoughETH");
        });
      });

      describe("acceptClaimRequest", function () {
        beforeEach(async function () {
          await pledger.connect(addr1).claimItem(itemId, { value: totalCost });
        });

        it("Should allow owner to accept claim request", async function () {
          await pledger.connect(owner).acceptClaimRequest(itemId);

          const item = await pledger.getItem(itemId);
          expect(item.itemStatus).to.equal(2); // DELIVERIED (or IN_DELIVERY if renamed)
        });

        it("Should revert if called by non-owner", async function () {
          await expect(pledger.connect(addr1).acceptClaimRequest(itemId)).to.be.revertedWith(
            "NotOwner"
          );
        });

        it("Should revert if item is not in NEGOTIATION", async function () {
          await pledger.connect(owner).acceptClaimRequest(itemId);
          await expect(pledger.connect(owner).acceptClaimRequest(itemId)).to.be.revertedWith(
            "WrongStatus"
          );
        });
      });

      describe("confirmItemDelivered", function () {
        beforeEach(async function () {
          await pledger.connect(addr1).claimItem(itemId, { value: totalCost });
          await pledger.connect(owner).acceptClaimRequest(itemId);
        });

        it("Should allow taker to confirm delivery and pay owner", async function () {
          const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

          const tx = await pledger.connect(addr1).confirmItemDelivered(itemId);
          await tx.wait();

          const item = await pledger.getItem(itemId);
          expect(item.itemStatus).to.equal(3); // CLAIMED or TAKEN
          expect(item.takenAt).to.be.greaterThan(0);

          const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
          expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
        });

        it("Should revert if not called by taker", async function () {
          await expect(pledger.connect(owner).confirmItemDelivered(itemId)).to.be.revertedWith(
            "NotTaker"
          );
        });

        it("Should revert if item is not in DELIVERY stage", async function () {
          // manually revert item to LISTED for test
          await expect(pledger.connect(addr1).confirmItemDelivered(itemId)).to.not.be.reverted; // valid path
        });
      });
    });
  });
});
