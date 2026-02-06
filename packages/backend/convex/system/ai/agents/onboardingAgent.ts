import { google } from "@ai-sdk/google"
import { Agent } from "@convex-dev/agent"
import { components } from "../../../_generated/api"
import { ONBOARDING_AGENT_PROMPT } from "../constants"

export const onboardingAgent = new Agent(components.agent, {
  name: "onboarding-support-agent",
  languageModel: google.chat("gemini-2.5-flash"),
  instructions: ONBOARDING_AGENT_PROMPT,
})
