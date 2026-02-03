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
  TagIcon,
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

const TAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Gray", value: "#6b7280" },
]

const DEFAULT_TAG_COLOR = "#3b82f6" // Blue

const tagSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name is too long"),
  color: z.string().min(1, "Color is required"),
  description: z
    .string()
    .max(200, "Description is too long")
    .optional()
    .or(z.literal("")),
})

type TagFormData = z.infer<typeof tagSchema>

interface ConversationTag {
  _id: Id<"conversationTags">
  name: string
  color: string
  description?: string
}

export const ConversationTagsManager = () => {
  const { organization } = useOrganization()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<ConversationTag | null>(null)

  const tags = useQuery(
    api.private.conversationTags.getMany,
    organization?.id ? { organizationId: organization.id } : "skip",
  )

  const createTag = useMutation(api.private.conversationTags.create)
  const updateTag = useMutation(api.private.conversationTags.update)
  const deleteTag = useMutation(api.private.conversationTags.remove)

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_TAG_COLOR,
      description: "",
    },
  })

  const handleCreate = async (data: TagFormData) => {
    if (!organization?.id) return

    try {
      await createTag({
        organizationId: organization.id,
        name: data.name,
        color: data.color,
        description: data.description || undefined,
      })
      toast.success("Tag created")
      setIsCreateDialogOpen(false)
      form.reset()
    } catch (error: any) {
      if (error?.data?.code === "DUPLICATE_TAG") {
        toast.error("A tag with this name already exists")
      } else {
        toast.error("Failed to create tag")
      }
      console.error(error)
    }
  }

  const handleUpdate = async (data: TagFormData) => {
    if (!editingTag) return

    try {
      await updateTag({
        id: editingTag._id,
        name: data.name,
        color: data.color,
        description: data.description || undefined,
      })
      toast.success("Tag updated")
      setEditingTag(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to update tag")
      console.error(error)
    }
  }

  const handleDelete = async (id: Id<"conversationTags">) => {
    try {
      await deleteTag({ id })
      toast.success("Tag deleted")
    } catch (error) {
      toast.error("Failed to delete tag")
      console.error(error)
    }
  }

  const openEditDialog = (tag: ConversationTag) => {
    setEditingTag(tag)
    form.reset({
      name: tag.name,
      color: tag.color,
      description: tag.description || "",
    })
  }

  const closeDialog = () => {
    setIsCreateDialogOpen(false)
    setEditingTag(null)
    form.reset({
      name: "",
      color: DEFAULT_TAG_COLOR,
      description: "",
    })
  }

  if (tags === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="size-5" />
            Conversation Tags
          </CardTitle>
          <CardDescription>Loading tags...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const TagFormFields = () => (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., VIP, Urgent, Bug" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="color"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Color</FormLabel>
            <FormControl>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`size-8 rounded-full border-2 transition-all ${
                      field.value === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => field.onChange(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (optional)</FormLabel>
            <FormControl>
              <Input placeholder="What is this tag used for?" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="size-5" />
              Conversation Tags
            </CardTitle>
            <CardDescription>
              Create tags to organize and categorize your conversations.
            </CardDescription>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 size-4" />
                Add Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Tag</DialogTitle>
                <DialogDescription>
                  Create a new tag to categorize conversations.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleCreate)}
                  className="space-y-4"
                >
                  <TagFormFields />
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
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TagIcon className="size-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No tags yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first tag to start organizing conversations.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <div
                key={tag._id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                <Badge
                  style={{
                    backgroundColor: tag.color,
                    color: "#fff",
                  }}
                  className="font-medium"
                >
                  {tag.name}
                </Badge>
                {tag.description && (
                  <span className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {tag.description}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <Dialog
                    open={editingTag?._id === tag._id}
                    onOpenChange={(open) => !open && closeDialog()}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEditDialog(tag as ConversationTag)}
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Tag</DialogTitle>
                        <DialogDescription>Update this tag.</DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form
                          onSubmit={form.handleSubmit(handleUpdate)}
                          className="space-y-4"
                        >
                          <TagFormFields />
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
                      <Button size="icon" variant="ghost" className="size-7">
                        <TrashIcon className="size-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the &quot;{tag.name}
                          &quot; tag? It will be removed from all conversations.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(tag._id)}
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
        )}
      </CardContent>
    </Card>
  )
}
