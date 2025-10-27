// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./PawnStorage.sol";

contract PawnshopCommon {
    PawnStorage public pawnStorageContract;
    address public owner;

    constructor(address _pawnStorageAddress) {
        require(_pawnStorageAddress != address(0), "Invalid storage address");
        pawnStorageContract = PawnStorage(_pawnStorageAddress);
        owner = msg.sender;
    }

    modifier itemStatusIs(
        uint256 itemId,
        PawnStorage.ItemStatus requiredStatus
    ) {
        require(
            pawnStorageContract.getItemStatus(itemId) == requiredStatus,
            "Item status incorrect"
        );
        _;
    }

    function getPublicList()
        external
        view
        returns (PawnStorage.PawnItem[] memory)
    {
        return pawnStorageContract.getAllItems();
    }

    function getItem(
        uint256 itemId
    ) public view returns (PawnStorage.PawnItem memory) {
        return pawnStorageContract.getItem(itemId);
    }
}
