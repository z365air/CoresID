import { encodeFunctionData, isAddress } from "viem";
import { CORESID_ABI, CORESID_CONTRACT_ADDRESS } from "@/lib/coresid";
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

  const paymentRequired = {
    x402Version: 2,
    error: "Payment required to mint a seed to a Core",
    resource: {
      url: request.url,
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
          calldata: calldataWithSuffix,
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
