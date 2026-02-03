import { mutation } from "../_generated/server"
import { ConvexError, v } from "convex/values"
import { internal } from "../_generated/api"
import { INPUT_CONSTRAINTS } from "../schema"

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.string(),
    organizationId: v.string(),
    contactSessionId: v.optional(v.id("contactSessions")),
  },
  handler: async (ctx, args) => {
    // Validate input lengths
    if (args.name.length > INPUT_CONSTRAINTS.NAME_MAX_LENGTH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Name is too long",
      })
    }
    if (args.email.length > INPUT_CONSTRAINTS.EMAIL_MAX_LENGTH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Email is too long",
      })
    }
    if (args.phone && args.phone.length > INPUT_CONSTRAINTS.PHONE_MAX_LENGTH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Phone number is too long",
      })
    }

    // Create email notification for organization
    await ctx.db.insert("emailNotifications", {
      organizationId: args.organizationId,
      type: "contact_form",
      to: args.email, // We'll need to look up org admin email
      subject: `New Contact Form Submission from ${args.name}`,
      body: `
Name: ${args.name}
Email: ${args.email}
Phone: ${args.phone || "Not provided"}

Message:
${args.message}
      `.trim(),
      status: "pending",
      conversationId: undefined,
    })

    // Log analytics event
    await ctx.db.insert("analyticsEvents", {
      organizationId: args.organizationId,
      eventType: "contact_form_submitted",
      eventData: {
        name: args.name,
        email: args.email,
        hasPhone: !!args.phone,
        messageLength: args.message.length,
      },
      timestamp: Date.now(),
      sessionId: args.contactSessionId,
    })

    return { success: true }
  },
})
