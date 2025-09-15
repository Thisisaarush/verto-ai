import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { Webhook } from "svix"
import { createClerkClient } from "@clerk/backend"
import type { WebhookEvent } from "@clerk/backend"
import { internal } from "./_generated/api"

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
})

const http = httpRouter()

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const event = await validateRequest(req)
    if (!event) {
      return new Response("Invalid request", { status: 400 })
    }

    switch (event.type) {
      case "subscription.updated":
        const subscription = event.data as {
          status: string
          payer?: {
            organization_id: string
          }
        }

        const organizationId = subscription.payer?.organization_id
        if (!organizationId) {
          return new Response("No organization ID", { status: 400 })
        }

        const maxAllowedMemberships = subscription.status === "active" ? 5 : 1

        await clerkClient.organizations.updateOrganization(organizationId, {
          maxAllowedMemberships: maxAllowedMemberships,
        })

        await ctx.runMutation(internal.system.subscriptions.upsert, {
          organizationId,
          status: subscription.status,
        })

        break
      default:
        console.log("Ignored Clerk Webhook event:", event.type)
    }

    return new Response(null, { status: 200 })
  }),
})

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text()
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "")

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent
  } catch (error) {
    console.error("Error validating webhook:", error)
    return null
  }
}

export default http
