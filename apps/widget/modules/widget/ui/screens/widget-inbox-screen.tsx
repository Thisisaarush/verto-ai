"use client"

import { useAtomValue, useSetAtom } from "jotai"
import {
  ArrowLeftIcon,
  MessageSquarePlusIcon,
  InboxIcon as InboxEmptyIcon,
} from "lucide-react"
import {
  contactSessionIdAtomFamily,
  conversationIdAtom,
  organizationIdAtom,
  screenAtom,
} from "../../atoms/widget-atoms"
import WidgetHeader from "../components/widget-header"
import WidgetFooter from "../components/widget-footer"
import { Button } from "@workspace/ui/components/button"
import { usePaginatedQuery } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { formatDistanceToNow } from "date-fns"
import { ConversationStatusIcon } from "@workspace/ui/components/conversation-status-icon"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { Skeleton } from "@workspace/ui/components/skeleton"

// Loading skeleton for conversation items
const ConversationSkeleton = () => (
  <div className="flex h-20 w-full items-center justify-between rounded-lg border bg-background p-4">
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
    </div>
  </div>
)

// Empty state component
const EmptyInbox = ({ onStartChat }: { onStartChat: () => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="rounded-full bg-muted p-4">
      <InboxEmptyIcon className="size-8 text-muted-foreground" />
    </div>
    <div className="space-y-1">
      <h3 className="font-medium">No conversations yet</h3>
      <p className="text-sm text-muted-foreground">
        Start a conversation to get help from our support team.
      </p>
    </div>
    <Button onClick={onStartChat} className="mt-2">
      <MessageSquarePlusIcon className="mr-2 size-4" />
      Start a Conversation
    </Button>
  </div>
)

export const WidgetInboxScreen = () => {
  const setScreen = useSetAtom(screenAtom)
  const setConversationId = useSetAtom(conversationIdAtom)

  const organizationId = useAtomValue(organizationIdAtom)
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || ""),
  )

  const conversations = usePaginatedQuery(
    api.public.conversations.getMany,
    contactSessionId ? { contactSessionId } : "skip",
    {
      initialNumItems: 10,
    },
  )

  const { topElementRef, handleLoadMore, canLoadMore, isLoadingMore } =
    useInfiniteScroll({
      status: conversations.status,
      loadMore: conversations.loadMore,
      loadSize: 10,
    })

  const isLoading = conversations.status === "LoadingFirstPage"
  const isEmpty = !isLoading && conversations.results?.length === 0

  const handleStartChat = () => {
    setScreen("selection")
  }

  return (
    <>
      <WidgetHeader className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Button
            size="icon"
            variant="transparent"
            onClick={() => setScreen("selection")}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <p className="font-medium">Inbox</p>
        </div>
        {!isEmpty && (
          <Button size="icon" variant="transparent" onClick={handleStartChat}>
            <MessageSquarePlusIcon className="size-4" />
          </Button>
        )}
      </WidgetHeader>

      <div className="flex flex-1 flex-col gap-y-2 p-4 overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && <EmptyInbox onStartChat={handleStartChat} />}

        {/* Conversation list */}
        {conversations?.results?.length > 0 &&
          conversations.results.map((conversation, index) => (
            <div key={conversation._id}>
              <Button
                className="h-auto min-h-[5rem] w-full justify-between py-3 px-4"
                onClick={() => {
                  setConversationId(conversation._id)
                  setScreen("chat")
                }}
                variant="outline"
              >
                <div className="flex w-full flex-col gap-2 overflow-hidden text-start">
                  <div className="flex w-full items-center justify-between gap-x-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        Chat
                      </span>
                      {conversation.tags && conversation.tags.length > 0 && (
                        <div className="flex gap-1">
                          {conversation.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(
                        new Date(conversation._creationTime),
                        {
                          addSuffix: true,
                        },
                      )}
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between gap-x-2">
                    <p className="truncate text-sm text-foreground">
                      {conversation.lastMessage?.text || "No messages yet"}
                    </p>
                    <ConversationStatusIcon status={conversation.status} />
                  </div>
                  {conversation.priority && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`size-2 rounded-full ${
                          conversation.priority === "high"
                            ? "bg-red-500"
                            : conversation.priority === "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                      />
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {conversation.priority} priority
                      </span>
                    </div>
                  )}
                </div>
              </Button>
            </div>
          ))}

        <InfiniteScrollTrigger
          canLoadMore={canLoadMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
          ref={topElementRef}
        />
      </div>
      <WidgetFooter />
    </>
  )
}
