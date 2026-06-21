import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Evita panic "Next.js package not found" quando o Turbopack infere root errado
  // (comum no Windows, paths com espaço ou lockfiles em diretórios pai).
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
