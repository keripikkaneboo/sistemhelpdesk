"use client";

import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/types";

type Service = { id: number; nama_layanan: string };

const shuffleAndFilter = (data: Service[]): Service[] =>
  data
    .filter((s) => s.nama_layanan !== "Informasi Dosen")
    .sort(() => Math.random() - 0.5);

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "bot",
  content: "Halo! Saya asisten Helpdesk Akademik LAA FTE. Ada yang bisa saya bantu hari ini?",
};

function GuestChatContent() {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestTicket, setSuggestTicket] = useState(false);
  const [serviceChips, setServiceChips] = useState<Service[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [rateLimitError, setRateLimitError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/services?role=Mahasiswa")
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (result?.status === "success") {
          setServiceChips(shuffleAndFilter(result.data));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setRateLimitError("");
    const userContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "mahasiswa",
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

    try {
      const response = await fetch("/api/guest/chat-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userContent,
          history: chatHistoryContext,
        }),
      });

      if (response.status === 429) {
        const data = await response.json();
        setRateLimitError(data.message ?? "Batas pesan tercapai. Coba lagi dalam 1 jam.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const botContent = data.output || "Maaf, saya sedang tidak bisa memproses permintaan Anda.";
      setSuggestTicket(data.suggest_ticket === true);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: botContent,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: "Terjadi kesalahan jaringan. Silakan coba lagi.",
      };
      setMessages((prev) => [...prev, botMessage]);
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
        <button
          onClick={() => router.push("/")}
          className="shrink-0 bg-white text-red-700 hover:bg-red-50 px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
        >
          Login
        </button>
      </header>

      {/* Rate limit error banner */}
      {rateLimitError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {rateLimitError}
          <button onClick={() => setRateLimitError("")} className="ml-auto text-amber-600 hover:text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Pesan */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => {
          const showServiceChips =
            msg.id === "welcome" &&
            messages.length === 1 &&
            serviceChips.length > 0;

          return (
            <div key={msg.id} className={`flex flex-col ${msg.role !== "bot" ? "items-end" : "items-start"}`}>
              <div className={`flex ${msg.role !== "bot" ? "justify-end" : "justify-start"} w-full`}>
                {showServiceChips ? (
                  <div className="w-[92%] md:w-[85%] rounded-xl shadow-sm bg-white border border-gray-200 text-gray-800 rounded-bl-none overflow-hidden">
                    <div className="p-4">
                      <div className="space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&>p]:mb-1 [&>p]:whitespace-pre-wrap">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="border-t border-gray-100">
                      <div className="px-3 py-2 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-400">📚 Layanan Tersedia</p>
                      </div>
                      <div className="p-3 flex flex-wrap gap-2">
                        {serviceChips.slice(0, 5).map((svc) => (
                          <button
                            key={svc.id}
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
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tombol Buat Tiket — arahkan ke login */}
              {msg.role === "bot" && idx === messages.length - 1 && suggestTicket && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="mt-2 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Buat Tiket
                </button>
              )}
            </div>
          );
        })}

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

      {/* Modal Login Required (untuk Buat Tiket) */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7 text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Login Diperlukan</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Pembuatan tiket hanya tersedia untuk pengguna yang telah login. Silakan masuk dengan akun Anda.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition text-sm"
              >
                Tutup
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex-[2] py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition text-sm"
              >
                Login Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestPage() {
  return (
    <Suspense>
      <GuestChatContent />
    </Suspense>
  );
}
