"use client"

import { useAtomValue } from "jotai"
import { WidgetAuthScreen } from "../screens/widget-auth-screen"
import { screenAtom, widgetSettingsAtom } from "../../atoms/widget-atoms"
import { WidgetErrorScreen } from "../screens/widget-error-screen"
import { WidgetLoadingScreen } from "../screens/widget-loading-screen"
import { WidgetSelectionScreen } from "../screens/widget-selection-screen"
import { WidgetChatScreen } from "../screens/widget-chat-screen"
import { WidgetInboxScreen } from "../screens/widget-inbox-screen"
import { WidgetContactScreen } from "../screens/widget-contact-screen"
import { useMemo } from "react"

interface WidgetViewProps {
  organizationId: string | null
}

const WidgetView: React.FC<WidgetViewProps> = ({ organizationId }) => {
  const screen = useAtomValue(screenAtom)
  const widgetSettings = useAtomValue(widgetSettingsAtom)

  // Apply primary color from widget settings
  const customStyles = useMemo(() => {
    if (!widgetSettings?.primaryColor) return {}

    return {
      "--primary": widgetSettings.primaryColor,
      "--primary-foreground": "#ffffff",
    } as React.CSSProperties
  }, [widgetSettings?.primaryColor])

  const renderScreen = () => {
    switch (screen) {
      case "loading":
        return <WidgetLoadingScreen organizationId={organizationId} />
      case "error":
        return <WidgetErrorScreen />
      case "auth":
        return <WidgetAuthScreen />
      case "inbox":
        return <WidgetInboxScreen />
      case "selection":
        return <WidgetSelectionScreen />
      case "chat":
        return <WidgetChatScreen />
      case "contact":
        return <WidgetContactScreen />
      default:
        return <WidgetLoadingScreen organizationId={organizationId} />
    }
  }

  return (
    <main
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-muted"
      style={customStyles}
      lang={widgetSettings?.language || "en"}
    >
      <div className="flex h-full w-full flex-col">{renderScreen()}</div>
    </main>
  )
}

export default WidgetView
