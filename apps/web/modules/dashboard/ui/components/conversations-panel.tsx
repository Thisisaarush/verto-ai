"use client"

import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { usePaginatedQuery, useQuery } from "convex/react"
import {
  ListIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  CornerUpLeftIcon,
  FlagIcon,
  TagIcon,
  XIcon,
  SparklesIcon,
  SmileIcon,
} from "lucide-react"
import { api } from "@workspace/backend/convex/_generated/api"
import { getCountryFlagUrl, getCountryFromTimezone } from "@/lib/country-utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar"
import { formatDistanceToNow } from "date-fns"
import { ConversationStatusIcon } from "@workspace/ui/components/conversation-status-icon"
import { useAtomValue, useSetAtom } from "jotai/react"
import { statusFilterAtom } from "../../atoms"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { useOrganization } from "@clerk/nextjs"
import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

interface ConversationsPanelProps {
  onConversationClick?: () => void
}

export const ConversationsPanel = ({
  onConversationClick,
}: ConversationsPanelProps = {}) => {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "low" | "medium" | "high"
  >("all")
  const [sentimentFilter, setSentimentFilter] = useState<
    "all" | "positive" | "neutral" | "negative"
  >("all")
  const [tagFilter, setTagFilter] = useState<string>("all")

  const statusFilter = useAtomValue(statusFilterAtom)
  const setStatusFilter = useSetAtom(statusFilterAtom)

  const isMobile = useIsMobile()

  // Get available tags
  const availableTags = useQuery(
    api.private.conversationTags.getMany,
    organization?.id ? { organizationId: organization.id } : "skip",
  )

  const conversations = usePaginatedQuery(
    api.private.conversations.getMany,
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      priority:
        priorityFilter === "all"
          ? undefined
          : (priorityFilter as "low" | "medium" | "high"),
      sentiment:
        sentimentFilter === "all"
          ? undefined
          : (sentimentFilter as "positive" | "neutral" | "negative"),
      tag: tagFilter === "all" ? undefined : tagFilter,
    },
    {
      initialNumItems: 10,
    },
  )

  const {
    canLoadMore,
    handleLoadMore,
    isLoadingFirstPage,
    isLoadingMore,
    topElementRef,
  } = useInfiniteScroll({
    status: conversations.status,
    loadMore: conversations.loadMore,
    loadSize: 10,
  })

  return (
    <div className="flex h-full w-full flex-col bg-background text-sidebar-foreground">
      {isMobile && (
        <div className="flex items-center gap-2 border-b px-3 py-2.5 shrink-0">
          <SidebarTrigger />
          <h1 className="font-semibold">Conversations</h1>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 border-b p-2">
        <Select
          defaultValue="all"
          onValueChange={(value) => {
            setStatusFilter(
              value as "unresolved" | "escalated" | "resolved" | "all",
            )
          }}
          value={statusFilter}
        >
          <SelectTrigger className="h-8 border-none px-2 shadow-none ring-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-0">
            <SelectValue placeholder="Filter">
              <div className="flex items-center gap-2">
                <ListIcon className="size-4" />
                <span>
                  {statusFilter === "all"
                    ? "All"
                    : statusFilter === "escalated"
                      ? "Escalated"
                      : statusFilter === "unresolved"
                        ? "Unresolved"
                        : "Resolved"}
                </span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <ListIcon className="size-4" />
                <span>All</span>
              </div>
            </SelectItem>
            <SelectItem value="escalated">
              <div className="flex items-center gap-2">
                <ArrowUpIcon className="size-4" />
                <span>Escalated</span>
              </div>
            </SelectItem>
            <SelectItem value="unresolved">
              <div className="flex items-center gap-2">
                <ArrowRightIcon className="size-4" />
                <span>Unresolved</span>
              </div>
            </SelectItem>
            <SelectItem value="resolved">
              <div className="flex items-center gap-2">
                <CheckIcon className="size-4" />
                <span>Resolved</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={priorityFilter}
          onValueChange={(value) =>
            setPriorityFilter(value as typeof priorityFilter)
          }
        >
          <SelectTrigger className="h-8 border-none px-2 shadow-none ring-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-0">
            <SelectValue>
              <div className="flex items-center gap-2">
                <FlagIcon className="size-4" />
                <span>
                  {priorityFilter === "all"
                    ? "All Priorities"
                    : `${priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)} Priority`}
                </span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>

        {/* Sentiment Filter */}
        <Select
          value={sentimentFilter}
          onValueChange={(value) =>
            setSentimentFilter(value as typeof sentimentFilter)
          }
        >
          <SelectTrigger className="h-8 border-none px-2 shadow-none ring-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-0">
            <SelectValue>
              <div className="flex items-center gap-2">
                <SmileIcon className="size-4" />
                <span>
                  {sentimentFilter === "all"
                    ? "All Moods"
                    : sentimentFilter === "positive"
                      ? "😊 Positive"
                      : sentimentFilter === "neutral"
                        ? "😐 Neutral"
                        : "😤 Frustrated"}
                </span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Moods</SelectItem>
            <SelectItem value="positive">😊 Positive</SelectItem>
            <SelectItem value="neutral">😐 Neutral</SelectItem>
            <SelectItem value="negative">😤 Frustrated</SelectItem>
          </SelectContent>
        </Select>

        {/* Tag Filter */}
        <div className="flex items-center gap-1">
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-8 flex-1 border-none px-2 shadow-none ring-0 hover:bg-accent hover:text-accent-foreground focus-visible:ring-0">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <TagIcon className="size-4" />
                  <span className="truncate">
                    {tagFilter === "all" ? "All Tags" : tagFilter}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {availableTags?.map((tag) => (
                <SelectItem key={tag._id} value={tag.name}>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(priorityFilter !== "all" ||
            sentimentFilter !== "all" ||
            tagFilter !== "all") && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setPriorityFilter("all")
                setSentimentFilter("all")
                setTagFilter("all")
              }}
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {isLoadingFirstPage ? (
        <SkeletonConversations />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-53px)]">
          <div className="flex w-full flex-1 flex-col text-sm">
            {conversations.results.map((conversation) => {
              const isLastMessageFromOperator =
                conversation?.lastMessage?.message &&
                conversation?.lastMessage?.message.role !== "user"

              const country = getCountryFromTimezone(
                conversation.contactSession.metadata?.timezone,
              )

              const countryFlagUrl = country?.code
                ? getCountryFlagUrl(country.code)
                : undefined

              // Check if conversation has unread messages
              const isUnread =
                conversation.lastMessageAt &&
                (!conversation.lastReadAt ||
                  conversation.lastMessageAt > conversation.lastReadAt)

              return (
                <Link
                  onClick={onConversationClick}
                  href={`/conversations/${conversation._id}`}
                  key={conversation._id}
                  className={cn(
                    "flex relative cursor-pointer items-start gap-3 border-b p-4 py-5 text-sm leading-tight hover:bg-accent hover:text-accent-foreground",
                    pathname === `/conversations/${conversation._id}` &&
                      "bg-accent text-accent-foreground",
                    isUnread && "bg-blue-50/50 dark:bg-blue-950/20",
                  )}
                >
                  <div
                    className={cn(
                      "-translate-y-1/2 absolute top-1/2 left-0 h-[64%] w-1 rounded-r-full bg-neutral-300 opacity-0 transition-opacity",
                      pathname === `/conversations/${conversation._id}` &&
                        "opacity-100",
                    )}
                  />

                  <DicebearAvatar
                    seed={conversation.contactSession._id}
                    badgeImageUrl={countryFlagUrl}
                    size={40}
                    className="shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex w-full items-center gap-2">
                      {isUnread && (
                        <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "truncate font-bold",
                          isUnread && "text-blue-600 dark:text-blue-400",
                        )}
                      >
                        {conversation.contactSession?.name}
                      </span>
                      <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                        {formatDistanceToNow(conversation._creationTime)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex w-0 grow items-center gap-1">
                        {isLastMessageFromOperator && (
                          <CornerUpLeftIcon className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "line-clamp-1 text-muted-foreground text-xs",
                            !isLastMessageFromOperator &&
                              "font-bold text-black",
                          )}
                        >
                          {conversation.lastMessage?.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {conversation.sentiment && (
                          <span
                            className="text-sm"
                            title={`Sentiment: ${conversation.sentiment}`}
                          >
                            {conversation.sentiment === "positive"
                              ? "😊"
                              : conversation.sentiment === "neutral"
                                ? "😐"
                                : "😤"}
                          </span>
                        )}
                        <ConversationStatusIcon status={conversation.status} />
                      </div>
                    </div>

                    {/* AI Summary - shown as tooltip on hover */}
                    {conversation.summary && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="mt-1 flex items-center gap-1 cursor-help">
                              <SparklesIcon className="size-3 shrink-0 text-violet-500" />
                              <span className="text-xs text-violet-500 font-medium">
                                AI Summary
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-sm">{conversation.summary}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </Link>
              )
            })}
            <InfiniteScrollTrigger
              canLoadMore={canLoadMore}
              isLoadingMore={isLoadingMore}
              isLoadingFirstPage={isLoadingFirstPage}
              onLoadMore={handleLoadMore}
              ref={topElementRef}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

export const SkeletonConversations = () => {
  return (
    <div className="flex w-full flex-col">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 border-b p-4 py-5"
        >
          <div className="h-10 w-10 rounded-full bg-neutral-300" />
          <div className="flex-1">
            <div className="h-4 w-1/2 rounded bg-neutral-300" />
            <div className="mt-1 h-3 w-full rounded bg-neutral-300" />
          </div>
        </div>
      ))}
    </div>
  )
}
