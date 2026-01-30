/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    esmExternals: true,
  },
  // Transpile workspace packages (required for ESM modules)
  transpilePackages: [
    '@webapp/interface-sdk', 
    '@webapp/interface-saq-form',
    '@webapp/interface-pdf-signer'
  ],
  // Add webpack configuration for SVGs from interface packages
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            svgo: true,
            svgoConfig: {
              plugins: [{
                name: 'preset-default',
                params: {
                  overrides: { removeViewBox: false },
                },
              }],
            },
          },
        },
      ],
    });
    return config;
  },
};

export default nextConfig;