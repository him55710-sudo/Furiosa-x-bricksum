// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Hackathon escrow. The controller is a TRUSTED off-chain policy/delivery
/// verifier. Evidence hashes commit to its attestation, not semantic truth.
contract AgentDealEscrow {
    enum Status { NONE, LOCKED, RELEASED, REFUNDED }
    struct Escrow { address buyer; address seller; uint256 amount; uint64 deadline; Status status; }
    address public immutable controller;
    mapping(bytes32 => Escrow) public escrows;
    bool private entered;
    event Funded(bytes32 indexed dealHash, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline);
    event Released(bytes32 indexed dealHash, bytes32 evidenceHash, uint256 amount);
    event Refunded(bytes32 indexed dealHash, bytes32 reasonHash, uint256 amount);
    modifier onlyController() { require(msg.sender == controller, "CONTROLLER_ONLY"); _; }
    modifier guard() { require(!entered, "REENTRANCY"); entered = true; _; entered = false; }
    constructor(address who) { require(who != address(0), "ZERO_CONTROLLER"); controller = who; }
    function fund(bytes32 dealHash, address buyer, address seller, uint256 amount, uint32 deliveryWindow, uint64 dealExpiry) external payable onlyController guard {
        require(dealHash != bytes32(0) && escrows[dealHash].status == Status.NONE, "DUPLICATE_DEAL");
        require(buyer != address(0) && seller != address(0) && seller != buyer, "INVALID_PARTIES");
        require(amount > 0 && msg.value == amount, "EXACT_AMOUNT");
        require(deliveryWindow > 0 && deliveryWindow <= 3600 && dealExpiry > block.timestamp, "EXPIRED");
        uint64 deadline = uint64(block.timestamp + deliveryWindow);
        if (dealExpiry < deadline) deadline = dealExpiry;
        escrows[dealHash] = Escrow(buyer, seller, amount, deadline, Status.LOCKED);
        emit Funded(dealHash,buyer,seller,amount,deadline);
    }
    function release(bytes32 dealHash, bytes32 evidenceHash) external onlyController guard {
        Escrow storage e = escrows[dealHash]; require(e.status == Status.LOCKED, "NOT_LOCKED");
        require(block.timestamp < e.deadline, "EXPIRED"); require(evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        e.status = Status.RELEASED;
        (bool ok,) = e.seller.call{value:e.amount}(""); require(ok,"TRANSFER_FAILED");
        emit Released(dealHash,evidenceHash,e.amount);
    }
    function refund(bytes32 dealHash, bytes32 reasonHash) external guard {
        Escrow storage e = escrows[dealHash]; require(e.status == Status.LOCKED, "NOT_LOCKED");
        require(msg.sender == controller || (msg.sender == e.buyer && block.timestamp >= e.deadline), "REFUND_UNAUTHORIZED");
        require(reasonHash != bytes32(0), "REASON_REQUIRED"); e.status = Status.REFUNDED;
        (bool ok,) = e.buyer.call{value:e.amount}(""); require(ok,"TRANSFER_FAILED");
        emit Refunded(dealHash,reasonHash,e.amount);
    }
}
