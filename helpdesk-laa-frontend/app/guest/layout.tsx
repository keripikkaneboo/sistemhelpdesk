"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import GuestSidebar from "@/components/GuestSidebar";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const handler = () => setSidebarOpen(true);
    window.addEventListener("open-sidebar", handler);
    return () => window.removeEventListener("open-sidebar", handler);
  }, []);

  return (
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
        <GuestSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      </Suspense>

      {/* Konten utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
