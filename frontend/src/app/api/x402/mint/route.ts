import { isAddress, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { CORESID_ABI, CORESID_CONTRACT_ADDRESS } from "@/lib/coresid";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const core = searchParams.get("core");
    const seed = searchParams.get("seed");

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

    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
      return Response.json(
        { error: "Relayer not configured" },
        { status: 500 },
      );
    }

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const txHash = await walletClient.writeContract({
      address: CORESID_CONTRACT_ADDRESS,
      abi: CORESID_ABI,
      functionName: "ownerMint",
      args: [core, seed],
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
