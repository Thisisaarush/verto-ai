import { google } from "@ai-sdk/google"
import { Agent } from "@convex-dev/agent"
import { components } from "../../../_generated/api"
import { SALES_AGENT_PROMPT } from "../constants"

export const salesAgent = new Agent(components.agent, {
  name: "sales-support-agent",
  languageModel: google.chat("gemini-2.5-flash"),
  instructions: SALES_AGENT_PROMPT,
})
