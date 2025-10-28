// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopCommon.sol";

contract Pledger is PawnshopCommon {
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

    address public pawnbrokerContract;

    constructor(address _pawnStorageAddress, address _pawnbrokerAddress) PawnshopCommon(_pawnStorageAddress) {
        pawnbrokerContract = _pawnbrokerAddress;
    }

    // ---- Modifiers ----
    modifier itemOwnerOnly(uint256 itemId) {
        require(pawnStorageContract.getItemOwner(itemId) == msg.sender, "Sender must be the item owner");
        _;
    }

    modifier duringRedemptionPeriod(uint256 itemId) {
        uint256 currentTime = block.timestamp;
        uint256 claimedTime = pawnStorageContract.getTakenAt(itemId);
        uint256 redemptionPeriod = pawnStorageContract.getRedemptionPeriod(itemId);
        require(
            claimedTime < currentTime && currentTime <= claimedTime + redemptionPeriod,
            "Cannot redeem item outside of redemption period"
        );
        _;
    }

    // ---- Item Management ----
    function getMyList() external view returns (PawnStorage.PawnItem[] memory) {
        return pawnStorageContract.getItemsByOwner(msg.sender);
    }

    function createMyItem(
        string calldata itemName,
        string calldata itemUrl,
        uint256 itemPrice,
        uint256 redemptionPrice,
        uint256 punishmentPrice,
        uint256 redemptionPeriod
    ) public returns (PawnStorage.PawnItem memory) {
        require(redemptionPrice > itemPrice, "Redemption price must be higher than item price to benefit Pawnbroker");
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
        PawnStorage.PawnItem memory updatedItem = pawnStorageContract.updateItem(
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
    ) public itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.LISTED) {
        pawnStorageContract.deleteItem(itemId);
        emit ItemDeleted(itemId, msg.sender);
    }

    function acceptClaim(
        uint256 itemId
    ) public itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_NEGOTIATION) {
        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.IN_DELIVERY);

        // Moved the taker details to the Pawnbroker side -> have to ensure pawnbroker receives the item first
        // address otherParty = pawnStorageContract.getOtherParty(itemId);
        // pawnStorageContract.setTakenBy(itemId, otherParty);
        // pawnStorageContract.setTakenAt(itemId, block.timestamp);
    }

    // function rejectClaim(
    //     uint256 itemId
    // ) public itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_NEGOTIATION) {
    //     pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.LISTED);
    //     pawnStorageContract.setOtherParty(itemId, address(0));

    //     // return the amount he sent
    //     (uint256 price, , uint256 punishment) = pawnStorageContract.getItemPrices(itemId);

    //     (bool success, ) = payable(otherParty).call{value: price + punishment}("");
    //     require(success, "Transfer failed");
    // }

    function transferToPawnbrokerContract(uint256 amount) internal {
        (bool success, ) = payable(pawnbrokerContract).call{value: amount}("");
        require(success, "Transfer to pawnbroker contract failed");
    }

    function redeemItem(
        uint256 itemId
    )
        external
        payable
        itemOwnerOnly(itemId)
        itemStatusIs(itemId, PawnStorage.ItemStatus.CLAIMED)
        duringRedemptionPeriod(itemId)
    {
        (, uint256 redemption, ) = pawnStorageContract.getItemPrices(itemId);

        require(msg.value >= redemption, "Insufficient ether to redeem");

        uint256 toReturn = msg.value - redemption;
        if (toReturn > 0) {
            (bool success, ) = payable(msg.sender).call{value: toReturn}("");
            require(success, "Transfer failed");
        }

        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.IN_REDEMPTION);
        transferToPawnbrokerContract(redemption);
    }

    function confirmItemDelivered(
        uint256 itemId
    ) external itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_DELIVERY_RETURN) {
        (, uint256 redemption, uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        address itemTaker = pawnStorageContract.getItemTaker(itemId);

        (bool success, ) = payable(itemTaker).call{value: redemption + punishment}("");
        require(success, "Transfer failed");

        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.RETURNED);
    }
}
