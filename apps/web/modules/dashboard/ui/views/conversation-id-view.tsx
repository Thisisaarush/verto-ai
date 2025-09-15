"use client"

import { useState } from "react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { useAction, useMutation, useQuery } from "convex/react"
import { MoreHorizontalIcon, Wand2Icon } from "lucide-react"
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
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { toast } from "sonner"

const formSchema = z.object({
  message: z.string().min(1, "Message is required"),
})

export const ConversationIdView = ({
  conversationId,
}: {
  conversationId: Id<"conversations">
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const conversation = useQuery(api.private.conversations.getOne, {
    conversationId,
  })
  const messages = useThreadMessages(
    api.private.messages.getMany,
    conversation?.threadId
      ? {
          threadId: conversation.threadId,
        }
      : "skip",
    {
      initialNumItems: 10,
    }
  )

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
  const enhanceResponse = useAction(api.private.messages.enhanceResponse)
  const handleEnhanceResponse = async () => {
    setIsEnhancing(true)
    const currentValue = form.getValues("message")

    try {
      const response = await enhanceResponse({ prompt: currentValue })
      form.setValue("message", response)
    } catch (error) {
      toast.error("Failed to enhance response")
      console.error("Error enhancing response:", error)
    } finally {
      setIsEnhancing(false)
    }
  }

  const createMessage = useMutation(api.private.messages.create)

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await createMessage({
        conversationId,
        prompt: values.message,
      })

      form.reset()
    } catch (error) {
      console.error("Error creating message:", error)
    }
  }

  const updateConversationStatus = useMutation(
    api.private.conversations.updateStatus
  )
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
    } catch (error) {
      console.error("Error updating conversation status:", error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (conversation === undefined || messages.status === "LoadingFirstPage") {
    return <ConversationIdViewSkeleton />
  }

  return (
    <div className="flex h-full flex-col bg-muted">
      <header className="flex items-center justify-between border-b bg-background p-2.5">
        <Button size="sm" variant="ghost">
          <MoreHorizontalIcon />
        </Button>
        {!!conversation && (
          <ConversationStatusButton
            status={conversation?.status}
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
          />
        )}
      </header>

      <AIConversation className="max-h-[calc(100vh-180px)]">
        <AIConversationContent>
          <InfiniteScrollTrigger
            ref={topElementRef}
            onLoadMore={handleLoadMore}
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
          />
          {toUIMessages(messages.results ?? [])?.map((message) => (
            <AIMessage
              key={message.id}
              role={message.role}
              from={message.role === "user" ? "assistant" : "user"}
            >
              {message.text === "" && message.status === "pending" && (
                <div className="flex items-end gap-2">
                  <AIMessageContent>
                    <span className="inline-flex items-center font-bold gap-1">
                      <span className="animate-bounce [animation-delay:-0.3s] size-1 bg-white rounded-full"></span>
                      <span className="animate-bounce [animation-delay:-0.2s] size-1 bg-white rounded-full"></span>
                      <span className="animate-bounce [animation-delay:-0.1s] size-1 bg-white rounded-full"></span>
                    </span>
                  </AIMessageContent>
                  <DicebearAvatar
                    seed={conversation?.contactSessionId ?? "user"}
                    size={32}
                  />
                </div>
              )}
              {message.text && message.status !== "pending" && (
                <AIMessageContent>{message.text}</AIMessageContent>
              )}
              {message.role === "user" && (
                <DicebearAvatar
                  seed={conversation?.contactSessionId ?? "user"}
                  size={32}
                />
              )}
            </AIMessage>
          ))}
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>

      <div className="p-2">
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
                  onChange={field.onChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      form.handleSubmit(onSubmit)()
                    }
                  }}
                  placeholder={
                    conversation?.status === "resolved"
                      ? "Conversation resolved"
                      : "Type your message..."
                  }
                  value={field.value}
                />
              )}
            />
            <AIInputToolbar>
              <AIInputTools>
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
              </AIInputTools>
              <AIInputSubmit
                disabled={
                  conversation?.status === "resolved" ||
                  !form.formState.isValid ||
                  form.formState.isSubmitting ||
                  isEnhancing
                }
                status="ready"
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
    <div className="flex h-full flex-col bg-muted">
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
