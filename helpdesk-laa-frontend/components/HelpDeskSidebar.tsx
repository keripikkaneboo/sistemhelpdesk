"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import type { ChatSession } from "@/lib/types";
import { getCache, setCache, invalidateCache, clearAllCache } from "@/lib/dataCache";
import { useToast } from "@/lib/useToast";
import ToastNotification from "@/components/ToastNotification";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpDeskSidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userName, nimNip, userRole } = useUser();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => getCache<ChatSession>("chat_sessions") ?? []);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  const currentSessionId = searchParams.get("session") ?? "";

  // Fetch / refresh riwayat chat setiap kali pathname/searchParams berubah
  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) return;
    const cached = getCache<ChatSession>("chat_sessions");
    if (cached) setChatSessions(cached);
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (result?.status === "success" && result.data?.length > 0) {
          const sessions: ChatSession[] = result.data
            .map((m: { session_id: string; content: string }) => ({
              sessionId: m.session_id,
              title: m.content.length > 25 ? m.content.substring(0, 25) + "..." : m.content,
            }))
            .reverse();
          setChatSessions(sessions);
          setCache("chat_sessions", sessions);
        } else {
          setChatSessions([]);
          setCache("chat_sessions", []);
        }
      })
      .catch(() => {});
  }, [pathname, searchParams]);

  // Tutup dropdown saat klik luar
  useEffect(() => {
    const handler = () => setOpenDropdownId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Auto-close drawer saat navigasi (mobile)
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const handleConfirmDeleteSession = async () => {
    if (!deleteTarget) return;
    const sessionId = deleteTarget.sessionId;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.status === "success") {
        invalidateCache("chat_sessions");
        setChatSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (currentSessionId === sessionId) router.push("/dashboard/chat");
        showToast("success", "Riwayat percakapan berhasil dihapus.");
      } else {
        showToast("error", result.message ?? "Gagal menghapus percakapan.");
      }
    } catch {
      showToast("error", "Gagal menghapus percakapan.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearAllCache();
    window.location.replace("/");
  };

  const isChat = pathname === "/dashboard/chat";
  const isTiket = pathname === "/dashboard/tiket";
  const isAkun = pathname === "/dashboard/akun";

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:shrink-0
        ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Profil */}
        <div className="relative p-6 flex flex-col items-center border-b border-gray-100 bg-gray-50/30">
          <button
            className="absolute top-4 right-4 md:hidden text-gray-400 hover:text-red-600 focus:outline-none"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-20 h-20 rounded-full border-2 border-red-600 p-1 mb-3 shadow-md bg-white">
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || "U")}&background=E11D48&color=fff&bold=true`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="text-center">
            <h2
              onClick={() => router.push("/dashboard/akun")}
              className="text-lg font-bold text-gray-800 leading-tight cursor-pointer hover:text-red-600 transition-colors"
              title="Klik untuk lihat profil"
            >
              {userName || "..."}
            </h2>
            <p className="text-sm text-gray-500 font-medium">{nimNip}</p>
            <div className="mt-2 inline-block px-3 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-widest rounded-full">
              {userRole || "User"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          {/* Menu Utama */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu Utama</p>
            <nav className="space-y-1">
              <button
                onClick={() => router.push("/dashboard/chat")}
                className={`w-full text-left px-3 py-2.5 rounded-lg font-medium transition flex items-center gap-3 ${
                  isChat ? "bg-red-50 text-red-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                💬 Chat Baru
              </button>
              <button
                onClick={() => router.push("/dashboard/tiket")}
                className={`w-full text-left px-3 py-2.5 rounded-lg font-medium transition flex items-center gap-3 ${
                  isTiket ? "bg-red-50 text-red-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                🎫 Daftar Tiket
              </button>
            </nav>
          </div>

          {/* Layanan Cepat */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Layanan Cepat</p>
            <ul className="space-y-1 text-sm">
              <li>
                <a href="https://igracias.telkomuniversity.ac.id/index.php" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                  🔗 iGracias Tel-U
                </a>
              </li>
              <li>
                <a href="https://lms.telkomuniversity.ac.id/" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                  🔗 CeLOE LMS
                </a>
              </li>
              <li>
                <a href="https://linktr.ee/laa.fte" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                  🔗 Web Fakultas
                </a>
              </li>
            </ul>
          </div>

          {/* Riwayat Chat */}
          <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Riwayat Chat</p>
              <ul className="space-y-1 text-sm">
                {chatSessions.length > 0 ? (
                  chatSessions.map((session, idx) => (
                    <li
                      key={idx}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition group ${
                        currentSessionId === session.sessionId ? "bg-red-50 text-red-700" : "text-gray-500 hover:bg-gray-100"
                      }`}
                      onClick={() => router.push(`/dashboard/chat?session=${session.sessionId}`)}
                    >
                      <div className="flex-1 truncate flex items-center gap-2">
                        <span>💬</span>
                        <span className="truncate">{session.title}</span>
                      </div>
                      <div className="relative flex items-center ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            setOpenDropdownId(openDropdownId === session.sessionId ? null : session.sessionId);
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition"
                          title="Opsi"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                          </svg>
                        </button>

                        {openDropdownId === session.sessionId && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-[999] overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                setDeleteTarget(session);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-gray-400 italic text-xs">Belum ada riwayat chat</li>
                )}
              </ul>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white">
          <h1 className="text-xl font-bold text-red-700 tracking-tight">LAA FTE</h1>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Telkom University</p>
        </div>
      </div>

      {/* Konfirmasi Hapus Riwayat Chat */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Hapus Riwayat Percakapan?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Percakapan <strong>&quot;{deleteTarget.title}&quot;</strong> akan dihapus secara permanen dan tidak dapat dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteSession}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastNotification toast={toast} onDismiss={dismissToast} />
    </aside>
  );
}
