// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PawnshopCommon.sol";

contract Pawnbroker is PawnshopCommon {
    event ItemClaimed(uint256 indexed itemId, address indexed taker);
    event ClaimAccepted(uint256 indexed itemId, address indexed owner);
    event ItemDelivered(uint256 indexed itemId, address indexed taker);

    constructor(address _pawnStorageAddress) PawnshopCommon(_pawnStorageAddress) {}

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
        return pawnStorageContract.getItemsByTaker(msg.sender);
    }

    function startClaimProcess(uint256 itemId) internal {
        // Helper function to update details upon claim request
        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.IN_NEGOTIATION);
        pawnStorageContract.setOtherParty(itemId, msg.sender);
    }

    function claimItem(
        uint256 itemId
    ) external payable notItemOwner(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.LISTED) {
        (uint256 price, , uint256 punishment) = pawnStorageContract.getItemPrices(itemId);

        require(msg.value >= (price + punishment), "Insufficient ether to claim");

        uint256 toReturn = msg.value - (price + punishment);
        if (toReturn > 0) {
            (bool success, ) = payable(msg.sender).call{value: toReturn}("");
            require(success, "Transfer failed");
        }

        startClaimProcess(itemId);
    }

    function confirmItemDelivered(
        uint256 itemId
    ) external claimInitiatorOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_DELIVERY) {
        (uint256 price, , ) = pawnStorageContract.getItemPrices(itemId);
        address itemOwner = pawnStorageContract.getItemOwner(itemId);

        (bool success, ) = payable(itemOwner).call{value: price}("");
        require(success, "Transfer failed");

        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.CLAIMED);
        pawnStorageContract.setTakenBy(itemId, msg.sender);
        pawnStorageContract.setTakenAt(itemId, block.timestamp);
        pawnStorageContract.addItemIdToTakerList(itemId);
    }

    function returnItem(
        uint256 itemId
    ) external itemTakerOnly(itemId) itemStatusIs(itemId, PawnStorage.ItemStatus.IN_REDEMPTION) {
        pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.IN_DELIVERY_RETURN);
        pawnStorageContract.removeItemIdFromTakerList(itemId);
    }

    function claimAmount(uint256 itemId) external itemTakerOnly(itemId) {
        PawnStorage.ItemStatus itemStatus = pawnStorageContract.getItemStatus(itemId);
        require(
            itemStatus == PawnStorage.ItemStatus.IN_NEGOTIATION || itemStatus == PawnStorage.ItemStatus.RETURNED,
            "Claim not allowed for this item status"
        );

        (uint256 price, uint256 redemption, uint256 punishment) = pawnStorageContract.getItemPrices(itemId);
        if (itemStatus == PawnStorage.ItemStatus.IN_NEGOTIATION) {
            (bool success, ) = payable(msg.sender).call{value: price + punishment}("");
            require(success, "Transfer failed");
            pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.LISTED);
        } else if (itemStatus == PawnStorage.ItemStatus.RETURNED) {
            (bool success, ) = payable(msg.sender).call{value: redemption + punishment}("");
            require(success, "Transfer failed");
            pawnStorageContract.setStatus(itemId, PawnStorage.ItemStatus.END_OF_TRANSACTION);
        }
    }

    receive() external payable {
        // pawnbroker contract will the main point of contact for releasing eth
    }
}
