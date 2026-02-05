import { createGoogleGenerativeAI, google } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { QueryCtx } from "../_generated/server"
import { AI_PROVIDERS, type AIProvider } from "../private/aiModelSettings"

const DEFAULT_MODEL = google.chat("gemini-2.5-flash")

export type AIModelSettings = {
  provider: AIProvider
  model: string
  apiKey: string | undefined
  canUseFreeTier: boolean
  freeRequestsRemaining: number
}

/**
 * Get the language model instance based on provider and model settings
 * Returns a model compatible with the AI SDK
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLanguageModel(
  provider: AIProvider,
  model: string,
  apiKey?: string,
): any {
  switch (provider) {
    case "platform":
      return DEFAULT_MODEL

    case "google":
      if (!apiKey) {
        throw new Error("API key required for Google AI")
      }
      const googleProvider = createGoogleGenerativeAI({ apiKey })
      return googleProvider.chat(model)

    case "openai":
      if (!apiKey) {
        throw new Error("API key required for OpenAI")
      }
      const openaiProvider = createOpenAI({ apiKey })
      return openaiProvider.chat(model)

    case "anthropic":
      if (!apiKey) {
        throw new Error("API key required for Anthropic")
      }
      const anthropicProvider = createAnthropic({ apiKey })
      return anthropicProvider.chat(model)

    default:
      return DEFAULT_MODEL
  }
}

/**
 * Get AI settings from the database for a specific organization
 */
export async function getAISettingsForOrg(
  ctx: QueryCtx,
  organizationId: string,
): Promise<AIModelSettings> {
  const FREE_REQUESTS_LIMIT = 100

  const settings = await ctx.db
    .query("aiModelSettings")
    .withIndex("by_organization_id", (q) =>
      q.eq("organizationId", organizationId),
    )
    .unique()

  if (!settings) {
    return {
      provider: "platform",
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
    provider: settings.provider as AIProvider,
    model: settings.model,
    apiKey: settings.apiKey,
    canUseFreeTier:
      settings.provider === "platform" && freeRequestsRemaining > 0,
    freeRequestsRemaining,
  }
}

/**
 * Validate if the organization can use AI based on their settings
 */
export function canUseAI(settings: AIModelSettings): {
  allowed: boolean
  reason?: string
} {
  // If using custom API key (non-platform provider), always allowed
  if (settings.provider !== "platform" && settings.apiKey) {
    return { allowed: true }
  }

  // If using platform with free tier remaining, allowed
  if (settings.canUseFreeTier && settings.freeRequestsRemaining > 0) {
    return { allowed: true }
  }

  // No API key and no free tier remaining
  return {
    allowed: false,
    reason: "Free tier limit reached. Please add your own API key to continue.",
  }
}
