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

    constructor(address payable _pawnStorageAddress) PawnshopCommon(_pawnStorageAddress) {}

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
            claimedTime < currentTime && currentTime <= claimedTime + redemptionPeriod * 24 * 60 * 60,
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
        pawnStorageContract.updateToNextStatus(itemId);

        // Moved the taker details to the Pawnbroker side -> have to ensure pawnbroker receives the item first
        // address otherParty = pawnStorageContract.getOtherParty(itemId);
        // pawnStorageContract.setTakenBy(itemId, otherParty);
        // pawnStorageContract.setTakenAt(itemId, block.timestamp);
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

        // Deposit redemption amount to storage contract
        pawnStorageContract.depositToEscrow{value: redemption}(itemId);

        // Return excess
        uint256 toReturn = msg.value - redemption;
        if (toReturn > 0) {
            (bool success, ) = payable(msg.sender).call{value: toReturn}("");
            require(success, "Transfer failed");
        }

        // to handle grace period for when pledger attempts to claim back on the last day of redemption period
        // give pawnbroker 7 days to return the item, even if it goes beyond redemption period
        uint256 returnByTimestamp = block.timestamp + 7 days;
        if (returnByTimestamp < pawnStorageContract.getReturnBy(itemId)) {
            pawnStorageContract.setReturnBy(itemId, returnByTimestamp);
        }

        pawnStorageContract.updateToNextStatus(itemId);
    }

    function confirmItemDelivered(
        uint256 itemId
    ) external itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_DELIVERY_RETURN) {
        address takenBy = pawnStorageContract.getItemTaker(itemId);

        (, uint256 redemption, uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        uint256 totalAmount = redemption + punishment;

        pawnStorageContract.withdrawFromEscrow(itemId, takenBy, totalAmount);
        pawnStorageContract.clearEscrow(itemId);
        pawnStorageContract.updateToNextStatus(itemId);
    }

    function getPunishmentFee(
        uint256 itemId
    ) external itemOwnerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_REDEMPTION) {
        // This is used when Pawnbroker fails to return item by ReturnBy time
        uint256 currentTime = block.timestamp;
        uint256 returnByTime = pawnStorageContract.getReturnBy(itemId);

        require(currentTime > returnByTime, "Cannot claim punishment fee during redemption period");

        (, uint256 redemption, uint256 punishment) = pawnStorageContract.getItemPrices(itemId);

        pawnStorageContract.withdrawFromEscrow(itemId, msg.sender, redemption + punishment); // return the redemption amount as well
        pawnStorageContract.clearEscrow(itemId);
        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.END_OF_TRANSACTION);
    }

    // Allow receiving ETH for any edge cases
    receive() external payable {}
}
