"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/UserContext";
import type { Ticket } from "@/lib/types";

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

const LS_KEY = "helpdesk_ticket_viewed";

function loadViewedAt(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function saveViewedAt(map: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

export default function TiketPage() {
  const { userRole } = useUser();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTicket, setSearchTicket] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  // Map ticketId → ISO timestamp kapan user terakhir membuka tiket tersebut
  const [viewedAt, setViewedAt] = useState<Record<string, string>>({});

  useEffect(() => {
    setViewedAt(loadViewedAt());
  }, []);

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

  const fetchTickets = async () => {
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
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch(`/api/services?role=${userRole}`);
      const result = await res.json();
      if (result.status === "success") setServices(result.data);
    } catch { /* noop */ }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (userRole) fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Badge muncul jika ada balasan admin DAN tiket diupdate setelah user terakhir membukanya
  const hasNewAdminReply = (ticket: Ticket): boolean => {
    if (!ticket.admin_reply_count || ticket.admin_reply_count === 0) return false;
    const lastViewed = viewedAt[ticket.id];
    if (!lastViewed) return true; // belum pernah dibuka
    const updatedAt = ticket.updated_at;
    if (!updatedAt) return false;
    return new Date(updatedAt) > new Date(lastViewed);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchSearch =
      ticket.subject.toLowerCase().includes(searchTicket.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTicket.toLowerCase());
    const matchDate = filterDate ? ticket.date === filterDate : true;
    const matchStatus = filterStatus === "All" ? true : ticket.status === filterStatus;
    return matchSearch && matchDate && matchStatus;
  });

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) { alert("Silakan pilih jenis layanan terlebih dahulu!"); return; }
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
        alert("Tiket berhasil dibuat!");
        setIsTicketModalOpen(false);
        setSelectedService("");
        setNewTicketSubject("");
        setNewTicketDescription("");
        fetchTickets();
      }
    } catch { console.error("Gagal membuat tiket"); }
    finally { setIsSubmittingTicket(false); }
  };

  const handleViewTicket = async (ticket: Ticket) => {
    // Tandai tiket sebagai "sudah dibaca" sekarang
    const now = new Date().toISOString();
    const updated = { ...viewedAt, [ticket.id]: now };
    setViewedAt(updated);
    saveViewedAt(updated);

    setSelectedTicket(ticket);
    setTicketMessages([]);
    try {
      const res = await fetch(`/api/tickets/messages?ticketId=${ticket.id}`);
      const result = await res.json();
      if (result.status === "success") setTicketMessages(result.data);
    } catch { console.error("Gagal memuat pesan tiket"); }
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
        setTicketMessages((prev) => [...prev, result.data]);
        setReplyInput("");
      }
    } catch { alert("Gagal mengirim pesan."); }
    finally { setIsSendingReply(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
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
            <div className="w-full md:w-40 relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition text-gray-600 bg-white appearance-none cursor-pointer"
              >
                <option value="All">Semua Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">ID Tiket</th>
                    <th className="px-6 py-4 font-medium">NIM</th>
                    <th className="px-6 py-4 font-medium">Nama</th>
                    <th className="px-6 py-4 font-medium">Kategori</th>
                    <th className="px-6 py-4 font-medium">Subjek / Masalah</th>
                    <th className="px-6 py-4 font-medium">Tanggal Dibuat</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => handleViewTicket(ticket)}
                        className="hover:bg-gray-100 transition cursor-pointer"
                        title="Klik untuk melihat percakapan"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{ticket.id}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{ticket.nim}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{ticket.nama}</td>
                        <td className="px-6 py-4 text-red-600 font-medium whitespace-nowrap">{ticket.nama_layanan || "Umum"}</td>
                        <td className="px-6 py-4 text-gray-600">{ticket.subject}</td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(ticket.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                          {hasNewAdminReply(ticket) && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                              {ticket.admin_reply_count}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Layanan</label>
                <select
                  required
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white cursor-pointer text-gray-700"
                >
                  <option value="">-- Pilih Layanan --</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>{svc.nama_layanan}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjek / Judul</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Masalah</label>
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
              {ticketMessages.length === 0 ? (
                <p className="text-center text-gray-400 text-sm italic mt-10">Belum ada percakapan pada tiket ini.</p>
              ) : (
                ticketMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${
                      msg.sender_type === "user"
                        ? "bg-red-600 text-white rounded-br-none"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                    }`}>
                      <p className="text-xs opacity-75 mb-1 font-semibold">
                        {msg.sender_name} {msg.sender_type === "admin" && "🛡️"}
                      </p>
                      <p className="text-sm">{msg.message}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                        <p>{new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
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
                ))
              )}
            </div>

            {selectedTicket.status !== "Closed" ? (
              <form onSubmit={handleSendTicketReply} className="p-4 bg-white border-t border-gray-200 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="Balas pesan admin di sini..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none text-sm"
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
    </div>
  );
}
