"use client"

import {
  ChevronRightIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  SparklesIcon,
} from "lucide-react"
import WidgetHeader from "../components/widget-header"
import { Button } from "@workspace/ui/components/button"
import { useAtomValue, useSetAtom } from "jotai"
import {
  organizationIdAtom,
  screenAtom,
  contactSessionIdAtomFamily,
  errorMessageAtom,
  conversationIdAtom,
  widgetSettingsAtom,
} from "../../atoms/widget-atoms"
import { useMutation } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useState } from "react"
import WidgetFooter from "../components/widget-footer"
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar"

export const WidgetSelectionScreen = () => {
  const setScreen = useSetAtom(screenAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const setConversationId = useSetAtom(conversationIdAtom)
  const widgetSettings = useAtomValue(widgetSettingsAtom)

  const organizationId = useAtomValue(organizationIdAtom)
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || ""),
  )

  const createConverzations = useMutation(api.public.conversations.create)
  const [isPending, setIsPending] = useState(false)

  const handleNewConversations = async () => {
    if (!contactSessionId) {
      setScreen("auth")
      return
    }
    if (!organizationId) {
      setScreen("error")
      setErrorMessage("Missing Organization ID")
      return
    }

    setIsPending(true)

    try {
      const conversationId = await createConverzations({
        contactSessionId,
        organizationId,
      })
      setConversationId(conversationId)
      setScreen("chat")
    } catch (error) {
      console.error("Failed to create conversation:", error)
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start conversation",
      )
      setScreen("error")
    } finally {
      setIsPending(false)
    }
  }

  const greeting = widgetSettings?.greetMessage || "Hi there! 👋"

  return (
    <>
      <WidgetHeader>
        <div className="flex flex-col justify-between gap-y-3 px-2 py-4">
          <div className="flex items-center gap-3">
            <DicebearAvatar
              seed="support-team"
              size={48}
              badgeImageUrl="/logo.svg"
            />
            <div>
              <p className="text-2xl font-semibold">{greeting}</p>
              <p className="text-sm opacity-90">How can we help you today?</p>
            </div>
          </div>
        </div>
      </WidgetHeader>

      <div className="flex flex-1 flex-col overflow-y-auto gap-y-3 p-4">
        {/* Quick Actions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
            Get Started
          </p>
          <Button
            className="h-auto w-full justify-between py-4 px-4"
            variant="outline"
            onClick={handleNewConversations}
            disabled={isPending}
          >
            <div className="flex items-center gap-x-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MessageSquareTextIcon className="size-5 text-primary" />
              </div>
              <div className="text-left">
                <span className="font-medium">Start a Conversation</span>
                <p className="text-xs text-muted-foreground">
                  Chat with our AI assistant
                </p>
              </div>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Button>
        </div>

        <div>
          <Button
            className="h-auto w-full justify-between py-4 px-4"
            variant="outline"
            onClick={() => setScreen("contact")}
          >
            <div className="flex items-center gap-x-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <PhoneIcon className="size-5 text-green-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Contact Us</span>
                <p className="text-xs text-muted-foreground">
                  Send us a direct message
                </p>
              </div>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Features highlight */}
        <div className="mt-auto">
          <div className="rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/20 p-1.5">
                <SparklesIcon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">AI-Powered Support</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get instant answers to your questions with our intelligent
                  assistant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WidgetFooter />
    </>
  )
}
