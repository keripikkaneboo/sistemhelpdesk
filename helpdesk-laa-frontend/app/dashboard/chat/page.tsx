"use client";

import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import type { Message } from "@/lib/types";
import { getCache, setCache } from "@/lib/dataCache";

type Service = { id: number; nama_layanan: string };

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-red-600 underline font-medium hover:text-red-800 transition-colors break-all"
    >
      {children}
    </a>
  ),
};

// Konversi URL plain-text (dengan atau tanpa https://) ke format Markdown link.
// Mendukung: https://..., bare domain (kepokape.id), dan domain+path (linktr.ee/laa.fte).
// Split terlebih dahulu agar link Markdown yang sudah ada tidak di-wrap ulang.
const autoLinkify = (text: string) =>
  text
    .split(/(\[[^\]]*\]\([^)]*\))/g)
    .map((part, i) => {
      if (i % 2 === 1) return part; // sudah dalam [...](...)
      return part.replace(
        /(?<![/@\w])((?:https?:\/\/)?(?:[a-zA-Z0-9][a-zA-Z0-9-]*\.)+(?:ac\.id|co\.id|go\.id|sch\.id|id|com|net|org|edu|io|ly|ee)(?:\/[^\s<>"')\]]*)?)/gi,
        (match) => {
          const href = /^https?:\/\//i.test(match) ? match : `https://${match}`;
          return `[${match}](${href})`;
        }
      );
    })
    .join("");

const filterServices = (data: Service[]): Service[] =>
  data.filter((s) => s.nama_layanan !== "Informasi Dosen");

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "bot",
  content: "Halo! Saya asisten Helpdesk Akademik LAA FTE. Ada yang bisa saya bantu hari ini?",
};

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get("session");
  const { userRole } = useUser();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(() => Date.now().toString());
  const [suggestTicket, setSuggestTicket] = useState(false);
  const [serviceChips, setServiceChips] = useState<Service[]>([]);
  const [mhsServiceChips, setMhsServiceChips] = useState<Service[]>([]);
  const [activeServiceTab, setActiveServiceTab] = useState<'own' | 'mhs'>('own');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch layanan sesuai role (reuse cache dari sidebar)
  useEffect(() => {
    if (!userRole) return;
    const key = `services_${userRole}`;
    const cached = getCache<Service>(key);
    if (cached) { setServiceChips(cached); return; }
    fetch(`/api/services?role=${userRole}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (result?.status === "success") {
          const filtered = filterServices(result.data);
          setServiceChips(filtered);
          setCache(key, filtered);
        }
      })
      .catch(() => {});
  }, [userRole]);

  // Fetch Layanan Mahasiswa untuk tab kedua Dosen
  useEffect(() => {
    if (userRole?.toLowerCase() !== 'dosen') return;
    const key = 'services_Mahasiswa';
    const cached = getCache<Service>(key);
    if (cached) { setMhsServiceChips(cached); return; }
    fetch('/api/services?role=Mahasiswa')
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (result?.status === 'success') {
          const filtered = filterServices(result.data);
          setMhsServiceChips(filtered);
          setCache(key, filtered);
        }
      })
      .catch(() => {});
  }, [userRole]);

  // Scroll ke bawah setiap ada pesan baru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load session dari URL, atau mulai sesi baru
  useEffect(() => {
    if (sessionFromUrl) {
      loadSpecificSession(sessionFromUrl);
    } else {
      setMessages([WELCOME_MESSAGE]);
      setCurrentSessionId(Date.now().toString());
      setSuggestTicket(false);
      setActiveServiceTab('own');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFromUrl]);

  const loadSpecificSession = async (sessionId: string) => {
    setSuggestTicket(false);
    const key = `chat_session_${sessionId}`;
    const cached = getCache<Message>(key);
    if (cached) { setMessages(cached); setCurrentSessionId(sessionId); return; }
    setIsLoadingSession(true);
    try {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`);
      const result = await res.json();
      if (result.status === "success" && result.data?.length > 0) {
        const historyMessages: Message[] = result.data.map(
          (m: { id?: number; role: string; content: string }, index: number) => ({
            id: m.id ? m.id.toString() : `hist-${index}-${Date.now()}`,
            role: m.role,
            content: m.content,
          }),
        );
        setMessages(historyMessages);
        setCurrentSessionId(sessionId);
        setCache(key, historyMessages);
      }
    } catch (err) {
      console.error("Gagal memuat sesi:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const saveBotReply = async (content: string, sessionId: string) => {
    const botMessage: Message = { id: (Date.now() + 1).toString(), role: "bot", content };
    setMessages((prev) => [...prev, botMessage]);
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role: "bot", content }),
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: userRole ? userRole.toLowerCase() : "user",
      content: userContent,
    };

    const chatHistoryContext = (() => {
      const filtered = messages
        .filter((msg) => !msg.id.startsWith("welcome"))
        .slice(-6)
        .map((msg) => ({
          role: msg.role === "bot" ? "assistant" : "user",
          content: msg.content,
        }));

      const alternating: { role: string; content: string }[] = [];
      for (const msg of filtered) {
        if (alternating.length === 0 || alternating[alternating.length - 1].role !== msg.role) {
          alternating.push(msg);
        }
      }
      while (alternating.length > 0 && alternating[0].role !== "user") {
        alternating.shift();
      }
      return alternating;
    })();

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSuggestTicket(false);
    setIsLoading(true);

    const activeSessionId = currentSessionId;

    try {
      // Simpan pesan user ke DB
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          role: userRole ? userRole.toLowerCase() : "user",
          content: userContent,
        }),
      });

      // Update URL ke session aktif (hanya jika belum ada di URL) tanpa membuat history baru
      if (!sessionFromUrl) {
        router.replace(`/dashboard/chat?session=${activeSessionId}`);
      }

      // Kirim ke Python backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/chat-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userContent,
          user_mode: userRole || "Mahasiswa",
          history: chatHistoryContext,
        }),
      });

      const data = await response.json();
      const botContent = data.output || "Maaf, saya sedang tidak bisa memproses permintaan Anda.";
      setSuggestTicket(data.suggest_ticket === true);
      await saveBotReply(botContent, activeSessionId);
    } catch {
      await saveBotReply("Terjadi kesalahan jaringan. Silakan coba lagi.", activeSessionId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* Header */}
      <header className="bg-red-700 text-white p-4 sm:p-5 flex items-center shadow-sm z-10 gap-4 shrink-0">
        <button
          className="md:hidden p-1 -ml-1 rounded hover:bg-red-800 transition focus:outline-none shrink-0"
          aria-label="Buka menu"
          onClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold truncate">Asisten Virtual LAA FTE</h2>
          <p className="text-sm opacity-80 truncate">Layanan Helpdesk</p>
        </div>
      </header>

      {/* Pesan */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
        {isLoadingSession ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex flex-col ${i % 2 === 0 ? "items-end" : "items-start"} animate-pulse`}>
              <div className={`max-w-[70%] h-16 rounded-xl bg-gray-200 w-64 ${i % 2 === 0 ? "rounded-br-none" : "rounded-bl-none"}`} />
            </div>
          ))
        ) : messages.map((msg, idx) => {
          const showServiceTabs =
            msg.id === 'welcome' &&
            messages.length === 1 &&
            !sessionFromUrl &&
            !isLoadingSession &&
            serviceChips.length > 0;

          return (
          <div key={msg.id} className={`flex flex-col ${msg.role !== "bot" ? "items-end" : "items-start"}`}>
            <div className={`flex ${msg.role !== "bot" ? "justify-end" : "justify-start"} w-full`}>
              {showServiceTabs ? (
                <div className="w-[92%] md:w-[85%] rounded-xl shadow-sm bg-white border border-gray-200 text-gray-800 rounded-bl-none overflow-hidden">
                  <div className="p-4">
                    <div className="space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&>p]:mb-1 [&>p]:whitespace-pre-wrap">
                      <ReactMarkdown components={markdownComponents}>{autoLinkify(msg.content)}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="border-t border-gray-100">
                    {userRole?.toLowerCase() === 'dosen' ? (
                      <div className="flex border-b border-gray-100 bg-gray-50/50">
                        <button onClick={() => setActiveServiceTab('own')} className={`flex-1 py-2 text-xs font-semibold transition border-b-2 ${activeServiceTab === 'own' ? 'text-red-600 border-red-500 bg-white' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                          👨‍🏫 Layanan Dosen
                        </button>
                        <button onClick={() => setActiveServiceTab('mhs')} className={`flex-1 py-2 text-xs font-semibold transition border-b-2 ${activeServiceTab === 'mhs' ? 'text-red-600 border-red-500 bg-white' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                          🎓 Layanan Mahasiswa
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-400">📚 Layanan Tersedia</p>
                      </div>
                    )}
                    <div className="p-3 flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                      {(activeServiceTab === 'mhs' && userRole?.toLowerCase() === 'dosen'
                        ? mhsServiceChips : serviceChips
                      ).map((svc) => (
                        <button key={svc.id}
                          onClick={() => setInput(`Saya ingin bertanya tentang ${svc.nama_layanan}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-100 bg-red-50/70 text-red-700 hover:bg-red-100 hover:border-red-200 transition"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          {svc.nama_layanan}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-gray-400 italic px-3 pb-2">Klik layanan untuk memulai percakapan</p>
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[85%] md:max-w-[75%] p-4 rounded-xl shadow-sm ${
                    msg.role !== "bot"
                      ? "bg-red-600 text-white rounded-br-none"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.role !== "bot" ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <div className="space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&>p]:mb-1 [&>p]:whitespace-pre-wrap">
                      <ReactMarkdown components={markdownComponents}>{autoLinkify(msg.content)}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tombol Buat Tiket — hanya di pesan bot terakhir saat suggest_ticket = true */}
            {msg.role === "bot" && idx === messages.length - 1 && suggestTicket && (
              <button
                onClick={() => router.push("/dashboard/tiket")}
                className="mt-2 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Buat Tiket
              </button>
            )}
          </div>
        ); })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-500 p-4 rounded-xl rounded-bl-none italic text-sm shadow-sm flex space-x-2">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2 md:gap-3 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik pertanyaan anda di sini..."
          className="flex-1 border border-gray-300 rounded-xl px-4 md:px-5 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition text-sm md:text-base"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 md:px-8 py-3 rounded-xl font-medium transition disabled:opacity-50 shadow-sm"
        >
          <span className="hidden md:inline">Kirim</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:hidden inline">
            <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageContent />
    </Suspense>
  );
}
