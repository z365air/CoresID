import { isAddress } from "viem";
import {
  CORESID_ABI,
  CORESID_CONTRACT_ADDRESS,
  CORESID_CHAIN_ID,
  CORESID_EIP712_DOMAIN,
  MINT_AUTH_TYPE,
} from "@/lib/coresid";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_RAW = "100000";
const PAYMENT_RECIPIENT =
  process.env.X402_PAYMENT_RECIPIENT ||
  "0x98b79Ff375ed9E785d9F09c7FE0394DbeF87f1Fa";

// GET — x402 discovery for the execute endpoint
export async function GET(request: Request) {
  const paymentRequired = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: request.url,
      description: "Execute mint(core) via relayer after payment",
      mimeType: "application/json",
      serviceName: "CoresID",
      tags: ["coresid", "nft", "soulbound", "relay"],
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: PRICE_RAW,
        asset: USDC_ADDRESS,
        payTo: PAYMENT_RECIPIENT,
        maxTimeoutSeconds: 300,
        extra: { name: "USDC", version: "2" },
      },
    ],
    extensions: {
      "eip712": {
        info: {
          domain: CORESID_EIP712_DOMAIN,
          types: MINT_AUTH_TYPE,
          primaryType: "MintAuthorization",
        },
        schema: {
          type: "object",
          properties: {
            domain: { type: "object" },
            types: { type: "object" },
            primaryType: { type: "string" },
          },
          required: ["domain", "types", "primaryType"],
        },
      },
    },
  };

  return Response.json(paymentRequired, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED":
        Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
    },
  });
}

// POST — relay the mint
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { core, seed, deadline, signature } = body;

    if (!core || !isAddress(core)) {
      return Response.json(
        { error: "Invalid or missing 'core' address" },
        { status: 400 },
      );
    }

    if (!seed || !isAddress(seed)) {
      return Response.json(
        { error: "Invalid or missing 'seed' address" },
        { status: 400 },
      );
    }

    if (!deadline || typeof deadline !== "number") {
      return Response.json(
        { error: "Invalid or missing 'deadline' (Unix timestamp)" },
        { status: 400 },
      );
    }

    if (!signature || typeof signature !== "string") {
      return Response.json(
        { error: "Invalid or missing 'signature'" },
        { status: 400 },
      );
    }

    // Verify PAYMENT-SIGNATURE
    const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
    if (!paymentSignature) {
      return Response.json(
        { error: "PAYMENT-SIGNATURE header is required" },
        { status: 402 },
      );
    }

    const paymentError = verifyPaymentSignature(paymentSignature);
    if (paymentError) {
      return paymentError;
    }

    // Verify EIP-712 signature off-chain
    const { verifyTypedData } = await import("viem/actions");
    const { createPublicClient, http } = await import("viem");
    const { base } = await import("viem/chains");

    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const isValid = await verifyTypedData(publicClient, {
      address: seed as `0x${string}`,
      domain: CORESID_EIP712_DOMAIN,
      types: MINT_AUTH_TYPE,
      primaryType: "MintAuthorization",
      message: { core, seed, deadline: BigInt(deadline) },
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return Response.json(
        { error: "Invalid EIP-712 signature" },
        { status: 400 },
      );
    }

    // Broadcast mintFor via relayer
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
      return Response.json(
        { error: "Relayer not configured" },
        { status: 500 },
      );
    }

    const { createWalletClient, http: walletHttp } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: walletHttp(),
    });

    const txHash = await walletClient.writeContract({
      address: CORESID_CONTRACT_ADDRESS,
      abi: CORESID_ABI,
      functionName: "mintFor",
      args: [core, seed, BigInt(deadline), signature as `0x${string}`],
    });

    return Response.json({ success: true, txHash, chainId: CORESID_CHAIN_ID });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

function verifyPaymentSignature(signature: string) {
  try {
    const payload = JSON.parse(
      Buffer.from(signature, "base64").toString("utf-8"),
    );

    if (payload.x402Version !== 2) {
      return respondJson(400, "invalid_x402_version", "Unsupported x402 version");
    }

    const accepted = payload.accepted;
    if (!accepted) {
      return respondJson(400, "invalid_payload", "Missing 'accepted' field");
    }

    if (accepted.scheme !== "exact") {
      return respondJson(400, "invalid_scheme", "Only 'exact' scheme is supported");
    }

    if (accepted.network !== "eip155:8453") {
      return respondJson(400, "invalid_network", "Only Base mainnet is supported");
    }

    if (accepted.amount !== PRICE_RAW) {
      return respondJson(400, "invalid_exact_evm_payload_authorization_value_mismatch", `Amount must be ${PRICE_RAW}`);
    }

    if (accepted.asset?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      return respondJson(400, "invalid_payload", "Asset must be USDC on Base");
    }

    if (accepted.payTo?.toLowerCase() !== PAYMENT_RECIPIENT.toLowerCase()) {
      return respondJson(400, "invalid_exact_evm_payload_recipient_mismatch", "Recipient mismatch");
    }

    return null;
  } catch {
    return respondJson(400, "invalid_payload", "Failed to parse PAYMENT-SIGNATURE");
  }
}

function respondJson(status: number, code: string, message: string) {
  const settlementResponse = {
    success: false,
    errorReason: code,
    transaction: "",
    network: "eip155:8453",
    payer: "",
  };

  return Response.json(
    { error: message, code },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-RESPONSE":
          Buffer.from(JSON.stringify(settlementResponse)).toString("base64"),
      },
    },
  );
}
