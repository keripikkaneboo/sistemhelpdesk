"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { handleSessionExpired } from "@/lib/sessionUtils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const INACTIVITY_LIMIT = 60 * 60 * 1000;
  const REFRESH_INTERVAL = 5 * 60 * 1000;
  const CHECK_EVERY = 60 * 1000;
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastRefreshRef.current > REFRESH_INTERVAL) {
        lastRefreshRef.current = now;
        fetch("/api/auth/refresh", { method: "POST" })
          .then((res) => { if (res.status === 401) handleSessionExpired(); })
          .catch(() => {});
      }
    };

    const checkInactivity = () => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_LIMIT) {
        handleSessionExpired();
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = setInterval(checkInactivity, CHECK_EVERY);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex bg-[#f3f4f6] min-h-screen">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <div className="md:sticky md:top-0 md:h-screen md:shrink-0 md:overflow-y-auto sidebar-scroll">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      </div>

      {/* ── Konten utama ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

        {/* ── Mobile topbar ── */}
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 shadow-sm" style={{ background: "#1e2a3a" }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-white hover:bg-[#243245] transition"
            aria-label="Buka menu"
            aria-expanded={sidebarOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-white tracking-tight">Admin Panel Helpdesk LAA</span>
        </header>

        <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
