// DEV-006: Next.js 16 uses Turbopack by default (ARCHITECTURE.md assumed Next.js 14 + webpack).
// DEV-013/DEV-015: Turbopack deadlocks on @zama-fhe/relayer-sdk/web (1.2MB JS + 4.5MB WASM).
// Fix: force webpack mode (no --turbopack flag) + ESM conditionNames for wagmi v3.
// DEV-014: Dynamic import in lib/fhevm.ts keeps SDK out of static graph (still needed for webpack tree-shaking).
// DEV-016: wagmi v3 uses ESM package.json exports; webpack needs conditionNames + transpilePackages.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force webpack mode — Turbopack deadlocks on WASM (DEV-013/DEV-015)
  turbopack: undefined,
  transpilePackages: ["wagmi", "@wagmi/core", "viem", "@viem/chains"],
  serverExternalPackages: ["@zama-fhe/relayer-sdk"],
  webpack: (config: any, { isServer }: any) => {
    // WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // ESM resolution for wagmi/viem (DEV-016)
    config.resolve = {
      ...config.resolve,
      conditionNames: ["import", "module", "require", "default"],
      // Stub wagmi Tempo wallet's optional 'accounts' dep — we don't use Tempo wallet
      alias: {
        ...(config.resolve?.alias ?? {}),
        accounts: require("path").resolve(__dirname, "lib/empty-stub.js"),
      },
    };
    if (isServer) {
      config.output = {
        ...config.output,
        webassemblyModuleFilename: "./../static/wasm/[modulehash].wasm",
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
