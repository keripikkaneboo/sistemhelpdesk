"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCache, setCache } from "@/lib/dataCache";
import { useAdmin } from "@/lib/AdminContext";

type Ticket = {
  id: string;
  nim: string;
  nama: string;
  subject: string;
  description: string;
  status: string;
  date: string;
  created_at: string;
  handled_by?: string | null;
  handled_by_name?: string | null;
  has_new_message?: boolean;
  unread_count?: number;
};

type Message = {
  id: number | string;
  ticket_id: string;
  sender_type: "user" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
};

function statusStyle(status: string) {
  const s = status?.toLowerCase();
  if (s === "open")        return "bg-yellow-100 text-yellow-700";
  if (s === "in progress") return "bg-blue-100 text-blue-700";
  if (s === "closed")      return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-600";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open:          "Open",
    "in progress": "In Progress",
    closed:        "Closed",
  };
  return map[status?.toLowerCase()] ?? status ?? "—";
}

// PostgreSQL mengembalikan TIMESTAMPTZ tanpa suffix timezone (misal "2026-05-10 08:31:00"),
// sehingga new Date() menginterpretasikannya sebagai waktu lokal, bukan UTC.
// Fungsi ini memastikan string selalu diparse sebagai UTC.
function parseAsUTC(val: string): Date {
  if (!val) return new Date(NaN);
  const hasTimezone = val.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(val);
  if (hasTimezone) return new Date(val);
  return new Date(val.replace(" ", "T") + "Z");
}

