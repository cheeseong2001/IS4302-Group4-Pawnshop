// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./PawnshopItems.sol";

contract Pawnbroker {
    
    constructor(PawnshopItems _pawnshopItems) {
        // No state variable to avoid collision with Pledger
    }
    
}
