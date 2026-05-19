"use client";

import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import type { Message } from "@/lib/types";

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
  const [currentSessionId, setCurrentSessionId] = useState(() => Date.now().toString());
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFromUrl]);

  const loadSpecificSession = async (sessionId: string) => {
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
      }
    } catch (err) {
      console.error("Gagal memuat sesi:", err);
    }
  };

  const handleNewChat = () => {
    if (confirm("Mulai percakapan baru?")) {
      router.push("/dashboard/chat");
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
      const response = await fetch("http://localhost:8000/api/chat-bot", {
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
        <div className="flex-1">
          <h2 className="text-lg font-bold truncate">Asisten Virtual LAA FTE</h2>
          <p className="text-sm opacity-80 truncate">Layanan Helpdesk</p>
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 bg-red-800 hover:bg-red-900 text-white px-3 py-2 rounded-lg transition border border-red-500/30 text-sm font-medium shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="hidden sm:inline">Chat Baru</span>
        </button>
      </header>

      {/* Pesan */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role !== "bot" ? "justify-end" : "justify-start"}`}>
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
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
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
