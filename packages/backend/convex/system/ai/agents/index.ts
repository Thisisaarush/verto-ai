// Export all specialized agents
export { supportAgent } from "./supportAgent"
export { billingAgent } from "./billingAgent"
export { technicalAgent } from "./technicalAgent"
export { onboardingAgent } from "./onboardingAgent"
export { salesAgent } from "./salesAgent"

import { supportAgent } from "./supportAgent"
import { billingAgent } from "./billingAgent"
import { technicalAgent } from "./technicalAgent"
import { onboardingAgent } from "./onboardingAgent"
import { salesAgent } from "./salesAgent"
import type { AgentType } from "../constants"

// Agent map for easy lookup
export const agentMap = {
  general: supportAgent,
  billing: billingAgent,
  technical: technicalAgent,
  onboarding: onboardingAgent,
  sales: salesAgent,
} as const

export function getAgentByType(agentType: AgentType) {
  return agentMap[agentType] || supportAgent
}