function localTime(val: string): string {
  if (!val) return "";
  const d = parseAsUTC(val);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function localDateKey(val: string): string {
  if (!val) return "";
  const d = parseAsUTC(val);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string): string {
  const [y, mo, dy] = dateKey.split("-").map(Number);
  const msgDate  = new Date(y, mo - 1, dy);
  const now      = new Date();
  const today    = dateKeyOf(now);
  const yesterday = dateKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  if (dateKey === today)     return "Today";
  if (dateKey === yesterday) return "Yesterday";

  const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - msgDate.getTime()) / 86400000);
  if (diffDays < 7) return msgDate.toLocaleDateString("en-US", { weekday: "long" });

  return `${String(dy).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${cls} rounded-full bg-red-100 text-red-600 font-semibold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const MSG_CACHE_KEY = `ticket_messages_${id}`;
  const [messages, setMessages] = useState<Message[]>(() => getCache<Message>(MSG_CACHE_KEY) ?? []);
  const [loadingMessages, setLoadingMessages] = useState(() => !getCache<Message>(MSG_CACHE_KEY));
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const { adminId: ctxAdminId, adminName: ctxAdminName, isLoadingAdmin } = useAdmin();
  const adminId = ctxAdminId;
  const adminName = ctxAdminName || "Admin";
  const adminLoaded = !isLoadingAdmin;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load ticket — cache first, then API
  useEffect(() => {
    const cached = getCache<Ticket>("tickets");
    const fromCache = cached?.find((t) => t.id === id);
    if (fromCache) {
      setTicket(fromCache);
      setCurrentStatus(fromCache.status);
      setLoadingTicket(false);
    } else {
      fetch(`/api/tickets/${id}`)
        .then((r) => r.json())
        .then((data) => { setTicket(data); setCurrentStatus(data.status); })
        .catch(() => {})
        .finally(() => setLoadingTicket(false));
    }
  }, [id]);

  // Load messages — selalu fetch fresh agar is_read ter-update di server,
  // tapi tampilkan cache dulu supaya tidak ada jeda kosong
  useEffect(() => {
    const cached = getCache<Message>(MSG_CACHE_KEY);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    }
    fetch(`/api/tickets/${id}/messages`)
      .then((r) => r.json())
      .then((data) => {
        const msgs = Array.isArray(data) ? data : [];
        setCache(MSG_CACHE_KEY, msgs);
        setMessages(msgs);
        // Setelah admin baca → reset unread_count di cache daftar tiket
        const ticketCache = getCache<Ticket>("tickets");
        if (ticketCache) {
          const updated = ticketCache.map((t) =>
            t.id === id ? { ...t, unread_count: 0 } : t
          );
          setCache("tickets", updated);
          const total = updated.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
          window.dispatchEvent(new CustomEvent("tickets-unread-updated", { detail: { total } }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll pesan baru setiap 3 detik, berhenti saat tab tidak aktif
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/tickets/${id}/messages`);
        const data = await res.json();
        if (!Array.isArray(data)) return;
        setMessages((prev) => {
          if (data.length === prev.length) return prev;
          setCache(MSG_CACHE_KEY, data);
          return data;
        });
      } catch { /* noop */ }
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { interval = setInterval(poll, 3000); };
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
  }, [id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputText]);

  const allMessages: Message[] = ticket
    ? [
        {
          id: "__original__",
          ticket_id: ticket.id,
          sender_type: "user",
          sender_name: ticket.nama,
          message: ticket.description || ticket.subject,
          created_at: ticket.created_at,
        },
        ...messages,
      ]
    : messages;

  const handleSend = async () => {
    if (!inputText.trim() || sending || !ticket) return;
    const text = inputText.trim();
    setInputText("");
    setSendError(false);
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sender_name: adminName }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const { new_status, new_handled_by, ...newMsg } =
        data as Message & { new_status: string | null; new_handled_by: string | null };

      // Tambahkan pesan baru ke chat
      setMessages((prev) => {
        const updated = [...prev, newMsg];
        setCache(MSG_CACHE_KEY, updated);
        return updated;
      });

      // Sync status & handled_by ke cache daftar tiket
      const cached = getCache<Ticket>("tickets");
      if (cached) {
        setCache("tickets", cached.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            ...(new_status     ? { status: new_status }         : {}),
            ...(new_handled_by ? { handled_by: new_handled_by } : {}),
            unread_count: 0,
          };
        }));
      }
      if (new_status) {
        setTicket((prev) => prev ? { ...prev, status: new_status } : prev);
        setCurrentStatus(new_status);
      }
    } catch {
      setInputText(text);
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, handled_by: adminId }),
      });
      if (!res.ok) throw new Error();
      const updated: Ticket = await res.json();
      setTicket(updated);
      setCurrentStatus(updated.status);
      const cached = getCache<Ticket>("tickets");
      if (cached) setCache("tickets", cached.map((t) => (t.id === id ? updated : t)));
    } catch {
      /* revert silently */
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loadingTicket || !adminLoaded) {
    return (
      <div className="flex flex-col h-[calc(100dvh-52px)] md:h-screen overflow-hidden bg-white animate-pulse">
        {/* Skeleton header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-gray-100" />
          <div className="w-10 h-10 rounded-full bg-gray-100" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
          <div className="h-6 bg-gray-100 rounded-full w-24" />
          <div className="h-8 bg-gray-100 rounded-lg w-28" />
        </div>
        <div className="px-5 py-2 border-b border-gray-100 flex gap-2">
          <div className="h-3 bg-gray-100 rounded w-48" />
          <div className="h-3 bg-gray-100 rounded w-16 ml-auto" />
        </div>
        {/* Skeleton bubbles */}
        <div className="flex-1 px-5 py-4 flex flex-col gap-4">
          {[["left","w-64","h-12"],["right","w-48","h-10"],["left","w-72","h-16"],["right","w-56","h-10"]].map(([side, w, h], i) => (
            <div key={i} className={`flex items-end gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className={`${w} ${h} bg-gray-100 rounded-2xl`} />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-[calc(100dvh-52px)] md:h-screen items-center justify-center gap-3">
        <p className="text-gray-500 text-sm">Tiket tidak ditemukan.</p>
        <button onClick={() => router.push("/dashboard/ticket")} className="text-sm text-red-600 underline">
          Kembali ke daftar tiket
        </button>
      </div>
    );
  }

  const isReadOnly = !!(ticket.handled_by && ticket.handled_by !== adminId);
  const otherHandlerName = ticket.handled_by_name ?? ticket.handled_by;

  return (
    <div className="flex flex-col h-[calc(100dvh-52px)] md:h-screen overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        {/* Tombol kembali — pojok kiri di samping avatar */}
        <button
          onClick={() => router.push("/dashboard/ticket")}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition shrink-0"
          title="Kembali ke daftar tiket"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={ticket.nama} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{ticket.nama}</p>
          <p className="text-xs text-gray-400 font-mono">{ticket.nim || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(currentStatus)}`}>
            {statusLabel(currentStatus)}
          </span>
          {!isReadOnly && currentStatus.toLowerCase() !== "closed" && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={updatingStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-900 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Close Ticket
            </button>
          )}
        </div>
      </div>

      {/* ── Subject banner — identik ── */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span className="text-xs text-gray-500 font-medium truncate">{ticket.subject}</span>
        <span className="text-xs text-gray-400 ml-auto shrink-0">#{ticket.id}</span>
      </div>

      {/* ── Notice: ditangani admin lain (read-only) ── */}
      {isReadOnly && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-amber-700">
            Tiket ini sedang ditangani oleh{" "}
            <span className="font-semibold">{otherHandlerName}</span>. Anda hanya dapat melihat percakapan (mode lihat saja).
          </span>
        </div>
      )}

      {/* ── Messages — identik ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loadingMessages ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {[
              { side: "left",  w: "w-64", h: "h-12" },
              { side: "right", w: "w-48", h: "h-10" },
              { side: "left",  w: "w-72", h: "h-16" },
              { side: "right", w: "w-56", h: "h-10" },
              { side: "left",  w: "w-52", h: "h-10" },
            ].map(({ side, w, h }, i) => (
              <div key={i} className={`flex items-end gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                <div className={`${w} ${h} bg-gray-200 rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {(() => {
              const nodes: React.ReactNode[] = [];
              let lastDateKey = "";
              allMessages.forEach((msg) => {
                const dk = localDateKey(msg.created_at);
                if (dk !== lastDateKey) {
                  lastDateKey = dk;
                  nodes.push(
                    <div key={`sep-${dk}`} className="flex items-center gap-3 my-1">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[10px] font-medium text-gray-400 px-2 shrink-0">
                        {formatDateLabel(dk)}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  );
                }
                const isAdmin = msg.sender_type === "admin";
                nodes.push(
                  <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                    {!isAdmin && <Avatar name={msg.sender_name} size="sm" />}
                    <div className={`max-w-[72%] flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-gray-400 mb-1 px-1">
                        {msg.sender_name || (isAdmin ? "Admin" : "User")}
                      </span>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isAdmin
                          ? "bg-red-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {localTime(msg.created_at)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              });
              return nodes;
            })()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input ── */}
      <div className="border-t border-gray-100 shrink-0">
        {isReadOnly ? (
          <div className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-xs text-gray-400">
              Tiket ini ditangani oleh <span className="font-medium text-gray-500">{otherHandlerName}</span>. Anda tidak dapat mengirim balasan.
            </p>
          </div>
        ) : currentStatus.toLowerCase() === "closed" ? (
          <div className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-400">Tiket ini sudah ditutup. Tidak dapat mengirim pesan.</p>
          </div>
        ) : (
          <div className="px-4 py-3">
            {sendError && (
              <p className="text-xs text-red-500 mb-2">Gagal mengirim pesan. Coba lagi.</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik balasan… (Enter kirim, Shift+Enter baris baru)"
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition leading-relaxed"
                style={{ maxHeight: "120px", overflowY: "auto" }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shrink-0"
              >
                {sending ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Close Ticket Confirmation Modal ── */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !updatingStatus && setShowCloseConfirm(false)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900" />
            <div className="px-6 py-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              {/* Title & description */}
              <h3 className="text-center text-base font-semibold text-gray-800 mb-1">
                Tutup Tiket Ini?
              </h3>
              <p className="text-center text-sm text-gray-500 mb-1 leading-relaxed">
                Tiket dari <span className="font-medium text-gray-700">{ticket.nama}</span> akan ditandai sebagai <span className="font-medium text-gray-700">Closed</span>.
              </p>
              <p className="text-center text-xs text-gray-400 mb-6">
                Tindakan ini akan mengakhiri percakapan dan tidak dapat dibatalkan.
              </p>
              {/* Ticket info card */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{ticket.subject}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{ticket.id}</p>
                </div>
              </div>
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  disabled={updatingStatus}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    await handleStatusChange("Closed");
                    setShowCloseConfirm(false);
                  }}
                  disabled={updatingStatus}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingStatus ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Menutup…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Ya, Tutup
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
