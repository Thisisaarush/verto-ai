"use client"

import { useAtomValue, useSetAtom } from "jotai"
import {
  errorMessageAtom,
  loadingMessageAtom,
  organizationIdAtom,
  screenAtom,
  contactSessionIdAtomFamily,
  widgetSettingsAtom,
} from "../../atoms/widget-atoms"
import WidgetHeader from "../components/widget-header"
import { LoaderIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Skeleton } from "@workspace/ui/components/skeleton"

type InitStep = "org" | "session" | "settings" | "done"

// Loading skeleton that mimics the selection screen
const LoadingSkeleton = () => (
  <div className="flex flex-1 flex-col gap-y-3 p-4">
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
    <Skeleton className="h-16 w-full rounded-lg" />
    <div className="mt-auto">
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  </div>
)

export const WidgetLoadingScreen = ({
  organizationId,
}: {
  organizationId: string | null
}) => {
  const [step, setStep] = useState<InitStep>("org")
  const [sessionValid, setSessionValid] = useState<boolean>(false)

  const loadingMessage = useAtomValue(loadingMessageAtom)
  const setWidgetSettings = useSetAtom(widgetSettingsAtom)
  const setOrganizationId = useSetAtom(organizationIdAtom)
  const setLoadingMessage = useSetAtom(loadingMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const setScreen = useSetAtom(screenAtom)

  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || ""),
  )

  // 1. Validate Organization
  const validateOrganization = useAction(api.public.organizations.validate)
  useEffect(() => {
    if (step !== "org") return

    setLoadingMessage("Validating organization...")

    if (!organizationId) {
      setErrorMessage("Organization ID is missing.")
      setScreen("error")
      return
    }

    setLoadingMessage("Verifying organization...")

    validateOrganization({ organizationId })
      .then((result) => {
        if (result.valid) {
          setOrganizationId(organizationId)
          setStep("session")
        } else {
          setErrorMessage(result.reason || "Invalid organization.")
          setScreen("error")
        }
      })
      .catch((error) => {
        setErrorMessage(error.message || "Unable to validate organization.")
        setScreen("error")
      })
  }, [
    step,
    organizationId,
    setErrorMessage,
    setScreen,
    setOrganizationId,
    setStep,
    validateOrganization,
    setLoadingMessage,
  ])

  // 2. Validate Session
  const validateContactSession = useMutation(
    api.public.contactSessions.validate,
  )
  useEffect(() => {
    if (step !== "session") return

    setLoadingMessage("Looking for contact session...")

    if (!contactSessionId) {
      setSessionValid(false)
      setStep("settings")
      return
    }

    setLoadingMessage("Validating session...")

    validateContactSession({
      contactSessionId,
    })
      .then((result) => {
        setSessionValid(result.valid)
        setStep("settings")
      })
      .catch((error) => {
        setSessionValid(false)
        setStep("settings")
      })
  }, [step, contactSessionId, validateContactSession, setLoadingMessage])

  // 3. Load Widget Settings
  const widgetSettings = useQuery(
    api.public.widgetSettings.getByOrganizationId,
    organizationId
      ? {
          organizationId,
        }
      : "skip",
  )
  useEffect(() => {
    if (step !== "settings") return

    setLoadingMessage("Loading widget settings...")

    if (widgetSettings !== undefined && organizationId) {
      setWidgetSettings(widgetSettings)
      setStep("done")
    }
  }, [step, setStep, widgetSettings, setWidgetSettings, setLoadingMessage])

  useEffect(() => {
    if (step !== "done") return

    const hasValidSession = contactSessionId && sessionValid
    setScreen(hasValidSession ? "selection" : "auth")
  }, [step, contactSessionId, sessionValid, setScreen])

  return (
    <>
      <WidgetHeader>
        <div className="flex items-center gap-3 px-2 py-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </WidgetHeader>

      <LoadingSkeleton />

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 p-4 border-t bg-background">
        <LoaderIcon className="size-4 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">
          {loadingMessage || "Loading..."}
        </p>
      </div>
    </>
  )
}
