"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import { useAdmin } from "@/lib/AdminContext";
import Pagination from "@/components/Pagination";
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
  updated_at?: string | null;
  handled_by?: string | null;
  handled_by_name?: string | null;
  layanan_id?: string | null;
  nama_layanan?: string | null;
  unread_count?: number;
};

const CACHE_KEY = "tickets";
const PAGE_SIZE = 50;

const AGE_OPTIONS = [
  { value: "",     label: "Semua Durasi" },
  { value: "<1h",  label: "< 1 jam" },
  { value: "<1d",  label: "< 1 hari" },
  { value: ">1d",  label: "> 1 hari" },
  { value: ">7d",  label: "> 7 hari" },
];

function statusStyle(status: string) {
  const s = status?.toLowerCase();
  if (s === "open" || s === "menunggu" || s === "pending")
    return "bg-yellow-100 text-yellow-700";
  if (s === "in progress" || s === "diproses" || s === "sedang ditangani")
    return "bg-blue-100 text-blue-700";
  if (s === "closed" || s === "selesai" || s === "done")
    return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-600";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Open", pending: "Open",
    "in progress": "In Progress", diproses: "In Progress",
    closed: "Closed", done: "Closed",
  };
  return map[status?.toLowerCase()] ?? status ?? "—";
}

function formatDate(val: string) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
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

function calcAgeHours(created: string, endDate?: string | null): number {
  const end = endDate ? parseAsUTC(endDate).getTime() : Date.now();
  return (end - parseAsUTC(created).getTime()) / 3600000;
}

function formatAge(created: string, endDate?: string | null): string {
  if (!created) return "—";
  const diffHours = Math.floor(calcAgeHours(created, endDate));
  const suffix = endDate ? "" : " yang lalu";
  if (diffHours < 1) return `< 1 jam${suffix}`;
  if (diffHours < 24) return `${diffHours} jam${suffix}`;
  return `${Math.floor(diffHours / 24)} hari${suffix}`;
}

function ageStyle(created: string, endDate?: string | null): string {
  const diffHours = Math.floor(calcAgeHours(created, endDate));
  if (diffHours < 1)  return "bg-red-50 text-red-500";
  if (diffHours < 24) return "bg-orange-50 text-orange-500";
  return "bg-gray-100 text-gray-500";
}

function matchAge(created: string, filter: string): boolean {
  if (!filter) return true;
  const diffHours = calcAgeHours(created);
  if (filter === "<1h")  return diffHours < 1;
  if (filter === "<1d")  return diffHours < 24;
  if (filter === ">1d")  return diffHours >= 24;
  if (filter === ">7d")  return diffHours >= 168;
  return true;
}

