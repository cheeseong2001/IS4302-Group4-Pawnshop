// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopCommon.sol";

contract Pledger is PawnshopCommon {
    event ItemCreated(uint256 indexed itemId, address indexed owner);
    event ItemUpdated(uint256 indexed itemId, address indexed owner);
    event ItemDeleted(uint256 indexed itemId, address indexed owner);
    // event ItemClaimed(uint256 indexed itemId, address indexed taker);
    // event ClaimAccepted(uint256 indexed itemId, address indexed owner);
    // event ItemDelivered(uint256 indexed itemId, address indexed taker);
    event ItemClaimed(uint256 indexed itemId, address indexed taker);
    event ClaimAccepted(uint256 indexed itemId, address indexed owner);
    event ItemDelivered(uint256 indexed itemId, address indexed taker);

    // ---- Struct ----
    struct ItemUpdateData {
        string itemName;
        string itemUrl;
        uint256 itemPrice;
        uint256 redemptionPrice;
        uint256 punishmentPrice;
        uint256 redemptionPeriod;
    }

    constructor(
        address _pawnStorageAddress
    ) PawnshopCommon(_pawnStorageAddress) {}

    // ---- Modifiers ----
    modifier itemOwnerOnly(uint256 itemId) {
        require(
            pawnStorageContract.getItemOwner(itemId) == msg.sender,
            "Sender must be the item owner"
        );
        _;
    }

    function getMyList() external view returns (PawnStorage.PawnItem[] memory) {
        return pawnStorageContract.getItemsByOwner(msg.sender);
    }

    // ---- Item Management ----
    function createMyItem(
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) public returns (PawnStorage.PawnItem memory) {
        uint256 newItemId = pawnStorageContract.createItem(
            msg.sender,
            itemName,
            itemUrl,
            itemPrice,
            redemptionPrice,
            punishmentPrice,
            redemptionPeriod
        );
        emit ItemCreated(newItemId, msg.sender);
        return pawnStorageContract.getItem(newItemId);
    }

    function updateMyItem(
        uint256 itemId,
        ItemUpdateData memory newData
    )
        external
        itemOwnerOnly(itemId)
        itemStatusIs(itemId, PawnStorage.ItemStatus.LISTED)
        returns (PawnStorage.PawnItem memory)
    {
        PawnStorage.PawnItem memory updatedItem = pawnStorageContract
            .updateItem(
                itemId,
                newData.itemName,
                newData.itemUrl,
                newData.itemPrice,
                newData.redemptionPrice,
                newData.punishmentPrice,
                newData.redemptionPeriod
            );

        emit ItemUpdated(itemId, msg.sender);
        return updatedItem;
    }

    function deleteMyItem(
        uint256 itemId
    )
        public
        itemOwnerOnly(itemId)
        itemStatusIs(itemId, PawnStorage.ItemStatus.LISTED)
    {
        pawnStorageContract.deleteItem(itemId);
        emit ItemDeleted(itemId, msg.sender);
    }
}
