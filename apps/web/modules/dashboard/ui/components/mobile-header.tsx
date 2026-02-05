"use client"

import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

interface MobileHeaderProps {
  title: string
}

export const MobileHeader = ({ title }: MobileHeaderProps) => {
  const isMobile = useIsMobile()

  if (!isMobile) return null

  return (
    <div className="flex items-center gap-2 border-b bg-background px-3 py-2.5 shrink-0">
      <SidebarTrigger />
      <h1 className="font-semibold">{title}</h1>
    </div>
  )
}
