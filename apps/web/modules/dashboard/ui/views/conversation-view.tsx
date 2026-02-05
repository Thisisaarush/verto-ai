"use client"

import Image from "next/image"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { Button } from "@workspace/ui/components/button"
import { MessageSquareIcon } from "lucide-react"
import { useConversationsPanelContext } from "../layouts/conversations-layout"

export const ConversationView = () => {
  const isMobile = useIsMobile()
  const { setIsOpen: setConversationsOpen } = useConversationsPanelContext()

  return (
    <div className="flex h-full flex-1 flex-col bg-muted">
      {isMobile && (
        <div className="flex items-center gap-2 border-b bg-background px-3 py-2.5 shrink-0">
          <SidebarTrigger />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setConversationsOpen(true)}
          >
            <MessageSquareIcon className="size-4" />
          </Button>
          <span className="font-semibold">Conversations</span>
        </div>
      )}
      <div className="flex flex-1 items-center justify-center gap-x-2">
        <Image alt="logo" height={40} width={40} src="logo.svg" />
        <p className="font-semibold text-lg">AI Chat</p>
      </div>
    </div>
  )
}
