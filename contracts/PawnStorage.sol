// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PawnStorage {
    // ---- Enum ----
    enum ItemStatus {
        LISTED,
        IN_NEGOTIATION,
        DELIVERED,
        TAKEN,
        REDEEMED,
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
        uint256 takenAt;
        address takenBy;
    }

    mapping(uint256 => PawnItem) internal allItems; // for all items listed
    mapping(address => uint256[]) internal ownerItems; // for list of items put up by owners
    mapping(address => uint256[]) internal takerItems; // for list of items taken by takers

    uint public nextItemId;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function createItem(
        address itemOwner,
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) external returns (uint256) {
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
            takenAt: 0,
            takenBy: address(0)
        });

        storeItem(newItem);
        return newItem.itemId;
    }

    function storeItem(PawnItem memory item) public {
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
    ) external returns (PawnItem memory) {
        PawnItem storage item = allItems[itemId];
        item.itemName = itemName;
        item.itemUrl = itemUrl;
        item.itemPrice = itemPrice;
        item.redemptionPrice = redemptionPrice;
        item.punishmentPrice = punishmentPrice;
        item.redemptionPeriod = redemptionPeriod;

        return getItem(itemId);
    }

    function deleteItem(uint256 itemId) external {
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

    function getItemName(
        uint256 _itemId
    ) external view returns (string memory) {
        return allItems[_itemId].itemName;
    }

    function getItemUrl(uint256 _itemId) external view returns (string memory) {
        return allItems[_itemId].itemUrl;
    }

    function getItemOwner(uint256 _itemId) public view returns (address) {
        return allItems[_itemId].owner;
    }

    function getItemStatus(uint256 _itemId) external view returns (ItemStatus) {
        return allItems[_itemId].itemStatus;
    }

    function getItemPrices(
        uint256 _itemId
    )
        external
        view
        returns (
            uint256 itemPrice,
            uint256 redemptionPrice,
            uint256 punishmentPrice
        )
    {
        PawnItem memory item = getItem(_itemId);
        return (item.itemPrice, item.redemptionPrice, item.punishmentPrice);
    }

    function getItemsByOwner(
        address ownerAddress
    ) public view returns (PawnItem[] memory) {
        uint256 numOfItemsOwned = ownerItems[ownerAddress].length;
        PawnItem[] memory ownedItems = new PawnItem[](numOfItemsOwned);

        for (uint256 i = 0; i < numOfItemsOwned; i++) {
            ownedItems[i] = getItem(ownerItems[ownerAddress][i]);
        }
        return ownedItems;
    }
}
