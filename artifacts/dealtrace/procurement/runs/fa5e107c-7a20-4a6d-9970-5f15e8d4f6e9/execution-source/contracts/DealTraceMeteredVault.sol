// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice V3 testnet extension: signed unit rates and maximum quantities are enforced
/// on-chain. The buyer-selected evaluator still attests to off-chain delivery truth.
/// No administrator, upgrades, arbitrary withdrawals or evaluator power to change terms.
contract DealTraceMeteredVault is EIP712, ReentrancyGuard {
    enum Status { NONE, LOCKED, RELEASED, REFUNDED }
    struct Mandate {
        address buyer;
        address agent;
        address evaluator;
        bytes32 sellersHash;
        uint256 budget;
        uint256 maxPerDeal;
        uint64 validUntil;
        uint256 nonce;
    }
    struct Authority { address buyer; address agent; address evaluator; uint256 budget; uint256 allocated; uint256 maxPerDeal; uint64 validUntil; bool revoked; }
    struct Deal { bytes32 dealHash; bytes32 mandateId; address seller; uint256 amount; uint32 deliveryWindow; uint64 expiresAt; bytes32 termsHash; bytes32 previewHash; }
    struct Escrow { bytes32 mandateId; address seller; uint256 amount; uint64 deadline; Status status; bytes32 termsHash; }
    struct Claim { bytes32 dealHash; bytes32 claimId; address payee; uint256 amount; bytes32 deliveryHash; }
    bytes32 public constant MANDATE_TYPEHASH = keccak256("Mandate(address buyer,address agent,address evaluator,bytes32 sellersHash,uint256 budget,uint256 maxPerDeal,uint64 validUntil,uint256 nonce)");
    bytes32 public constant DEAL_TYPEHASH = keccak256("Deal(bytes32 dealHash,bytes32 mandateId,address seller,uint256 amount,uint32 deliveryWindow,uint64 expiresAt,bytes32 termsHash,bytes32 previewHash)");
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(bytes32 dealHash,bytes32 claimId,address payee,uint256 amount,bytes32 deliveryHash)");
    bytes32 public constant VALIDATION_TYPEHASH = keccak256("Validation(bytes32 dealHash,bytes32 claimHash,bytes32 evidenceHash)");
    bytes32 public constant PREVIEW_TYPEHASH = keccak256("Preview(bytes32 dealHash,bytes32 previewHash)");
    mapping(bytes32 => Authority) public mandates;
    mapping(bytes32 => mapping(address => bool)) public allowedSeller;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => Escrow) public escrows;
    mapping(address => mapping(address => bool)) public requiresPreview;
    mapping(address => uint256) public credits;
    uint256 public totalLocked;
    uint256 public totalCredits;
    event MandateOpened(bytes32 indexed mandateId, address indexed buyer, address agent, address evaluator, uint256 budget, uint256 maxPerDeal, uint64 validUntil, bytes32 sellersHash);
    event MandateRevoked(bytes32 indexed mandateId);
    event Funded(bytes32 indexed dealHash, bytes32 indexed mandateId, address indexed seller, uint256 amount, uint64 deadline, bytes32 termsHash, bytes32 previewHash);
    event Released(bytes32 indexed dealHash, bytes32 claimHash, bytes32 deliveryHash, bytes32 evidenceHash, uint256 amount);
    event Refunded(bytes32 indexed dealHash, uint8 reason, bytes32 evidenceHash, uint256 amount);
    event PreviewRequired(address indexed buyer, address indexed seller, bytes32 indexed triggerDeal);
    event Withdrawn(address indexed beneficiary, address indexed destination, uint256 amount);
    constructor() EIP712("DealTraceMeteredVault", "3") {}

    struct Line { bytes32 lineId; uint256 unitPrice; uint32 maxUnits; }
    mapping(bytes32 => bytes32) public metering;
    bytes32 public constant METERING_TYPEHASH = keccak256("Metering(bytes32 dealHash,bytes32 linesHash)");
    event MeteringCommitted(bytes32 indexed dealHash, bytes32 linesHash);
    event MeteredSettled(bytes32 indexed dealHash, bytes32 claimHash, bytes32 usageHash, bytes32 evidenceHash, uint256 paid, uint256 refunded);

    function meteringDigest(bytes32 dealHash, bytes32 linesHash) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(METERING_TYPEHASH, dealHash, linesHash)));
    }

    function fundMetered(Deal calldata d, bytes calldata agentSignature, bytes calldata sellerSignature, bytes calldata previewSignature, Line[] calldata lines, bytes calldata agentMeterSignature, bytes calldata sellerMeterSignature) external payable nonReentrant {
        require(lines.length > 0 && lines.length <= 8, "METER_LINES");
        uint256 maximum;
        for (uint256 i; i < lines.length; ++i) {
            require(lines[i].lineId != bytes32(0) && lines[i].unitPrice > 0 && lines[i].maxUnits > 0 && lines[i].maxUnits <= 1000, "METER_LINE");
            for (uint256 j; j < i; ++j) require(lines[i].lineId != lines[j].lineId, "DUPLICATE_LINE");
            maximum += lines[i].unitPrice * lines[i].maxUnits;
        }
        require(maximum == d.amount, "METER_MAXIMUM");
        bytes32 commitment = keccak256(abi.encode(lines));
        bytes32 typed = meteringDigest(d.dealHash, commitment);
        require(_signed(mandates[d.mandateId].agent, typed, agentMeterSignature) && _signed(d.seller, typed, sellerMeterSignature), "METER_SIGNATURES");
        _fund(d, agentSignature, sellerSignature, previewSignature);
        metering[d.dealHash] = commitment;
        emit MeteringCommitted(d.dealHash, commitment);
    }

    /// Counts are attested by the buyer-chosen evaluator. The chain enforces the
    /// signed unit rates/caps and returns all unused principal; it cannot observe APIs.
    function settleMetered(Claim calldata c, bytes calldata sellerSignature, bytes32 evidenceHash, bytes calldata evaluatorSignature, Line[] calldata lines, uint32[] calldata successes) external nonReentrant {
        Escrow storage e = escrows[c.dealHash];
        require(e.status == Status.LOCKED && block.timestamp < e.deadline, "NOT_LOCKED_OR_EXPIRED");
        require(metering[c.dealHash] != bytes32(0) && keccak256(abi.encode(lines)) == metering[c.dealHash], "METER_COMMITMENT");
        require(lines.length == successes.length, "METER_COUNTS");
        uint256 paid;
        for (uint256 i; i < lines.length; ++i) {
            require(successes[i] <= lines[i].maxUnits, "METER_CAP");
            paid += lines[i].unitPrice * successes[i];
        }
        require(c.payee == e.seller && c.amount == paid, "CLAIM_MISMATCH");
        require(c.claimId != bytes32(0) && c.deliveryHash != bytes32(0) && evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        bytes32 digest = claimDigest(c);
        require(_signed(e.seller, digest, sellerSignature), "CLAIM_SIGNATURE");
        require(_signed(mandates[e.mandateId].evaluator, validationDigest(c.dealHash, digest, evidenceHash), evaluatorSignature), "EVALUATOR_SIGNATURE");
        e.status = Status.RELEASED;
        _credit(e.seller, paid);
        _credit(mandates[e.mandateId].buyer, e.amount - paid);
        emit MeteredSettled(c.dealHash, digest, c.deliveryHash, evidenceHash, paid, e.amount - paid);
    }

    // Use OZ's ECDSA validation plus the ERC-1271 address path. OZ 5.4's generic
    // SignatureChecker also imports ERC-7913/MCOPY, unsupported by our Shanghai devnet.
    function _signed(address signer, bytes32 message, bytes memory signature) private view returns (bool) {
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(message, signature);
            return err == ECDSA.RecoverError.NoError && recovered == signer;
        }
        (bool ok, bytes memory result) = signer.staticcall(abi.encodeCall(IERC1271.isValidSignature, (message, signature)));
        return ok && result.length >= 32 && abi.decode(result, (bytes32)) == bytes32(IERC1271.isValidSignature.selector);
    }

    function mandateDigest(Mandate calldata m) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(MANDATE_TYPEHASH, m))); }
    function dealDigest(Deal calldata d) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(DEAL_TYPEHASH, d))); }
    function claimDigest(Claim calldata c) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, c))); }
    function validationDigest(bytes32 dealHash, bytes32 claimHash, bytes32 evidenceHash) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(VALIDATION_TYPEHASH, dealHash, claimHash, evidenceHash))); }
    function previewDigest(bytes32 dealHash, bytes32 previewHash) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(PREVIEW_TYPEHASH, dealHash, previewHash))); }

    function openMandate(Mandate calldata m, address[] calldata sellers, bytes calldata signature) external nonReentrant returns (bytes32 id) {
        require(m.buyer != address(0) && m.agent != address(0) && m.evaluator != address(0), "INVALID_IDENTITY");
        require(m.validUntil > block.timestamp && m.budget > 0 && m.maxPerDeal > 0 && m.maxPerDeal <= m.budget, "INVALID_MANDATE");
        require(sellers.length > 0 && sellers.length <= 16 && keccak256(abi.encode(sellers)) == m.sellersHash, "SELLER_LIST");
        require(!usedNonce[m.buyer][m.nonce], "NONCE_USED");
        id = mandateDigest(m);
        require(_signed(m.buyer, id, signature), "BUYER_SIGNATURE");
        usedNonce[m.buyer][m.nonce] = true;
        mandates[id] = Authority(m.buyer, m.agent, m.evaluator, m.budget, 0, m.maxPerDeal, m.validUntil, false);
        for (uint256 i; i < sellers.length; ++i) {
            require(sellers[i] != address(0) && sellers[i] != m.buyer && !allowedSeller[id][sellers[i]], "INVALID_SELLER");
            allowedSeller[id][sellers[i]] = true;
        }
        emit MandateOpened(id, m.buyer, m.agent, m.evaluator, m.budget, m.maxPerDeal, m.validUntil, m.sellersHash);
    }

    /// @dev Revocation stops NEW commitments. Already locked work retains its signed terms.
    function revoke(bytes32 id) external {
        require(msg.sender == mandates[id].buyer, "BUYER_ONLY");
        mandates[id].revoked = true;
        emit MandateRevoked(id);
    }

    /// @dev A relayer may sponsor principal, but can never redirect its signed beneficiary.
    /// Budget is gross allocation for this mandate; refunds do not replenish permission.
    function fund(Deal calldata d, bytes calldata agentSignature, bytes calldata sellerSignature, bytes calldata previewSignature) external payable nonReentrant {
        _fund(d, agentSignature, sellerSignature, previewSignature);
    }

    function _fund(Deal calldata d, bytes calldata agentSignature, bytes calldata sellerSignature, bytes calldata previewSignature) private {
        Authority storage m = mandates[d.mandateId];
        require(m.buyer != address(0) && !m.revoked && block.timestamp < m.validUntil, "AUTHORITY_INACTIVE");
        require(d.dealHash != bytes32(0) && escrows[d.dealHash].status == Status.NONE, "DUPLICATE_DEAL");
        require(allowedSeller[d.mandateId][d.seller], "SELLER_NOT_ALLOWED");
        require(d.amount > 0 && msg.value == d.amount && d.amount <= m.maxPerDeal, "EXACT_AMOUNT_OR_LIMIT");
        require(m.allocated + d.amount <= m.budget, "SESSION_BUDGET");
        require(d.termsHash != bytes32(0) && d.deliveryWindow > 0 && d.deliveryWindow <= 3600, "INVALID_TERMS");
        uint64 deadline = uint64(block.timestamp + d.deliveryWindow);
        require(deadline <= d.expiresAt && d.expiresAt <= m.validUntil, "FULL_DELIVERY_WINDOW");
        bytes32 digest = dealDigest(d);
        require(_signed(m.agent, digest, agentSignature), "AGENT_SIGNATURE");
        require(_signed(d.seller, digest, sellerSignature), "SELLER_SIGNATURE");
        if (requiresPreview[m.buyer][d.seller]) {
            require(d.previewHash != bytes32(0) && _signed(m.evaluator, previewDigest(d.dealHash, d.previewHash), previewSignature), "PREVIEW_REQUIRED");
        }
        m.allocated += d.amount;
        totalLocked += d.amount;
        escrows[d.dealHash] = Escrow(d.mandateId, d.seller, d.amount, deadline, Status.LOCKED, d.termsHash);
        emit Funded(d.dealHash, d.mandateId, d.seller, d.amount, deadline, d.termsHash, d.previewHash);
    }

    function release(Claim calldata c, bytes calldata sellerSignature, bytes32 evidenceHash, bytes calldata evaluatorSignature) external nonReentrant {
        Escrow storage e = escrows[c.dealHash];
        require(e.status == Status.LOCKED, "NOT_LOCKED");
        require(block.timestamp < e.deadline, "EXPIRED");
        require(metering[c.dealHash] == bytes32(0), "METERED_SETTLEMENT_REQUIRED");
        require(c.payee == e.seller && c.amount == e.amount, "CLAIM_MISMATCH");
        require(c.claimId != bytes32(0) && c.deliveryHash != bytes32(0) && evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        bytes32 digest = claimDigest(c);
        require(_signed(e.seller, digest, sellerSignature), "CLAIM_SIGNATURE");
        require(_signed(mandates[e.mandateId].evaluator, validationDigest(c.dealHash, digest, evidenceHash), evaluatorSignature), "EVALUATOR_SIGNATURE");
        e.status = Status.RELEASED;
        _credit(e.seller, e.amount);
        emit Released(c.dealHash, digest, c.deliveryHash, evidenceHash, e.amount);
    }

    /// @param reason 1 = evaluator-attested delivery mismatch; 2 = deadline expiry.
    /// Anyone can finalize a timeout to the fixed buyer; no server cooperation is needed.
    function refund(bytes32 dealHash, uint8 reason, bytes32 evidenceHash) external nonReentrant {
        Escrow storage e = escrows[dealHash];
        require(e.status == Status.LOCKED, "NOT_LOCKED");
        Authority storage m = mandates[e.mandateId];
        require(evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        if (reason == 1) {
            require(msg.sender == m.evaluator, "EVALUATOR_ONLY");
            requiresPreview[m.buyer][e.seller] = true;
            emit PreviewRequired(m.buyer, e.seller, dealHash);
        } else { require(reason == 2 && block.timestamp >= e.deadline, "TIMEOUT_REQUIRED"); }
        e.status = Status.REFUNDED;
        _credit(m.buyer, e.amount);
        emit Refunded(dealHash, reason, evidenceHash, e.amount);
    }

    function _credit(address who, uint256 amount) private {
        totalLocked -= amount;
        totalCredits += amount;
        credits[who] += amount;
    }

    /// @dev Pull payments isolate reverting recipients. Only the beneficiary can redirect.
    function withdraw(address payable destination) external nonReentrant {
        _withdraw(msg.sender, destination);
    }

    /// @notice A gas sponsor can help a beneficiary withdraw only to that same beneficiary.
    function withdrawFor(address payable beneficiary) external nonReentrant {
        _withdraw(beneficiary, beneficiary);
    }

    function _withdraw(address beneficiary, address payable destination) private {
        require(destination != address(0), "ZERO_DESTINATION");
        uint256 amount = credits[beneficiary];
        require(amount > 0, "NO_CREDIT");
        credits[beneficiary] = 0;
        totalCredits -= amount;
        (bool ok,) = destination.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
        emit Withdrawn(beneficiary, destination, amount);
    }
}
