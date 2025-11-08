// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopCommon.sol";

contract Pawnbroker is PawnshopCommon {
    event ItemClaimed(uint256 indexed itemId, address indexed taker);
    event ClaimAccepted(uint256 indexed itemId, address indexed owner);
    event ItemDelivered(uint256 indexed itemId, address indexed taker);

    constructor(address payable _pawnStorageAddress) PawnshopCommon(_pawnStorageAddress) {}

    // ---- Modifiers ----
    modifier itemTakerOnly(uint256 itemId) {
        require(pawnStorageContract.getItemTaker(itemId) == msg.sender, "Sender must be the item taker");
        _;
    }

    modifier claimInitiatorOnly(uint256 itemId) {
        require(pawnStorageContract.getOtherParty(itemId) == msg.sender, "Sender must be the claim initiator");
        _;
    }

    modifier notItemOwner(uint256 itemId) {
        require(pawnStorageContract.getItemOwner(itemId) != msg.sender, "Taker must not be the item owner");
        _;
    }

    function getMyClaimedList() external view returns (PawnStorage.PawnItem[] memory) {
        // Get items where I'm the taker (already claimed and confirmed - CLAIMED status and beyond)
        PawnStorage.PawnItem[] memory takenItems = pawnStorageContract.getItemsByTaker(msg.sender);

        // Get items where I'm the otherParty (in negotiation or delivery - IN_NEGOTIATION, IN_DELIVERY)
        PawnStorage.PawnItem[] memory negotiatingItems = pawnStorageContract.getItemsByOtherParty(msg.sender);

        // Merge both arrays
        uint256 totalLength = takenItems.length + negotiatingItems.length;
        PawnStorage.PawnItem[] memory allItems = new PawnStorage.PawnItem[](totalLength);

        uint256 index = 0;
        for (uint256 i = 0; i < takenItems.length; i++) {
            allItems[index] = takenItems[i];
            index++;
        }
        for (uint256 i = 0; i < negotiatingItems.length; i++) {
            allItems[index] = negotiatingItems[i];
            index++;
        }

        return allItems;
    }

    function startClaimProcess(uint256 itemId) internal {
        pawnStorageContract.updateToNextStatus(itemId);
        pawnStorageContract.setOtherParty(itemId, msg.sender);
    }

    function claimItem(
        uint256 itemId
    ) external payable notItemOwner(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.LISTED) {
        (uint256 price, , uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        uint256 requiredAmount = price + punishment;

        require(msg.value >= requiredAmount, "Insufficient ether to claim");

        pawnStorageContract.depositToEscrow{value: requiredAmount}(itemId);

        uint256 toReturn = msg.value - requiredAmount;
        if (toReturn > 0) {
            (bool success, ) = payable(msg.sender).call{value: toReturn}("");
            require(success, "Transfer failed");
        }

        startClaimProcess(itemId);
    }

    function withdrawClaim(
        uint256 itemId
    ) public claimInitiatorOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_NEGOTIATION) {
        (uint256 price, , uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        uint256 refundAmount = price + punishment;

        pawnStorageContract.withdrawFromEscrow(itemId, msg.sender, refundAmount);
        pawnStorageContract.resetStatus(itemId);

        // Clear otherParty when claim is withdrawn
        pawnStorageContract.setOtherParty(itemId, address(0));
    }

    function confirmItemDelivered(
        uint256 itemId
    ) external claimInitiatorOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_DELIVERY) {
        (uint256 price, , ) = pawnStorageContract.getItemPrices(itemId);
        address itemOwner = pawnStorageContract.getItemOwner(itemId);

        pawnStorageContract.withdrawFromEscrow(itemId, itemOwner, price);

        pawnStorageContract.updateToNextStatus(itemId);
        pawnStorageContract.setTakenBy(itemId, msg.sender);
        pawnStorageContract.setTakenAt(itemId, block.timestamp);
        pawnStorageContract.addItemIdToTakerList(itemId);

        // Clear otherParty since negotiation/delivery phase is complete
        pawnStorageContract.setOtherParty(itemId, address(0));
    }

    function returnItem(
        uint256 itemId
    ) external itemTakerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_REDEMPTION) {
        pawnStorageContract.updateToNextStatus(itemId);
        pawnStorageContract.removeItemIdFromTakerList(itemId);
    }

    function claimAmount(
        uint256 itemId
    ) external itemTakerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.RETURNED) {
        (, uint256 redemption, uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        uint256 totalAmount = redemption + punishment;

        pawnStorageContract.withdrawFromEscrow(itemId, msg.sender, totalAmount);
        pawnStorageContract.clearEscrow(itemId);
        pawnStorageContract.updateToNextStatus(itemId);
    }

    function retrievePunishmentFee(
        uint256 itemId
    ) external itemTakerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.CLAIMED) {
        uint256 currentTime = block.timestamp;
        uint256 claimedTime = pawnStorageContract.getTakenAt(itemId);
        uint256 redemptionPeriod = pawnStorageContract.getRedemptionPeriod(itemId);
        
        require(
            currentTime > claimedTime + redemptionPeriod * 24 * 60 * 60,
            "Cannot retrieve punishment fee during redemption period"
        );

        (, , uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        
        pawnStorageContract.withdrawFromEscrow(itemId, msg.sender, punishment);
        pawnStorageContract.clearEscrow(itemId);
        pawnStorageContract.removeItemIdFromTakerList(itemId);
        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.END_OF_TRANSACTION);
    }

    // Allow receiving ETH for any edge cases, but primary storage is in PawnStorage
    receive() external payable {}
}
