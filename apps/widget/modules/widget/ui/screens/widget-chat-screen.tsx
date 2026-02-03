"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { useAtomValue, useSetAtom } from "jotai"
import {
  ArrowLeftIcon,
  MenuIcon,
  PaperclipIcon,
  MoreVerticalIcon,
  CopyIcon,
  TrashIcon,
  PhoneIcon,
  CheckIcon,
  CheckCheckIcon,
  AlertCircleIcon,
  XIcon,
  UserIcon,
  BotIcon,
  HeadphonesIcon,
} from "lucide-react"
import WidgetHeader from "../components/widget-header"
import { Button } from "@workspace/ui/components/button"
import {
  contactSessionIdAtomFamily,
  conversationIdAtom,
  organizationIdAtom,
  screenAtom,
  widgetSettingsAtom,
} from "../../atoms/widget-atoms"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react"
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@workspace/ui/components/ai/conversation"
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@workspace/ui/components/ai/input"
import {
  AIMessage,
  AIMessageContent,
} from "@workspace/ui/components/ai/message"
import { AIResponse } from "@workspace/ui/components/ai/response"
import {
  AISuggestion,
  AISuggestions,
} from "@workspace/ui/components/ai/suggestion"
import { Form, FormField } from "@workspace/ui/components/form"
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { formatDistanceToNow, format } from "date-fns"

const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(4000, "Message too long"),
})

// Message status indicator component
const MessageStatus = ({
  status,
}: {
  status: "sending" | "sent" | "delivered" | "failed"
}) => {
  const icons = {
    sending: <span className="animate-pulse">●</span>,
    sent: <CheckIcon className="size-3" />,
    delivered: <CheckCheckIcon className="size-3" />,
    failed: <AlertCircleIcon className="size-3 text-destructive" />,
  }
  return (
    <span className="ml-1 inline-flex items-center text-muted-foreground">
      {icons[status]}
    </span>
  )
}

