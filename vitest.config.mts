import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Minimal vitest config: only adds the `@/*` path alias already declared in
 * tsconfig.json (used throughout app/lib/data via `@/lib/...`,
 * `@/data/...`, etc.) so unit tests can import modules that use it without
 * every test file having to fall back to relative paths. Vitest/esbuild
 * strip `import type` at transform time regardless, which is why most
 * existing tests worked without this; modules imported for their runtime
 * values (e.g. lib/enforcement/select.ts, which imports `enforcementCases`
 * as a value) need real alias resolution.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
