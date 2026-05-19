"use client";

import { Suspense, useState, useCallback } from "react";
import { UserProvider } from "@/lib/UserContext";
import HelpDeskSidebar from "@/components/HelpDeskSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <UserProvider>
      <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <Suspense>
          <HelpDeskSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        </Suspense>

        {/* Konten utama */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar — hamburger + judul, hanya muncul di layar kecil */}
          <header className="md:hidden bg-red-700 text-white px-4 py-3 flex items-center gap-3 shadow-sm z-10 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded hover:bg-red-800 transition focus:outline-none"
              aria-label="Buka menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-base font-bold tracking-tight">Helpdesk LAA FTE</span>
          </header>

          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
