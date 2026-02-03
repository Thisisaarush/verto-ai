"use client"

import { useQuery } from "convex/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useOrganization } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  MessageSquareIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "lucide-react"
import { Skeleton } from "@workspace/ui/components/skeleton"

// Stat card component
const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: "up" | "down" | "neutral"
  trendValue?: string
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {(description || trendValue) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend && trendValue && (
            <>
              {trend === "up" ? (
                <TrendingUpIcon className="h-3 w-3 text-green-500" />
              ) : trend === "down" ? (
                <TrendingDownIcon className="h-3 w-3 text-red-500" />
              ) : null}
              <span
                className={
                  trend === "up"
                    ? "text-green-500"
                    : trend === "down"
                      ? "text-red-500"
                      : ""
                }
              >
                {trendValue}
              </span>
            </>
          )}
          {description && <span>{description}</span>}
        </div>
      )}
    </CardContent>
  </Card>
)

// Loading skeleton for stats
const StatsSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <Card key={i}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    ))}
  </div>
)

// Simple bar chart component (no external library needed)
const SimpleBarChart = ({
  data,
  dataKey,
  label,
}: {
  data: { date: string; [key: string]: number | string }[]
  dataKey: string
  label: string
}) => {
  const maxValue = Math.max(...data.map((d) => Number(d[dataKey]) || 0), 1)

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-end gap-1 h-32">
        {data.map((item) => {
          const value = Number(item[dataKey]) || 0
          const height = (value / maxValue) * 100

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${item.date}: ${value}`}
              />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {new Date(item.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { organization } = useOrganization()
  const organizationId = organization?.id

  const analytics = useQuery(
    api.public.analytics.getSummary,
    organizationId ? { organizationId } : "skip",
  )

  const metrics = useQuery(
    api.public.analytics.getConversationMetrics,
    organizationId ? { organizationId, days: 14 } : "skip",
  )

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Track your support performance and customer engagement
        </p>
      </div>

      {/* Stats Overview */}
      {!analytics ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Conversations"
            value={analytics.summary.totalConversations}
            description="Last 30 days"
            icon={MessageSquareIcon}
          />
          <StatCard
            title="Resolution Rate"
            value={`${analytics.summary.resolutionRate}%`}
            description={`${analytics.summary.resolvedConversations} resolved`}
            icon={CheckCircleIcon}
            trend={analytics.summary.resolutionRate > 70 ? "up" : "down"}
            trendValue={
              analytics.summary.resolutionRate > 70 ? "Good" : "Needs attention"
            }
          />
          <StatCard
            title="Escalation Rate"
            value={`${analytics.summary.escalationRate}%`}
            description={`${analytics.summary.escalatedConversations} escalated`}
            icon={AlertTriangleIcon}
            trend={analytics.summary.escalationRate < 20 ? "up" : "down"}
            trendValue={analytics.summary.escalationRate < 20 ? "Low" : "High"}
          />
          <StatCard
            title="Unresolved"
            value={analytics.summary.unresolvedConversations}
            description="Pending conversations"
            icon={ClockIcon}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversations Over Time</CardTitle>
            <CardDescription>
              Daily conversation volume (last 14 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!metrics ? (
              <Skeleton className="h-32 w-full" />
            ) : metrics.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No data available
              </div>
            ) : (
              <SimpleBarChart data={metrics} dataKey="total" label="" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution Trend</CardTitle>
            <CardDescription>
              Daily resolved conversations (last 14 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!metrics ? (
              <Skeleton className="h-32 w-full" />
            ) : metrics.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No data available
              </div>
            ) : (
              <SimpleBarChart data={metrics} dataKey="resolved" label="" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Breakdown */}
      {analytics?.eventCounts &&
        Object.keys(analytics.eventCounts).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Event Breakdown</CardTitle>
              <CardDescription>
                Activity events in the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(analytics.eventCounts).map(([event, count]) => (
                  <div
                    key={event}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm capitalize">
                      {event.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
