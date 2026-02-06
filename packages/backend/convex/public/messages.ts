import { components, internal } from "../_generated/api"
import { action, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { supportAgent } from "../system/ai/agents/supportAgent"
import { getAgentByType } from "../system/ai/agents"
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
  checkAIRateLimit,
  GEMINI_FREE_TIER,
} from "../lib/rateLimit"
import {
  getLanguageModel,
  canUseAI,
  type AIModelSettings,
} from "../lib/getAIModel"
import { getErrorCode } from "../system/aiRequestLogs"
import type { LanguageModel } from "ai"
import type { AgentType } from "../system/ai/constants"

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

      const startTime = Date.now()

      try {
        // Determine which agent should handle this conversation
        let agentType: AgentType = conversation.agentType || "general"

        // If this is the first message (no agent assigned yet), classify the conversation
        if (!conversation.agentType) {
          // Run classification in parallel with a short timeout
          // to not delay the response too much
          try {
            agentType = await ctx.runAction(
              internal.system.conversations.classifyConversation,
              {
                firstMessage: sanitizedPrompt,
                conversationId: conversation._id,
              },
            )
            console.log(
              `[CLASSIFICATION] Successfully classified as: ${agentType}`,
            )
          } catch (classifyError) {
            console.error(
              `[CLASSIFICATION] Failed for conversation ${conversation._id}:`,
            )
            console.error(
              `[CLASSIFICATION] Error: ${classifyError instanceof Error ? classifyError.message : String(classifyError)}`,
            )
            agentType = "general"
          }
        }

        // Get the appropriate specialized agent
        const agent = getAgentByType(agentType)

        // Check AI rate limit before making the call
        const rateLimitCheck = checkAIRateLimit(conversation.organizationId)
        if (!rateLimitCheck.allowed) {
          console.log(
            `[AI RATE LIMIT] Organization ${conversation.organizationId} hit rate limit.`,
            `Retry in ${rateLimitCheck.retryAfterSeconds}s`,
          )

          // Log the rate-limited request
          await ctx.runMutation(internal.system.aiRequestLogs.logFailure, {
            organizationId: conversation.organizationId,
            requestType: "chat",
            provider: aiSettings.provider,
            model: aiSettings.model,
            errorMessage: `App rate limit exceeded. limit: ${GEMINI_FREE_TIER.appRpm}, Please retry in ${rateLimitCheck.retryAfterSeconds}s`,
            errorCode: "RATE_LIMIT",
            durationMs: 0,
            conversationId: conversation._id,
          })

          // Save user message and rate limit response
          await saveMessage(ctx, components.agent, {
            threadId: args.threadId,
            prompt: sanitizedPrompt,
          })

          await supportAgent.saveMessage(ctx, {
            threadId: args.threadId,
            message: {
              role: "assistant",
              content:
                `I'm currently handling many requests. Please wait ${rateLimitCheck.retryAfterSeconds} seconds before sending another message. ` +
                "Thank you for your patience!",
            },
          })
          return
        }

        await agent.generateText(
          ctx,
          { threadId: args.threadId },
          {
            prompt: sanitizedPrompt,
            tools: { escalateConversation, resolveConversation, search },
            model,
          },
        )

        const durationMs = Date.now() - startTime

        // Log successful chat request
        await ctx.runMutation(internal.system.aiRequestLogs.logSuccess, {
          organizationId: conversation.organizationId,
          requestType: "chat",
          provider: aiSettings.provider,
          model: aiSettings.model,
          durationMs,
          conversationId: conversation._id,
        })

        if (aiSettings.provider === "platform") {
          await ctx.runMutation(
            internal.private.aiModelSettings.incrementUsage,
            {
              organizationId: conversation.organizationId,
            },
          )
        }
      } catch (error) {
        const durationMs = Date.now() - startTime

        // Enhanced error logging for debugging
        console.error(`[AI ERROR] Organization: ${conversation.organizationId}`)
        console.error(`[AI ERROR] Provider: ${aiSettings.provider}`)
        console.error(`[AI ERROR] Model: ${aiSettings.model}`)
        console.error(`[AI ERROR] Duration: ${durationMs}ms`)
        console.error(
          `[AI ERROR] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`,
        )
        console.error(
          `[AI ERROR] Error message: ${error instanceof Error ? error.message : String(error)}`,
        )
        if (error instanceof Error && error.stack) {
          console.error(`[AI ERROR] Stack trace: ${error.stack}`)
        }
        // Log the full error object for inspection
        console.error(
          `[AI ERROR] Full error:`,
          JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2),
        )

        // Log failed chat request
        await ctx.runMutation(internal.system.aiRequestLogs.logFailure, {
          organizationId: conversation.organizationId,
          requestType: "chat",
          provider: aiSettings.provider,
          model: aiSettings.model,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          errorCode: getErrorCode(error),
          durationMs,
          conversationId: conversation._id,
        })

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

    // Update lastMessageAt for unread tracking
    await ctx.runMutation(internal.system.conversations.updateLastMessageAt, {
      conversationId: conversation._id,
    })

    // Trigger sentiment analysis after user message
    // Delay by 5 seconds to avoid rate limiting (Google's 15 RPM limit)
    await ctx.scheduler.runAfter(
      5000,
      internal.system.conversations.analyzeSentiment,
      {
        conversationId: conversation._id,
        threadId: args.threadId,
      },
    )

    // Trigger auto-tagging and priority analysis after user message
    // Only run if conversation doesn't already have tags or priority set
    // Delay by 10 seconds to stagger API calls
    if (!conversation.tags?.length && !conversation.priority) {
      await ctx.scheduler.runAfter(
        10000,
        internal.system.conversations.analyzeAndTag,
        {
          conversationId: conversation._id,
          threadId: args.threadId,
          organizationId: conversation.organizationId,
        },
      )
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
