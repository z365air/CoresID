// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract CoresID is
    ERC721Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    IERC5192
{
    using Strings for uint256;

    uint256 public constant MAX_SEEDS = 5;

    bytes32 public constant MINT_AUTH_TYPEHASH = keccak256(
        "MintAuthorization(address core,address seed,uint256 deadline)"
    );

    mapping(address core => mapping(address seed => bool)) public isNominated;
    mapping(address seed => address core) public coreOfSeed;
    mapping(address core => uint256) public seedCount;
    mapping(address core => uint256) public coreTokenId;
    mapping(uint256 tokenId => address) public tokenCore;

    mapping(address core => address[]) private _pendingSeeds;
    mapping(address core => address[]) private _linkedSeeds;

    string public baseURI;
    uint256 public nextTokenId;

    event Nominated(address indexed core, address indexed seed);
    event NominationCancelled(address indexed core, address indexed seed);
    event Minted(address indexed core, address indexed seed, uint256 indexed level);
    event Revoked(address indexed core, address indexed seed, uint256 indexed level);

    error ZeroAddress();
    error MaxSeedsExceeded(address core);
    error SeedAlreadyNominated(address seed);
    error SeedAlreadyLinked(address seed);
    error NotNominated(address core, address seed);
    error AlreadyMinted(address seed, address core);
    error SeedNotLinked(address seed);
    error TokenIsSoulbound();
    error MintAuthExpired();
    error InvalidSigner();

    constructor() {
        _disableInitializers();
    }

    function initialize(string memory baseURI_, address initialOwner) external initializer {
        __ERC721_init("CoresID", "CRID");
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __EIP712_init("CoresID", "1");
        baseURI = baseURI_;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ---- Core functions ----

    function nominate(address[] calldata seeds) external {
        if (seeds.length == 0) revert ZeroAddress();
        if (_pendingSeeds[msg.sender].length + seedCount[msg.sender] + seeds.length > MAX_SEEDS) {
            revert MaxSeedsExceeded(msg.sender);
        }

        if (balanceOf(msg.sender) == 0) {
            uint256 tid = nextTokenId;
            unchecked { ++nextTokenId; }
            coreTokenId[msg.sender] = tid;
            tokenCore[tid] = msg.sender;
            _mint(msg.sender, tid);
            emit Locked(tid);
        }

        for (uint256 i; i < seeds.length;) {
            address seed = seeds[i];
            if (seed == address(0)) revert ZeroAddress();
            if (isNominated[msg.sender][seed]) revert SeedAlreadyNominated(seed);
            if (coreOfSeed[seed] != address(0)) revert SeedAlreadyLinked(seed);

            isNominated[msg.sender][seed] = true;
            _pendingSeeds[msg.sender].push(seed);
            emit Nominated(msg.sender, seed);

            unchecked {
                ++i;
            }
        }
    }

    function cancelNomination(address seed) external {
        if (!isNominated[msg.sender][seed]) revert NotNominated(msg.sender, seed);
        if (coreOfSeed[seed] == msg.sender) revert AlreadyMinted(seed, msg.sender);

        isNominated[msg.sender][seed] = false;
        _removePendingSeed(msg.sender, seed);

        emit NominationCancelled(msg.sender, seed);
    }

    function getPendingSeeds(address core) external view returns (address[] memory) {
        return _pendingSeeds[core];
    }

    function getLinkedSeeds(address core) external view returns (address[] memory) {
        return _linkedSeeds[core];
    }

    function mint(address core) external returns (uint256 tokenId) {
        return _mintSeed(core, msg.sender);
    }

    function mintFor(
        address core,
        address seed,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert MintAuthExpired();

        address signer = ECDSA.recover(
            _hashTypedDataV4(keccak256(abi.encode(MINT_AUTH_TYPEHASH, core, seed, deadline))),
            signature
        );
        if (signer != seed) revert InvalidSigner();

        return _mintSeed(core, seed);
    }

    function revoke(address seed) external {
        if (coreOfSeed[seed] != msg.sender) revert SeedNotLinked(seed);
        if (seedCount[msg.sender] == 0) revert SeedNotLinked(seed);

        delete coreOfSeed[seed];
        _removeLinkedSeed(msg.sender, seed);

        unchecked {
            --seedCount[msg.sender];
        }

        emit Revoked(msg.sender, seed, seedCount[msg.sender]);
    }

    // ---- Internal ----

    function _mintSeed(address core, address seed) private returns (uint256 tokenId) {
        if (!isNominated[core][seed]) revert NotNominated(core, seed);
        if (coreOfSeed[seed] != address(0)) revert SeedAlreadyLinked(seed);
        if (seedCount[core] >= MAX_SEEDS) revert MaxSeedsExceeded(core);

        isNominated[core][seed] = false;
        coreOfSeed[seed] = core;
        _removePendingSeed(core, seed);
        _linkedSeeds[core].push(seed);

        unchecked {
            ++seedCount[core];
        }

        uint256 level = seedCount[core];

        if (level == 1) {
            tokenId = coreTokenId[core];
            emit Locked(tokenId);
        }

        emit Minted(core, seed, level);
    }

    // ---- Views ----

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        address core = tokenCore[tokenId];
        uint256 level = seedCount[core];
        return string.concat(baseURI, level.toString(), ".json");
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    // ---- Soulbound ----

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert TokenIsSoulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert TokenIsSoulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert TokenIsSoulbound(); }

    // ---- Storage helpers ----

    function _removePendingSeed(address core, address seed) private {
        address[] storage list = _pendingSeeds[core];
        uint256 len = list.length;
        for (uint256 i; i < len;) {
            if (list[i] == seed) {
                list[i] = list[len - 1];
                list.pop();
                return;
            }
            unchecked {
                ++i;
            }
        }
    }

    function _removeLinkedSeed(address core, address seed) private {
        address[] storage list = _linkedSeeds[core];
        uint256 len = list.length;
        for (uint256 i; i < len;) {
            if (list[i] == seed) {
                list[i] = list[len - 1];
                list.pop();
                return;
            }
            unchecked {
                ++i;
            }
        }
    }
}
