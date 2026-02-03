// Structured logging utility for Convex
// Provides consistent log format for debugging and monitoring

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  organizationId?: string
  conversationId?: string
  sessionId?: string
  userId?: string
  requestId?: string
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Get minimum log level from environment
const getMinLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL as LogLevel
  return LOG_LEVELS[level] !== undefined ? level : "info"
}

const shouldLog = (level: LogLevel): boolean => {
  const minLevel = getMinLogLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

const formatLogEntry = (entry: LogEntry): string => {
  return JSON.stringify(entry)
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (!shouldLog("debug")) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "debug",
      message,
      context,
    }
    console.log(formatLogEntry(entry))
  },

  info: (message: string, context?: LogContext) => {
    if (!shouldLog("info")) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      context,
    }
    console.log(formatLogEntry(entry))
  },

  warn: (message: string, context?: LogContext) => {
    if (!shouldLog("warn")) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      context,
    }
    console.warn(formatLogEntry(entry))
  },

  error: (message: string, error?: Error, context?: LogContext) => {
    if (!shouldLog("error")) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    }
    console.error(formatLogEntry(entry))
  },

  // Log with automatic timing
  timed: async <T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext,
  ): Promise<T> => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      logger.info(`${operation} completed`, {
        ...context,
        durationMs: duration,
      })
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(
        `${operation} failed`,
        error instanceof Error ? error : new Error(String(error)),
        { ...context, durationMs: duration },
      )
      throw error
    }
  },
}

// Request ID generator for tracing
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Helper to create context with common fields
export const createLogContext = (
  organizationId?: string,
  additionalContext?: Partial<LogContext>,
): LogContext => {
  return {
    requestId: generateRequestId(),
    organizationId,
    ...additionalContext,
  }
}
