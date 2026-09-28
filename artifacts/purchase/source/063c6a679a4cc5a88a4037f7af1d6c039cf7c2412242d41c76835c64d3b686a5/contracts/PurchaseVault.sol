// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// One owner-approved resource retrieval, at most one successful token transfer.
/// Result delivery and truth are deliberately not on-chain assertions.
contract PurchaseVault is EIP712, ReentrancyGuard {
    struct Consent {
        bytes32 purchaseId; address owner; bytes32 resourceSpecHash;
        uint256 totalCap; uint256 perTxCap; uint256 expiresAt;
        bytes32 merchantsHash; uint256 maxSettlements; uint256 nonce;
    }
    struct Quote {
        bytes32 purchaseId; address owner; bytes32 resourceSpecHash;
        bytes32 offerId; address merchant; uint256 subtotal;
        uint256 fee; uint256 total; uint256 expiresAt;
    }
    bytes32 constant CONSENT_TYPEHASH = keccak256("Consent(bytes32 purchaseId,address owner,bytes32 resourceSpecHash,uint256 totalCap,uint256 perTxCap,uint256 expiresAt,bytes32 merchantsHash,uint256 maxSettlements,uint256 nonce)");
    bytes32 constant QUOTE_TYPEHASH = keccak256("Quote(bytes32 purchaseId,address owner,bytes32 resourceSpecHash,bytes32 offerId,address merchant,uint256 subtotal,uint256 fee,uint256 total,uint256 expiresAt)");
    bytes32 constant REVOKE_TYPEHASH = keccak256("RevokePurchase(bytes32 purchaseId,address owner)");
    IERC20 public immutable token;
    address public immutable executor;
    uint256 public allocated;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => Consent) public consents;
    mapping(bytes32 => bool) public active;
    mapping(bytes32 => bool) public settled;
    mapping(bytes32 => uint256) public spent;
    mapping(bytes32 => mapping(address => bool)) public allowed;
    event PurchaseApproved(bytes32 indexed key, bytes32 indexed purchaseId, address indexed owner, bytes32 consentDigest);
    event PurchaseSettled(bytes32 indexed key, bytes32 indexed purchaseId, address indexed merchant, bytes32 resourceSpecHash, bytes32 offerDigest, bytes32 evidenceHash, uint256 amount);
    event PurchaseRevoked(bytes32 indexed key, address indexed owner);
    constructor(address asset, address worker) EIP712("ControlMemoryPurchase", "3") {
        require(asset != address(0) && worker != address(0), "ZERO_ADDRESS");
        token = IERC20(asset); executor = worker;
    }
    modifier onlyExecutor() { require(msg.sender == executor, "EXECUTOR_ONLY"); _; }
    function keyOf(address owner, bytes32 purchaseId) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), owner, purchaseId));
    }
    function consentDigest(Consent calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(CONSENT_TYPEHASH, c)));
    }
    function quoteDigest(Quote calldata q) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(QUOTE_TYPEHASH, q)));
    }
    function approvePurchase(Consent calldata c, address[] calldata merchants, bytes calldata signature) external onlyExecutor {
        bytes32 key = keyOf(c.owner, c.purchaseId);
        require(c.owner != address(0) && c.purchaseId != bytes32(0), "INVALID_OWNER_OR_ID");
        require(consents[key].owner == address(0), "PURCHASE_ALREADY_REGISTERED");
        require(c.maxSettlements == 1, "ONE_PURCHASE_ONLY");
        require(c.totalCap > 0 && c.perTxCap > 0 && c.perTxCap <= c.totalCap, "INVALID_CAP");
        require(c.expiresAt > block.timestamp, "DEADLINE_EXPIRED");
        require(c.nonce == nonces[c.owner]++, "NONCE_USED");
        require(merchants.length > 0 && merchants.length <= 8 && keccak256(abi.encode(merchants)) == c.merchantsHash, "MERCHANTS_MISMATCH");
        require(ECDSA.recover(consentDigest(c), signature) == c.owner, "OWNER_SIGNATURE");
        require(token.balanceOf(address(this)) >= allocated + c.totalCap, "INSUFFICIENT_TEST_FUNDS");
        consents[key] = c; active[key] = true; allocated += c.totalCap;
        for (uint256 i; i < merchants.length; i++) {
            require(merchants[i] != address(0), "ZERO_MERCHANT"); allowed[key][merchants[i]] = true;
        }
        emit PurchaseApproved(key, c.purchaseId, c.owner, consentDigest(c));
    }
    function pay(Quote calldata q, bytes calldata signature, bytes32 evidenceHash) external onlyExecutor nonReentrant {
        bytes32 key = keyOf(q.owner, q.purchaseId);
        Consent storage c = consents[key];
        require(!settled[key], "PURCHASE_ALREADY_PAID");
        require(active[key], "PURCHASE_INACTIVE");
        require(block.timestamp < c.expiresAt && block.timestamp < q.expiresAt, "DEADLINE_EXPIRED");
        require(q.resourceSpecHash == c.resourceSpecHash, "RESOURCE_MISMATCH");
        require(allowed[key][q.merchant], "MERCHANT_NOT_ALLOWED");
        require(q.total > 0 && q.total == q.subtotal + q.fee, "TOTAL_MISMATCH");
        require(q.total <= c.perTxCap && q.total <= c.totalCap, "BUDGET_EXCEEDED");
        bytes32 digest = quoteDigest(q);
        require(ECDSA.recover(digest, signature) == q.merchant, "SELLER_SIGNATURE");
        require(evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        settled[key] = true; spent[key] = q.total;
        // No second settlement is possible, so all remaining allocation is released.
        allocated -= c.totalCap;
        require(token.transfer(q.merchant, q.total), "TRANSFER_FAILED");
        emit PurchaseSettled(key, q.purchaseId, q.merchant, q.resourceSpecHash, digest, evidenceHash, q.total);
    }
    function revokeDirect(bytes32 purchaseId) external {
        _revoke(msg.sender, purchaseId);
    }
    function revokeWithSignature(address owner, bytes32 purchaseId, bytes calldata signature) external {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(REVOKE_TYPEHASH, purchaseId, owner)));
        require(ECDSA.recover(digest, signature) == owner, "OWNER_SIGNATURE");
        _revoke(owner, purchaseId);
    }
    function _revoke(address owner, bytes32 purchaseId) internal {
        bytes32 key = keyOf(owner, purchaseId);
        require(consents[key].owner == owner && owner != address(0), "PURCHASE_NOT_FOUND");
        if (active[key]) {
            active[key] = false;
            if (!settled[key]) allocated -= consents[key].totalCap;
            emit PurchaseRevoked(key, owner);
        }
    }
}
