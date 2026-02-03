"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { Loader2Icon } from "lucide-react"
import { CustomizationForm } from "../components/customization-form"
import { CannedResponsesManager } from "../components/canned-responses-manager"
import { ConversationTagsManager } from "../components/conversation-tags-manager"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

export const CustomizationView = () => {
  const widgetSettings = useQuery(api.private.widgetSettings.getOne)

  if (widgetSettings === undefined) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-y-2 bg-muted p-8 overflow-auto">
        <Loader2Icon className="text-muted-foreground animate-spin" />
        <p className="text-muted-foreground text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted overflow-auto p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl">Customization</h1>
          <p className="text-muted-foreground">
            Customize your chat widget appearance and manage quick responses
          </p>
        </div>

        <Tabs defaultValue="widget" className="w-full">
          <TabsList>
            <TabsTrigger value="widget">Widget Settings</TabsTrigger>
            <TabsTrigger value="responses">Canned Responses</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>
          <TabsContent value="widget" className="mt-6">
            <CustomizationForm initialData={widgetSettings} />
          </TabsContent>
          <TabsContent value="responses" className="mt-6">
            <CannedResponsesManager />
          </TabsContent>
          <TabsContent value="tags" className="mt-6">
            <ConversationTagsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
