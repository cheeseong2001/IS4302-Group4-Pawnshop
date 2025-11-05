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
        IN_DELIVERY_RETURN,
        RETURNED,
        END_OF_TRANSACTION
    }

    // ---- Struct ----
    struct PawnItem {
        uint256 itemId;
        address owner;
        string itemName;
        string itemUrl;
        uint256 itemPrice;
        uint256 redemptionPrice;
        uint256 punishmentPrice;
        uint256 redemptionPeriod;
        ItemStatus itemStatus;
        address otherParty;
        uint256 takenAt;
        address takenBy;
    }

    mapping(uint256 => PawnItem) internal allItems;
    mapping(address => uint256[]) internal ownerItems;
    mapping(address => uint256[]) internal takerItems;

    // Track escrowed funds per item
    mapping(uint256 => uint256) internal itemEscrow;

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

    function storeItem(PawnItem memory item) internal {
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

    function depositToEscrow(uint256 itemId) external payable trustedCallerOnly {
        itemEscrow[itemId] += msg.value;
    }

    function withdrawFromEscrow(uint256 itemId, address recipient, uint256 amount) external trustedCallerOnly {
        require(itemEscrow[itemId] >= amount, "Insufficient escrow balance");
        itemEscrow[itemId] -= amount;

        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Transfer failed");
    }

    function getEscrowBalance(uint256 itemId) external view returns (uint256) {
        return itemEscrow[itemId];
    }

    function clearEscrow(uint256 itemId) external trustedCallerOnly {
        itemEscrow[itemId] = 0;
    }

    // ---- Getter Functions ----

    function getItem(uint id) public view returns (PawnItem memory) {
        return allItems[id];
    }

    function getAllItems() public view returns (PawnItem[] memory) {
        uint i = 0;
        uint validItemsCount = 0;

        for (i = 0; i < nextItemId; i++) {
            PawnItem memory item = allItems[i];
            if (item.owner == address(0) || item.itemStatus != ItemStatus.LISTED) {
                // deleted item -> default zero address
                // or if it's not in LISTED state, then it shouldn't appear
                continue;
            }

            validItemsCount++;
        }

        PawnItem[] memory items = new PawnItem[](validItemsCount);
        uint256 j = 0; // iterator for storing
        for (i = 0; i < nextItemId; i++) {
            PawnItem memory itemToAdd = allItems[i];
            if (itemToAdd.owner == address(0) || itemToAdd.itemStatus != ItemStatus.LISTED) {
                // deleted item -> default zero address
                // or if it's not in LISTED state, then it shouldn't appear
                continue;
            }
            items[j] = itemToAdd;
            j++;
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
        // used by tests to explicitly set statuses
        PawnItem storage item = allItems[itemId];
        item.itemStatus = newStatus;
    }

    function updateToNextStatus(uint256 itemId) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        uint nextStatus = uint(item.itemStatus) + 1;
        require(nextStatus <= uint(ItemStatus.END_OF_TRANSACTION), "Cannot increment stage beyond End of Transaction");
        item.itemStatus = ItemStatus(nextStatus);
    }

    function resetStatus(uint256 itemId) external trustedCallerOnly {
        PawnItem storage item = allItems[itemId];
        item.itemStatus = ItemStatus.LISTED;
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

    function addItemIdToTakerList(uint256 itemId) external trustedCallerOnly {
        address takerAddress = getItemTaker(itemId);
        takerItems[takerAddress].push(itemId);
    }

    function removeItemIdFromTakerList(uint256 itemId) external trustedCallerOnly {
        address takerAddress = getItemTaker(itemId);
        uint256[] storage items = takerItems[takerAddress];

        for (uint256 i = 0; i < items.length; i++) {
            if (items[i] == itemId) {
                items[i] = items[items.length - 1];
                items.pop();
                break;
            }
        }
    }

    receive() external payable {}
}
