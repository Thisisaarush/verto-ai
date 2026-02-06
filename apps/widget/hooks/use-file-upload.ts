"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  ALLOWED_ATTACHMENT_TYPES,
  INPUT_CONSTRAINTS,
  type AllowedMimeType,
} from "@workspace/backend/convex/schema"

export interface PendingAttachment {
  id: string
  file: File
  filename: string
  mimeType: string
  size: number
  status: "pending" | "uploading" | "uploaded" | "error"
  progress: number
  error?: string
  storageId?: Id<"_storage">
  attachmentId?: Id<"attachments">
  url?: string
}

interface UseFileUploadOptions {
  organizationId: string
  conversationId: Id<"conversations"> | null
  contactSessionId: string
  maxFiles?: number
  onError?: (error: string) => void
}

export function useFileUpload({
  organizationId,
  conversationId,
  contactSessionId,
  maxFiles = INPUT_CONSTRAINTS.ATTACHMENT_MAX_PER_MESSAGE,
  onError,
}: UseFileUploadOptions) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateUploadUrl = useMutation(api.public.attachments.generateUploadUrl)
  const completeUpload = useMutation(api.public.attachments.completeUpload)

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check mime type
    const allowedType = ALLOWED_ATTACHMENT_TYPES[file.type as AllowedMimeType]
    if (!allowedType) {
      const allowedTypes = Object.keys(ALLOWED_ATTACHMENT_TYPES)
        .map(t => t.split("/")[1])
        .join(", ")
      return {
        valid: false,
        error: `File type "${file.type || "unknown"}" not allowed. Allowed: ${allowedTypes}`,
      }
    }

    // Check extension
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."))
    if (!(allowedType.ext as readonly string[]).includes(ext)) {
      return {
        valid: false,
        error: `File extension "${ext}" does not match type`,
      }
    }

    // Check size
    if (file.size > allowedType.maxSize) {
      const maxMB = Math.round(allowedType.maxSize / (1024 * 1024))
      return {
        valid: false,
        error: `File too large (max ${maxMB}MB)`,
      }
    }

    return { valid: true }
  }, [])

  const uploadFile = useCallback(async (
    attachment: PendingAttachment
  ): Promise<PendingAttachment> => {
    if (!conversationId) {
      return { ...attachment, status: "error", error: "No conversation" }
    }

    try {
      // Update status to uploading
      setAttachments(prev =>
        prev.map(a =>
          a.id === attachment.id ? { ...a, status: "uploading" as const, progress: 10 } : a
        )
      )

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl({
        conversationId,
        contactSessionId: contactSessionId as Id<"contactSessions">,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })

      setAttachments(prev =>
        prev.map(a =>
          a.id === attachment.id ? { ...a, progress: 30 } : a
        )
      )

      // Upload to storage
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": attachment.mimeType },
        body: attachment.file,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const { storageId } = await response.json() as { storageId: Id<"_storage"> }

      setAttachments(prev =>
        prev.map(a =>
          a.id === attachment.id ? { ...a, progress: 70 } : a
        )
      )

      // Complete the upload to create attachment record
      const result = await completeUpload({
        storageId,
        conversationId,
        contactSessionId: contactSessionId as Id<"contactSessions">,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })

      const updated: PendingAttachment = {
        ...attachment,
        status: "uploaded",
        progress: 100,
        storageId,
        attachmentId: result.id,
        url: result.url ?? undefined,
      }

      setAttachments(prev =>
        prev.map(a => (a.id === attachment.id ? updated : a))
      )

      return updated
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      const updated: PendingAttachment = {
        ...attachment,
        status: "error",
        error: errorMessage,
      }

      setAttachments(prev =>
        prev.map(a => (a.id === attachment.id ? updated : a))
      )

      onError?.(errorMessage)
      return updated
    }
  }, [conversationId, organizationId, contactSessionId, generateUploadUrl, completeUpload, onError])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const currentCount = attachments.length
    
    if (currentCount + fileArray.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`)
      return
    }

    const newAttachments: PendingAttachment[] = []

    for (const file of fileArray) {
      const validation = validateFile(file)
      
      const attachment: PendingAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        status: validation.valid ? "pending" : "error",
        progress: 0,
        error: validation.error,
      }

      newAttachments.push(attachment)
    }

    setAttachments(prev => [...prev, ...newAttachments])

    // Upload valid files
    setIsUploading(true)
    try {
      const validAttachments = newAttachments.filter(a => a.status === "pending")
      await Promise.all(validAttachments.map(uploadFile))
    } finally {
      setIsUploading(false)
    }
  }, [attachments.length, maxFiles, validateFile, uploadFile, onError])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addFiles(files)
    }
    // Reset input so same file can be selected again
    e.target.value = ""
  }, [addFiles])

  // Get uploaded attachment IDs for including in message
  const uploadedAttachmentIds = attachments
    .filter(a => a.status === "uploaded" && a.attachmentId)
    .map(a => a.attachmentId!)

  // Get string of allowed extensions for file input
  const acceptedTypes = Object.entries(ALLOWED_ATTACHMENT_TYPES)
    .flatMap(([mime, config]) => [mime, ...config.ext])
    .join(",")

  return {
    attachments,
    isUploading,
    uploadedAttachmentIds,
    addFiles,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    handleFileChange,
    fileInputRef,
    acceptedTypes,
  }
}
