import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"

// Email sending action - integrate with Resend or similar
export const sendEmail = internalAction({
  args: {
    notificationId: v.id("emailNotifications"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.runQuery(
      internal.system.emails.getNotification,
      {
        notificationId: args.notificationId,
      },
    )

    if (!notification || notification.status !== "pending") {
      return {
        success: false,
        error: "Notification not found or already processed",
      }
    }

    try {
      // Check if Resend API key is configured
      const resendApiKey = process.env.RESEND_API_KEY

      if (!resendApiKey) {
        console.log("Email notification (RESEND_API_KEY not configured):", {
          to: notification.to,
          subject: notification.subject,
          body: notification.body,
        })

        // Mark as sent even without actual sending in dev
        await ctx.runMutation(internal.system.emails.updateNotificationStatus, {
          notificationId: args.notificationId,
          status: "sent",
          sentAt: Date.now(),
        })

        return {
          success: true,
          message: "Email logged (no API key configured)",
        }
      }

      // Send via Resend API
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Verto AI <noreply@vertoai.com>",
          to: notification.to,
          subject: notification.subject,
          text: notification.body,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to send email: ${error}`)
      }

      await ctx.runMutation(internal.system.emails.updateNotificationStatus, {
        notificationId: args.notificationId,
        status: "sent",
        sentAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"

      await ctx.runMutation(internal.system.emails.updateNotificationStatus, {
        notificationId: args.notificationId,
        status: "failed",
        error: errorMessage,
      })

      return { success: false, error: errorMessage }
    }
  },
})

export const getNotification = internalQuery({
  args: {
    notificationId: v.id("emailNotifications"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.notificationId)
  },
})

export const updateNotificationStatus = internalMutation({
  args: {
    notificationId: v.id("emailNotifications"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      sentAt: args.sentAt,
      error: args.error,
    })
  },
})

// Queue email notification on escalation
export const notifyOnEscalation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    organizationId: v.string(),
    contactEmail: v.optional(v.string()),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create notification for escalation
    const notificationId = await ctx.db.insert("emailNotifications", {
      organizationId: args.organizationId,
      type: "escalation",
      to: "admin@organization.com", // TODO: Look up organization admin email
      subject: `[Urgent] Conversation Escalated - ${args.contactName || "Customer"}`,
      body: `
A conversation has been escalated and requires human attention.

Customer: ${args.contactName || "Unknown"}
Email: ${args.contactEmail || "Not provided"}
Conversation ID: ${args.conversationId}

Please log in to your dashboard to respond.
      `.trim(),
      status: "pending",
      conversationId: args.conversationId,
    })

    // Schedule email sending
    await ctx.scheduler.runAfter(0, internal.system.emails.sendEmail, {
      notificationId,
    })

    return notificationId
  },
})
