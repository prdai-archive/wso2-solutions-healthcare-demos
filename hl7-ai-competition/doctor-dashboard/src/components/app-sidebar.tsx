"use client";

import {
  Activity,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  MessagesSquare,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const nav = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Patients", href: "/patients", icon: Users },
  { title: "Reviews", href: "/reviews", icon: Activity },
  { title: "Messages", href: "/messages", icon: MessagesSquare },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { doctor, reviews } = useData();
  const reviewCount = reviews.filter(
    (r) => r.kind === "lab" || r.kind === "questionnaire" || r.kind === "refill",
  ).length;
  const messageCount = reviews.filter((r) => r.kind === "message").length;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Care Loop</span>
            <span className="text-xs text-muted-foreground">Clinician</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.title === "Reviews" && reviewCount > 0 ? (
                    <SidebarMenuBadge>{reviewCount}</SidebarMenuBadge>
                  ) : null}
                  {item.title === "Messages" && messageCount > 0 ? (
                    <SidebarMenuBadge>{messageCount}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
            {doctor.initials}
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{doctor.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {doctor.specialty}
            </span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
