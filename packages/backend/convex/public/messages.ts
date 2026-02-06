import { components, internal } from "../_generated/api"
import { action, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "../system/ai/agents/supportAgent"
import { paginationOptsValidator } from "convex/server"
import { resolveConversation } from "../system/ai/tools/resolveConversation"
import { escalateConversation } from "../system/ai/tools/escalateConversation"
import { saveMessage } from "@convex-dev/agent"
import { search } from "../system/ai/tools/search"
import {
  enforceRateLimit,
  getIdentifier,
  RATE_LIMITS,
  sanitizeInput,
  validateInputLength,
} from "../lib/rateLimit"
import {
  getLanguageModel,
  canUseAI,
  type AIModelSettings,
} from "../lib/getAIModel"
import type { LanguageModel } from "ai"

function isQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes("quota") ||
      message.includes("billing") ||
      message.includes("rate limit") ||
      message.includes("insufficient_quota") ||
      message.includes("exceeded") ||
      message.includes("credit") ||
      message.includes("payment")
    )
  }
  return false
}

function getErrorMessage(error: unknown, provider: string): string {
  if (isQuotaError(error)) {
    return (
      `I apologize, but I'm currently unable to respond due to an API quota issue with the ${provider} service. ` +
      "This conversation has been escalated to a human support agent who will assist you shortly. " +
      "We apologize for any inconvenience."
    )
  }
  return (
    "I apologize, but I encountered an unexpected error while processing your request. " +
    "This conversation has been escalated to a human support agent who will assist you shortly."
  )
}

export const create = action({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    contactSessionId: v.id("contactSessions"),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    enforceRateLimit(
      getIdentifier("messageCreate", args.contactSessionId),
      RATE_LIMITS.messageCreate,
    )

    if (!validateInputLength(args.prompt, "message")) {
      throw new ConvexError({
        message: "Message too long or empty",
        code: "INVALID_INPUT",
      })
    }

    const sanitizedPrompt = sanitizeInput(args.prompt)

    // Generate a messageId for attachment linking
    const messageId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Link attachments to this message if any
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      await ctx.runMutation(internal.public.attachments.linkToMessageInternal, {
        attachmentIds: args.attachmentIds,
        messageId,
        contactSessionId: args.contactSessionId,
      })
    }

    const contactSession = await ctx.runQuery(
      internal.system.contactSessions.getOne,
      { contactSessionId: args.contactSessionId },
    )

    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      throw new ConvexError({
        message: "Invalid contact session",
        code: "INVALID_CONTACT_SESSION",
      })
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getByThreadId,
      { threadId: args.threadId },
    )

    if (!conversation) {
      throw new ConvexError({
        message: "Conversation not found",
        code: "INVALID_CONVERSATION",
      })
    }

    if (conversation.status === "resolved") {
      throw new ConvexError({
        message: "Conversation already resolved",
        code: "CONVERSATION_RESOLVED",
      })
    }

    await ctx.runMutation(internal.system.contactSessions.refresh, {
      contactSessionId: args.contactSessionId,
    })

    const subscriptions = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      { organizationId: conversation.organizationId },
    )

    const shouldTriggerAgent =
      conversation.status === "unresolved" && subscriptions?.status === "active"

    if (shouldTriggerAgent) {
      const aiSettings = (await ctx.runQuery(
        internal.private.aiModelSettings.getSettingsForAI,
        { organizationId: conversation.organizationId },
      )) as AIModelSettings

      const aiCheck = canUseAI(aiSettings)
      if (!aiCheck.allowed) {
        await saveMessage(ctx, components.agent, {
          threadId: args.threadId,
          prompt: sanitizedPrompt,
        })
        await saveMessage(ctx, components.agent, {
          threadId: args.threadId,
          prompt:
            "I apologize, but the AI assistant is currently unavailable. " +
            "The organization has reached its free tier limit. " +
            "Please contact support or wait for an administrator to configure an API key.",
        })
        return
      }

      const model = getLanguageModel(
        aiSettings.provider,
        aiSettings.model,
        aiSettings.apiKey,
      ) as LanguageModel

      const providerNames: Record<string, string> = {
        platform: "Platform",
        google: "Google AI",
        openai: "OpenAI",
        anthropic: "Anthropic",
      }
      const providerName =
        providerNames[aiSettings.provider] || aiSettings.provider

      try {
        await supportAgent.generateText(
          ctx,
          { threadId: args.threadId },
          {
            prompt: sanitizedPrompt,
            tools: { escalateConversation, resolveConversation, search },
            model,
          },
        )

        if (aiSettings.provider === "platform") {
          await ctx.runMutation(
            internal.private.aiModelSettings.incrementUsage,
            {
              organizationId: conversation.organizationId,
            },
          )
        }
      } catch (error) {
        console.error(
          `AI generation failed for organization ${conversation.organizationId}:`,
          error,
        )

        await saveMessage(ctx, components.agent, {
          threadId: args.threadId,
          prompt: sanitizedPrompt,
        })

        const errorMessage = getErrorMessage(error, providerName)
        await supportAgent.saveMessage(ctx, {
          threadId: args.threadId,
          message: {
            role: "assistant",
            content: errorMessage,
          },
        })

        await ctx.runMutation(internal.system.conversations.escalate, {
          threadId: args.threadId,
        })
      }
    } else {
      await saveMessage(ctx, components.agent, {
        threadId: args.threadId,
        prompt: sanitizedPrompt,
      })
    }
  },
})

export const getMany = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId)

    if (
      !contactSession ||
      (contactSession.expiresAt && contactSession.expiresAt < Date.now())
    ) {
      throw new ConvexError({
        message: "Invalid contact session",
        code: "INVALID_CONTACT_SESSION",
      })
    }

    const paginated = await supportAgent.listMessages(ctx, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    })

    return paginated
  },
})