export default function TicketPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>(() => getCache<Ticket>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(() => !getCache<Ticket>(CACHE_KEY));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterHandledBy, setFilterHandledBy] = useState("");
  const [filterMe, setFilterMe] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { adminId: currentAdmin } = useAdmin();
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFromApi = async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/tickets");
      if (!res.ok) throw new Error();
      const data: Ticket[] = await res.json();
      setCache(CACHE_KEY, data);
      setTickets(data);
      const total = data.reduce((sum: number, t: Ticket) => sum + (t.unread_count ?? 0), 0);
      window.dispatchEvent(new CustomEvent("tickets-unread-updated", { detail: { total } }));
    } catch {
      if (showLoading) setApiError("Tidak dapat terhubung ke database. Periksa koneksi dan konfigurasi.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getCache<Ticket>(CACHE_KEY);
    if (cached) {
      setTickets(cached);
      setLoading(false);
      fetchFromApi(false);
    } else {
      fetchFromApi(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { interval = setInterval(() => fetchFromApi(false), 3000); };
    const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else { fetchFromApi(false); start(); }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState !== "hidden") start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalTickets    = tickets.length;
  const waitingCount    = tickets.filter((t) => t.status?.toLowerCase() === "open").length;
  const inProgressCount = tickets.filter((t) => t.status?.toLowerCase() === "in progress").length;
  const doneCount       = tickets.filter((t) => t.status?.toLowerCase() === "closed").length;

  const statusOptions   = [...new Set(tickets.map((t) => t.status).filter(Boolean))];
  const adminOptions    = Array.from(
    new Map(
      tickets
        .filter((t): t is Ticket & { handled_by: string } => Boolean(t.handled_by))
        .map((t) => [t.handled_by, t.handled_by_name ?? t.handled_by] as const)
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const ticketDate = t.date || t.created_at;

    const matchSearch =
      t.id.toLowerCase().includes(q) ||
      (t.nim ?? "").toLowerCase().includes(q) ||
      (t.nama ?? "").toLowerCase().includes(q) ||
      (t.subject ?? "").toLowerCase().includes(q);

    const matchStatus      = filterStatus      ? t.status === filterStatus         : true;
    const matchHandledBy   = filterHandledBy   ? t.handled_by === filterHandledBy  : true;
    const matchMe          = filterMe          ? t.handled_by === currentAdmin      : true;
    const matchUnread      = filterUnread      ? (t.unread_count ?? 0) > 0         : true;
    const matchAgeFilter   = matchAge(t.created_at, filterAge);

    const matchDateFrom = dateFrom
      ? new Date(ticketDate) >= new Date(dateFrom)
      : true;
    const matchDateTo = dateTo
      ? new Date(ticketDate) <= new Date(dateTo + "T23:59:59")
      : true;

    return matchSearch && matchStatus && matchHandledBy && matchMe && matchUnread && matchAgeFilter && matchDateFrom && matchDateTo;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const activeFilterCount = [
    filterStatus, filterAge, filterHandledBy,
    filterMe, filterUnread, dateFrom, dateTo,
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterAge("");
    setFilterHandledBy("");
    setFilterMe(false);
    setFilterUnread(false);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const isAnyFilterActive = !!(search || filterStatus || filterAge || filterHandledBy || filterMe || filterUnread || dateFrom || dateTo);

  return (
    <div className="flex flex-col flex-1 p-4 md:p-8 gap-4 md:gap-6">
      {/* Header */}
      <div className="page-header animate-fade-up">
        <h1 className="text-2xl font-bold text-gray-800">Tiket</h1>
        <p className="text-sm text-gray-500 mt-1">
          Daftar tiket dari user yang membutuhkan penanganan khusus
        </p>
      </div>

      {/* Error */}
      {apiError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
          <button onClick={() => fetchFromApi(true)} className="ml-auto underline text-red-600 hover:text-red-800 font-medium">Coba lagi</button>
        </div>
      )}

      {/* Stats — Design C: icon top-right, number top-left, progress bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl border border-[#e8edf5] p-[18px] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[32px] font-extrabold text-gray-900 tabular-nums leading-none">{loading ? "—" : totalTickets}</p>
              <p className="text-xs text-gray-400 font-medium mt-[5px]">Total Tiket</p>
            </div>
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-[14px] h-[3px] bg-[#f1f5f9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-600" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Open */}
        <div className="bg-white rounded-xl border border-[#e8edf5] p-[18px] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[32px] font-extrabold text-gray-900 tabular-nums leading-none">{loading ? "—" : waitingCount}</p>
              <p className="text-xs text-gray-400 font-medium mt-[5px]">Open</p>
            </div>
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-[14px] h-[3px] bg-[#f1f5f9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber-500" style={{ width: totalTickets > 0 ? `${Math.round((waitingCount / totalTickets) * 100)}%` : "0%" }} />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-xl border border-[#e8edf5] p-[18px] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[32px] font-extrabold text-gray-900 tabular-nums leading-none">{loading ? "—" : inProgressCount}</p>
              <p className="text-xs text-gray-400 font-medium mt-[5px]">In Progress</p>
            </div>
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="mt-[14px] h-[3px] bg-[#f1f5f9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-orange-500" style={{ width: totalTickets > 0 ? `${Math.round((inProgressCount / totalTickets) * 100)}%` : "0%" }} />
          </div>
        </div>

        {/* Closed */}
        <div className="bg-white rounded-xl border border-[#e8edf5] p-[18px] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[32px] font-extrabold text-gray-900 tabular-nums leading-none">{loading ? "—" : doneCount}</p>
              <p className="text-xs text-gray-400 font-medium mt-[5px]">Closed</p>
            </div>
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-green-50 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-[14px] h-[3px] bg-[#f1f5f9] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-600" style={{ width: totalTickets > 0 ? `${Math.round((doneCount / totalTickets) * 100)}%` : "0%" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">

        {/* ── Filter bar ── */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex flex-wrap items-center gap-2 md:gap-3">
          <h2 className="text-base font-semibold text-gray-700 shrink-0">
            Daftar Tiket{" "}
            <span className="text-gray-400 font-normal text-sm">({filtered.length} tiket)</span>
          </h2>

          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Cari ID, NIM, nama, atau subjek..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition"
            />
          </div>

          {/* Single filter dropdown */}
          <div className="relative shrink-0" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((p) => !p)}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filterOpen
                  ? "border-red-400 bg-red-50 text-red-600"
                  : activeFilterCount > 0
                  ? "border-red-400 text-red-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-80 p-4 flex flex-col gap-4">

                  {/* Status */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</label>
                    <CustomSelect
                      value={filterStatus}
                      onChange={(v) => { setFilterStatus(v); resetPage(); }}
                      options={[{ value: "", label: "Semua Status" }, ...statusOptions.map((s) => ({ value: s, label: statusLabel(s) }))]}
                    />
                  </div>

                  {/* Umur tiket */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Durasi Tiket</label>
                    <CustomSelect
                      value={filterAge}
                      onChange={(v) => { setFilterAge(v); resetPage(); }}
                      options={AGE_OPTIONS}
                    />
                  </div>

                  {/* Handled By */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Handled By</label>
                    <CustomSelect
                      value={filterHandledBy}
                      onChange={(v) => { setFilterHandledBy(v); resetPage(); }}
                      options={[{ value: "", label: "Semua Admin" }, ...adminOptions.map((a) => ({ value: a.id, label: a.id === currentAdmin ? `${a.name} (Me)` : a.name }))]}
                    />
                  </div>

                  {/* Rentang Tanggal */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rentang Tanggal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none focus:ring-2 focus:ring-red-300 transition bg-white"
                      />
                      <span className="text-xs text-gray-400 shrink-0">—</span>
                      <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none focus:ring-2 focus:ring-red-300 transition bg-white"
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100" />

                  {/* Toggle: My Tickets & Unread */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setFilterMe((p) => !p); resetPage(); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition text-xs font-medium ${filterMe ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-gray-200 text-gray-600"}`}
                    >
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Tickets
                      </span>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${filterMe ? "bg-red-500" : "bg-gray-200"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${filterMe ? "left-4" : "left-0.5"}`} />
                      </div>
                    </button>

                    <button
                      onClick={() => { setFilterUnread((p) => !p); resetPage(); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition text-xs font-medium ${filterUnread ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-gray-200 text-gray-600"}`}
                    >
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Unread saja
                      </span>
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${filterUnread ? "bg-red-500" : "bg-gray-200"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${filterUnread ? "left-4" : "left-0.5"}`} />
                      </div>
                    </button>
                  </div>

                  {/* Reset button */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { resetAllFilters(); setFilterOpen(false); }}
                      className="w-full text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg py-1.5 font-medium transition"
                    >
                      Reset semua filter ({activeFilterCount})
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>

        <div className="overflow-x-auto rounded-b-xl ticket-table">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr>
                <th className="th-cell w-10">No</th>
                <th className="th-cell">ID</th>
                <th className="th-cell">Pengguna</th>
                <th className="th-cell">Layanan</th>
                <th className="th-cell">Subjek</th>
                <th className="th-cell">Deskripsi</th>
                <th className="th-cell">Tanggal</th>
                <th className="th-cell">Durasi</th>
                <th className="th-cell">Status</th>
                <th className="th-cell">Handled By</th>
                <th className="th-cell w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-6" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3">
                      <div className="h-4 bg-gray-100 rounded w-32 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-20" />
                    </td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-40" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3">
                      <div className="h-3 bg-gray-100 rounded w-48 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-32" />
                    </td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-14" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-6 bg-gray-100 rounded-full w-24" /></td>
                    <td className="px-3 py-2 md:px-3 md:py-3"><div className="h-4 bg-gray-100 rounded w-28" /></td>
                    <td className="px-3 py-4" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                      </svg>
                      <p className="text-gray-400 text-sm">
                        {isAnyFilterActive ? "Tidak ada tiket yang cocok dengan filter ini" : "Belum ada tiket masuk"}
                      </p>
                      {isAnyFilterActive && (
                        <button onClick={resetAllFilters} className="text-xs text-red-500 underline mt-1">
                          Reset semua filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((ticket, idx) => {
                  const ticketDate = ticket.date || ticket.created_at;
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-600 font-mono text-xs max-w-[90px]"><p className="truncate">{ticket.id}</p></td>
                      <td className="px-3 py-2 md:px-3 md:py-3">
                        <p className="text-gray-800 font-medium">{ticket.nama || "—"}</p>
                        {ticket.nim && <p className="text-gray-400 text-xs font-mono">{ticket.nim}</p>}
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-600 text-xs">
                        {ticket.nama_layanan || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-700 max-w-[180px]">
                        <p className="truncate">{ticket.subject || "—"}</p>
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-500 max-w-[130px]">
                        <p className="line-clamp-2 text-xs leading-relaxed">{ticket.description || "—"}</p>
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(ticketDate)}
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3 whitespace-nowrap">
                        {(() => {
                          const isClosed = ticket.status?.toLowerCase() === "closed";
                          const endDate = isClosed ? ticket.updated_at : null;
                          const style = isClosed ? "bg-gray-100 text-gray-500" : ageStyle(ticket.created_at, endDate);
                          return (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${style}`}>
                              {formatAge(ticket.created_at, endDate)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(ticket.status)}`}>
                          {statusLabel(ticket.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 md:px-3 md:py-3">
                        {ticket.handled_by ? (
                          <span className={`text-xs font-medium ${ticket.handled_by === currentAdmin ? "text-red-600" : "text-gray-600"}`}>
                            {ticket.handled_by === currentAdmin ? "Me" : (ticket.handled_by_name ?? ticket.handled_by)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="pr-4 py-4 text-right">
                        {(ticket.unread_count ?? 0) > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                            {(ticket.unread_count ?? 0) > 99 ? "99+" : ticket.unread_count}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
