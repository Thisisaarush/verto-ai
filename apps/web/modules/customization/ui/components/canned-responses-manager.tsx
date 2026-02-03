"use client"

import { useState } from "react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { useOrganization } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MessageSquareTextIcon,
  ZapIcon,
  Loader2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"

const cannedResponseSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(2000, "Content is too long"),
  shortcut: z
    .string()
    .max(20, "Shortcut is too long")
    .regex(
      /^[a-zA-Z0-9_-]*$/,
      "Shortcut can only contain letters, numbers, underscores, and hyphens",
    )
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .max(50, "Category is too long")
    .optional()
    .or(z.literal("")),
})

type CannedResponseFormData = z.infer<typeof cannedResponseSchema>

interface CannedResponse {
  _id: Id<"cannedResponses">
  title: string
  content: string
  shortcut?: string
  category?: string
  usageCount: number
}

export const CannedResponsesManager = () => {
  const { organization } = useOrganization()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(
    null,
  )

  const cannedResponses = useQuery(
    api.private.cannedResponses.getMany,
    organization?.id ? { organizationId: organization.id } : "skip",
  )

  const createCannedResponse = useMutation(api.private.cannedResponses.create)
  const updateCannedResponse = useMutation(api.private.cannedResponses.update)
  const deleteCannedResponse = useMutation(api.private.cannedResponses.remove)

  const form = useForm<CannedResponseFormData>({
    resolver: zodResolver(cannedResponseSchema),
    defaultValues: {
      title: "",
      content: "",
      shortcut: "",
      category: "",
    },
  })

  const handleCreate = async (data: CannedResponseFormData) => {
    if (!organization?.id) return

    try {
      await createCannedResponse({
        organizationId: organization.id,
        title: data.title,
        content: data.content,
        shortcut: data.shortcut || undefined,
        category: data.category || undefined,
      })
      toast.success("Canned response created")
      setIsCreateDialogOpen(false)
      form.reset()
    } catch (error) {
      toast.error("Failed to create canned response")
      console.error(error)
    }
  }

  const handleUpdate = async (data: CannedResponseFormData) => {
    if (!editingResponse) return

    try {
      await updateCannedResponse({
        id: editingResponse._id,
        title: data.title,
        content: data.content,
        shortcut: data.shortcut || undefined,
        category: data.category || undefined,
      })
      toast.success("Canned response updated")
      setEditingResponse(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to update canned response")
      console.error(error)
    }
  }

  const handleDelete = async (id: Id<"cannedResponses">) => {
    try {
      await deleteCannedResponse({ id })
      toast.success("Canned response deleted")
    } catch (error) {
      toast.error("Failed to delete canned response")
      console.error(error)
    }
  }

  const openEditDialog = (response: CannedResponse) => {
    setEditingResponse(response)
    form.reset({
      title: response.title,
      content: response.content,
      shortcut: response.shortcut || "",
      category: response.category || "",
    })
  }

  const closeDialog = () => {
    setIsCreateDialogOpen(false)
    setEditingResponse(null)
    form.reset()
  }

  // Group responses by category
  const groupedResponses = cannedResponses?.reduce(
    (acc, response) => {
      const category = response.category || "Uncategorized"
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(response as CannedResponse)
      return acc
    },
    {} as Record<string, CannedResponse[]>,
  )

  if (cannedResponses === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareTextIcon className="size-5" />
            Canned Responses
          </CardTitle>
          <CardDescription>Loading canned responses...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareTextIcon className="size-5" />
              Canned Responses
            </CardTitle>
            <CardDescription>
              Create pre-written responses for quick replies. Use shortcuts like
              /greeting to quickly insert them.
            </CardDescription>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 size-4" />
                Add Response
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Canned Response</DialogTitle>
                <DialogDescription>
                  Create a pre-written response that can be quickly inserted
                  into conversations.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleCreate)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Greeting" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Hello! How can I help you today?"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shortcut"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shortcut (optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                /
                              </span>
                              <Input
                                placeholder="greeting"
                                className="pl-7"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Type /{field.value || "shortcut"} to insert
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Greetings" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeDialog}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {cannedResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ZapIcon className="size-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No canned responses yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first canned response to speed up your replies.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedResponses || {}).map(
              ([category, responses]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {category}
                  </h4>
                  <div className="space-y-3">
                    {responses.map((response) => (
                      <div
                        key={response._id}
                        className="flex items-start justify-between rounded-lg border p-4"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{response.title}</h4>
                            {response.shortcut && (
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                /{response.shortcut}
                              </Badge>
                            )}
                            {response.usageCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Used {response.usageCount} times
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {response.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Dialog
                            open={editingResponse?._id === response._id}
                            onOpenChange={(open) => !open && closeDialog()}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(response)}
                              >
                                <PencilIcon className="size-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Canned Response</DialogTitle>
                                <DialogDescription>
                                  Update this canned response.
                                </DialogDescription>
                              </DialogHeader>
                              <Form {...form}>
                                <form
                                  onSubmit={form.handleSubmit(handleUpdate)}
                                  className="space-y-4"
                                >
                                  <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                          <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Content</FormLabel>
                                        <FormControl>
                                          <Textarea
                                            className="min-h-[100px]"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="shortcut"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Shortcut</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                /
                                              </span>
                                              <Input
                                                className="pl-7"
                                                {...field}
                                              />
                                            </div>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name="category"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Category</FormLabel>
                                          <FormControl>
                                            <Input {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={closeDialog}
                                    >
                                      Cancel
                                    </Button>
                                    <Button type="submit">Save Changes</Button>
                                  </DialogFooter>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <TrashIcon className="size-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Canned Response
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;
                                  {response.title}&quot;? This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(response._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
