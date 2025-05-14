import "@rainbow-me/rainbowkit/styles.css"
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { WagmiProvider } from "wagmi"
import { sepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApolloProvider } from "@apollo/client"
import client from "../src/apollo-client"

const wagmiConfig = getDefaultConfig({
    appName: "NFT Marketplace",
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
    chains: [sepolia],
    ssr: true,
    connectionMode: "auto", // Changed from 'single' to 'auto'
})

const queryClient = new QueryClient()

export default function App({ Component, pageProps }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    chains={[sepolia]}
                    modalSize="compact"
                    coolMode // Add cool mode for better UX
                >
                    <ApolloProvider client={client}>
                        <Component {...pageProps} />
                    </ApolloProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
