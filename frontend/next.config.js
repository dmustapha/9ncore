// File: frontend/next.config.js
// DEV-006: Next.js 16 uses Turbopack by default (ARCHITECTURE.md assumed Next.js 14 + webpack).
// Turbopack has native WASM support — asyncWebAssembly is ON by default.
// webpack config kept for explicit --webpack mode; turbopack: {} silences the conflict error.
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    if (isServer) {
      config.output = {
        ...config.output,
        webassemblyModuleFilename: "./../static/wasm/[modulehash].wasm",
      };
    }
    return config;
  },
};

module.exports = nextConfig;
