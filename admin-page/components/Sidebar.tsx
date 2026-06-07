"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAllCache } from "@/lib/dataCache";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [kbOpen, setKbOpen] = useState(pathname.startsWith("/dashboard/knowledge-base"));
  const [adminName, setAdminName] = useState("Admin LAA");
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = (adminName || "A")
    .split(" ")
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.nama) setAdminName(data.nama); })
      .catch(() => {});

    fetch("/api/tickets")
      .then((r) => r.ok ? r.json() : [])
      .then((tickets: { unread_count?: number }[]) => {
        const total = tickets.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {});
  }, []);

  // Update unread badge instan saat ticket list page melakukan poll
  useEffect(() => {
    const handler = (e: Event) => {
      const { total } = (e as CustomEvent<{ total: number }>).detail;
      setUnreadCount(total);
    };
    window.addEventListener("tickets-unread-updated", handler);
    return () => window.removeEventListener("tickets-unread-updated", handler);
  }, []);

  // Fallback polling mandiri setiap 30s (aktif di semua halaman admin)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      fetch("/api/tickets")
        .then((r) => r.ok ? r.json() : [])
        .then((tickets: { unread_count?: number }[]) => {
          setUnreadCount(tickets.reduce((sum, t) => sum + (t.unread_count ?? 0), 0));
        })
        .catch(() => {});
    };

    const start = () => { interval = setInterval(poll, 30000); };
    const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else { poll(); start(); }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState !== "hidden") start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Update nama langsung saat profil disimpan
  useEffect(() => {
    const handler = (e: Event) => {
      const { nama } = (e as CustomEvent<{ nama: string }>).detail;
      if (nama) setAdminName(nama);
    };
    window.addEventListener("admin-profile-updated", handler);
    return () => window.removeEventListener("admin-profile-updated", handler);
  }, []);

  // Auto-close drawer saat navigasi (mobile)
  useEffect(() => {
    onClose?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearAllCache();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className={`w-60 h-dvh md:min-h-screen sidebar-gradient flex flex-col shadow-[4px_0_16px_rgba(0,0,0,0.18)] fixed md:relative inset-y-0 left-0 z-40 sidebar-drawer${isOpen ? " sidebar-drawer-open" : ""}`}>

      {/* Brand — horizontal layout (Design A) */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(220,38,38,0.4)] text-white font-bold text-sm select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-bold leading-tight tracking-wide truncate">{adminName}</p>
          <p className="text-white/40 text-[10px] leading-tight mt-0.5 uppercase tracking-widest">Fakultas Teknik Elektro</p>
        </div>
        {/* Tombol close — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition shrink-0"
          aria-label="Tutup menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 min-h-0 overflow-y-auto sidebar-scroll">
        <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-white/25 select-none">
          Menu
        </p>

        {/* Ticket */}
        <Link
          href="/dashboard/ticket"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
            pathname.startsWith("/dashboard/ticket")
              ? "bg-red-600 text-white"
              : "text-white/62 hover:bg-white/7 hover:text-white hover:translate-x-0.5"
          }`}
        >
          <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h4M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
          <span className="flex-1">Ticket</span>
          {unreadCount > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
              pathname.startsWith("/dashboard/ticket")
                ? "bg-white/25 text-white"
                : "bg-red-600 text-white"
            }`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Manajemen User */}
        <Link
          href="/dashboard/users"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
            pathname.startsWith("/dashboard/users")
              ? "bg-red-600 text-white"
              : "text-white/62 hover:bg-white/7 hover:text-white hover:translate-x-0.5"
          }`}
        >
          <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 16a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          Manajemen User
        </Link>

        {/* Knowledge Base (collapsible) */}
        <div>
          <button
            onClick={() => setKbOpen((prev) => !prev)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              pathname.startsWith("/dashboard/knowledge-base")
                ? "bg-white/10 text-white"
                : "text-white/62 hover:bg-white/7 hover:text-white hover:translate-x-0.5"
            }`}
          >
            <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="flex-1 text-left">Knowledge Base</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${kbOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Submenu dengan tree-line connector */}
          {kbOpen && (
            <div className="mt-1 flex flex-col gap-0.5 ml-4 pl-3 border-l border-white/10">
              <Link
                href="/dashboard/knowledge-base/layanan"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                  pathname === "/dashboard/knowledge-base/layanan"
                    ? "bg-red-600 text-white font-semibold"
                    : "text-white/50 hover:bg-white/7 hover:text-white"
                }`}
              >
                <span className={`w-0.5 h-4 rounded-full shrink-0 transition ${
                  pathname === "/dashboard/knowledge-base/layanan" ? "bg-red-300" : "bg-white/20"
                }`} />
                Knowledge Layanan
              </Link>
              <Link
                href="/dashboard/knowledge-base/dosen"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                  pathname === "/dashboard/knowledge-base/dosen"
                    ? "bg-red-600 text-white font-semibold"
                    : "text-white/50 hover:bg-white/7 hover:text-white"
                }`}
              >
                <span className={`w-0.5 h-4 rounded-full shrink-0 transition ${
                  pathname === "/dashboard/knowledge-base/dosen" ? "bg-red-300" : "bg-white/20"
                }`} />
                Informasi Dosen
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer — Akun */}
      <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-0.5 shrink-0">
        <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-white/25 select-none">
          Akun
        </p>
        <Link
          href="/dashboard/profile"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
            pathname === "/dashboard/profile"
              ? "bg-red-600 text-white"
              : "text-white/62 hover:bg-white/7 hover:text-white hover:translate-x-0.5"
          }`}
        >
          <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Edit Profil
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-white/55 hover:bg-red-900/30 hover:text-red-200 transition-all duration-150"
        >
          <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
