// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "./Pledger.sol";
import "./Pawnbroker.sol";


contract Pawnshop is Pledger, Pawnbroker {
    
    constructor(PawnshopItems _pawnshopItems) 
        Pledger(_pawnshopItems)
        Pawnbroker(_pawnshopItems)
    {
    }
    
}
