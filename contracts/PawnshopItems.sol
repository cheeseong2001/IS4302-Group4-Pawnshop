// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PawnshopItems {
    address _owner;
    address public authorizedPawnshop;
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

    constructor() {
        _owner = msg.sender;
    }

    modifier ownerOnly() {
        require(msg.sender == _owner, "NotOwner");
        _;
    }

    modifier authorizedPawnshopOnly() {
        require(msg.sender == authorizedPawnshop, "NotAuthorizedPawnshop");
        _;
    }

    function setAuthorizedPawnshop(address _pawnshop) external ownerOnly {
        authorizedPawnshop = _pawnshop;
    }

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

    /// @notice Get owner's listed items
    function getOwnerItems(address ownerAddress) external view returns (Item[] memory) {
        uint256[] memory itemIds = ownerItems[ownerAddress];
        Item[] memory items = new Item[](itemIds.length);

        for (uint256 i = 0; i < itemIds.length; i++) {
            items[i] = itemList[itemIds[i]];  
        }

        return items;
    }


    /// @notice Get taker's taken item IDs
    function getTakerItems(address _taker) external view returns (uint256[] memory) {
        return takerItems[_taker];
    }

    // ---- Setters for external contracts ----

    /// @notice Create a new item (for Pledger contract)
    function createItem(
        uint256 itemId,
        address owner,
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) external authorizedPawnshopOnly {
        Item storage it = itemList[itemId];
        it.itemId = itemId;
        it.owner = owner;
        it.itemName = itemName;
        it.itemUrl = itemUrl;
        it.itemPrice = itemPrice;
        it.redemptionPrice = redemptionPrice;
        it.punishmentPrice = punishmentPrice;
        it.redemptionPeriod = redemptionPeriod;
        it.itemStatus = ItemStatus.LISTED;
        it.takenAt = 0;
        it.takenBy = address(0);

        ownerItems[owner].push(itemId);
    }

    /// @notice Update item details (for Pledger contract)
    function updateItem(
        uint256 itemId,
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) external authorizedPawnshopOnly {
        Item storage item = itemList[itemId];
        item.itemName = itemName;
        item.itemUrl = itemUrl;
        item.itemPrice = itemPrice;
        item.redemptionPrice = redemptionPrice;
        item.punishmentPrice = punishmentPrice;
        item.redemptionPeriod = redemptionPeriod;
    }

    /// @notice Delete an item (for Pledger contract)
    function deleteItem(uint256 itemId, address owner) external authorizedPawnshopOnly {
        delete itemList[itemId];

        uint256[] storage items = ownerItems[owner];
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i] == itemId) {
                items[i] = items[items.length - 1];
                items.pop();
                break;
            }
        }
    }

    /// @notice Get next item ID
    function getNextItemId() external view returns (uint256) {
        return nextItemId;
    }

    /// @notice Increment next item ID
    function incrementNextItemId() external authorizedPawnshopOnly {
        nextItemId++;
    }

    /// @notice Check if caller is item owner
    function isItemOwner(uint256 itemId, address caller) external view returns (bool) {
        return itemList[itemId].owner == caller;
    }

    /// @notice Check item status
    function checkItemStatus(uint256 itemId, ItemStatus requiredStatus) external view returns (bool) {
        return itemList[itemId].itemStatus == requiredStatus;
    }
}
