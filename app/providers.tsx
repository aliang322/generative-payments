"use client";

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { AlgorandWalletConnectors } from "@dynamic-labs/algorand";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { CosmosWalletConnectors } from "@dynamic-labs/cosmos";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { FlowWalletConnectors } from "@dynamic-labs/flow";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { StarknetWalletConnectors } from "@dynamic-labs/starknet";
import { SuiWalletConnectors } from "@dynamic-labs/sui";

export default function Providers({ children }: { children: React.ReactNode }) {
	const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "";
	return (
		<DynamicContextProvider
			settings={{
				environmentId,
				walletConnectors: [
					AlgorandWalletConnectors,
					BitcoinWalletConnectors,
					CosmosWalletConnectors,
					EthereumWalletConnectors,
					FlowWalletConnectors,
					SolanaWalletConnectors,
					StarknetWalletConnectors,
					SuiWalletConnectors,
				],
			}}
		>
			{children}
		</DynamicContextProvider>
	);
}
