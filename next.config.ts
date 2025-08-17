import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude supabase functions from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude supabase directory from webpack compilation
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    // Ignore supabase functions directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/functions/**'],
    };
    
    return config;
  },
};

export default nextConfig;
