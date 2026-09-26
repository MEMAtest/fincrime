import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The e2e suites each drive a full browser run; serialising them keeps timings stable.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
