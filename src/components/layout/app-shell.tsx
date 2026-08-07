"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/logo";
import { RoleBadge } from "@/components/ui/role-badge";
import { NAVIGATION_BY_ROLE } from "@/config/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

type ShellActor = {
  name: string;
  email: string;
  role: UserRole;
};

export function AppShell({
  actor,
  children,
}: {
  actor: ShellActor;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigation = NAVIGATION_BY_ROLE[actor.role];
  const initials = actor.name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-20 shrink-0 items-center border-b border-white/10 px-5",
          collapsed && "justify-center px-2",
        )}
      >
        <BrandLogo compact={collapsed} className="brightness-0 invert" />
      </div>
      <nav
        aria-label="Điều hướng chính"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
      >
        {navigation.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                active
                  ? "bg-white text-[#243467] shadow-sm"
                  : "text-blue-100 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon aria-hidden="true" className="size-[18px] shrink-0" />
              {collapsed ? (
                <span className="sr-only">{item.label}</span>
              ) : (
                <span>{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-white/10 p-3 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-blue-100 transition hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-2",
          )}
        >
          <PanelLeftClose
            aria-hidden="true"
            className={cn(
              "size-[18px] transition-transform",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed ? "Thu gọn" : <span className="sr-only">Mở rộng</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden bg-[#243467] transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[252px]",
        )}
      >
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[#101828]/55"
          />
          <aside className="relative h-full w-[286px] bg-[#243467] shadow-2xl">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-4 z-10 rounded-lg p-2 text-white hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-[#E4E7EC] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[#344054] hover:bg-[#F2F4F7] lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <label className="relative hidden max-w-lg flex-1 md:block">
            <span className="sr-only">Tìm kiếm</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="search"
              placeholder="Tìm lớp, buổi học, nội dung…"
              className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] pr-4 pl-10 text-sm text-[#344054] placeholder:text-[#98A2B3]"
            />
          </label>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-[#F2F4F7]"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[#E5E9F6] text-xs font-bold text-[#243467]">
                {initials}
              </span>
              <span className="hidden max-w-40 sm:block">
                <span className="block truncate text-sm font-semibold text-[#172033]">
                  {actor.name}
                </span>
                <span className="block truncate text-xs text-[#667085]">
                  {actor.email}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="hidden size-4 text-[#667085] sm:block"
              />
            </button>
            {profileOpen ? (
              <div className="absolute top-[calc(100%+8px)] right-0 w-64 rounded-xl border border-[#E4E7EC] bg-white p-3 shadow-xl">
                <div className="border-b border-[#EAECF0] px-2 pb-3">
                  <p className="truncate text-sm font-semibold">{actor.name}</p>
                  <p className="mt-1 truncate text-xs text-[#667085]">
                    {actor.email}
                  </p>
                  <div className="mt-2">
                    <RoleBadge role={actor.role} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
