import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { ConversationsPanel } from "../components/conversations-panel"

export const ConversationsLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
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
  )
}
