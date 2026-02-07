"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  Shield,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"

// Type for API key from the backend
interface ApiKey {
  _id: Id<"apiKeys">
  name: string
  keyPrefix: string
  permissions: string[]
  lastUsedAt?: number
  expiresAt?: number
  isActive: boolean
  createdAt: number
  revokedAt?: number
}

const PERMISSIONS = [
  {
    id: "conversations:read",
    label: "Read conversations",
    description: "List and view conversations",
  },
  {
    id: "conversations:write",
    label: "Write conversations",
    description: "Update conversation status, tags, etc.",
  },
  {
    id: "messages:read",
    label: "Read messages",
    description: "View messages in conversations",
  },
  {
    id: "messages:write",
    label: "Write messages",
    description: "Send messages to conversations",
  },
  {
    id: "analytics:read",
    label: "Read analytics",
    description: "Access analytics data",
  },
  {
    id: "contacts:read",
    label: "Read contacts",
    description: "List contacts/sessions",
  },
  {
    id: "contacts:write",
    label: "Write contacts",
    description: "Update contact information",
  },
] as const

type Permission = (typeof PERMISSIONS)[number]["id"]

export const ApiKeysManager = () => {
  // Note: api.private.apiKeys types are generated when running `npx convex dev`
  const apiKeys = useQuery((api.private as any).apiKeys?.list) as
    | ApiKey[]
    | undefined
  const createKey = useMutation((api.private as any).apiKeys?.create)
  const revokeKey = useMutation((api.private as any).apiKeys?.revoke)
  const deleteKey = useMutation((api.private as any).apiKeys?.deleteKey)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([
    "conversations:read",
    "messages:read",
  ])
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key")
      return
    }
    if (selectedPermissions.length === 0) {
      toast.error("Please select at least one permission")
      return
    }

    setIsCreating(true)
    try {
      const result = await createKey({
        name: newKeyName.trim(),
        permissions: selectedPermissions,
      })
      setNewlyCreatedKey(result.key)
      toast.success("API key created successfully")
    } catch (error) {
      toast.error("Failed to create API key")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey)
      setCopied(true)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setNewKeyName("")
    setSelectedPermissions(["conversations:read", "messages:read"])
    setNewlyCreatedKey(null)
    setCopied(false)
  }

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeKey({ keyId: keyId as any })
      toast.success("API key revoked")
    } catch (error) {
      toast.error("Failed to revoke API key")
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteKey({ keyId: keyId as any })
      toast.success("API key deleted")
    } catch (error) {
      toast.error("Failed to delete API key")
    }
  }

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    )
  }

  if (apiKeys === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access to your organization&apos;s
            data
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            {newlyCreatedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API key now. You won&apos;t be able to see it
                    again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/50 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      This is the only time you&apos;ll see this key. Store it
                      securely.
                    </p>
                  </div>
                  <div className="relative">
                    <Input
                      value={newlyCreatedKey}
                      readOnly
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={handleCopyKey}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseCreateDialog}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {PERMISSIONS.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(
                              permission.id,
                            )}
                            onCheckedChange={() =>
                              togglePermission(permission.id)
                            }
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {permission.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {permission.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreateDialog}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-1">No API Keys</h4>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first API key to integrate with external services
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <Card key={key._id} className={!key.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{key.name}</CardTitle>
                    {!key.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {key.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                          >
                            <Shield className="h-4 w-4 text-amber-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately disable the API key. Any
                              applications using this key will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeKey(key._id)}
                              className="bg-amber-500 hover:bg-amber-600"
                            >
                              Revoke Key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the API key. This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKey(key._id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                    {key.keyPrefix}...
                  </code>
                </div>
                <div className="flex flex-wrap gap-1">
                  {key.permissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {formatDistanceToNow(key.createdAt)} ago
                  </span>
                  {key.lastUsedAt && (
                    <span>
                      Last used {formatDistanceToNow(key.lastUsedAt)} ago
                    </span>
                  )}
                  {key.revokedAt && (
                    <span className="text-amber-500">
                      Revoked {formatDistanceToNow(key.revokedAt)} ago
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API Documentation Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Documentation</CardTitle>
          <CardDescription>
            Quick reference for using the REST API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Base URL</p>
            <code className="block px-3 py-2 bg-muted rounded text-sm font-mono">
              "https://blessed-cobra-308.convex.site/api/v1"
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Authentication</p>
            <code className="block px-3 py-2 bg-muted rounded text-sm font-mono whitespace-pre">
              {`Authorization: Bearer <your_api_key>`}
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Example: List Conversations</p>
            <code className="block px-3 py-2 bg-muted rounded text-sm font-mono whitespace-pre overflow-x-auto">
              {`curl -X GET "https://blessed-cobra-308.convex.site/api/v1/conversations" \\
  -H "Authorization: Bearer verto_pk_xxxxx"`}
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Endpoints</p>
            <div className="text-sm space-y-1">
              <p>
                <code className="text-xs bg-muted px-1 rounded">GET</code>{" "}
                /conversations - List conversations
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">GET</code>{" "}
                /conversations/:id - Get conversation
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">PATCH</code>{" "}
                /conversations/:id - Update conversation
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">GET</code>{" "}
                /conversations/:id/messages - Get messages
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">POST</code>{" "}
                /conversations/:id/messages - Send message
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">GET</code>{" "}
                /analytics - Get analytics
              </p>
              <p>
                <code className="text-xs bg-muted px-1 rounded">GET</code>{" "}
                /contacts - List contacts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
