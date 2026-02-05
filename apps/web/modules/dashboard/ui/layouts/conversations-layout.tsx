"use client"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { ConversationsPanel } from "../components/conversations-panel"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { createContext, useContext, useState } from "react"

const ConversationsPanelContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

export const useConversationsPanelContext = () =>
  useContext(ConversationsPanelContext)

export const ConversationsLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  if (isMobile) {
    return (
      <ConversationsPanelContext.Provider value={{ isOpen, setIsOpen }}>
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent side="left" className="w-[300px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Conversations</SheetTitle>
                <SheetDescription>List of all conversations</SheetDescription>
              </SheetHeader>
              <ConversationsPanel
                onConversationClick={() => setIsOpen(false)}
              />
            </SheetContent>
          </Sheet>
          {children}
        </div>
      </ConversationsPanelContext.Provider>
    )
  }

  return (
    <ConversationsPanelContext.Provider value={{ isOpen, setIsOpen }}>
      <ResizablePanelGroup
        className="h-full flex-1 overflow-hidden"
        direction="horizontal"
      >
        <ResizablePanel defaultSize={30} minSize={20} maxSize={30}>
          <ConversationsPanel />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="h-full overflow-hidden" defaultSize={70}>
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </ConversationsPanelContext.Provider>
  )
}
