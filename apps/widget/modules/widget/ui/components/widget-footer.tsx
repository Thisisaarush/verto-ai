import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useAtomValue, useSetAtom } from "jotai"
import { HomeIcon, InboxIcon, PhoneIcon } from "lucide-react"
import { screenAtom } from "../../atoms/widget-atoms"

export default function WidgetFooter() {
  const screen = useAtomValue(screenAtom)
  const setScreen = useSetAtom(screenAtom)

  const navItems = [
    { id: "selection" as const, icon: HomeIcon, label: "Home" },
    { id: "inbox" as const, icon: InboxIcon, label: "Inbox" },
    { id: "contact" as const, icon: PhoneIcon, label: "Contact" },
  ]

  return (
    <footer className="flex items-center justify-around border-t bg-background px-2 py-1">
      {navItems.map((item) => {
        const isActive = screen === item.id
        return (
          <Button
            key={item.id}
            className={cn(
              "relative flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-none",
              isActive && "text-primary",
            )}
            onClick={() => setScreen(item.id)}
            variant="ghost"
          >
            <item.icon className={cn("size-5", isActive && "text-primary")} />
            <span
              className={cn(
                "text-[10px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </span>
            {isActive && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary transition-all" />
            )}
          </Button>
        )
      })}
    </footer>
  )
}
