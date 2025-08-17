import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@dynamic-labs-wallet/node-evm',
    '@dynamic-labs-wallet/node-svm',
    '@dynamic-labs-wallet/node'
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle Dynamic SDK modules on the server side
      config.externals = config.externals || [];
      config.externals.push({
        '@dynamic-labs-wallet/node-evm': 'commonjs @dynamic-labs-wallet/node-evm',
        '@dynamic-labs-wallet/node-svm': 'commonjs @dynamic-labs-wallet/node-svm',
        '@dynamic-labs-wallet/node': 'commonjs @dynamic-labs-wallet/node'
      });
    }
    return config;
  }
};

export default nextConfig;
