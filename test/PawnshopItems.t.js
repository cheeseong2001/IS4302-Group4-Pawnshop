const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PawnshopItems", function () {
  let PawnshopItems, pawnshop, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    PawnshopItems = await ethers.getContractFactory("PawnshopItems");
    pawnshop = await PawnshopItems.deploy();
  });

  it("should deploy with no items", async function () {
    const ownerItems = await pawnshop.getOwnerItems(owner.address);
    expect(ownerItems.length).to.equal(0);
  });

  it("should return default zero values for non-existent item", async function () {
    const item = await pawnshop.getItem(1);
    expect(item.owner).to.equal(ethers.ZeroAddress);
    expect(item.itemName).to.equal("");
    expect(item.itemPrice).to.equal(0);
    expect(item.itemStatus).to.equal(0); // LISTED
  });

  it("should read back a mocked item correctly", async function () {
    
    // Enum ordering test
    const status = await pawnshop.getItemStatus(0);
    expect(status).to.equal(0); // LISTED

    // Prices getter returns zero tuple for uninitialized item
    const [price, redemption, punishment] = await pawnshop.getItemPrices(0);
    expect(price).to.equal(0);
    expect(redemption).to.equal(0);
    expect(punishment).to.equal(0);
  });

  it("should handle multiple owners and takers lists as empty", async function () {
    const ownerItems = await pawnshop.getOwnerItems(owner.address);
    const takerItems = await pawnshop.getTakerItems(addr1.address);
    expect(ownerItems.length).to.equal(0);
    expect(takerItems.length).to.equal(0);
  });

  it("should expose all 8 getter functions as callable", async function () {
    // 1. getItem (struct)
    const item = await pawnshop.getItem(0);
    expect(item).to.exist;
    expect(item.owner).to.equal(ethers.ZeroAddress);
    expect(item.itemName).to.be.a("string");

    // 2. getItemName
    const name = await pawnshop.getItemName(0);
    expect(name).to.be.a("string");

    // 3. getItemUrl
    const url = await pawnshop.getItemUrl(0);
    expect(url).to.be.a("string");

    // 4. getItemOwner
    const ownerAddr = await pawnshop.getItemOwner(0);
    expect(ownerAddr).to.be.a("string");
    expect(ownerAddr).to.match(/^0x[a-fA-F0-9]{40}$/);

    // 5. getItemStatus
    const status = await pawnshop.getItemStatus(0);
    expect(typeof status).to.equal("bigint");
    expect(Number(status)).to.equal(0);

    // 6. getItemPrices (tuple)
    const [price, redemption, punishment] = await pawnshop.getItemPrices(0);
    expect(typeof price).to.equal("bigint");
    expect(typeof redemption).to.equal("bigint");
    expect(typeof punishment).to.equal("bigint");

    // 7. getOwnerItems
    it("Should return an array of items for the owner", async function () {
      await pledger.connect(owner).createMyItem("Owner Item", "url", ethers.parseEther("1.0"), ethers.parseEther("1.2"), ethers.parseEther("0.5"), 30);

      const ownerItems = await pawnshopItems.getOwnerItems(owner.address);

      expect(Array.isArray(ownerItems)).to.be.true;
      expect(ownerItems.length).to.equal(1);
      expect(ownerItems[0].itemName).to.equal("Owner Item");
      expect(ownerItems[0].itemStatus).to.equal(0); // LISTED
    });

    // 8. getTakerItems
    const takerItems = await pawnshop.getTakerItems(addr1.address);
    expect(Array.isArray(takerItems)).to.be.true;
    });
});
