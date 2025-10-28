// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PawnStorage {
    // ---- Enum ----
    enum ItemStatus {
        LISTED,
        IN_NEGOTIATION,
        IN_DELIVERY,
        CLAIMED,
        IN_REDEMPTION,
        IN_DELIVERY_RETURN, // NOT REUSING IN_DELIVERY for redemption. this is to prevent unauthorised function calls that uses enum value IN_DELIVERY
        RETURNED
    }

    // ---- Struct ----
    struct PawnItem {
        uint256 itemId;
        address owner;
        string itemName;
        string itemUrl;
        uint256 itemPrice; // in wei ether
        uint256 redemptionPrice; // in wei ether
        uint256 punishmentPrice; // in wei ether
        uint256 redemptionPeriod; // in days
        ItemStatus itemStatus;
        address otherParty; // used to track who is currently trying to claim
        uint256 takenAt; // used to track who actually claimed if they accepted it
        address takenBy;
    }

    mapping(uint256 => PawnItem) internal allItems; // for all items listed
    mapping(address => uint256[]) internal ownerItems; // for list of items put up by owners
    mapping(address => uint256[]) internal takerItems; // for list of items taken by takers

    uint public nextItemId;
    address public owner;

    mapping(address => bool) public trustedCallers;

    constructor() {
        owner = msg.sender;
    }

    modifier contractOwnerOnly() {
        require(msg.sender == owner, "Sender must be the contract owner");
        _;
    }

    modifier trustedCallerOnly() {
        require(trustedCallers[msg.sender] == true, "Cannot call function because untrusted source");
        _;
    }

    function addTrustedCaller(address trustedCaller) external contractOwnerOnly {
        trustedCallers[trustedCaller] = true;
    }

    function createItem(
        address itemOwner,
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) external trustedCallerOnly returns (uint256) {
        PawnItem memory newItem = PawnItem({
            itemId: nextItemId,
            owner: itemOwner,
            itemName: itemName,
            itemUrl: itemUrl,
            itemPrice: itemPrice,
            redemptionPrice: redemptionPrice,
            punishmentPrice: punishmentPrice,
            redemptionPeriod: redemptionPeriod,
            itemStatus: ItemStatus.LISTED,
            otherParty: address(0),
            takenAt: 0,
            takenBy: address(0)
        });

        storeItem(newItem);
        return newItem.itemId;
    }

    function storeItem(PawnItem memory item) internal trustedCallerOnly {
        allItems[nextItemId] = item;
        ownerItems[item.owner].push(nextItemId);
        nextItemId++;
    }

    function updateItem(
        uint256 itemId,
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) external trustedCallerOnly returns (PawnItem memory) {
        PawnItem storage item = allItems[itemId];
        item.itemName = itemName;
        item.itemUrl = itemUrl;
        item.itemPrice = itemPrice;
        item.redemptionPrice = redemptionPrice;
        item.punishmentPrice = punishmentPrice;
        item.redemptionPeriod = redemptionPeriod;

        return getItem(itemId);
    }

    function deleteItem(uint256 itemId) external trustedCallerOnly {
        address itemOwner = getItemOwner(itemId);
        delete allItems[itemId];

        uint256[] storage items = ownerItems[itemOwner];
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i] == itemId) {
                items[i] = items[items.length - 1];
                items.pop();
                break;
            }
        }
    }

    function getItem(uint id) public view returns (PawnItem memory) {
        return allItems[id];
    }

    function getAllItems() public view returns (PawnItem[] memory) {
        PawnItem[] memory items = new PawnItem[](nextItemId);
        for (uint i = 0; i < nextItemId; i++) {
            items[i] = allItems[i];
        }
        return items;
    }

    function getItemName(uint256 _itemId) public view returns (string memory) {
        return allItems[_itemId].itemName;
    }

    function getItemUrl(uint256 _itemId) public view returns (string memory) {
        return allItems[_itemId].itemUrl;
    }

    function getItemOwner(uint256 _itemId) public view returns (address) {
        return allItems[_itemId].owner;
    }

    function getItemTaker(uint256 _itemId) public view returns (address) {
        return allItems[_itemId].takenBy;
    }

    function getRedemptionPeriod(uint256 _itemId) public view returns (uint256) {
        return allItems[_itemId].redemptionPeriod;
    }

    function getTakenAt(uint256 _itemId) public view returns (uint256) {
        return allItems[_itemId].takenAt;
    }

    function getItemStatus(uint256 _itemId) public view returns (ItemStatus) {
        return allItems[_itemId].itemStatus;
    }

    function getItemPrices(
        uint256 _itemId
    ) external view returns (uint256 itemPrice, uint256 redemptionPrice, uint256 punishmentPrice) {
        PawnItem memory item = getItem(_itemId);
        return (item.itemPrice, item.redemptionPrice, item.punishmentPrice);
    }

    function getOtherParty(uint256 _itemId) public view returns (address) {
        PawnItem memory item = getItem(_itemId);
        return item.otherParty;
    }

    function getItemsByOwner(address ownerAddress) public view returns (PawnItem[] memory) {
        uint256 numOfItemsOwned = ownerItems[ownerAddress].length;
        PawnItem[] memory ownedItems = new PawnItem[](numOfItemsOwned);

        for (uint256 i = 0; i < numOfItemsOwned; i++) {
            ownedItems[i] = getItem(ownerItems[ownerAddress][i]);
        }
        return ownedItems;
    }

    function getItemsByTaker(address takerAddress) public view returns (PawnItem[] memory) {
        uint256 numOfItemsClaimed = takerItems[takerAddress].length;
        PawnItem[] memory claimedItems = new PawnItem[](numOfItemsClaimed);

        for (uint256 i = 0; i < numOfItemsClaimed; i++) {
            claimedItems[i] = getItem(takerItems[takerAddress][i]);
        }
        return claimedItems;
    }

    function setStatus(uint256 itemId, ItemStatus newStatus) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        item.itemStatus = newStatus;
    }

    function setOtherParty(uint256 itemId, address otherPartyAddress) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        item.otherParty = otherPartyAddress;
    }

    function setTakenBy(uint256 itemId, address taker) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        item.takenBy = taker;
    }

    function setTakenAt(uint256 itemId, uint256 time) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        item.takenAt = time;
    }
}
