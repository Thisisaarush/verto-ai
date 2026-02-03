"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  MoreHorizontalIcon,
  Wand2Icon,
  UserIcon,
  BotIcon,
  CheckIcon,
  CheckCheckIcon,
  CopyIcon,
  FlagIcon,
  MessageSquareTextIcon,
  TagIcon,
  XIcon,
  PanelRightOpenIcon,
  PanelRightCloseIcon,
} from "lucide-react"
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "@workspace/ui/components/ai/conversation"
import {
  AIInput,
  AIInputButton,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "@workspace/ui/components/ai/input"
import {
  AIMessage,
  AIMessageContent,
} from "@workspace/ui/components/ai/message"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { AIResponse } from "@workspace/ui/components/ai/response"
import { Form, FormField } from "@workspace/ui/components/form"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toUIMessages, useThreadMessages } from "@convex-dev/agent/react"
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar"
import { ConversationStatusButton } from "../components/conversation-status-button"
import { usePanelContext } from "../layouts/conversation-id-layout"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu"
import { formatDistanceToNow, format } from "date-fns"
import { Badge } from "@workspace/ui/components/badge"
import { useOrganization } from "@clerk/nextjs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
})

// Typing indicator component
const TypingIndicator = ({ name }: { name: string }) => (
  <div className="flex items-end gap-2 py-2">
    <DicebearAvatar seed={name} size={32} />
    <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s] size-1.5 bg-foreground/50 rounded-full"></span>
        <span className="animate-bounce [animation-delay:-0.2s] size-1.5 bg-foreground/50 rounded-full"></span>
        <span className="animate-bounce [animation-delay:-0.1s] size-1.5 bg-foreground/50 rounded-full"></span>
      </span>
    </div>
    <span className="text-xs text-muted-foreground">{name} is typing...</span>
  </div>
)

// Message timestamp with tooltip
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

