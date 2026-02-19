"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary" />
          <span className="text-xl font-bold">Dotted</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/vote"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Today&apos;s Vote
          </Link>
          <Link
            href="/cycle"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Daily Cycle
          </Link>
          <Link
            href="/reviews"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Reviews
          </Link>
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              {user.role === "ADMIN" && (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
              )}
              {user.role === "RESTAURANT_OWNER" && (
                <Link
                  href="/bids"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Bids
                </Link>
              )}
              {user.role === "SUPPLIER" && (
                <Link
                  href="/inventory"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Inventory
                </Link>
              )}
              <Link
                href="/orders"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                My Orders
              </Link>
              <span className="text-sm text-muted-foreground">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