// Timestamp component with tooltip
const MessageTimestamp = ({ timestamp }: { timestamp: number }) => {
  const date = new Date(timestamp)
  const relativeTime = formatDistanceToNow(date, { addSuffix: true })
  const fullTime = format(date, "PPpp")

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground cursor-default">
            {relativeTime}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{fullTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Loading skeleton for messages
const MessageSkeleton = () => (
  <div className="flex items-end gap-2 py-2">
    <Skeleton className="size-8 rounded-full" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
)

export const WidgetChatScreen = () => {
  const setScreen = useSetAtom(screenAtom)
  const setConversationId = useSetAtom(conversationIdAtom)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [sendingMessages, setSendingMessages] = useState<Set<string>>(new Set())
  const [failedMessages, setFailedMessages] = useState<Map<string, string>>(
    new Map(),
  )

  const widgetSettings = useAtomValue(widgetSettingsAtom)
  const conversationId = useAtomValue(conversationIdAtom)
  const organizationId = useAtomValue(organizationIdAtom)
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || ""),
  )

  const onBack = () => {
    setScreen("selection")
    setConversationId(null)
  }

  const suggestions = useMemo(() => {
    if (!widgetSettings) return []

    return Object.keys(widgetSettings.defaultSuggestions)
      .map(
        (key) =>
          widgetSettings.defaultSuggestions[
            key as keyof typeof widgetSettings.defaultSuggestions
          ],
      )
      .filter((s): s is string => !!s && s.trim() !== "")
  }, [widgetSettings])

  const conversation = useQuery(
    api.public.conversations.getOne,
    conversationId && contactSessionId
      ? {
          conversationId,
          contactSessionId,
        }
      : "skip",
  )

  const messages = useThreadMessages(
    api.public.messages.getMany,
    conversation?.threadId && contactSessionId
      ? {
          threadId: conversation.threadId,
          contactSessionId,
        }
      : "skip",
    {
      initialNumItems: 10,
    },
  )

  // Typing indicator queries and mutations
  const typingStatus = useQuery(
    api.public.typingIndicators.getTypingStatus,
    conversationId && contactSessionId
      ? { conversationId, contactSessionId }
      : "skip",
  )

  const setTyping = useMutation(api.public.typingIndicators.setTyping)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingStateRef = useRef(false)

  // Handle user typing
  const handleTyping = useCallback(() => {
    if (!conversationId || !contactSessionId) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set typing to true if not already
    if (!lastTypingStateRef.current) {
      lastTypingStateRef.current = true
      setTyping({ conversationId, contactSessionId, isTyping: true })
    }

    // Set timeout to turn off typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (lastTypingStateRef.current) {
        lastTypingStateRef.current = false
        setTyping({ conversationId, contactSessionId, isTyping: false })
      }
    }, 3000)
  }, [conversationId, contactSessionId, setTyping])

  // Cleanup typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (lastTypingStateRef.current && conversationId && contactSessionId) {
        setTyping({ conversationId, contactSessionId, isTyping: false })
      }
    }
  }, [conversationId, contactSessionId, setTyping])

  const { topElementRef, handleLoadMore, canLoadMore, isLoadingMore } =
    useInfiniteScroll({
      status: messages.status,
      loadMore: messages.loadMore,
      loadSize: 10,
    })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  })

  const createMessage = useAction(api.public.messages.create)

  const onSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      if (!conversation || !contactSessionId) return

      const messageId = `temp-${Date.now()}`
      setSendingMessages((prev) => new Set(prev).add(messageId))

      form.reset({ message: "" })
      setShowSuggestions(false)

      try {
        await createMessage({
          threadId: conversation.threadId,
          prompt: values.message,
          contactSessionId,
        })
        setSendingMessages((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          return next
        })
      } catch (error) {
        setSendingMessages((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          return next
        })
        setFailedMessages((prev) =>
          new Map(prev).set(messageId, values.message),
        )
      }
    },
    [conversation, contactSessionId, createMessage, form],
  )

  const retryMessage = useCallback(
    (messageId: string) => {
      const message = failedMessages.get(messageId)
      if (message) {
        setFailedMessages((prev) => {
          const next = new Map(prev)
          next.delete(messageId)
          return next
        })
        onSubmit({ message })
      }
    },
    [failedMessages, onSubmit],
  )

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const uiMessages = toUIMessages(messages.results ?? [])
  const isLoading = messages.status === "LoadingFirstPage"
  const isConversationLoading = conversation === undefined

  // Show loading state while conversation is being fetched
  if (isConversationLoading) {
    return (
      <>
        <WidgetHeader className="flex items-center justify-between py-3">
          <div className="flex items-center gap-x-2">
            <Button size="icon" variant="transparent" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            </div>
          </div>
        </WidgetHeader>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Compact Header */}
      <WidgetHeader className="flex items-center justify-between py-3">
        <div className="flex items-center gap-x-2">
          <Button size="icon" variant="transparent" onClick={onBack}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            {conversation?.status === "escalated" ? (
              <div className="flex size-7 items-center justify-center rounded-full bg-green-500/20">
                <HeadphonesIcon className="size-4 text-green-600" />
              </div>
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/20">
                <BotIcon className="size-4 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">
                {conversation?.status === "escalated"
                  ? "Human Support"
                  : "AI Assistant"}
              </p>
              <p className="text-xs opacity-80">
                {conversation?.status === "escalated"
                  ? "Connected to an agent"
                  : "Usually replies instantly"}
              </p>
            </div>
          </div>
        </div>

        {/* Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="transparent">
              <MoreVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setScreen("contact")}>
              <PhoneIcon className="mr-2 size-4" />
              Contact Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const text = uiMessages
                  .map((m) => `${m.role}: ${m.text}`)
                  .join("\n")
                copyToClipboard(text)
              }}
            >
              <CopyIcon className="mr-2 size-4" />
              Export Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </WidgetHeader>

      {/* AI Conversation */}
      <AIConversation className="flex-1">
        <AIConversationContent className="px-3">
          <InfiniteScrollTrigger
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            ref={topElementRef}
          />

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4 py-4">
              <MessageSkeleton />
              <MessageSkeleton />
              <MessageSkeleton />
            </div>
          )}

          {/* Messages */}
          {uiMessages.map((message, index) => (
            <div key={message.id}>
              <AIMessage from={message.role === "user" ? "user" : "assistant"}>
                {/* Typing indicator */}
                {message.text === "" && message.status === "pending" && (
                  <div className="flex items-end gap-2">
                    {conversation?.status === "escalated" ? (
                      <div className="flex size-8 items-center justify-center rounded-full bg-green-500/20">
                        <HeadphonesIcon className="size-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
                        <BotIcon className="size-4 text-primary" />
                      </div>
                    )}
                    <AIMessageContent>
                      <span className="inline-flex items-center gap-1">
                        <span className="animate-bounce [animation-delay:-0.3s] size-1.5 bg-primary rounded-full"></span>
                        <span className="animate-bounce [animation-delay:-0.2s] size-1.5 bg-primary rounded-full"></span>
                        <span className="animate-bounce [animation-delay:-0.1s] size-1.5 bg-primary rounded-full"></span>
                      </span>
                    </AIMessageContent>
                  </div>
                )}

                {/* Message content with Markdown */}
                {message.text && message.status !== "pending" && (
                  <div className="flex flex-col gap-1">
                    <AIMessageContent>
                      <AIResponse>{message.text}</AIResponse>
                    </AIMessageContent>
                    {/* Status indicator for user messages */}
                    {message.role === "user" && (
                      <div className="flex items-center gap-1 px-1">
                        <MessageStatus status="delivered" />
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar for assistant messages */}
                {message.text &&
                  message.role === "assistant" &&
                  (conversation?.status === "escalated" ? (
                    <div className="flex size-8 items-center justify-center rounded-full bg-green-500/20">
                      <HeadphonesIcon className="size-4 text-green-600" />
                    </div>
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
                      <BotIcon className="size-4 text-primary" />
                    </div>
                  ))}
              </AIMessage>
            </div>
          ))}

          {/* Typing indicator */}
          {(typingStatus?.aiTyping || typingStatus?.operatorTyping) && (
            <div className="flex items-end gap-2 py-2">
              {typingStatus?.operatorTyping ||
              conversation?.status === "escalated" ? (
                <div className="flex size-8 items-center justify-center rounded-full bg-green-500/20">
                  <HeadphonesIcon className="size-4 text-green-600" />
                </div>
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
                  <BotIcon className="size-4 text-primary" />
                </div>
              )}
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  <span className="animate-bounce [animation-delay:-0.3s] size-1.5 bg-primary rounded-full"></span>
                  <span className="animate-bounce [animation-delay:-0.2s] size-1.5 bg-primary rounded-full"></span>
                  <span className="animate-bounce [animation-delay:-0.1s] size-1.5 bg-primary rounded-full"></span>
                </span>
              </div>
            </div>
          )}

          {/* Failed messages */}
          {Array.from(failedMessages).map(([id, text]) => (
            <div key={id} className="flex items-center justify-end gap-2 py-2">
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm">
                  {text}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">
                    Failed to send
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => retryMessage(id)}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      {/* Collapsible Suggestions */}
      {showSuggestions && uiMessages.length <= 2 && suggestions.length > 0 && (
        <div className="overflow-hidden border-t bg-background">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">Suggestions</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => setShowSuggestions(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
          <AISuggestions className="flex w-full flex-col items-end gap-1 px-3 pb-2">
            {suggestions.map((suggestion) => (
              <AISuggestion
                key={suggestion}
                onClick={() => {
                  form.setValue("message", suggestion, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                  form.handleSubmit(onSubmit)()
                }}
                suggestion={suggestion}
              />
            ))}
          </AISuggestions>
        </div>
      )}

      {/* Compact Input Area */}
      <Form {...form}>
        <AIInput
          className="rounded-none border-x-0 border-b-0"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            disabled={conversation?.status === "resolved"}
            control={form.control}
            name="message"
            render={({ field }) => (
              <AIInputTextarea
                disabled={conversation?.status === "resolved"}
                onChange={(e) => {
                  field.onChange(e)
                  handleTyping()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    form.handleSubmit(onSubmit)()
                  }
                }}
                placeholder={
                  conversation?.status === "resolved"
                    ? "Conversation ended"
                    : "Type your message..."
                }
                value={field.value}
              />
            )}
          />

          <AIInputToolbar>
            <AIInputTools>
              {/* Attachment button placeholder */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      type="button"
                      disabled
                    >
                      <PaperclipIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attachments coming soon</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </AIInputTools>
            <AIInputSubmit
              disabled={
                conversation?.status === "resolved" ||
                !form.formState.isValid ||
                sendingMessages.size > 0
              }
              status={sendingMessages.size > 0 ? "streaming" : "ready"}
              type="submit"
            />
          </AIInputToolbar>
        </AIInput>
      </Form>
    </>
  )
}
