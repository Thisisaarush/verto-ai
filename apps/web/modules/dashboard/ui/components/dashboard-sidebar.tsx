"use client"

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import {
  BarChart3Icon,
  CreditCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LibraryBigIcon,
  PaletteIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

const customerSupportItems = [
  {
    title: "Conversations",
    url: "/conversations",
    icon: InboxIcon,
  },
  {
    title: "Knowledge Base",
    url: "/files",
    icon: LibraryBigIcon,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3Icon,
  },
]

const configurationItems = [
  {
    title: "Widget Customization",
    url: "/customization",
    icon: PaletteIcon,
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: LayoutDashboardIcon,
  },
]

const accountItems = [
  {
    title: "Plans & Billing",
    url: "/billing",
    icon: CreditCardIcon,
  },
]

export const DashboardSidebar = () => {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/"
    return pathname.startsWith(url)
  }

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar className="group" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <OrganizationSwitcher
                hidePersonal
                skipInvitationScreen
                appearance={{
                  elements: {
                    rootBox: "w-full! h-8!",
                    avatarBox: "size-6! rounded-sm!",
                    organizationSwitcherTrigger:
                      "w-full! justify-start! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
                    organizationPreview:
                      "group-data-[collapsible=icon]:justify-center! gap-2!",
                    organizationPreviewTextContainer:
                      "group-data-[collapsible=icon]:hidden! text-xs! font-medium! text-sidebar-foreground!",
                    organizationSwitcherTriggerIcon:
                      "group-data-[collapsible=icon]:hidden! ml-auto! text-sidebar-foreground!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Customer Support */}
        <SidebarGroup>
          <SidebarGroupLabel>Customer Support</SidebarGroupLabel>
          <SidebarContent>
            <SidebarMenu>
              {customerSupportItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={cn(isActive(item.url) && "bg-muted")}
                    tooltip={item?.title}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="size-4" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </SidebarGroup>

        {/* Configuration */}
        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarContent>
            <SidebarMenu>
              {configurationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={cn(isActive(item.url) && "bg-muted")}
                    tooltip={item?.title}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="size-4" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </SidebarGroup>

        {/* Account */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={cn(isActive(item.url) && "bg-muted")}
                    tooltip={item?.title}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="size-4" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton
              showName
              appearance={{
                elements: {
                  root: "w-full! h-8!",
                  userButtonTrigger:
                    "w-full! p-2! hover:bg-sidebar-accent! hover:text-sidebar-foreground! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
                  userButtonBox:
                    "w-full! flex-row-reverse! justify-end! gap-2! group-data-[collapsible=icon]:justify-center! text-sidebar-foreground!",
                  userButtonOuterIdentifier:
                    "pl-0! group-data-[collapsible=icon]:hidden!",
                  userButtonAvatarBox: "size-6!",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
