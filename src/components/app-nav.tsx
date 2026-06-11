"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/lockers", label: "Lockers" },
  { href: "/students", label: "Students" },
  { href: "/history", label: "Records" },
  { href: "/devices", label: "Devices" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as unknown as Record<string, unknown> | undefined;
  const house = user?.house as string | null;
  const name = user?.name as string | undefined;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/tally-wordmark.svg" alt="tally" className="h-5 translate-y-px" />
            {house && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                House {house}
              </span>
            )}
          </Link>
          <nav className="hidden gap-0.5 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {name && (
            <span className="hidden text-sm text-gray-400 sm:block">{name}</span>
          )}
          <button
            onClick={() => signOut()}
            className="hidden text-sm text-gray-400 hover:text-gray-700 sm:block"
          >
            Sign out
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 sm:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t px-4 py-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t pt-2">
              {name && <span className="text-sm text-gray-400">{name}</span>}
              <button
                onClick={() => signOut()}
                className="text-sm text-gray-400 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
