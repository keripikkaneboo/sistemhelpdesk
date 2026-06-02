"use client";

import { useState, useEffect, useRef } from "react";
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

const STATUS_OPTIONS = [
  { value: "In Progress", label: "In Progress" },
  { value: "Closed",      label: "Closed" },
];

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

interface Props {
  ticket: Ticket;
  onClose: () => void;
  onStatusChange: (ticketId: string, newStatus: string) => void;
}

export default function TicketChatPanel({ ticket, onClose, onStatusChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentStatus(ticket.status);
    setLoadingMessages(true);
    setMessages([]);
    fetch(`/api/tickets/${ticket.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputText]);

  const allMessages: Message[] = [
    {
      id: "__original__",
      ticket_id: ticket.id,
      sender_type: "user",
      sender_name: ticket.nama,
      message: ticket.description || ticket.subject,
      created_at: ticket.created_at,
    },
    ...messages,
  ];

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSendError(false);
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setCurrentStatus(newStatus);
      onStatusChange(ticket.id, newStatus);
    } catch {
      /* revert silently */
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        <Avatar name={ticket.nama} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{ticket.nama}</p>
          <p className="text-xs text-gray-400 font-mono">{ticket.nim || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(currentStatus)}`}>
            {statusLabel(currentStatus)}
          </span>
          <CustomSelect
            value={currentStatus}
            onChange={(v) => handleStatusChange(v)}
            disabled={updatingStatus}
            options={STATUS_OPTIONS}
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
            title="Tutup"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subject banner */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span className="text-xs text-gray-500 font-medium truncate">{ticket.subject}</span>
        <span className="text-xs text-gray-400 ml-auto shrink-0">#{ticket.id}</span>
      </div>

      {/* Messages */}
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
                  {!isAdmin && <Avatar name={msg.sender_name} size="sm" />}
                  <div className={`max-w-[72%] flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-gray-400 mb-1 px-1">
                      {isAdmin ? "Admin" : (msg.sender_name || "User")}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isAdmin
                        ? "bg-red-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}>
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
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

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 shrink-0">
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
    </div>
  );
}
