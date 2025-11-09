/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Optimize webpack configuration to reduce memory usage
    webpack: (config, { isServer }) => {
        // Optimize chunk splitting
        if (!isServer) {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        default: false,
                        vendors: false,
                        // Vendor chunk
                        vendor: {
                            name: 'vendor',
                            chunks: 'all',
                            test: /node_modules/,
                            priority: 20
                        },
                        // Common chunk
                        common: {
                            name: 'common',
                            minChunks: 2,
                            chunks: 'all',
                            priority: 10,
                            reuseExistingChunk: true,
                            enforce: true
                        }
                    }
                }
            };
        }
        return config;
    },
    // Optimize images
    images: {
        minimumCacheTTL: 60,
    },
    // Reduce build output
    compress: true,
    // Enable SWC minification (faster and uses less memory)
    swcMinify: true,
};

export default nextConfig;