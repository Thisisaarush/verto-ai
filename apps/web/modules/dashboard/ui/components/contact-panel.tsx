"use client"

import { getCountryFlagUrl, getCountryFromTimezone } from "@/lib/country-utils"
import { api } from "@workspace/backend/convex/_generated/api"
import { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { DicebearAvatar } from "@workspace/ui/components/dicebear-avatar"
import { useQuery } from "convex/react"
import {
  ClockIcon,
  GlobeIcon,
  MailIcon,
  MonitorIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import Bowser from "bowser"

type InfoItem = {
  label: string
  value: string | React.ReactNode
  className?: string
}

type InfoSection = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  items: InfoItem[]
}

export const ContactPanel = () => {
  const params = useParams()
  const conversationId = params.conversationId as Id<"conversations">
  const contactSession = useQuery(
    api.private.contactSessions.getOneByConversationId,
    conversationId
      ? {
          conversationId,
        }
      : "skip",
  )

  // Fetch conversation data for AI summary
  const conversation = useQuery(
    api.private.conversations.getOne,
    conversationId
      ? {
          conversationId,
        }
      : "skip",
  )

  const parseUserAgent = useMemo(() => {
    return (userAgent?: string) => {
      if (!userAgent)
        return {
          browser: "Unknown",
          os: "Unknown",
          device: "Unknown",
        }
      const browser = Bowser.getParser(userAgent)
      const result = browser.getResult()

      return {
        browser: result.browser.name || "Unknown",
        browserVersion: result.browser.version || "Unknown",
        os: result.os.name || "Unknown",
        osVersion: result.os.version || "Unknown",
        device: result.platform.type || "Unknown",
        deviceVendor: result.platform.vendor || "Unknown",
        deviceModel: result.platform.model || "Unknown",
      }
    }
  }, [])

  const userAgentInfo = useMemo(() => {
    return parseUserAgent(contactSession?.metadata?.userAgent)
  }, [contactSession?.metadata?.userAgent, parseUserAgent])

  const countryInfo = useMemo(() => {
    return getCountryFromTimezone(contactSession?.metadata?.timezone)
  }, [contactSession?.metadata?.timezone])

  const accordionSections = useMemo<InfoSection[]>(() => {
    if (!contactSession?.metadata) return []

    return [
      {
        id: "device-info",
        icon: MonitorIcon,
        title: "Device Info",
        items: [
          {
            label: "Browser",
            value:
              userAgentInfo.browser +
              (userAgentInfo.browserVersion
                ? ` (${userAgentInfo.browserVersion})`
                : ""),
          },
          {
            label: "OS",
            value:
              userAgentInfo.os +
              (userAgentInfo.osVersion ? ` (${userAgentInfo.osVersion})` : ""),
          },
          {
            label: "Device",
            value:
              userAgentInfo.device +
              (userAgentInfo.deviceVendor
                ? ` (${userAgentInfo.deviceVendor})`
                : "") +
              (userAgentInfo.deviceModel
                ? ` - ${userAgentInfo.deviceModel}`
                : ""),
            className: "capitalize",
          },
          {
            label: "Screen",
            value: contactSession.metadata.screenResolution || "Unknown",
          },
          {
            label: "Viewport",
            value: contactSession.metadata.viewportSize || "Unknown",
          },
          {
            label: "Cookies",
            value: contactSession.metadata.cookieEnabled
              ? "Enabled"
              : "Disabled",
          },
        ],
      },
      {
        id: "location-info",
        icon: GlobeIcon,
        title: "Location Info",
        items: [
          ...(countryInfo
            ? [
                {
                  label: "Country",
                  value: <span>{countryInfo.name}</span>,
                },
              ]
            : []),
          {
            label: "Language",
            value: contactSession.metadata.language || "Unknown",
          },
          {
            label: "Timezone",
            value: contactSession.metadata.timezone || "Unknown",
          },
        ],
      },
      {
        id: "section-details",
        title: "Section Details",
        icon: ClockIcon,
        items: [
          {
            label: "Session Started",
            value: new Date(contactSession._creationTime).toLocaleString(),
          },
        ],
      },
    ]
  }, [contactSession, userAgentInfo, countryInfo])

  if (contactSession === undefined || contactSession === null) {
    return null
  }

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex flex-col gap-y-4 p-4">
        <div className="flex items-center gap-x-2">
          <DicebearAvatar
            badgeImageUrl={
              countryInfo?.code
                ? getCountryFlagUrl(countryInfo.code)
                : undefined
            }
            seed={contactSession?._id}
            size={42}
          />

          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-x-2">
              <h4 className="line-clamp-1">{contactSession?.name}</h4>
            </div>
          </div>
          <p className="line-clamp-1 text-muted-foreground text-sm">
            {contactSession.email}
          </p>
        </div>

        <Button asChild className="w-full" size="lg">
          <Link href={`mailto:${contactSession.email}`}>
            <MailIcon />
            <span>Send Email</span>
          </Link>
        </Button>
      </div>

      <div>
        {/* AI Summary */}
        {conversation?.summary && (
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="size-4 text-violet-500" />
              <span className="text-sm font-medium">AI Summary</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {conversation.summary}
            </p>
          </div>
        )}

        {contactSession?.metadata && (
          <Accordion className="w-full rounded-none border-y" type="multiple">
            {accordionSections.map((section) => {
              return (
                <AccordionItem
                  className="rounded-none outline-none has-focus-visible:z-10 has-focus-visible:border-ring has-focus-visible:ring-[3px]
                  has-focus-visible:ring-ring/50"
                  key={section.id}
                  value={section.id}
                >
                  <AccordionTrigger className="flex w-full flex-1 items-start justify-between gap-4 rounded-none bg-accent px-5 py-4 text-left font-medium text-sm outline-none transition-all hover:no-underline disabled:pointer-events-none disabled:opacity-50">
                    <div className="flex items-center gap-4">
                      <section.icon className="size-4 shrink-0" />
                      <span>{section.title}</span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-5 py-4">
                    <div className="space-y-2 text-sm">
                      {section.items.map((item, index) => (
                        <div
                          key={`${section.id}-${item.label}`}
                          className="flex justify-between"
                        >
                          <span className="text-muted-foreground">
                            {item.label}:
                          </span>
                          <span className={item.className}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </div>
    </div>
  )
}
