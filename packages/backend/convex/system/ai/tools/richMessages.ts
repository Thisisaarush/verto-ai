import { createTool } from "@convex-dev/agent"
import z from "zod"
import {
  createQuickReplies,
  createCard,
  createCarousel,
  createList,
  createStatus,
  createRatingRequest,
  createLinkPreview,
} from "../../../lib/richMessages"
import { supportAgent } from "../agents/supportAgent"

/**
 * Rich Message Tools for AI Agents
 *
 * These tools allow AI agents to create interactive, structured content
 * in their responses. The content is serialized in a format that the
 * widget can parse and render as rich UI components.
 */

/**
 * Tool for creating quick reply buttons
 * Use when you want to present the user with predefined response options
 */
export const quickRepliesTool = createTool({
  description: `Create quick reply buttons for the user to choose from. Use this when you want to guide the user's response with predefined options. The buttons will be displayed below any accompanying text and users can click them to send that response.`,
  args: z.object({
    text: z
      .string()
      .optional()
      .describe("Optional text to display above the buttons"),
    buttons: z
      .array(
        z.object({
          label: z.string().describe("The text shown on the button"),
          replyText: z
            .string()
            .optional()
            .describe(
              "The text sent when clicked (defaults to label if not provided)",
            ),
        }),
      )
      .min(1)
      .max(6)
      .describe("Array of buttons (1-6 buttons)"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createQuickReplies(args.buttons, args.text)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return "Quick reply buttons displayed to user"
  },
})

/**
 * Tool for creating rich cards
 * Use when you want to present structured information with optional image and actions
 */
export const cardTool = createTool({
  description: `Create a rich card with title, description, optional image, and action buttons. Use this for presenting product information, articles, features, or any structured content that benefits from visual presentation.`,
  args: z.object({
    title: z.string().describe("The main title of the card"),
    description: z
      .string()
      .optional()
      .describe("A description or body text for the card"),
    imageUrl: z
      .string()
      .optional()
      .describe("URL of an image to display at the top of the card"),
    buttons: z
      .array(
        z.object({
          label: z.string().describe("Button text"),
          url: z.string().optional().describe("URL to open when clicked"),
          replyText: z
            .string()
            .optional()
            .describe("Text to send as reply when clicked (if no URL)"),
        }),
      )
      .optional()
      .describe("Optional array of action buttons"),
    metadata: z
      .array(
        z.object({
          label: z.string().describe("Metadata label (e.g., 'Price')"),
          value: z.string().describe("Metadata value (e.g., '$99.99')"),
        }),
      )
      .optional()
      .describe(
        "Optional key-value metadata to display (e.g., price, availability)",
      ),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createCard(args)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return `Card "${args.title}" displayed to user`
  },
})

/**
 * Tool for creating carousels
 * Use when you want to present multiple items that users can browse horizontally
 */
export const carouselTool = createTool({
  description: `Create a horizontal carousel of cards. Use this when presenting multiple related items like products, articles, or options that the user can scroll through and compare.`,
  args: z.object({
    title: z.string().optional().describe("Optional title above the carousel"),
    cards: z
      .array(
        z.object({
          title: z.string().describe("Card title"),
          description: z.string().optional().describe("Card description"),
          imageUrl: z.string().optional().describe("Card image URL"),
          buttons: z
            .array(
              z.object({
                label: z.string(),
                url: z.string().optional(),
                replyText: z.string().optional(),
              }),
            )
            .optional(),
        }),
      )
      .min(2)
      .max(10)
      .describe("Array of cards (2-10 cards)"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createCarousel(args.cards, args.title)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return `Carousel with ${args.cards.length} cards displayed to user`
  },
})

/**
 * Tool for creating structured lists
 * Use when presenting a list of items with consistent structure
 */
export const listTool = createTool({
  description: `Create a structured list of items. Use this for presenting search results, feature lists, step-by-step instructions, or any content that works well as a list.`,
  args: z.object({
    title: z.string().optional().describe("Optional title above the list"),
    items: z
      .array(
        z.object({
          title: z.string().describe("Item title"),
          subtitle: z.string().optional().describe("Brief subtitle"),
          description: z.string().optional().describe("Longer description"),
          imageUrl: z.string().optional().describe("Optional image URL"),
          icon: z.string().optional().describe("Optional emoji icon"),
        }),
      )
      .min(1)
      .max(10)
      .describe("Array of list items (1-10 items)"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createList(args.items, args.title)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return `List with ${args.items.length} items displayed to user`
  },
})

/**
 * Tool for creating status/progress indicators
 * Use when showing the status of a process, order, or task
 */
export const statusTool = createTool({
  description: `Create a status indicator with optional progress or steps. Use this to show the current status of an order, process, or task.`,
  args: z.object({
    title: z.string().describe("Status title"),
    status: z
      .enum(["pending", "in_progress", "completed", "failed"])
      .describe("Current status"),
    message: z.string().optional().describe("Optional status message"),
    progress: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Optional progress percentage (0-100)"),
    steps: z
      .array(
        z.object({
          label: z.string().describe("Step label"),
          done: z.boolean().describe("Whether the step is completed"),
        }),
      )
      .optional()
      .describe("Optional array of steps showing progress"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createStatus(args)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return `Status "${args.title}" (${args.status}) displayed to user`
  },
})

/**
 * Tool for requesting user ratings
 * Use after providing help to gather feedback
 */
export const ratingTool = createTool({
  description: `Request a rating from the user. Use this after resolving an issue or providing help to gather feedback on the support experience.`,
  args: z.object({
    title: z.string().optional().describe("Rating request title"),
    message: z
      .string()
      .optional()
      .describe("Optional message above the rating"),
    ratingType: z
      .enum(["stars", "thumbs", "emoji"])
      .optional()
      .describe("Type of rating UI"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createRatingRequest({
      title: args.title || "How was your experience?",
      message: args.message,
      ratingType: args.ratingType || "thumbs",
      maxRating: 5,
      callbackId: `rating-${Date.now()}`,
    })

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return "Rating request displayed to user"
  },
})

/**
 * Tool for creating link previews
 * Use when sharing a relevant link with the user
 */
export const linkPreviewTool = createTool({
  description: `Create a rich link preview card. Use this when sharing a URL with the user to provide a better visual experience than a plain link.`,
  args: z.object({
    url: z.string().describe("The URL to preview"),
    title: z.string().optional().describe("Link title"),
    description: z.string().optional().describe("Link description"),
    imageUrl: z.string().optional().describe("Preview image URL"),
    siteName: z.string().optional().describe("Name of the website"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) return "Missing thread ID"

    const richContent = createLinkPreview(args)

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content: richContent,
      },
    })

    return `Link preview for "${args.url}" displayed to user`
  },
})

/**
 * All rich message tools combined for easy agent configuration
 */
export const richMessageTools = {
  createQuickReplies: quickRepliesTool,
  createCard: cardTool,
  createCarousel: carouselTool,
  createList: listTool,
  createStatus: statusTool,
  requestRating: ratingTool,
  createLinkPreview: linkPreviewTool,
}
