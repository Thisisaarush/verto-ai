"use client"

import { useState } from "react"
import { ContactPanel } from "../components/contact-panel"
import { Button } from "@workspace/ui/components/button"
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { createContext, useContext } from "react"

// Context for panel state
const PanelContext = createContext<{
  isPanelCollapsed: boolean
  togglePanel: () => void
}>({
  isPanelCollapsed: true,
  togglePanel: () => {},
})

export const usePanelContext = () => useContext(PanelContext)

export const ConversationIdLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true)

  return (
    <PanelContext.Provider
      value={{
        isPanelCollapsed,
        togglePanel: () => setIsPanelCollapsed(!isPanelCollapsed),
      }}
    >
      <div className="flex h-full flex-1 overflow-hidden">
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          {children}
        </div>

        {/* Collapsible Side Panel */}
        <div
          className={cn(
            "hidden lg:flex flex-col border-l bg-background transition-all duration-300 ease-in-out overflow-hidden",
            isPanelCollapsed ? "w-0" : "w-[350px]",
          )}
        >
          {!isPanelCollapsed && <ContactPanel />}
        </div>
      </div>
    </PanelContext.Provider>
  )
}
