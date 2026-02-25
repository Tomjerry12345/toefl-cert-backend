// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TOEFLCertificate
 * @dev Smart contract untuk verifikasi sertifikat TOEFL menggunakan Merkle Tree
 * @author Sistem Verifikasi Sertifikat TOEFL
 */
contract TOEFLCertificate {
    
    // ============================================================
    // STRUCTS
    // ============================================================
    struct Certificate {
        string certId;          // ID unik sertifikat
        bytes32 merkleRoot;     // Merkle root dari batch sertifikat
        uint256 issuedAt;       // Timestamp penerbitan
        address issuedBy;       // Alamat issuer
        bool isRevoked;         // Status pencabutan
        string metadataURI;     // URI metadata IPFS (opsional)
    }

    // ============================================================
    // STATE VARIABLES
    // ============================================================
    address public owner;
    mapping(string => Certificate) private certificates;     // certId => Certificate
    mapping(bytes32 => string[]) private merkleRootToCerts; // merkleRoot => list certIds
    mapping(address => bool) public authorizedIssuers;
    
    string[] private allCertIds;
    uint256 public totalCertificates;

    // ============================================================
    // EVENTS
    // ============================================================
    event CertificateIssued(
        string indexed certId, 
        bytes32 indexed merkleRoot, 
        address issuedBy, 
        uint256 issuedAt
    );
    event CertificateRevoked(string indexed certId, address revokedBy, uint256 revokedAt);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    // ============================================================
    // MODIFIERS
    // ============================================================
    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang bisa melakukan ini");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner,
            "Tidak memiliki akses untuk menerbitkan sertifikat"
        );
        _;
    }

    modifier certExists(string memory certId) {
        require(
            bytes(certificates[certId].certId).length > 0,
            "Sertifikat tidak ditemukan"
        );
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    // ============================================================
    // ISSUER MANAGEMENT
    // ============================================================
    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    // ============================================================
    // CERTIFICATE ISSUANCE
    // ============================================================

    /**
     * @dev Menerbitkan satu sertifikat dengan Merkle root
     * @param certId ID unik sertifikat
     * @param merkleRoot Merkle root dari batch sertifikat
     * @param metadataURI URI metadata (bisa kosong)
     */
    function issueCertificate(
        string memory certId,
        bytes32 merkleRoot,
        string memory metadataURI
    ) external onlyAuthorized {
        require(bytes(certId).length > 0, "certId tidak boleh kosong");
        require(bytes(certificates[certId].certId).length == 0, "Sertifikat sudah ada");
        require(merkleRoot != bytes32(0), "Merkle root tidak valid");

        certificates[certId] = Certificate({
            certId: certId,
            merkleRoot: merkleRoot,
            issuedAt: block.timestamp,
            issuedBy: msg.sender,
            isRevoked: false,
            metadataURI: metadataURI
        });

        merkleRootToCerts[merkleRoot].push(certId);
        allCertIds.push(certId);
        totalCertificates++;

        emit CertificateIssued(certId, merkleRoot, msg.sender, block.timestamp);
    }

    /**
     * @dev Menerbitkan banyak sertifikat sekaligus (batch)
     */
    function issueBatch(
        string[] memory certIds,
        bytes32 merkleRoot,
        string memory metadataURI
    ) external onlyAuthorized {
        require(certIds.length > 0, "Batch tidak boleh kosong");
        require(certIds.length <= 100, "Maksimal 100 sertifikat per batch");
        require(merkleRoot != bytes32(0), "Merkle root tidak valid");

        for (uint256 i = 0; i < certIds.length; i++) {
            string memory certId = certIds[i];
            require(bytes(certId).length > 0, "certId tidak boleh kosong");
            require(bytes(certificates[certId].certId).length == 0, "Sertifikat sudah ada");

            certificates[certId] = Certificate({
                certId: certId,
                merkleRoot: merkleRoot,
                issuedAt: block.timestamp,
                issuedBy: msg.sender,
                isRevoked: false,
                metadataURI: metadataURI
            });

            allCertIds.push(certId);
            totalCertificates++;
            emit CertificateIssued(certId, merkleRoot, msg.sender, block.timestamp);
        }

        merkleRootToCerts[merkleRoot] = certIds;
    }

    // ============================================================
    // CERTIFICATE REVOCATION
    // ============================================================
    function revokeCertificate(string memory certId) 
        external 
        onlyAuthorized 
        certExists(certId) 
    {
        require(!certificates[certId].isRevoked, "Sertifikat sudah dicabut");
        certificates[certId].isRevoked = true;
        emit CertificateRevoked(certId, msg.sender, block.timestamp);
    }

    // ============================================================
    // VERIFICATION
    // ============================================================

    /**
     * @dev Verifikasi sertifikat menggunakan Merkle proof
     * @param certId ID sertifikat yang diverifikasi
     * @param leaf Hash leaf dari data sertifikat
     * @param proof Array Merkle proof
     * @return isValid true jika sertifikat valid
     * @return isRevoked true jika sertifikat sudah dicabut
     */
    function verifyCertificate(
        string memory certId,
        bytes32 leaf,
        bytes32[] memory proof
    ) external view returns (bool isValid, bool isRevoked, uint256 issuedAt) {
        Certificate memory cert = certificates[certId];
        
        if (bytes(cert.certId).length == 0) {
            return (false, false, 0);
        }

        bool proofValid = _verifyMerkleProof(proof, cert.merkleRoot, leaf);
        
        return (proofValid && !cert.isRevoked, cert.isRevoked, cert.issuedAt);
    }

    /**
     * @dev Cek apakah sertifikat ada dan tidak dicabut
     */
    function getCertificateStatus(string memory certId) 
        external 
        view 
        returns (
            bool exists,
            bool isRevoked,
            bytes32 merkleRoot,
            uint256 issuedAt,
            address issuedBy
        ) 
    {
        Certificate memory cert = certificates[certId];
        exists = bytes(cert.certId).length > 0;
        
        if (exists) {
            isRevoked = cert.isRevoked;
            merkleRoot = cert.merkleRoot;
            issuedAt = cert.issuedAt;
            issuedBy = cert.issuedBy;
        }
    }

    // ============================================================
    // INTERNAL - MERKLE PROOF VERIFICATION
    // ============================================================
    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }

    // ============================================================
    // GETTERS
    // ============================================================
    function getCertificate(string memory certId) 
        external 
        view 
        certExists(certId) 
        returns (Certificate memory) 
    {
        return certificates[certId];
    }

    function getCertsByMerkleRoot(bytes32 merkleRoot) 
        external 
        view 
        returns (string[] memory) 
    {
        return merkleRootToCerts[merkleRoot];
    }
}
