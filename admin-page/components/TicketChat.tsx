"use client";

import { useState, useEffect, useRef } from "react";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import CustomSelect from "@/components/CustomSelect";

type Ticket = {
  id: string;
  nim: string;
  nama: string;
  subject: string;
  description: string;
  status: string;
  date: string;
  created_at: string;
};

type Message = {
  id: number | string;
  ticket_id: string;
  sender_type: "user" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
};

const CACHE_KEY = "tickets";

const STATUS_OPTIONS = [
  { value: "open",     label: "Menunggu" },
  { value: "diproses", label: "Diproses" },
  { value: "closed",   label: "Selesai" },
];

function statusStyle(status: string) {
  const s = status?.toLowerCase();
  if (s === "open" || s === "menunggu" || s === "pending")
    return "bg-yellow-100 text-yellow-700";
  if (s === "diproses" || s === "in_progress" || s === "progress")
    return "bg-blue-100 text-blue-700";
  if (s === "closed" || s === "selesai" || s === "done")
    return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-600";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Menunggu", pending: "Menunggu", menunggu: "Menunggu",
    diproses: "Diproses", in_progress: "Diproses", progress: "Diproses",
    closed: "Selesai", done: "Selesai", selesai: "Selesai",
  };
  return map[status?.toLowerCase()] ?? status ?? "—";
}

function formatTime(val: string) {
  if (!val) return "";
  const d = new Date(val);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0)
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7)
    return d.toLocaleDateString("id-ID", { weekday: "short" });
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function formatBubbleTime(val: string) {
  if (!val) return "";
  const d = new Date(val);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Kemarin, ${time}`;
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}, ${time}`;
}

