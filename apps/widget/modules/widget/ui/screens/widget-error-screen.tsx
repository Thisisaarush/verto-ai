"use client"

import { useAtomValue, useSetAtom } from "jotai"
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react"
import { errorMessageAtom, screenAtom } from "../../atoms/widget-atoms"
import WidgetHeader from "../components/widget-header"
import { Button } from "@workspace/ui/components/button"

export const WidgetErrorScreen = () => {
  const errorMessage = useAtomValue(errorMessageAtom)
  const setScreen = useSetAtom(screenAtom)

  const handleRetry = () => {
    // Reload the widget by going back to loading screen
    setScreen("loading")
    window.location.reload()
  }

  return (
    <>
      <WidgetHeader>
        <div className="flex flex-col justify-between gap-y-2 px-2 py-4 font-semibold">
          <p className="text-2xl">Oops!</p>
          <p className="text-sm opacity-90">Something went wrong</p>
        </div>
      </WidgetHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-y-4 p-6 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangleIcon className="size-8 text-destructive" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium">Unable to load widget</h3>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            {errorMessage || "Something went wrong. Please try again later."}
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCwIcon className="mr-2 size-4" />
            Try Again
          </Button>
        </div>
      </div>
    </>
  )
}
