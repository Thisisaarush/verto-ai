"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  AlertTriangle,
  Zap,
  Activity,
  Timer,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatDistanceToNow } from "date-fns"

const REQUEST_TYPE_LABELS: Record<string, string> = {
  chat: "Chat Response",
  sentiment: "Sentiment Analysis",
  classification: "Agent Routing",
  tagging: "Auto-Tagging",
  summarization: "Summarization",
  suggested_replies: "Suggested Replies",
}

type TypeCounts = { success: number; failed: number }
type ErrorCount = { code: string; count: number; description: string }
type LogEntry = {
  _id: string
  requestType: string
  status: "success" | "failed"
  errorMessage?: string
  errorDescription?: string
  durationMs?: number
  createdAt: number
}
type RateLimit = {
  isRateLimited: boolean
  resetAt: number | null
  retryAfterSeconds: number | null
  limitPerMinute: number
  currentUsage: number
}

// Countdown timer component
function RateLimitCountdown({ resetAt }: { resetAt: number }) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.ceil((resetAt - Date.now()) / 1000)),
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [resetAt])

  if (secondsLeft <= 0) {
    return <span className="text-green-600 font-medium">Ready!</span>
  }

  return (
    <span className="text-amber-600 font-mono font-bold text-lg">
      {secondsLeft}s
    </span>
  )
}

export const AILogsManager = () => {
  const stats = useQuery(api.private.aiRequestLogs.getAIUsageStats)
  const recentLogs = useQuery(api.private.aiRequestLogs.getAIRequestLogs, {
    limit: 20,
  })

  if (stats === undefined || recentLogs === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const rateLimit = stats.rateLimit as RateLimit | undefined

  return (
    <div className="space-y-6">
      {/* Rate Limit Alert Banner */}
      {rateLimit?.isRateLimited && rateLimit.resetAt && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardHeader className="flex flex-row items-center gap-4 py-4">
            <Timer className="h-6 w-6 text-amber-500 animate-pulse" />
            <div className="flex-1">
              <CardTitle className="text-amber-700 dark:text-amber-400 text-lg flex items-center gap-3">
                Rate Limited - Waiting for Reset
                <RateLimitCountdown resetAt={rateLimit.resetAt} />
              </CardTitle>
              <CardDescription>
                You have exceeded the {rateLimit.limitPerMinute} requests per
                minute limit on Google Gemini free tier. AI features will
                automatically resume when the limit resets.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Alert Banner if daily quota exhausted */}
      {stats.isFreeTierExhausted && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader className="flex flex-row items-center gap-4 py-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div className="flex-1">
              <CardTitle className="text-destructive text-lg">
                Daily Free Tier Quota Exhausted
              </CardTitle>
              <CardDescription>
                You have used all {stats.freeRequestsLimit} daily free requests.
                AI features are disabled. Add your own API key to continue using
                AI features, or wait until tomorrow for the quota to reset.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {stats.lastFailure &&
        !stats.isFreeTierExhausted &&
        !rateLimit?.isRateLimited && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader className="flex flex-row items-center gap-4 py-4">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <div className="flex-1">
                <CardTitle className="text-amber-700 dark:text-amber-400 text-lg">
                  Recent AI Failure Detected
                </CardTitle>
                <CardDescription className="break-all">
                  {stats.lastFailure.errorDescription ||
                    stats.lastFailure.errorMessage}
                  <span className="ml-2 text-xs opacity-70">
                    ({formatDistanceToNow(stats.lastFailure.createdAt)} ago)
                  </span>
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Requests (24h)
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests24h}</div>
            <p className="text-xs text-muted-foreground">
              {stats.requestsLastHour} in the last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.successCount} succeeded, {stats.failedCount} failed
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            rateLimit?.isRateLimited ? "border-amber-500 bg-amber-500/5" : ""
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Rate Limit (RPM)
            </CardTitle>
            <Zap
              className={`h-4 w-4 ${rateLimit?.isRateLimited ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateLimit?.currentUsage ?? stats.requestsLastMinute}/
              {rateLimit?.limitPerMinute ?? 20}
            </div>
            <Progress
              value={
                ((rateLimit?.currentUsage ?? stats.requestsLastMinute) /
                  (rateLimit?.limitPerMinute ?? 20)) *
                100
              }
              className={`h-2 mt-2 ${rateLimit?.isRateLimited ? "[&>*]:bg-amber-500" : ""}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {rateLimit?.isRateLimited
                ? "Rate limited - waiting for reset"
                : "Google Gemini free tier limit"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Usage</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.freeRequestsUsed}/{stats.freeRequestsLimit}
            </div>
            <Progress
              value={(stats.freeRequestsUsed / stats.freeRequestsLimit) * 100}
              className={`h-2 mt-2 ${stats.isFreeTierExhausted ? "[&>*]:bg-destructive" : ""}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.freeRequestsRemaining} daily requests remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Requests by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requests by Type (24h)</CardTitle>
            <CardDescription>
              Breakdown of AI requests by feature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats.byType as Record<string, TypeCounts>).map(
                ([type, counts]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {REQUEST_TYPE_LABELS[type] || type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {counts.success + counts.failed} total
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {counts.success > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-600 border-green-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {counts.success}
                        </Badge>
                      )}
                      {counts.failed > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-red-500/10 text-red-600 border-red-500/20"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          {counts.failed}
                        </Badge>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Summary */}
      {stats.errorCounts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error Summary (24h)
            </CardTitle>
            <CardDescription>Common error types encountered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats.errorCounts as ErrorCount[]).map((error) => (
                <div
                  key={error.code}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div>
                    <p className="font-medium text-sm text-destructive">
                      {error.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Error code: {error.code}
                    </p>
                  </div>
                  <Badge variant="destructive">{error.count} occurrences</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent AI Requests</CardTitle>
          <CardDescription>Last 20 AI API calls</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No AI requests yet. Start a conversation to see logs here.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(recentLogs as LogEntry[]).map((log) => (
                <div
                  key={log._id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    log.status === "success"
                      ? "bg-muted/50"
                      : "bg-destructive/5 border border-destructive/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {REQUEST_TYPE_LABELS[log.requestType] ||
                          log.requestType}
                      </p>
                      {log.status === "failed" && (
                        <p className="text-xs text-destructive">
                          {log.errorDescription || log.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {log.durationMs && <span>{log.durationMs}ms</span>}
                    <span>
                      {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
