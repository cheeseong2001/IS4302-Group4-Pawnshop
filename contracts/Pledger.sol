// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopItems.sol";

contract Pledger is PawnshopItems {

    // ---- Events ----
    event ItemCreated(uint256 indexed itemId, address indexed owner);
    event ItemUpdated(uint256 indexed itemId, address indexed owner);
    event ItemDeleted(uint256 indexed itemId, address indexed owner);
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

    // ---- Modifiers ----
    modifier itemOwnerOnly(uint256 itemId) {
        require(itemList[itemId].owner == msg.sender, "NotOwner");
        _;
    }

    modifier notItemOwner(uint256 itemId) {
        require(itemList[itemId].owner != msg.sender, "OwnerCannotClaim");
        _;
    }

    modifier takerOnly(uint256 itemId) {
        require(itemList[itemId].takenBy == msg.sender, "NotTaker");
        _;
    }

    modifier onlyItemStatus(uint256 itemId, ItemStatus requiredStatus) {
        require(itemList[itemId].itemStatus == requiredStatus, "WrongStatus");
        _;
    }

    // ---- Getters ----
    function getMyList() external view returns (uint256[] memory) {
        return ownerItems[msg.sender];
    }

    // ---- Item Management ----
    function createMyItem(
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) public returns (Item memory) {
        uint256 id = ++nextItemId;

        Item storage it = itemList[id];
        it.itemId = id;
        it.owner = msg.sender;
        it.itemName = itemName;
        it.itemUrl = itemUrl;
        it.itemPrice = itemPrice;
        it.redemptionPrice = redemptionPrice;
        it.punishmentPrice = punishmentPrice;
        it.redemptionPeriod = redemptionPeriod;
        it.itemStatus = ItemStatus.LISTED;
        it.takenAt = 0;
        it.takenBy = address(0);

        ownerItems[msg.sender].push(id);

        emit ItemCreated(id, msg.sender);
        return itemList[id];
    }

    function updateMyItem(uint256 itemId, ItemUpdateData memory data) external
        itemOwnerOnly(itemId)
        onlyItemStatus(itemId, ItemStatus.LISTED)
    {
        itemList[itemId].itemName = data.itemName;
        itemList[itemId].itemUrl = data.itemUrl;
        itemList[itemId].itemPrice = data.itemPrice;
        itemList[itemId].redemptionPrice = data.redemptionPrice;
        itemList[itemId].punishmentPrice = data.punishmentPrice;
        itemList[itemId].redemptionPeriod = data.redemptionPeriod;

        emit ItemUpdated(itemId, msg.sender);
    }

    function deleteMyItem(uint256 itemId) public
        itemOwnerOnly(itemId)
        onlyItemStatus(itemId, ItemStatus.LISTED)
    {
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

    function claimItem(uint256 itemId) public payable
        notItemOwner(itemId)
        onlyItemStatus(itemId, ItemStatus.LISTED)
    {
        Item storage it = itemList[itemId];
        uint256 totalCost = it.punishmentPrice + it.itemPrice;
        require(msg.value >= totalCost, "NotEnoughETH");
        (bool sent, ) = payable(address(this)).call{value: totalCost}("");
        require(sent, "TransferFailed");
        if (msg.value > totalCost) {
            (bool refundSent, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refundSent, "RefundFailed");
        }

        it.itemStatus = ItemStatus.NEGOTIATION;
        it.takenBy = msg.sender;

        takerItems[msg.sender].push(itemId);

        emit ItemClaimed(itemId, msg.sender);
    }

    function acceptClaimRequest(uint256 itemId) public
        itemOwnerOnly(itemId)
        onlyItemStatus(itemId, ItemStatus.NEGOTIATION)
    {
        itemList[itemId].itemStatus = ItemStatus.DELIVERIED;
        emit ClaimAccepted(itemId, msg.sender);
    }

    function confirmItemDelivered(uint256 itemId) public
        takerOnly(itemId)
        onlyItemStatus(itemId, ItemStatus.DELIVERIED)
    {
        Item storage it = itemList[itemId];
        it.itemStatus = ItemStatus.TAKEN;
        it.takenAt = block.timestamp;
        (bool sent, ) = payable(it.owner).call{value: it.itemPrice}("");
        require(sent, "PaymentFailed");
        emit ItemDelivered(itemId, msg.sender);
    }
}
