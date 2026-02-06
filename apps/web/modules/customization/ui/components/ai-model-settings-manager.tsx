"use client"

import { useState } from "react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Progress } from "@workspace/ui/components/progress"
import {
  BrainIcon,
  KeyIcon,
  Loader2Icon,
  SparklesIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

type Provider = "platform" | "google" | "openai" | "anthropic"

interface ProviderConfig {
  name: string
  description: string
  models: { id: string; name: string; isDefault: boolean }[]
  requiresApiKey: boolean
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  platform: {
    name: "Platform Default",
    description:
      "Use Google Gemini 2.5 Flash with 1,500 free requests/day and 15 requests/minute.",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: true },
    ],
    requiresApiKey: false,
  },
  google: {
    name: "Google AI",
    description:
      "Use your own Google API key for higher limits and more models.",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isDefault: false },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", isDefault: false },
    ],
    requiresApiKey: true,
  },
  openai: {
    name: "OpenAI",
    description: "OpenAI's GPT models",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", isDefault: true },
      { id: "gpt-4o", name: "GPT-4o", isDefault: false },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", isDefault: false },
    ],
    requiresApiKey: true,
  },
  anthropic: {
    name: "Anthropic",
    description: "Anthropic's Claude models",
    models: [
      {
        id: "claude-3-5-haiku-latest",
        name: "Claude 3.5 Haiku",
        isDefault: true,
      },
      {
        id: "claude-3-5-sonnet-latest",
        name: "Claude 3.5 Sonnet",
        isDefault: false,
      },
      { id: "claude-3-opus-latest", name: "Claude 3 Opus", isDefault: false },
    ],
    requiresApiKey: true,
  },
}

export const AIModelSettingsManager = () => {
  const settings = useQuery(api.private.aiModelSettings.getOne)
  const usageStats = useQuery(api.private.aiModelSettings.getUsageStats)
  const upsertSettings = useMutation(api.private.aiModelSettings.upsert)
  const removeApiKey = useMutation(api.private.aiModelSettings.removeApiKey)

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null,
  )
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Initialize from settings when loaded
  const currentProvider =
    selectedProvider ?? (settings?.provider as Provider) ?? "platform"
  const currentModel = selectedModel ?? settings?.model ?? "gemini-2.5-flash"

  const providerConfig = PROVIDERS[currentProvider]

  const handleProviderChange = (provider: Provider) => {
    setSelectedProvider(provider)
    const providerModels = PROVIDERS[provider].models
    const defaultModel = providerModels.find((m) => m.isDefault)
    setSelectedModel(defaultModel?.id ?? providerModels[0]?.id ?? "")
    setApiKey("")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await upsertSettings({
        provider: currentProvider,
        model: currentModel,
        apiKey: apiKey || undefined,
      })
      toast.success("AI model settings saved successfully!")
      setApiKey("")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveApiKey = async () => {
    try {
      await removeApiKey()
      toast.success("API key removed. Using platform default.")
      setSelectedProvider("platform")
      setSelectedModel("gemini-2.5-flash")
      setApiKey("")
    } catch (error) {
      console.error("Error removing API key:", error)
      toast.error("Failed to remove API key.")
    }
  }

  if (settings === undefined || usageStats === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="size-5" />
            AI Model Configuration
          </CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const hasOwnApiKey = settings.hasApiKey && currentProvider !== "platform"

  return (
    <div className="space-y-6">
      {/* Usage Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5" />
            Free Tier Usage
          </CardTitle>
          <CardDescription>
            Your organization gets{" "}
            {usageStats.freeRequestsLimit.toLocaleString()} free AI requests per
            day, powered by Google Gemini 2.5 Flash.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Daily requests used</span>
              <span className="font-medium">
                {usageStats.freeRequestsUsed.toLocaleString()} /{" "}
                {usageStats.freeRequestsLimit.toLocaleString()}
              </span>
            </div>
            <Progress value={usageStats.percentUsed} className="h-2" />
            <div className="flex items-center gap-2 text-sm">
              {usageStats.freeRequestsRemaining > 0 ? (
                <>
                  <CheckCircleIcon className="size-4 text-green-500" />
                  <span className="text-muted-foreground">
                    {usageStats.freeRequestsRemaining.toLocaleString()} requests
                    remaining today
                  </span>
                </>
              ) : (
                <>
                  <AlertCircleIcon className="size-4 text-amber-500" />
                  <span className="text-muted-foreground">
                    Daily limit reached. Add your own API key or wait until
                    tomorrow.
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">
              Free tier uses Google&apos;s Gemini 2.5 Flash with limits of 15
              requests/minute and 1,500 requests/day. For higher limits, add
              your own API key.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Model Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="size-5" />
            AI Model Configuration
          </CardTitle>
          <CardDescription>
            Choose which AI model to use for your chat assistant. Use the
            platform default for free, or bring your own API key for more
            control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label>AI Provider</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.entries(PROVIDERS) as [Provider, ProviderConfig][]).map(
                ([key, provider]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleProviderChange(key)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg border p-4 text-center transition-all hover:border-primary",
                      currentProvider === key
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-border",
                    )}
                  >
                    <span className="font-medium text-sm">{provider.name}</span>
                    {!provider.requiresApiKey && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Free Tier
                      </Badge>
                    )}
                    {key === settings.provider && settings.hasApiKey && (
                      <Badge
                        variant="default"
                        className="absolute -top-2 -right-2 text-xs"
                      >
                        Active
                      </Badge>
                    )}
                  </button>
                ),
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {providerConfig.description}
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={currentModel}
              onValueChange={(value) => setSelectedModel(value)}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                    {model.isDefault && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Recommended)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key Input */}
          {providerConfig.requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <KeyIcon className="size-4" />
                API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={
                    hasOwnApiKey
                      ? "••••••••••••••••"
                      : `Enter your ${providerConfig.name} API key`
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                {hasOwnApiKey && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <TrashIcon className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove your API key and switch to the
                          platform default. Your free tier usage will still
                          apply.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveApiKey}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your API key is securely stored and never exposed.{" "}
                {currentProvider === "google" && (
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Get a Google AI API key →
                  </a>
                )}
                {currentProvider === "openai" && (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Get an OpenAI API key →
                  </a>
                )}
                {currentProvider === "anthropic" && (
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Get an Anthropic API key →
                  </a>
                )}
              </p>
            </div>
          )}

          {/* Current Configuration Summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Configuration</p>
                <p className="text-xs text-muted-foreground">
                  {settings.provider === "platform"
                    ? "Using platform default (free tier)"
                    : `Using ${PROVIDERS[settings.provider as Provider]?.name ?? settings.provider} with your API key`}
                </p>
              </div>
              <Badge variant={settings.isActive ? "default" : "secondary"}>
                {settings.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Model: <span className="font-medium">{settings.model}</span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
