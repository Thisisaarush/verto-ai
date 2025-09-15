import {
  HTML_SCRIPT,
  type IntegrationId,
  JAVASCRIPT_SCRIPT,
  REACT_SCRIPT,
  NEXTJS_SCRIPT,
} from "./constants"

export const createScript = (
  integrationId: IntegrationId,
  organizationId: string
) => {
  if (integrationId === "html") {
    return HTML_SCRIPT.replace(/{{ORGANIZATION_ID}}/g, organizationId)
  } else if (integrationId === "javascript") {
    return JAVASCRIPT_SCRIPT.replace(/{{ORGANIZATION_ID}}/g, organizationId)
  } else if (integrationId === "react") {
    return REACT_SCRIPT.replace(/{{ORGANIZATION_ID}}/g, organizationId)
  } else if (integrationId === "nextjs") {
    return NEXTJS_SCRIPT.replace(/{{ORGANIZATION_ID}}/g, organizationId)
  } else {
    return ""
  }
}
