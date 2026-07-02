"use client";

import { QueryClient } from "@tanstack/react-query";
import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
} from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected, walletConnect } from "wagmi/connectors";
import { Attribution } from "ox/erc8021";

export const WC_PROJECT_ID = "c46c1ecc93170d80c743ae6d3f8f70d2";

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_a56e61vw"],
});

export const wagmiConfig = createConfig({
  chains: [base],
  multiInjectedProviderDiscovery: true,
  connectors: [
    baseAccount({
      appName: "CoresID",
      appLogoUrl: typeof window !== "undefined" ? `${window.location.origin}/baselogomid.png` : "https://coresid.vercel.app/baselogomid.png",
    }),
    injected({ shimDisconnect: true }),
    walletConnect({ projectId: WC_PROJECT_ID, showQrModal: true }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [base.id]: http(),
  },
  dataSuffix: DATA_SUFFIX,
});

export const queryClient = new QueryClient();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
