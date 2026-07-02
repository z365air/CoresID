import { encodeFunctionData, isAddress, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { CORESID_ABI, CORESID_CONTRACT_ADDRESS } from "@/lib/coresid";
import { Attribution } from "ox/erc8021";

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_a56e61vw"],
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const core = searchParams.get("core");

    if (!core || !isAddress(core)) {
      return Response.json(
        { error: "Invalid or missing 'core' address" },
        { status: 400 },
      );
    }

    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
      return Response.json(
        { error: "Relayer not configured" },
        { status: 500 },
      );
    }

    const calldata = encodeFunctionData({
      abi: CORESID_ABI,
      functionName: "mint",
      args: [core],
    });

    const calldataWithSuffix = calldata + DATA_SUFFIX.slice(2);

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const txHash = await walletClient.sendTransaction({
      to: CORESID_CONTRACT_ADDRESS,
      data: calldataWithSuffix as `0x${string}`,
    });

    return Response.json({
      success: true,
      txHash,
      contract: CORESID_CONTRACT_ADDRESS,
      chainId: 8453,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
