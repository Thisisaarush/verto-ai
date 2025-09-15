"use client"

import { useOrganization } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { IntegrationId, INTEGRATIONS } from "../../constants"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { createScript } from "../../utils"

export const IntegrationsView = () => {
  const { organization } = useOrganization()
  const [copied, setCopied] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSnippet, setSelectedSnippet] = useState("")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(organization?.id ?? "")
      toast.success("Org ID copied to clipboard")
      setCopied(true)
    } catch (error) {
      toast.error("Failed to copy Org ID")
      setCopied(false)
    }
  }

  const handleIntegrationClick = (integrationId: IntegrationId) => {
    if (!organization) {
      toast.error("Organization not found")
      return
    }

    const snippet = createScript(integrationId, organization.id)
    setSelectedSnippet(snippet)
    setDialogOpen(true)
  }

  return (
    <>
      <IntegrationsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        snippet={selectedSnippet}
      />
      <div className="flex min-h-screen flex-col bg-muted p-8">
        <div className="mx-auto w-full max-w-screen-md">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl">Setup & Integrations</h1>
            <p className="text-muted-foreground">
              Choose the integration that best fits your needs.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-4">
              <Label className="w-34" htmlFor="organization-id">
                Organization ID
              </Label>
              <Input
                className="flex-1 bg-background font-mono text-sm"
                id="organization-id"
                disabled
                readOnly
                value={organization?.id ?? ""}
              />
              <Button
                className={`gap-2 ${copied ? "bg-green-500" : ""}`}
                onClick={handleCopy}
                size="sm"
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <Separator className="my-8" />
          <div className="space-y-6">
            <div className="space-y-1">
              <Label className="text-lg">Integrations</Label>
              <p className="text-muted-foreground text-sm">
                Add the following code to your website to integrate the chat
                experience
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {INTEGRATIONS.map((integration) => (
                  <button
                    key={integration.id}
                    onClick={() => handleIntegrationClick(integration.id)}
                    type="button"
                    className="flex items-center gap-4 rounded-lg border bg-background p-4 hover:bg-accent overflow-hidden"
                  >
                    <Image
                      alt={integration.title}
                      height={32}
                      width={32}
                      src={integration.icon}
                    />
                    <p>{integration.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export const IntegrationsDialog = ({
  open,
  onOpenChange,
  snippet,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  snippet: string
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success("Snippet copied to clipboard")
      setCopied(true)
    } catch (error) {
      toast.error("Failed to copy snippet")
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Integrate with your website</DialogTitle>
          <DialogDescription>
            Follow these steps to add the chat widget to your website
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="rounded-md bg-accent p-2 text-sm">
              1. Copy the following code snippet
            </div>
            <div className="group relative">
              <pre className="max-h-[300px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-foreground p-2 font-mono text-secondary text-sm">
                {snippet}
              </pre>
              <Button
                className="absolute size-6 top-4 right-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={handleCopy}
                size="icon"
                variant="secondary"
              >
                {copied ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-md bg-accent p-2 text-sm">
              2. Add the code in your page
            </div>
            <p className="text-sm text-muted-foreground">
              Paste the chatbox code above in your page. You can add it in the
              HTML head section.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
