import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

interface InfiniteScrollTriggerProps {
  canLoadMore: boolean
  isLoadingMore: boolean
  isLoadingFirstPage?: boolean
  onLoadMore: () => void
  loadMoreText?: string
  noMoreText?: string
  className?: string
  ref?: React.Ref<HTMLDivElement>
}

export const InfiniteScrollTrigger = ({
  canLoadMore,
  isLoadingMore,
  isLoadingFirstPage = false,
  onLoadMore,
  loadMoreText = "Load More",
  noMoreText = "No More Items",
  className,
  ref,
}: InfiniteScrollTriggerProps) => {
  if (isLoadingFirstPage) {
    return <div ref={ref} className="h-1" />
  }

  let text = loadMoreText

  if (isLoadingMore) {
    text = "Loading..."
  } else if (!canLoadMore) {
    text = noMoreText
  }

  return (
    <div className={cn("flex w-full justify-center py-2", className)} ref={ref}>
      <Button
        onClick={onLoadMore}
        disabled={!canLoadMore || isLoadingMore}
        size="sm"
        variant="ghost"
      >
        {text}
      </Button>
    </div>
  )
}
