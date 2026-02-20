"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

export function Header() {
  const { user, token, loading, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: { count: number } }>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.data.count))
      .catch(() => {});

    const interval = setInterval(() => {
      apiFetch<{ data: { count: number } }>("/notifications/unread-count")
        .then((res) => setUnreadCount(res.data.count))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const navLinks = (
    <>
      <Link href="/vote" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
        Today&apos;s Vote
      </Link>
      <Link href="/cycle" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
        Daily Cycle
      </Link>
      <Link href="/reviews" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
        Reviews
      </Link>
    </>
  );

  const userLinks = user ? (
    <>
      {user.role === "ADMIN" && (
        <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
          Dashboard
        </Link>
      )}
      {user.role === "RESTAURANT_OWNER" && (
        <>
          <Link href="/bids" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
            Bids
          </Link>
          <Link href="/restaurant-orders" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
            Orders
          </Link>
        </>
      )}
      {user.role === "SUPPLIER" && (
        <>
          <Link href="/inventory" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
            Inventory
          </Link>
          <Link href="/supplier-orders" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
            POs
          </Link>
        </>
      )}
      <Link href="/orders" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
        My Orders
      </Link>
      <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
      <span className="text-sm text-muted-foreground">{user.name}</span>
      <button
        onClick={() => { logout(); setMenuOpen(false); }}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        Sign Out
      </button>
    </>
  ) : null;

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary" />
          <span className="text-xl font-bold">Dotted</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 md:flex">
          {navLinks}
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              {userLinks}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                Sign In
              </Link>
              <Link href="/register" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Sign Up
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex items-center md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-3 pt-3">
            {navLinks}
            {loading ? null : user ? (
              <>
                {userLinks}
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
                <Link href="/register" className="text-sm font-medium text-primary hover:text-primary/80" onClick={() => setMenuOpen(false)}>
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
