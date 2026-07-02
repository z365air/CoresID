"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { queryClient, wagmiConfig } from "@/lib/wagmi-config";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      chain={base}
      config={{
        appearance: { name: "CoresID", logo: "/baselogomid.png" },
        wallet: {
          preference: "smartWalletOnly",
          display: "modal",
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </OnchainKitProvider>
  );
}
