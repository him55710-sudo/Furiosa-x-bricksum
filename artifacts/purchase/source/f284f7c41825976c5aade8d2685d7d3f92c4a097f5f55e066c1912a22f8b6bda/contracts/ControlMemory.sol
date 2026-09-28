// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// Test-only asset: no mint endpoint, no value or production payment claims.
contract TestCredit is ERC20 {
    constructor(address treasury) ERC20("Devnet TestCredit", "TC") { _mint(treasury, 100_000_000); }
    function decimals() public pure override returns (uint8) { return 2; }
}

contract BudgetVault is EIP712, ReentrancyGuard {
    struct Mandate {
        bytes32 sessionId; address owner; uint256 totalCap; uint256 perTxCap;
        uint256 expiresAt; bytes32 purposeHash; bytes32 skuHash; uint256 minQuantity;
        uint256 minRefundHours; bytes32 merchantsHash; bytes32 policyHash; uint256 nonce;
    }
    struct Offer {
        bytes32 sessionId; bytes32 offerId; address merchant; bytes32 purposeHash;
        bytes32 skuHash; uint256 quantity; uint256 refundHours; uint256 subtotal;
        uint256 fee; uint256 total; uint256 expiresAt;
    }
    bytes32 private constant MANDATE_TYPEHASH = keccak256("Mandate(bytes32 sessionId,address owner,uint256 totalCap,uint256 perTxCap,uint256 expiresAt,bytes32 purposeHash,bytes32 skuHash,uint256 minQuantity,uint256 minRefundHours,bytes32 merchantsHash,bytes32 policyHash,uint256 nonce)");
    bytes32 private constant OFFER_TYPEHASH = keccak256("Offer(bytes32 sessionId,bytes32 offerId,address merchant,bytes32 purposeHash,bytes32 skuHash,uint256 quantity,uint256 refundHours,uint256 subtotal,uint256 fee,uint256 total,uint256 expiresAt)");
    bytes32 private constant REVOKE_TYPEHASH = keccak256("Revoke(bytes32 sessionId,address owner)");
    TestCredit public immutable token;
    address public immutable executor;
    uint256 public allocated;
    mapping(bytes32 => Mandate) public mandates;
    mapping(bytes32 => uint256) public spent;
    mapping(bytes32 => bool) public active;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => mapping(address => bool)) public allowed;
    mapping(bytes32 => bool) public usedPayments;
    mapping(bytes32 => bool) public usedOffers;
    event MandateCreated(bytes32 indexed sessionId, address indexed owner, bytes32 mandateDigest);
    event Payment(bytes32 indexed sessionId, bytes32 indexed paymentKey, address indexed merchant, uint256 amount, bytes32 offerDigest, bytes32 evidenceHash, uint256 cumulativeSpent);
    event Revoked(bytes32 indexed sessionId, address indexed owner);

    constructor(address credit, address worker) EIP712("ControlMemory", "1") {
        token = TestCredit(credit); executor = worker;
    }
    modifier onlyExecutor() { require(msg.sender == executor, "EXECUTOR_ONLY"); _; }

    function mandateDigest(Mandate calldata m) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(MANDATE_TYPEHASH, m)));
    }
    function offerDigest(Offer calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(OFFER_TYPEHASH, o)));
    }
    function createMandate(Mandate calldata m, address[] calldata merchants, bytes calldata signature) external onlyExecutor {
        require(m.owner != address(0) && mandates[m.sessionId].owner == address(0), "SESSION_EXISTS");
        require(m.totalCap > 0 && m.perTxCap > 0 && m.perTxCap <= m.totalCap, "INVALID_CAP");
        require(m.expiresAt > block.timestamp, "DEADLINE_EXPIRED");
        require(m.nonce == nonces[m.owner]++, "NONCE_USED");
        require(merchants.length > 0 && merchants.length <= 8 && keccak256(abi.encode(merchants)) == m.merchantsHash, "MERCHANTS_MISMATCH");
        require(ECDSA.recover(mandateDigest(m), signature) == m.owner, "OWNER_SIGNATURE");
        require(token.balanceOf(address(this)) >= allocated + m.totalCap, "INSUFFICIENT_TEST_FUNDS");
        mandates[m.sessionId] = m; active[m.sessionId] = true; allocated += m.totalCap;
        for (uint256 i; i < merchants.length; i++) { require(merchants[i] != address(0), "ZERO_MERCHANT"); allowed[m.sessionId][merchants[i]] = true; }
        emit MandateCreated(m.sessionId, m.owner, mandateDigest(m));
    }
    function executePayment(Offer calldata o, bytes calldata signature, bytes32 paymentKey, bytes32 evidenceHash) external onlyExecutor nonReentrant {
        Mandate storage m = mandates[o.sessionId];
        require(active[o.sessionId], "MANDATE_INACTIVE");
        require(block.timestamp < m.expiresAt && block.timestamp < o.expiresAt, "DEADLINE_EXPIRED");
        require(allowed[o.sessionId][o.merchant], "MERCHANT_NOT_ALLOWED");
        require(o.purposeHash == m.purposeHash && o.skuHash == m.skuHash, "PURPOSE_MISMATCH");
        require(o.quantity >= m.minQuantity && o.refundHours >= m.minRefundHours, "SPEC_MISMATCH");
        require(o.total > 0 && o.total == o.subtotal + o.fee, "TOTAL_MISMATCH");
        require(o.total <= m.perTxCap && spent[o.sessionId] + o.total <= m.totalCap, "BUDGET_EXCEEDED");
        bytes32 digest = offerDigest(o);
        require(ECDSA.recover(digest, signature) == o.merchant, "SELLER_SIGNATURE");
        require(!usedPayments[paymentKey] && !usedOffers[digest], "DUPLICATE_PAYMENT");
        usedPayments[paymentKey] = true; usedOffers[digest] = true;
        spent[o.sessionId] += o.total; allocated -= o.total;
        require(token.transfer(o.merchant, o.total), "TRANSFER_FAILED");
        emit Payment(o.sessionId, paymentKey, o.merchant, o.total, digest, evidenceHash, spent[o.sessionId]);
    }
    function revoke(bytes32 sessionId, bytes calldata signature) external onlyExecutor {
        Mandate storage m = mandates[sessionId];
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(REVOKE_TYPEHASH, sessionId, m.owner)));
        require(m.owner != address(0) && ECDSA.recover(digest, signature) == m.owner, "OWNER_SIGNATURE");
        if (active[sessionId]) { active[sessionId] = false; allocated -= m.totalCap - spent[sessionId]; emit Revoked(sessionId, m.owner); }
    }
}