export const ConversationIdView = ({
  conversationId,
}: {
  conversationId: Id<"conversations">
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const { organization } = useOrganization()
  const { isPanelCollapsed, togglePanel } = usePanelContext()

  const conversation = useQuery(api.private.conversations.getOne, {
    conversationId,
  })

  // Get contact session info
  const contactSession = useQuery(
    api.private.contactSessions.getOne,
    conversation?.contactSessionId
      ? { contactSessionId: conversation.contactSessionId }
      : "skip",
  )

  // Get canned responses for quick insertion
  const cannedResponses = useQuery(
    api.private.cannedResponses.getMany,
    organization?.id ? { organizationId: organization.id } : "skip",
  )

  // Get conversation tags
  const availableTags = useQuery(
    api.private.conversationTags.getMany,
    organization?.id ? { organizationId: organization.id } : "skip",
  )

  const incrementCannedResponseUsage = useMutation(
    api.private.cannedResponses.incrementUsage,
  )
  const addTagToConversation = useMutation(
    api.private.conversationTags.addToConversation,
  )
  const removeTagFromConversation = useMutation(
    api.private.conversationTags.removeFromConversation,
  )

  const messages = useThreadMessages(
    api.private.messages.getMany,
    conversation?.threadId
      ? {
          threadId: conversation.threadId,
        }
      : "skip",
    {
      initialNumItems: 10,
    },
  )

  // Typing indicators
  const typingStatus = useQuery(
    api.private.typingIndicators.getTypingStatus,
    conversationId ? { conversationId } : "skip",
  )

  const setTyping = useMutation(api.private.typingIndicators.setTyping)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingStateRef = useRef(false)

  // Handle operator typing
  const handleTyping = useCallback(() => {
    if (!conversationId) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set typing to true if not already
    if (!lastTypingStateRef.current) {
      lastTypingStateRef.current = true
      setTyping({ conversationId, participantType: "operator", isTyping: true })
    }

    // Set timeout to turn off typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (lastTypingStateRef.current) {
        lastTypingStateRef.current = false
        setTyping({
          conversationId,
          participantType: "operator",
          isTyping: false,
        })
      }
    }, 3000)
  }, [conversationId, setTyping])

  // Cleanup typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (lastTypingStateRef.current && conversationId) {
        setTyping({
          conversationId,
          participantType: "operator",
          isTyping: false,
        })
      }
    }
  }, [conversationId, setTyping])

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
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isCannedResponsesOpen, setIsCannedResponsesOpen] = useState(false)
  const [shortcutSuggestions, setShortcutSuggestions] = useState<
    Array<{
      _id: Id<"cannedResponses">
      title: string
      content: string
      shortcut?: string
    }>
  >([])
  const [showShortcutSuggestions, setShowShortcutSuggestions] = useState(false)

  const enhanceResponse = useAction(api.private.messages.enhanceResponse)

  // Handle /shortcut detection for canned responses
  const handleInputChange = useCallback(
    (value: string) => {
      // Check if the input starts with / and matches any canned response shortcut
      if (value.startsWith("/") && cannedResponses) {
        const shortcutQuery = value.slice(1).toLowerCase()
        const matches = cannedResponses.filter(
          (response) =>
            response.shortcut &&
            response.shortcut.toLowerCase().startsWith(shortcutQuery),
        )
        setShortcutSuggestions(
          matches.map((r) => ({
            _id: r._id,
            title: r.title,
            content: r.content,
            shortcut: r.shortcut,
          })),
        )
        setShowShortcutSuggestions(matches.length > 0)
      } else {
        setShowShortcutSuggestions(false)
        setShortcutSuggestions([])
      }
    },
    [cannedResponses],
  )

  const handleSelectShortcutSuggestion = async (
    responseId: Id<"cannedResponses">,
    content: string,
  ) => {
    form.setValue("message", content, { shouldValidate: true })
    setShowShortcutSuggestions(false)
    setShortcutSuggestions([])

    // Track usage
    try {
      await incrementCannedResponseUsage({ id: responseId })
    } catch (error) {
      console.error("Failed to track canned response usage:", error)
    }
  }

  const handleEnhanceResponse = async () => {
    setIsEnhancing(true)
    const currentValue = form.getValues("message")

    try {
      const response = await enhanceResponse({ prompt: currentValue })
      form.setValue("message", response, { shouldValidate: true })
    } catch (error) {
      toast.error("Failed to enhance response")
      console.error("Error enhancing response:", error)
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleInsertCannedResponse = async (
    responseId: Id<"cannedResponses">,
    content: string,
  ) => {
    form.setValue("message", content, { shouldValidate: true })
    setIsCannedResponsesOpen(false)

    // Track usage
    try {
      await incrementCannedResponseUsage({ id: responseId })
    } catch (error) {
      // Silently fail - not critical
      console.error("Failed to track canned response usage:", error)
    }
  }

  const createMessage = useMutation(api.private.messages.create)

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Stop typing indicator
    if (lastTypingStateRef.current && conversationId) {
      lastTypingStateRef.current = false
      setTyping({
        conversationId,
        participantType: "operator",
        isTyping: false,
      })
    }

    try {
      await createMessage({
        conversationId,
        prompt: values.message,
      })

      form.reset()
    } catch (error) {
      console.error("Error creating message:", error)
      toast.error("Failed to send message")
    }
  }

  const updateConversationStatus = useMutation(
    api.private.conversations.updateStatus,
  )

  const updateConversationPriority = useMutation(
    api.private.conversations.updatePriority,
  )

  const handleUpdatePriority = async (priority: "low" | "medium" | "high") => {
    try {
      await updateConversationPriority({
        conversationId,
        priority,
      })
      toast.success(`Priority set to ${priority}`)
    } catch (error) {
      console.error("Error updating priority:", error)
      toast.error("Failed to update priority")
    }
  }

  const handleAddTag = async (tagName: string) => {
    try {
      await addTagToConversation({
        conversationId,
        tagName,
      })
      toast.success(`Tag "${tagName}" added`)
    } catch (error) {
      console.error("Error adding tag:", error)
      toast.error("Failed to add tag")
    }
  }

  const handleRemoveTag = async (tagName: string) => {
    try {
      await removeTagFromConversation({
        conversationId,
        tagName,
      })
      toast.success(`Tag "${tagName}" removed`)
    } catch (error) {
      console.error("Error removing tag:", error)
      toast.error("Failed to remove tag")
    }
  }

  const handleToggleStatus = async () => {
    if (!conversation) return

    setIsUpdatingStatus(true)
    let newStatus: "unresolved" | "resolved" | "escalated"

    if (conversation.status === "unresolved") {
      newStatus = "escalated"
    } else if (conversation.status === "escalated") {
      newStatus = "resolved"
    } else {
      newStatus = "unresolved"
    }

    try {
      await updateConversationStatus({
        conversationId: conversationId,
        status: newStatus,
      })
      toast.success(`Conversation marked as ${newStatus}`)
    } catch (error) {
      console.error("Error updating conversation status:", error)
      toast.error("Failed to update status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }, [])

  const uiMessages = toUIMessages(messages.results ?? [])

  if (conversation === undefined || messages.status === "LoadingFirstPage") {
    return <ConversationIdViewSkeleton />
  }

  return (
    <div className="flex h-full flex-col bg-muted overflow-hidden">
      {/* Enhanced Header */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <DicebearAvatar
            seed={conversation?.contactSessionId ?? "user"}
            size={40}
          />
          <div>
            <p className="font-medium">
              {contactSession?.name || "Anonymous User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {contactSession?.email || "No email provided"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Display active tags */}
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {conversation.tags.map((tagName) => {
                const tagData = availableTags?.find((t) => t.name === tagName)
                return (
                  <Badge
                    key={tagName}
                    style={{
                      backgroundColor: tagData?.color || "#6b7280",
                      color: "#fff",
                    }}
                    className="text-xs flex items-center gap-1 group cursor-pointer"
                    onClick={() => handleRemoveTag(tagName)}
                  >
                    {tagName}
                    <XIcon className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                )
              })}
            </div>
          )}
          {conversation.priority && (
            <Badge
              variant={
                conversation.priority === "high"
                  ? "destructive"
                  : conversation.priority === "medium"
                    ? "default"
                    : "secondary"
              }
            >
              {conversation.priority}
            </Badge>
          )}
          <ConversationStatusButton
            status={conversation?.status}
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FlagIcon className="mr-2 size-4" />
                  Set Priority
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleUpdatePriority("low")}>
                    <Badge variant="secondary" className="mr-2">
                      Low
                    </Badge>
                    Low Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdatePriority("medium")}
                  >
                    <Badge variant="default" className="mr-2">
                      Medium
                    </Badge>
                    Medium Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdatePriority("high")}
                  >
                    <Badge variant="destructive" className="mr-2">
                      High
                    </Badge>
                    High Priority
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <TagIcon className="mr-2 size-4" />
                  Manage Tags
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {availableTags && availableTags.length > 0 ? (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Available Tags
                      </DropdownMenuLabel>
                      {availableTags.map((tag) => {
                        const isActive = conversation.tags?.includes(tag.name)
                        return (
                          <DropdownMenuItem
                            key={tag._id}
                            onClick={() =>
                              isActive
                                ? handleRemoveTag(tag.name)
                                : handleAddTag(tag.name)
                            }
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Badge
                                style={{
                                  backgroundColor: tag.color,
                                  color: "#fff",
                                }}
                                className="text-xs"
                              >
                                {tag.name}
                              </Badge>
                              {isActive && (
                                <CheckIcon className="size-3 ml-auto" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        )
                      })}
                    </>
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No tags available.
                      <br />
                      Create in Customization.
                    </div>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
                Export Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Toggle side panel button */}
          <Button
            size="icon"
            variant="ghost"
            className="hidden lg:flex"
            onClick={togglePanel}
          >
            {isPanelCollapsed ? (
              <PanelRightOpenIcon className="size-4" />
            ) : (
              <PanelRightCloseIcon className="size-4" />
            )}
          </Button>
        </div>
      </header>

      <AIConversation className="flex-1 min-h-0 overflow-auto">
        <AIConversationContent className="px-4">
          <InfiniteScrollTrigger
            ref={topElementRef}
            onLoadMore={handleLoadMore}
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
          />
          {uiMessages.map((message) => (
            <AIMessage
              key={message.id}
              role={message.role}
              from={message.role === "user" ? "assistant" : "user"}
            >
              {/* Pending message indicator */}
              {message.text === "" && message.status === "pending" && (
                <div className="flex items-end gap-2">
                  <AIMessageContent>
                    <span className="inline-flex items-center font-bold gap-1">
                      <span className="animate-bounce [animation-delay:-0.3s] size-1.5 bg-foreground/50 rounded-full"></span>
                      <span className="animate-bounce [animation-delay:-0.2s] size-1.5 bg-foreground/50 rounded-full"></span>
                      <span className="animate-bounce [animation-delay:-0.1s] size-1.5 bg-foreground/50 rounded-full"></span>
                    </span>
                  </AIMessageContent>
                  <DicebearAvatar
                    seed={conversation?.contactSessionId ?? "user"}
                    size={32}
                  />
                </div>
              )}

              {/* Message content with markdown */}
              {message.text && message.status !== "pending" && (
                <div className="flex flex-col gap-1">
                  <AIMessageContent>
                    <AIResponse>{message.text}</AIResponse>
                  </AIMessageContent>
                  {/* Message status for assistant (operator) messages */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-1 px-1 justify-end">
                      <CheckCheckIcon className="size-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}

              {/* Avatar for user messages */}
              {message.role === "user" && (
                <DicebearAvatar
                  seed={conversation?.contactSessionId ?? "user"}
                  size={32}
                />
              )}
            </AIMessage>
          ))}

          {/* User typing indicator */}
          {typingStatus?.userTyping && (
            <TypingIndicator name={contactSession?.name || "User"} />
          )}
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <div className="p-2 relative shrink-0 border-t bg-background">
        {/* Shortcut suggestions dropdown */}
        {showShortcutSuggestions && shortcutSuggestions.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-2 rounded-lg border bg-popover p-1 shadow-md z-50">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Quick Replies - Press Enter to select
            </p>
            {shortcutSuggestions.map((suggestion) => (
              <button
                key={suggestion._id}
                type="button"
                className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
                onClick={() =>
                  handleSelectShortcutSuggestion(
                    suggestion._id,
                    suggestion.content,
                  )
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    /{suggestion.shortcut}
                  </Badge>
                  <span className="font-medium text-sm">
                    {suggestion.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 pl-1">
                  {suggestion.content}
                </p>
              </button>
            ))}
          </div>
        )}
        <Form {...form}>
          <AIInput onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              disabled={conversation?.status === "resolved"}
              name="message"
              render={({ field }) => (
                <AIInputTextarea
                  {...field}
                  disabled={
                    conversation?.status === "resolved" ||
                    form.formState.isSubmitting ||
                    isEnhancing
                  }
                  onChange={(e) => {
                    field.onChange(e)
                    handleTyping()
                    handleInputChange(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    // Handle shortcut selection with Enter
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      showShortcutSuggestions &&
                      shortcutSuggestions.length > 0
                    ) {
                      e.preventDefault()
                      const firstSuggestion = shortcutSuggestions[0]
                      if (firstSuggestion) {
                        handleSelectShortcutSuggestion(
                          firstSuggestion._id,
                          firstSuggestion.content,
                        )
                      }
                      return
                    }
                    if (e.key === "Escape" && showShortcutSuggestions) {
                      setShowShortcutSuggestions(false)
                      return
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      form.handleSubmit(onSubmit)()
                    }
                  }}
                  placeholder={
                    conversation?.status === "resolved"
                      ? "Conversation resolved"
                      : "Type your reply..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputToolbar>
              <AIInputTools>
                {/* Canned Responses Picker */}
                <Popover
                  open={isCannedResponsesOpen}
                  onOpenChange={setIsCannedResponsesOpen}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <AIInputButton
                            disabled={conversation?.status === "resolved"}
                          >
                            <MessageSquareTextIcon />
                            Quick Reply
                          </AIInputButton>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Insert a canned response</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b">
                      <h4 className="font-medium text-sm">Quick Replies</h4>
                      <p className="text-xs text-muted-foreground">
                        Select a canned response to insert
                      </p>
                    </div>
                    <ScrollArea className="h-[200px]">
                      {cannedResponses && cannedResponses.length > 0 ? (
                        <div className="p-2 space-y-1">
                          {cannedResponses.map((response) => (
                            <button
                              key={response._id}
                              type="button"
                              className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                              onClick={() =>
                                handleInsertCannedResponse(
                                  response._id,
                                  response.content,
                                )
                              }
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {response.title}
                                </span>
                                {response.shortcut && (
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-xs"
                                  >
                                    /{response.shortcut}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {response.content}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No canned responses yet.
                          <br />
                          Create them in Customization settings.
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AIInputButton
                        onClick={handleEnhanceResponse}
                        disabled={
                          conversation?.status === "resolved" ||
                          isEnhancing ||
                          !form.formState.isValid
                        }
                      >
                        <Wand2Icon />
                        {isEnhancing ? "Enhancing..." : "AI Enhance"}
                      </AIInputButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Improve your message with AI</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </AIInputTools>
              <AIInputSubmit
                disabled={
                  conversation?.status === "resolved" ||
                  !form.formState.isValid ||
                  form.formState.isSubmitting ||
                  isEnhancing
                }
                status={form.formState.isSubmitting ? "streaming" : "ready"}
                type="submit"
              />
            </AIInputToolbar>
          </AIInput>
        </Form>
      </div>
    </div>
  )
}

const ConversationIdViewSkeleton = () => {
  return (
    <div className="flex h-full flex-col bg-muted overflow-hidden">
      <header className="flex items-center justify-between border-b bg-background p-2.5">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-28" />
      </header>

      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full max-w-[300px]" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        <div className="flex items-start gap-3 justify-end">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full max-w-[250px] ml-auto" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full max-w-[320px]" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>

      <div className="p-2">
        <div className="border rounded-md p-3 bg-background">
          <Skeleton className="h-20 w-full mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
