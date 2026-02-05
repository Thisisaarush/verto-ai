"use client"

import { useState } from "react"
import { ContactPanel } from "../components/contact-panel"
import { cn } from "@workspace/ui/lib/utils"
import { createContext, useContext } from "react"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

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
  const isMobile = useIsMobile()

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

      
        {isMobile ? (
          <Sheet
            open={!isPanelCollapsed}
            onOpenChange={(open) => setIsPanelCollapsed(!open)}
          >
            <SheetContent side="right" className="w-[320px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Contact Details</SheetTitle>
                <SheetDescription>View contact information</SheetDescription>
              </SheetHeader>
              <ContactPanel />
            </SheetContent>
          </Sheet>
        ) : (
         
          <div
            className={cn(
              "flex flex-col border-l bg-background transition-all duration-300 ease-in-out overflow-hidden",
              isPanelCollapsed ? "w-0" : "w-[350px]"
            )}
          >
            {!isPanelCollapsed && <ContactPanel />}
          </div>
        )}
      </div>
    </PanelContext.Provider>
  )
}
