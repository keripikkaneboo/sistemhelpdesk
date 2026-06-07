"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@/lib/UserContext";
import type { Ticket } from "@/lib/types";
import { useToast } from "@/lib/useToast";
import ToastNotification from "@/components/ToastNotification";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import Pagination from "@/components/Pagination";
import CustomSelect from "@/components/CustomSelect";

const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "Semua Status" },
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Closed", label: "Closed" },
];

type TicketMessage = {
  id: number;
  ticket_id: string;
  sender_type: "user" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

type Service = { id: number; nama_layanan: string };

function parseAsUTC(val: string): Date {
  if (!val) return new Date(NaN);
  const hasTimezone = val.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(val);
  if (hasTimezone) return new Date(val);
  return new Date(val.replace(" ", "T") + "Z");
}

function localTime(val: string): string {
  if (!val) return "";
  const d = parseAsUTC(val);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const msgDate = new Date(y, mo - 1, dy);
  const now = new Date();
  const today = dateKeyOf(now);
  const yesterday = dateKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const diffDays = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - msgDate.getTime()) / 86400000,
  );
  if (diffDays < 7) return msgDate.toLocaleDateString("en-US", { weekday: "long" });
  return `${String(dy).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
}

export default function TiketPage() {
  const { userRole } = useUser();
  const { toast, showToast, dismissToast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>(() => getCache<Ticket>("tickets") ?? []);
  const [loadingTickets, setLoadingTickets] = useState(() => !getCache<Ticket>("tickets"));
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [searchTicket, setSearchTicket] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchTickets = async () => {
    const cached = getCache<Ticket>("tickets");
    if (cached) { setTickets(cached); setLoadingTickets(false); return; }
    setLoadingTickets(true);
    try {
      const res = await fetch("/api/tickets");
      const result = await res.json();
      if (result.status === "success" && result.data) {
        const formatted = result.data.map((t: Ticket & { created_at?: string }) => ({
          ...t,
          date: t.created_at
            ? new Date(t.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }));
        setTickets(formatted);
        setCache("tickets", formatted);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  const pollTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      const result = await res.json();
      if (result.status === "success" && result.data) {
        const formatted = result.data.map((t: Ticket & { created_at?: string }) => ({
          ...t,
          date: t.created_at
            ? new Date(t.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }));
        setTickets(formatted);
        setCache("tickets", formatted);
      }
    } catch { /* noop */ }
  };

  const fetchServices = async () => {
    const key = `layanan_master_${userRole}`;
    const cached = getCache<Service>(key);
    if (cached) { setServices(cached); return; }
    try {
      const res = await fetch(`/api/layanan-master?role=${userRole}`);
      const result = await res.json();
      if (result.status === "success") {
        setServices(result.data);
        setCache(key, result.data);
      }
    } catch { /* noop */ }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { interval = setInterval(pollTickets, 3000); };
    const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else { pollTickets(); start(); }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState !== "hidden") start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userRole) fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  useEffect(() => { setPage(1); }, [searchTicket, filterDate, filterStatus]);

  useEffect(() => {
    if (!selectedTicket) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/tickets/messages?ticketId=${selectedTicket.id}`);
        const result = await res.json();
        if (result.status === "success" && Array.isArray(result.data)) {
          setTicketMessages((prev) => {
            if (result.data.length === prev.length) return prev;
            setCache(`ticket_messages_${selectedTicket.id}`, result.data);
            return result.data;
          });
        }
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
  }, [selectedTicket?.id]);

  const filteredTickets = tickets.filter((ticket) => {
    const matchSearch =
      ticket.subject.toLowerCase().includes(searchTicket.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTicket.toLowerCase());
    const matchDate = filterDate ? ticket.date === filterDate : true;
    const matchStatus = filterStatus === "All" ? true : ticket.status === filterStatus;
    return matchSearch && matchDate && matchStatus;
  });

  const totalPages = Math.ceil(filteredTickets.length / PAGE_SIZE);
  const paginatedTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) { showToast("error", "Silakan pilih jenis layanan terlebih dahulu!"); return; }
    setIsSubmittingTicket(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
          layanan_id: selectedService,
          subject: newTicketSubject,
          description: newTicketDescription,
          status: "Open",
        }),
      });
      if (res.ok) {
        showToast("success", "Tiket berhasil dibuat!");
        setIsTicketModalOpen(false);
        setSelectedService("");
        setNewTicketSubject("");
        setNewTicketDescription("");
        invalidateCache("tickets");
        fetchTickets();
      }
    } catch { console.error("Gagal membuat tiket"); }
    finally { setIsSubmittingTicket(false); }
  };

  const handleViewTicket = async (ticket: Ticket) => {
    // Optimistically clear unread badge saat tiket dibuka
    setTickets((prev) =>
      prev.map((t) => t.id === ticket.id ? { ...t, unread_count: 0 } : t)
    );

    setSelectedTicket(ticket);
    setTicketMessages([]);
    setLoadingMessages(true);

    const key = `ticket_messages_${ticket.id}`;
    const cached = getCache<TicketMessage>(key);
    if (cached) { setTicketMessages(cached); setLoadingMessages(false); return; }
    try {
      const res = await fetch(`/api/tickets/messages?ticketId=${ticket.id}`);
      const result = await res.json();
      if (result.status === "success") {
        setTicketMessages(result.data);
        setCache(key, result.data);
      }
    } catch { console.error("Gagal memuat pesan tiket"); }
    finally { setLoadingMessages(false); }
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedTicket) return;
    setIsSendingReply(true);
    try {
      const res = await fetch("/api/tickets/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: selectedTicket.id, message: replyInput }),
      });
      const result = await res.json();
      if (result.status === "success") {
        const updated = [...ticketMessages, result.data];
        setTicketMessages(updated);
        setCache(`ticket_messages_${selectedTicket.id}`, updated);
        setReplyInput("");
        if (replyTextareaRef.current) replyTextareaRef.current.style.height = "auto";
      }
    } catch { showToast("error", "Gagal mengirim pesan."); }
    finally { setIsSendingReply(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {/* Header mobile */}
      <header className="md:hidden bg-red-700 text-white px-4 py-3 flex items-center gap-3 shadow-sm z-10 shrink-0">
        <button
          className="p-1 -ml-1 rounded hover:bg-red-800 transition focus:outline-none shrink-0"
          aria-label="Buka menu"
          onClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold">Asisten Virtual LAA FTE</h2>
          <p className="text-xs opacity-80">Layanan Helpdesk</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Daftar Tiket</h2>
              <p className="text-sm text-gray-500 mt-1">Pantau status laporan dan pertanyaan Anda</p>
            </div>
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Buat Tiket Baru
            </button>
          </div>

          {/* Filter */}
          <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
                placeholder="Cari berdasarkan ID atau Subjek..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              />
            </div>
            <div className="w-full md:w-40">
              <CustomSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
            <div className="w-full md:w-auto">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition text-gray-600"
              />
            </div>
            {(searchTicket || filterDate || filterStatus !== "All") && (
              <button
                onClick={() => { setSearchTicket(""); setFilterDate(""); setFilterStatus("All"); }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {/* Tabel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto" id="tiket-table">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] md:text-sm text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">ID Tiket</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">NIM</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">Nama</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">Kategori</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">Subjek / Masalah</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">Tanggal Dibuat</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium">Status</th>
                    <th className="px-3 py-2 md:px-6 md:py-4 font-medium w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs md:text-sm">
                  {loadingTickets ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse border-b border-gray-50">
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                        <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
                        <td className="px-3 py-4" />
                      </tr>
                    ))
                  ) : paginatedTickets.length > 0 ? (
                    paginatedTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => handleViewTicket(ticket)}
                        className="hover:bg-gray-100 transition cursor-pointer"
                        title="Klik untuk melihat percakapan"
                      >
                        <td className="px-3 py-2 md:px-6 md:py-4 font-medium text-gray-900 whitespace-nowrap">{ticket.id}</td>
                        <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600 whitespace-nowrap">{ticket.nim}</td>
                        <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600 whitespace-nowrap">{ticket.nama}</td>
                        <td className="px-3 py-2 md:px-6 md:py-4 text-red-600 font-medium whitespace-nowrap">{ticket.nama_layanan || "Umum"}</td>
                        <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600">{ticket.subject}</td>
                        <td className="px-3 py-2 md:px-6 md:py-4 text-gray-500 whitespace-nowrap">
                          {new Date(ticket.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </td>
                        <td className="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            ticket.status === "Open"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : ticket.status === "In Progress"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              ticket.status === "Open" ? "bg-yellow-500" : ticket.status === "In Progress" ? "bg-blue-600" : "bg-green-500"
                            }`} />
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          {(ticket.unread_count ?? 0) > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                              {(ticket.unread_count ?? 0) > 9 ? "9+" : ticket.unread_count}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        Tidak ada tiket yang cocok dengan pencarian / filter tersebut.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filteredTickets.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        </div>
      </div>

      {/* Modal Buat Tiket */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Buat Tiket Baru</h3>
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Layanan <span className="text-red-500">*</span></label>
                <CustomSelect
                  value={selectedService}
                  onChange={setSelectedService}
                  placeholder="-- Pilih Layanan --"
                  options={services.map((svc) => ({ value: String(svc.id), label: svc.nama_layanan }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjek / Judul <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Contoh: Kendala iGracias"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Masalah <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  placeholder="Jelaskan detail masalah Anda..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTicketModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  Batal
                </button>
                <button type="submit" disabled={isSubmittingTicket} className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition">
                  {isSubmittingTicket ? "Mengirim..." : "Kirim Tiket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Percakapan Tiket */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col h-[80vh] overflow-hidden relative">
            <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedTicket.id} - {selectedTicket.subject}</h3>
                <p className="text-sm text-gray-500">Status: {selectedTicket.status}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-red-600 p-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {loadingMessages ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} animate-pulse`}>
                    <div className={`max-w-[70%] rounded-xl p-3 bg-gray-100 ${i % 2 === 0 ? "rounded-br-none" : "rounded-bl-none"} w-56`}>
                      <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-12 mt-2 ml-auto" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {(() => {
                    const nodes: React.ReactNode[] = [];
                    let lastDateKey = "";

                    const maybeSeparator = (dk: string, keyPrefix: string) => {
                      if (dk && dk !== lastDateKey) {
                        lastDateKey = dk;
                        nodes.push(
                          <div key={`sep-${keyPrefix}`} className="flex items-center gap-3 my-1">
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-[10px] font-medium text-gray-400 px-2 shrink-0">
                              {formatDateLabel(dk)}
                            </span>
                            <div className="flex-1 h-px bg-gray-100" />
                          </div>
                        );
                      }
                    };

                    if (selectedTicket.description) {
                      maybeSeparator(selectedTicket.date, "desc");
                      nodes.push(
                        <div key="description" className="flex justify-end">
                          <div className="max-w-[80%] rounded-xl p-3 shadow-sm bg-red-600 text-white rounded-br-none">
                            <p className="text-xs opacity-75 mb-1 font-semibold">{selectedTicket.nama}</p>
                            <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                            <p className="text-[10px] opacity-80 text-right mt-1">
                              {new Date(selectedTicket.date).toLocaleDateString("id-ID", {
                                day: "numeric", month: "long", year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    ticketMessages.forEach((msg, idx) => {
                      maybeSeparator(localDateKey(msg.created_at), `msg-${idx}`);
                      nodes.push(
                        <div key={idx} className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${
                            msg.sender_type === "user"
                              ? "bg-red-600 text-white rounded-br-none"
                              : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                          }`}>
                            <p className="text-xs opacity-75 mb-1 font-semibold">
                              {msg.sender_name} {msg.sender_type === "admin" && "🛡️"}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                              <p>{localTime(msg.created_at)}</p>
                              {msg.sender_type === "user" && (
                                <span>
                                  {msg.is_read ? (
                                    <div className="flex -space-x-1.5 text-blue-300" title="Dibaca">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <span title="Terkirim">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 opacity-70">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });

                    if (ticketMessages.length === 0 && !selectedTicket.description) {
                      nodes.push(
                        <p key="empty" className="text-center text-gray-400 text-sm italic mt-6">
                          Belum ada percakapan pada tiket ini.
                        </p>
                      );
                    }

                    return nodes;
                  })()}
                </>
              )}
            </div>

            {selectedTicket.status !== "Closed" ? (
              <form onSubmit={handleSendTicketReply} className="p-4 bg-white border-t border-gray-200 flex gap-2 shrink-0">
                <textarea
                  ref={replyTextareaRef}
                  rows={1}
                  value={replyInput}
                  onChange={(e) => {
                    setReplyInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      handleSendTicketReply(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Balas pesan admin di sini... (Shift+Enter untuk baris baru)"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none text-sm resize-none max-h-[76px] overflow-y-auto"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyInput.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                  {isSendingReply ? "..." : "Kirim"}
                </button>
              </form>
            ) : (
              <div className="p-4 bg-gray-100 border-t border-gray-200 text-center text-gray-500 text-sm font-medium shrink-0">
                Tiket ini sudah ditutup (Closed). Anda tidak dapat membalas pesan.
              </div>
            )}
          </div>
        </div>
      )}

      <ToastNotification toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