function matchesStatusFilter(status: string, filter: string) {
  if (!filter) return true;
  const s = status?.toLowerCase();
  if (filter === "menunggu") return s === "open" || s === "menunggu" || s === "pending";
  if (filter === "diproses") return s === "diproses" || s === "in_progress" || s === "progress";
  if (filter === "selesai") return s === "closed" || s === "selesai" || s === "done";
  return true;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  const cls = size === "sm"
    ? "w-8 h-8 text-xs"
    : "w-10 h-10 text-sm";
  return (
    <div className={`${cls} rounded-full bg-red-100 text-red-600 font-semibold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

export default function TicketChat() {
  // Ticket list
  const [tickets, setTickets] = useState<Ticket[]>(() => getCache<Ticket>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(() => !getCache<Ticket>(CACHE_KEY));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Chat
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch ticket list
  const fetchTickets = async () => {
    const cached = getCache<Ticket>(CACHE_KEY);
    if (cached) { setTickets(cached); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tickets");
      if (!res.ok) throw new Error();
      const data: Ticket[] = await res.json();
      setCache(CACHE_KEY, data);
      setTickets(data);
    } catch {
      /* handled silently, list stays empty */
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected ticket
  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`);
      if (!res.ok) throw new Error();
      setMessages(await res.json());
    } catch {
      /* stay empty */
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  useEffect(() => {
    if (selectedTicket) fetchMessages(selectedTicket.id);
  }, [selectedTicket?.id]);

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

  // Stats
  const totalTickets = tickets.length;
  const waitingCount = tickets.filter((t) => matchesStatusFilter(t.status, "menunggu")).length;
  const doneCount = tickets.filter((t) => matchesStatusFilter(t.status, "selesai")).length;

  // Filtered ticket list
  const displayedTickets = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      (t.nama ?? "").toLowerCase().includes(q) ||
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.nim ?? "").toLowerCase().includes(q);
    return matchSearch && matchesStatusFilter(t.status, filterStatus);
  });

  // All messages shown in chat: synthetic first message from ticket description + DB messages
  const allMessages: Message[] = selectedTicket
    ? [
        {
          id: "__original__",
          ticket_id: selectedTicket.id,
          sender_type: "user",
          sender_name: selectedTicket.nama,
          message: selectedTicket.description || selectedTicket.subject,
          created_at: selectedTicket.created_at,
        },
        ...messages,
      ]
    : [];

  const handleSelectTicket = (ticket: Ticket) => {
    if (selectedTicket?.id === ticket.id) return;
    setSelectedTicket(ticket);
    setInputText("");
    setSendError(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedTicket || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSendError(false);
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sender_name: "Admin" }),
      });
      if (!res.ok) throw new Error();
      const newMsg: Message = await res.json();
      setMessages((prev) => [...prev, newMsg]);
    } catch {
      setInputText(text);
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated: Ticket = await res.json();
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      // update cache
      const cached = getCache<Ticket>(CACHE_KEY);
      if (cached) {
        setCache(CACHE_KEY, cached.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch {
      /* status revert handled by not updating state */
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRefresh = () => {
    invalidateCache(CACHE_KEY);
    fetchTickets();
    if (selectedTicket) fetchMessages(selectedTicket.id);
  };

  const FILTER_TABS = [
    { key: "", label: "Semua", count: totalTickets },
    { key: "menunggu", label: "Menunggu", count: waitingCount },
    { key: "diproses", label: "Diproses", count: tickets.filter((t) => matchesStatusFilter(t.status, "diproses")).length },
    { key: "selesai", label: "Selesai", count: doneCount },
  ];

  return (
    <div className="flex flex-col flex-1 p-6 gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tiket</h1>
          <p className="text-sm text-gray-500 mt-0.5">Balas & tanggapi keluhan user</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-1.5 rounded-lg transition shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Main split layout */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Left: Ticket list ── */}
        <div className="w-80 shrink-0 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">

          {/* Stats mini */}
          <div className="flex border-b border-gray-100">
            {[
              { label: "Total", value: totalTickets, color: "text-blue-600" },
              { label: "Menunggu", value: waitingCount, color: "text-yellow-600" },
              { label: "Selesai", value: doneCount, color: "text-green-600" },
            ].map((s) => (
              <div key={s.label} className="flex-1 py-3 text-center border-r border-gray-100 last:border-r-0">
                <p className={`text-lg font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
                <p className="text-[11px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIM, atau subjek..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`flex-1 py-2 text-[11px] font-medium transition border-b-2 ${
                  filterStatus === tab.key
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 text-[10px] font-bold ${filterStatus === tab.key ? "text-red-500" : "text-gray-400"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 animate-pulse border-b border-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 bg-gray-100 rounded w-28" />
                      <div className="h-3 bg-gray-100 rounded w-10" />
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-40" />
                    <div className="h-4 bg-gray-100 rounded-full w-16 mt-0.5" />
                  </div>
                </div>
              ))
            ) : displayedTickets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {search || filterStatus ? "Tidak ada tiket yang cocok" : "Belum ada tiket"}
              </div>
            ) : (
              displayedTickets.map((ticket) => {
                const isActive = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full text-left px-4 py-3.5 transition hover:bg-gray-50 ${
                      isActive ? "bg-red-50 border-l-2 border-red-500" : "border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={ticket.nama} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-sm font-medium truncate ${isActive ? "text-red-700" : "text-gray-800"}`}>
                            {ticket.nama || "—"}
                          </p>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                            {formatTime(ticket.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{ticket.subject || "—"}</p>
                        <div className="mt-1.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyle(ticket.status)}`}>
                            {statusLabel(ticket.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Chat panel ── */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden min-w-0">
          {!selectedTicket ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-medium text-gray-400">Pilih tiket untuk mulai membalas</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 shrink-0">
                <Avatar name={selectedTicket.nama} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{selectedTicket.nama}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400 font-mono">{selectedTicket.nim || "—"}</p>
                    <span className="text-gray-200">·</span>
                    <p className="text-xs text-gray-400 truncate">{selectedTicket.subject}</p>
                  </div>
                </div>

                {/* Status changer */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(selectedTicket.status)}`}>
                    {statusLabel(selectedTicket.status)}
                  </span>
                  <CustomSelect
                    value={selectedTicket.status}
                    onChange={(v) => handleStatusChange(v)}
                    disabled={updatingStatus}
                    options={STATUS_OPTIONS}
                  />
                </div>
              </div>

              {/* Ticket subject banner */}
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="text-xs text-gray-500 font-medium truncate">{selectedTicket.subject}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">#{selectedTicket.id}</span>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {loadingMessages ? (
                  <div className="flex flex-col gap-4 animate-pulse">
                    {[
                      { side: "left",  w: "w-48", h: "h-10" },
                      { side: "right", w: "w-36", h: "h-8"  },
                      { side: "left",  w: "w-56", h: "h-14" },
                      { side: "right", w: "w-44", h: "h-10" },
                    ].map(({ side, w, h }, i) => (
                      <div key={i} className={`flex items-end gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
                        <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                        <div className={`${w} ${h} bg-gray-200 rounded-2xl`} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {allMessages.map((msg) => {
                      const isAdmin = msg.sender_type === "admin";
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                          {!isAdmin && (
                            <Avatar name={msg.sender_name} size="sm" />
                          )}
                          <div className={`max-w-[70%] flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                            {/* Sender name */}
                            <span className="text-[10px] text-gray-400 mb-1 px-1">
                              {isAdmin ? "Admin" : (msg.sender_name || "User")}
                            </span>
                            {/* Bubble */}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              isAdmin
                                ? "bg-red-600 text-white rounded-br-sm"
                                : "bg-gray-100 text-gray-800 rounded-bl-sm"
                            }`}>
                              {msg.message}
                            </div>
                            {/* Timestamp */}
                            <span className={`text-[10px] text-gray-400 mt-1 px-1 ${isAdmin ? "text-right" : "text-left"}`}>
                              {formatBubbleTime(msg.created_at)}
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
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input area */}
              <div className="border-t border-gray-100 px-4 py-3 shrink-0">
                {sendError && (
                  <p className="text-xs text-red-500 mb-2">Gagal mengirim pesan. Coba lagi.</p>
                )}
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik balasan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
