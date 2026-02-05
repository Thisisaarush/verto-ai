"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useInfiniteScroll } from "@workspace/ui/hooks/use-infinite-scroll"
import { InfiniteScrollTrigger } from "@workspace/ui/components/infinite-scroll-trigger"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PublicFile } from "@workspace/backend/convex/private/files"
import { usePaginatedQuery } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import {
  Delete,
  FileIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { UploadDialog } from "../components/upload-dialog"
import { useState } from "react"
import { DeleteFileDialog } from "../components/delete-file-dialog"
import { MobileHeader } from "@/modules/dashboard/ui/components/mobile-header"

export const FilesView = () => {
  const files = usePaginatedQuery(
    api.private.files.list,
    {},
    { initialNumItems: 10 },
  )

  const {
    topElementRef,
    handleLoadMore,
    canLoadMore,
    isLoadingFirstPage,
    isLoadingMore,
  } = useInfiniteScroll({
    status: files.status,
    loadMore: files.loadMore,
    loadSize: 10,
  })

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<PublicFile | null>(null)

  const handleDeleteClick = (file: PublicFile) => {
    setSelectedFile(file)
    setDeleteDialogOpen(true)
  }

  const handleFileDeleted = () => {
    setSelectedFile(null)
  }

  return (
    <>
      <DeleteFileDialog
        file={selectedFile}
        onDeleted={handleFileDeleted}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFileUploaded={() => {}}
      />

      <div className="h-full flex flex-col bg-muted overflow-auto">
        <MobileHeader title="Knowledge Base" />
        <div className="mx-auto w-full max-w-screen-md p-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Upload and manage documents for your AI assistant.
            </p>
          </div>

          <div className="mt-8 rounded-lg border bg-background">
            <div className="flex items-center justify-end border-b px-6 py-4">
              <Button onClick={() => setUploadDialogOpen(true)}>
                <PlusIcon />
                Add New
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-4 font-medium">Name</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Type</TableHead>
                  <TableHead className="px-6 py-4 font-medium">Size</TableHead>
                  <TableHead className="px-6 py-4 font-medium">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (isLoadingFirstPage) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          Loading files...
                        </TableCell>
                      </TableRow>
                    )
                  }

                  if (files.results.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No files found. Click "Add New" to upload files.
                        </TableCell>
                      </TableRow>
                    )
                  }

                  return files.results.map((file: PublicFile) => (
                    <TableRow key={file.id}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileIcon />
                          {file.name}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className="uppercase" variant="outline">
                          {file.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground">
                        {file.size}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="size-8 p-0"
                              variant="ghost"
                              size="sm"
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(file)}
                              className="text-destructive"
                            >
                              <TrashIcon className="size-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                })()}
              </TableBody>
            </Table>

            {!isLoadingFirstPage && files.results.length > 0 && (
              <div className="border-t">
                <InfiniteScrollTrigger
                  ref={topElementRef}
                  canLoadMore={canLoadMore}
                  isLoadingMore={isLoadingMore}
                  isLoadingFirstPage={isLoadingFirstPage}
                  onLoadMore={handleLoadMore}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FilesView
