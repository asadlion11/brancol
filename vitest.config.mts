import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only — the pure layers that stand between raw model output and the
 * UI (repair, color completion, role normalization). Nothing here touches the
 * network or `server-only` modules.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws outside React's server condition, which Vitest
      // does not provide. The stub lets tests reach the pure helpers inside
      // server modules; the client-bundle guarantee is enforced by next build.
      "server-only": fileURLToPath(
        new URL("./lib/__tests__/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
