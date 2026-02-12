"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Button } from "@workspace/ui/components/button"
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@workspace/ui/components/dropzone"
import { api } from "@workspace/backend/convex/_generated/api"

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileUploaded: () => void
}

export const UploadDialog = ({
  open,
  onOpenChange,
  onFileUploaded,
}: UploadDialogProps) => {
  const addFile = useAction(api.private.files.addFile)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    category: "",
    filename: "",
  })

  const handleFileDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setUploadedFiles([file])
      if (!uploadForm.filename) {
        setUploadForm((prev) => ({ ...prev, filename: file.name }))
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadedFiles || uploadedFiles.length === 0) return
    setIsUploading(true)
    try {
      const blob = uploadedFiles[0]
      if (!blob) return

      const filename = uploadForm.filename || blob.name
      await addFile({
        bytes: await blob.arrayBuffer(),
        filename,
        mimeType: blob.type || "text/plain",
        category: uploadForm.category,
      })

      onFileUploaded?.()
      handleCancel()
    } catch (error) {
      console.error("Error uploading file:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    setUploadedFiles([])
    setUploadForm({ category: "", filename: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload a file to your knowledge base. Supported formats include PDF,
            text, and images.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              className="w-full"
              id="category"
              value={uploadForm.category}
              placeholder="e.g., Documentation, Reports, Product"
              onChange={(e) =>
                setUploadForm((prev) => ({ ...prev, category: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filename">
              Filename
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              className="w-full"
              id="filename"
              value={uploadForm.filename}
              placeholder="Override the default filename"
              onChange={(e) =>
                setUploadForm((prev) => ({ ...prev, filename: e.target.value }))
              }
            />
          </div>

          <Dropzone
            accept={{
              "application/pdf": [".pdf"],
              "text/csv": [".csv"],
              "text/plain": [".txt"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                [".docx"],
            }}
            disabled={isUploading}
            maxFiles={1}
            onDrop={handleFileDrop}
            src={uploadedFiles}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              uploadedFiles?.length === 0 || isUploading || !uploadForm.category
            }
          >
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
