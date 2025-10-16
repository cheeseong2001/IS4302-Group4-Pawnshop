// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopItems.sol";

contract Pledger is PawnshopItems {

    event ItemCreated(uint256 indexed itemId, address indexed owner);
    event ItemUpdated(uint256 indexed itemId, address indexed owner);
    event ItemDeleted(uint256 indexed itemId, address indexed owner);

    // ---- Struct for updating items ---- (Running out of space due to too many parameters)
    struct ItemUpdateData {
        string itemName;
        string itemUrl;
        uint256 itemPrice;
        uint256 redemptionPrice;
        uint256 punishmentPrice;
        uint256 redemptionPeriod;
    }

    modifier itemOwnerOnly(uint256 itemId) {
        require(itemList[itemId].owner == msg.sender, "NotOwner");
        _;
    }

    modifier onlyItemStatus(uint256 itemId, ItemStatus requiredStatus) {
        Item storage it = itemList[itemId];
        require(it.itemStatus == requiredStatus, "WrongStatus");
        _;
    }

    function getMyList() external view returns (uint256[] memory) {
        return ownerItems[msg.sender];
    }

    // Note: getItem() is already available from PawnshopItems parent contract

    function createMyItem(
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) public returns (Item memory) {
        
        uint256 id = ++nextItemId;

        // Write record in itemList
        Item storage it = itemList[id];
        it.itemId            = id;
        it.owner             = msg.sender;
        it.itemName          = itemName;
        it.itemUrl           = itemUrl;
        it.itemPrice         = itemPrice;
        it.redemptionPrice   = redemptionPrice;
        it.punishmentPrice   = punishmentPrice;
        it.redemptionPeriod  = redemptionPeriod;
        it.itemStatus        = ItemStatus.LISTED;
        it.takenAt           = 0;
        it.takenBy           = address(0);

        ownerItems[msg.sender].push(id);

        emit ItemCreated(id, msg.sender);

        return itemList[id];
    }

    function updateMyItem(uint256 itemId,ItemUpdateData memory data) external 
    itemOwnerOnly(itemId) onlyItemStatus(itemId, ItemStatus.LISTED) {
        
        itemList[itemId].itemName          = data.itemName;
        itemList[itemId].itemUrl           = data.itemUrl;
        itemList[itemId].itemPrice         = data.itemPrice;
        itemList[itemId].redemptionPrice   = data.redemptionPrice;
        itemList[itemId].punishmentPrice   = data.punishmentPrice;
        itemList[itemId].redemptionPeriod  = data.redemptionPeriod;

        emit ItemUpdated(itemId, msg.sender);
    }

    function deleteMyItem(uint256 itemId) public itemOwnerOnly(itemId) onlyItemStatus(itemId, ItemStatus.LISTED) {

        delete itemList[itemId];

        uint256[] storage items = ownerItems[msg.sender];
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i] == itemId) {
                items[i] = items[items.length - 1];
                items.pop();
                break;
            }
        }

        emit ItemDeleted(itemId, msg.sender);
    }
}