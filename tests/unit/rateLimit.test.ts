import { describe, it, expect, beforeEach } from "vitest"
import {
  checkRateLimit,
  enforceRateLimit,
  validateInputLength,
  sanitizeInput,
  INPUT_LIMITS,
  RATE_LIMITS,
  getIdentifier,
} from "../../packages/backend/convex/lib/rateLimit"

describe("Rate Limiting", () => {
  describe("checkRateLimit", () => {
    it("should allow first request", () => {
      const result = checkRateLimit("test-unique-1", RATE_LIMITS.public)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(RATE_LIMITS.public.maxRequests - 1)
    })

    it("should track multiple requests", () => {
      const identifier = "test-unique-2"
      const config = { maxRequests: 3, windowMs: 60000 }

      const result1 = checkRateLimit(identifier, config)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)

      const result2 = checkRateLimit(identifier, config)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(1)

      const result3 = checkRateLimit(identifier, config)
      expect(result3.allowed).toBe(true)
      expect(result3.remaining).toBe(0)

      const result4 = checkRateLimit(identifier, config)
      expect(result4.allowed).toBe(false)
      expect(result4.remaining).toBe(0)
    })
  })

  describe("getIdentifier", () => {
    it("should create identifier with IP", () => {
      const result = getIdentifier("webhook", undefined, "192.168.1.1")
      expect(result).toBe("webhook:192.168.1.1")
    })

    it("should create identifier with session", () => {
      const result = getIdentifier("message", "session-123")
      expect(result).toBe("message:session-123")
    })

    it("should create anonymous identifier", () => {
      const result = getIdentifier("public")
      expect(result).toBe("public:anonymous")
    })
  })

  describe("enforceRateLimit", () => {
    it("should throw when rate limited", () => {
      const identifier = "test-enforce-1"
      const config = { maxRequests: 1, windowMs: 60000 }

      // First request should pass
      expect(() => enforceRateLimit(identifier, config)).not.toThrow()

      // Second request should throw
      expect(() => enforceRateLimit(identifier, config)).toThrow()
    })
  })
})

describe("Input Validation", () => {
  describe("validateInputLength", () => {
    it("should validate message length", () => {
      expect(validateInputLength("Hello", "message")).toBe(true)
      expect(validateInputLength("", "message")).toBe(false)
      expect(validateInputLength("a".repeat(4001), "message")).toBe(false)
    })

    it("should validate name length", () => {
      expect(validateInputLength("John", "name")).toBe(true)
      expect(validateInputLength("J", "name")).toBe(false)
      expect(validateInputLength("a".repeat(101), "name")).toBe(false)
    })

    it("should validate email length", () => {
      expect(validateInputLength("test@example.com", "email")).toBe(true)
      expect(validateInputLength("a".repeat(256), "email")).toBe(false)
    })
  })

  describe("sanitizeInput", () => {
    it("should remove script tags", () => {
      const input = "<script>alert('xss')</script>Hello"
      const result = sanitizeInput(input)
      expect(result).toBe("Hello")
    })

    it("should remove onclick handlers", () => {
      const input = "<div onclick=alert(1)>Click me</div>"
      const result = sanitizeInput(input)
      expect(result).not.toContain("onclick")
    })

    it("should trim whitespace", () => {
      const input = "  Hello World  "
      const result = sanitizeInput(input)
      expect(result).toBe("Hello World")
    })

    it("should handle normal input", () => {
      const input = "Hello, how can I help you?"
      const result = sanitizeInput(input)
      expect(result).toBe("Hello, how can I help you?")
    })
  })
})
