// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopItems.sol";

contract Pledger {
    PawnshopItems public pawnshopItems;

    constructor(PawnshopItems _pawnshopItems) {
        pawnshopItems = _pawnshopItems;
    }

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
        require(pawnshopItems.isItemOwner(itemId, msg.sender), "NotOwner");
        _;
    }

    modifier onlyItemStatus(uint256 itemId, PawnshopItems.ItemStatus requiredStatus) {
        require(pawnshopItems.checkItemStatus(itemId, requiredStatus), "WrongStatus");
        _;
    }

    function getMyList() external view returns (uint256[] memory) {
        return pawnshopItems.getOwnerItems(msg.sender);
    }

    function getItem(uint256 itemId) external view returns (PawnshopItems.Item memory) {
        return pawnshopItems.getItem(itemId);
    }

    function createMyItem(
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) public returns (PawnshopItems.Item memory) {
        
        uint256 currentId = pawnshopItems.getNextItemId();
        pawnshopItems.incrementNextItemId();
        uint256 id = currentId + 1;

        // Call PawnshopItems function to create item
        pawnshopItems.createItem(
            id,
            msg.sender,
            itemName,
            itemUrl,
            itemPrice,
            redemptionPrice,
            punishmentPrice,
            redemptionPeriod
        );

        emit ItemCreated(id, msg.sender);

        return pawnshopItems.getItem(id);
    }

    function updateMyItem(uint256 itemId, ItemUpdateData memory data) external 
    itemOwnerOnly(itemId) onlyItemStatus(itemId, PawnshopItems.ItemStatus.LISTED) {
        
        // Call PawnshopItems function to update item
        pawnshopItems.updateItem(
            itemId,
            data.itemName,
            data.itemUrl,
            data.itemPrice,
            data.redemptionPrice,
            data.punishmentPrice,
            data.redemptionPeriod
        );

        emit ItemUpdated(itemId, msg.sender);
    }

    function deleteMyItem(uint256 itemId) public itemOwnerOnly(itemId) onlyItemStatus(itemId, PawnshopItems.ItemStatus.LISTED) {

        // Call PawnshopItems function to delete item
        pawnshopItems.deleteItem(itemId, msg.sender);

        emit ItemDeleted(itemId, msg.sender);
    }
}
