import { defineConfig } from "vitest/config"
import path from "path"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "apps/web/lib/**/*.ts",
        "apps/web/modules/**/utils.ts",
        "apps/web/modules/**/constants.ts",
        "packages/ui/src/hooks/**/*.ts",
        "packages/ui/src/lib/**/*.ts",
        "packages/ui/src/components/**/*.tsx",
        "packages/backend/convex/lib/**/*.ts",
      ],
      exclude: [
        "node_modules/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
        "**/_generated/**",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web"),
      "@workspace/backend": path.resolve(__dirname, "./packages/backend"),
      "@workspace/ui": path.resolve(__dirname, "./packages/ui"),
    },
  },
})
