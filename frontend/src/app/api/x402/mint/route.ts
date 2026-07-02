import { encodeFunctionData, isAddress } from "viem";
import { CORESID_ABI, CORESID_CONTRACT_ADDRESS, CORESID_EIP712_DOMAIN, MINT_AUTH_TYPE } from "@/lib/coresid";
import { Attribution } from "ox/erc8021";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_RAW = "100000";
const PAYMENT_RECIPIENT =
  process.env.X402_PAYMENT_RECIPIENT ||
  "0x98b79Ff375ed9E785d9F09c7FE0394DbeF87f1Fa";

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_a56e61vw"],
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const core = searchParams.get("core");

  if (!core || !isAddress(core)) {
    return Response.json(
      { error: "Invalid or missing 'core' address" },
      { status: 400 },
    );
  }

  const calldata = encodeFunctionData({
    abi: CORESID_ABI,
    functionName: "mint",
    args: [core],
  });

  const calldataWithSuffix = calldata + DATA_SUFFIX.slice(2);

  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");

  if (paymentSignature) {
    return handlePaymentSignature(paymentSignature, calldataWithSuffix, core, request.url);
  }

  return respondPaymentRequired(request.url, calldataWithSuffix, core);
}

function handlePaymentSignature(
  signature: string,
  calldata: string,
  core: string,
  url: string,
) {
  try {
    const payload = JSON.parse(
      Buffer.from(signature, "base64").toString("utf-8"),
    );

    if (payload.x402Version !== 2) {
      return respondInvalid("invalid_x402_version", "Unsupported x402 version");
    }

    const accepted = payload.accepted;
    if (!accepted) {
      return respondInvalid("invalid_payload", "Missing 'accepted' field");
    }

    if (accepted.scheme !== "exact") {
      return respondInvalid("invalid_scheme", "Only 'exact' scheme is supported");
    }

    if (accepted.network !== "eip155:8453") {
      return respondInvalid("invalid_network", "Only Base mainnet is supported");
    }

    if (accepted.amount !== PRICE_RAW) {
      return respondInvalid(
        "invalid_exact_evm_payload_authorization_value_mismatch",
        `Amount must be ${PRICE_RAW}`,
      );
    }

    if (accepted.asset?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
      return respondInvalid("invalid_payload", `Asset must be USDC on Base`);
    }

    if (accepted.payTo?.toLowerCase() !== PAYMENT_RECIPIENT.toLowerCase()) {
      return respondInvalid(
        "invalid_exact_evm_payload_recipient_mismatch",
        "Recipient mismatch",
      );
    }

    const payer = payload.payload?.authorization?.from || "";

    const settlementResponse = {
      success: true,
      transaction: "",
      network: "eip155:8453",
      payer,
    };

    const base64Response =
      Buffer.from(JSON.stringify(settlementResponse)).toString("base64");

    return Response.json(
      {
        success: true,
        calldata,
        contract: CORESID_CONTRACT_ADDRESS,
        chainId: 8453,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-RESPONSE": base64Response,
        },
      },
    );
  } catch {
    return respondInvalid("invalid_payload", "Failed to parse PAYMENT-SIGNATURE");
  }
}

function respondPaymentRequired(url: string, calldata: string, core: string) {
  const paymentRequired = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url,
      description: "Mint a seed to a Core on CoresID",
      mimeType: "application/json",
      serviceName: "CoresID",
      tags: ["coresid", "nft", "soulbound"],
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: PRICE_RAW,
        asset: USDC_ADDRESS,
        payTo: PAYMENT_RECIPIENT,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: "2",
        },
      },
    ],
    extensions: {
      "contract-interaction": {
        info: {
          address: CORESID_CONTRACT_ADDRESS,
          chainId: 8453,
          functionName: "mint",
          args: [core],
          calldata,
        },
        schema: {
          type: "object",
          properties: {
            address: { type: "string" },
            chainId: { type: "number" },
            functionName: { type: "string" },
            args: { type: "array" },
            calldata: { type: "string" },
          },
          required: ["address", "chainId", "functionName", "args", "calldata"],
        },
      },
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

  const base64Header =
    Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

  return Response.json(paymentRequired, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": base64Header,
    },
  });
}

function respondInvalid(code: string, message: string) {
  const settlementResponse = {
    success: false,
    errorReason: code,
    transaction: "",
    network: "eip155:8453",
    payer: "",
  };

  const base64Response =
    Buffer.from(JSON.stringify(settlementResponse)).toString("base64");

  return Response.json(
    { error: message, code },
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-RESPONSE": base64Response,
      },
    },
  );
}
