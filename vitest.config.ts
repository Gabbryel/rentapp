import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    // These use custom runners (tsx-executed scripts); migrate incrementally
    exclude: [
      "__tests__/custom-period-invoice.test.ts",
      "__tests__/effective-end-date.test.ts",
      "__tests__/fetch-contracts-by-assetid.test.ts",
      "__tests__/invoice-numbering.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
