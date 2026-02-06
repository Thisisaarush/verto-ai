import { google } from "@ai-sdk/google"
import { Agent } from "@convex-dev/agent"
import { components } from "../../../_generated/api"
import { TECHNICAL_AGENT_PROMPT } from "../constants"

export const technicalAgent = new Agent(components.agent, {
  name: "technical-support-agent",
  languageModel: google.chat("gemini-2.5-flash"),
  instructions: TECHNICAL_AGENT_PROMPT,
})
