import { ConvexError, v } from "convex/values"
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "../_generated/server"

/**
 * Google Gemini 2.5 Flash Free Tier Limits:
 * - 15 RPM (requests per minute)
 * - 1,500 RPD (requests per day)
 * - 1,000,000 TPM (tokens per minute)
 *
 * We set a conservative daily limit per organization to share the free tier
 * across all platform users.
 */
const FREE_REQUESTS_LIMIT = 1500 // Google's daily limit for Gemini 2.5 Flash free tier

export const AI_PROVIDERS = {
  platform: {
    name: "Platform Default",
    description: "Use our default AI model (free tier included)",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: true },
    ],
    requiresApiKey: false,
  },
  google: {
    name: "Google AI",
    description: "Google's Gemini models",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isDefault: false },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", isDefault: false },
    ],
    requiresApiKey: true,
  },
  openai: {
    name: "OpenAI",
    description: "OpenAI's GPT models",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", isDefault: true },
      { id: "gpt-4o", name: "GPT-4o", isDefault: false },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", isDefault: false },
    ],
    requiresApiKey: true,
  },
  anthropic: {
    name: "Anthropic",
    description: "Anthropic's Claude models",
    models: [
      {
        id: "claude-3-5-haiku-latest",
        name: "Claude 3.5 Haiku",
        isDefault: true,
      },
      {
        id: "claude-3-5-sonnet-latest",
        name: "Claude 3.5 Sonnet",
        isDefault: false,
      },
      { id: "claude-3-opus-latest", name: "Claude 3 Opus", isDefault: false },
    ],
    requiresApiKey: true,
  },
} as const

export type AIProvider = keyof typeof AI_PROVIDERS

export const getProviders = query({
  args: {},
  handler: async () => {
    return AI_PROVIDERS
  },
})

export const getOne = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const settings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique()

    if (!settings) {
      return {
        provider: "platform" as const,
        model: "gemini-2.5-flash",
        apiKey: undefined,
        isActive: true,
        freeRequestsUsed: 0,
        freeRequestsLimit: FREE_REQUESTS_LIMIT,
        lastUsedAt: undefined,
        hasApiKey: false,
      }
    }

    return {
      ...settings,
      apiKey: settings.apiKey ? "••••••••" : undefined,
      hasApiKey: !!settings.apiKey,
    }
  },
})

export const upsert = mutation({
  args: {
    provider: v.union(
      v.literal("google"),
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("platform"),
    ),
    model: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const provider = AI_PROVIDERS[args.provider]
    const validModel = provider.models.find((m) => m.id === args.model)
    if (!validModel) {
      throw new ConvexError({
        code: "INVALID_MODEL",
        message: `Model ${args.model} is not valid for provider ${args.provider}`,
      })
    }

    if (
      provider.requiresApiKey &&
      !args.apiKey &&
      args.provider !== "platform"
    ) {
      throw new ConvexError({
        code: "API_KEY_REQUIRED",
        message: `API key is required for ${provider.name}`,
      })
    }

    const existingSettings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique()

    if (existingSettings) {
      // Only update apiKey if a new one is provided (not the masked value)
      const updateData: Record<string, unknown> = {
        provider: args.provider,
        model: args.model,
        isActive: true,
      }

      // Only update API key if it's not the masked value
      if (args.apiKey && args.apiKey !== "••••••••") {
        updateData.apiKey = args.apiKey
      }

      await ctx.db.patch(existingSettings._id, updateData)
    } else {
      await ctx.db.insert("aiModelSettings", {
        organizationId: orgId,
        provider: args.provider,
        model: args.model,
        apiKey: args.apiKey,
        isActive: true,
        freeRequestsUsed: 0,
        freeRequestsLimit: FREE_REQUESTS_LIMIT,
        lastUsedAt: undefined,
      })
    }
  },
})

export const removeApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const existingSettings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique()

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        apiKey: undefined,
        provider: "platform",
        model: "gemini-2.5-flash",
      })
    }
  },
})

// Internal function to get settings for AI usage (called by agents)
export const getSettingsForAI = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique()

    if (!settings) {
      return {
        provider: "platform" as const,
        model: "gemini-2.5-flash",
        apiKey: undefined,
        canUseFreeTier: true,
        freeRequestsRemaining: FREE_REQUESTS_LIMIT,
      }
    }

    const freeRequestsRemaining = Math.max(
      0,
      settings.freeRequestsLimit - settings.freeRequestsUsed,
    )

    return {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      canUseFreeTier:
        settings.provider === "platform" && freeRequestsRemaining > 0,
      freeRequestsRemaining,
    }
  },
})

// Track AI usage (internal - called from actions)
export const incrementUsage = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique()

    if (settings) {
      await ctx.db.patch(settings._id, {
        freeRequestsUsed: settings.freeRequestsUsed + 1,
        lastUsedAt: Date.now(),
      })
    } else {
      // Create settings with first usage
      await ctx.db.insert("aiModelSettings", {
        organizationId: args.organizationId,
        provider: "platform",
        model: "gemini-2.5-flash",
        apiKey: undefined,
        isActive: true,
        freeRequestsUsed: 1,
        freeRequestsLimit: FREE_REQUESTS_LIMIT,
        lastUsedAt: Date.now(),
      })
    }
  },
})

export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    const orgId = identity.orgId as string
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized",
      })
    }

    const settings = await ctx.db
      .query("aiModelSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique()

    if (!settings) {
      return {
        freeRequestsUsed: 0,
        freeRequestsLimit: FREE_REQUESTS_LIMIT,
        freeRequestsRemaining: FREE_REQUESTS_LIMIT,
        percentUsed: 0,
      }
    }

    const freeRequestsRemaining = Math.max(
      0,
      settings.freeRequestsLimit - settings.freeRequestsUsed,
    )

    return {
      freeRequestsUsed: settings.freeRequestsUsed,
      freeRequestsLimit: settings.freeRequestsLimit,
      freeRequestsRemaining,
      percentUsed: Math.round(
        (settings.freeRequestsUsed / settings.freeRequestsLimit) * 100,
      ),
    }
  },
})
