// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PawnshopItems {

    // ---- Enum ----
    enum ItemStatus {
        LISTED,
        NEGOTIATION,
        DELIVERIED,
        TAKEN,
        REDEEM,
        RETURNED
    }

    // ---- Struct ----
    struct Item {
        uint256 itemId;
        address owner;
        string itemName;
        string itemUrl;
        uint256 itemPrice;          // in wei ether
        uint256 redemptionPrice;    // in wei ether
        uint256 punishmentPrice;    // in wei ether
        uint256 redemptionPeriod;   // in days
        ItemStatus itemStatus;
        uint256 takenAt;           
        address takenBy;
    }

    // ---- Storage ----
    mapping(uint256 => Item) internal itemList;             
    mapping(address => uint256[]) internal ownerItems;     
    mapping(address => uint256[]) internal takerItems;     
    uint256 internal nextItemId;

    // ---- Getters ----

    /// @notice Get a full item struct by ID
    function getItem(uint256 _itemId) external view returns (Item memory) {
        return itemList[_itemId];
    }

    /// @notice Get item name by ID
    function getItemName(uint256 _itemId) external view returns (string memory) {
        return itemList[_itemId].itemName;
    }

    /// @notice Get item URL by ID
    function getItemUrl(uint256 _itemId) external view returns (string memory) {
        return itemList[_itemId].itemUrl;
    }

    /// @notice Get item owner
    function getItemOwner(uint256 _itemId) external view returns (address) {
        return itemList[_itemId].owner;
    }

    /// @notice Get current item status
    function getItemStatus(uint256 _itemId) external view returns (ItemStatus) {
        return itemList[_itemId].itemStatus;
    }

    /// @notice Get item prices
    function getItemPrices(uint256 _itemId) 
        external 
        view 
        returns (uint256 itemPrice, uint256 redemptionPrice, uint256 punishmentPrice) 
    {
        Item storage item = itemList[_itemId];
        return (item.itemPrice, item.redemptionPrice, item.punishmentPrice);
    }

    /// @notice Get owner’s listed item IDs
    function getOwnerItems(address _owner) external view returns (uint256[] memory) {
        return ownerItems[_owner];
    }

    /// @notice Get taker’s taken item IDs
    function getTakerItems(address _taker) external view returns (uint256[] memory) {
        return takerItems[_taker];
    }
}
