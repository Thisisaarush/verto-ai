import { Loader2Icon } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-muted">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
