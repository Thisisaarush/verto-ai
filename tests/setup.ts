// Global test setup
import { vi } from "vitest"

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.CONVEX_URL = "https://test.convex.cloud"
process.env.CLERK_SECRET_KEY = "test_clerk_secret"
process.env.CLERK_WEBHOOK_SECRET = "test_webhook_secret"

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : vi.fn(),
  error: console.error,
  warn: console.warn,
  info: process.env.DEBUG ? console.info : vi.fn(),
  debug: process.env.DEBUG ? console.debug : vi.fn(),
}
