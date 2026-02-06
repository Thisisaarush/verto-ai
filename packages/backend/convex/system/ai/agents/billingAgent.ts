import { google } from "@ai-sdk/google"
import { Agent } from "@convex-dev/agent"
import { components } from "../../../_generated/api"
import { BILLING_AGENT_PROMPT } from "../constants"

export const billingAgent = new Agent(components.agent, {
  name: "billing-support-agent",
  languageModel: google.chat("gemini-2.5-flash"),
  instructions: BILLING_AGENT_PROMPT,
})
