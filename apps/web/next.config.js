/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Disabled for now - enable for Docker deployment
  transpilePackages: ['@esgcredit/db-esg', '@esgcredit/db-credit'],
  experimental: {
    instrumentationHook: true, // Enable instrumentation for background workers
    serverComponentsExternalPackages: [
      '@prisma/client', 
      'prisma', 
      'pdfjs-dist',
      '@langchain/core',
      '@langchain/openai',
      'langchain',
      '@langchain/langgraph'
    ], // let Next bundle it safely
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // When server bundles anything that tries to require('canvas'),
      // give it an empty module so it never loads native bindings.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        canvas: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig