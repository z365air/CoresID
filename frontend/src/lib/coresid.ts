import type { Address, TypedDataDomain, TypedDataParameter } from "viem";

export const CORESID_CHAIN_ID = 8453;
export const CORESID_CHAIN = {
  id: CORESID_CHAIN_ID,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

export const CORESID_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CORESID_CONTRACT_ADDRESS as Address | undefined) ??
  "0xd7d05DcE1052aB52D7f8ba76846143C12454aF09";

export const CORESID_EXPLORER_URL = `https://basescan.org/address/${CORESID_CONTRACT_ADDRESS}`;
export const CORESID_TX_URL = (hash: string) => `https://basescan.org/tx/${hash}`;

export const CORESID_EIP712_DOMAIN: TypedDataDomain = {
  name: "CoresID",
  version: "1",
  chainId: CORESID_CHAIN_ID,
  verifyingContract: CORESID_CONTRACT_ADDRESS,
};

export const MINT_AUTH_TYPE = {
  MintAuthorization: [
    { name: "core", type: "address" },
    { name: "seed", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const satisfies Record<string, TypedDataParameter[]>;

export const CORESID_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "nominate",
    inputs: [{ name: "seeds", type: "address[]" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "cancelNomination",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isNominated",
    inputs: [
      { name: "core", type: "address" },
      { name: "seed", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "coreOfSeed",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [{ name: "core", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "seedCount",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getPendingSeeds",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getLinkedSeeds",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "ownerMint",
    inputs: [
      { name: "core", type: "address" },
      { name: "seed", type: "address" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "revoke",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mintFor",
    inputs: [
      { name: "core", type: "address" },
      { name: "seed", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "MINT_AUTH_TYPEHASH",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "coreTokenId",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "MAX_SEEDS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Nominated",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "NominationCancelled",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
      { name: "level", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Revoked",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
      { name: "level", type: "uint256", indexed: true },
    ],
  },
] as const;

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
