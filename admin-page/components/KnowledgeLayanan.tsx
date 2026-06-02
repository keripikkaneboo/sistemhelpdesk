"use client";

import { useState, useEffect, useRef } from "react";
import KnowledgeModal, { KnowledgeEntry, KnowledgeFormData } from "@/components/KnowledgeModal";
import { tipeColor, tipoLayananColor } from "@/lib/badgeColors";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import Pagination from "@/components/Pagination";
import CustomSelect from "@/components/CustomSelect";

const CACHE_KEY_KNOWLEDGE = "knowledge";
const PAGE_SIZE = 50;

export default function KnowledgeLayanan() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>(() => getCache<KnowledgeEntry>(CACHE_KEY_KNOWLEDGE) ?? []);
  const [loading, setLoading] = useState(() => !getCache<KnowledgeEntry>(CACHE_KEY_KNOWLEDGE));
  const [search, setSearch] = useState("");
  const [filterTipePengguna, setFilterTipePengguna] = useState("");
  const [filterTipeLayanan, setFilterTipeLayanan] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KnowledgeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  const CACHE_KEY = CACHE_KEY_KNOWLEDGE;

  const fetchData = async () => {
    const cached = getCache<KnowledgeEntry>(CACHE_KEY);
    if (cached) {
      setEntries(cached);
      setLoading(false);
      setApiError(null);
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error();
      const data: KnowledgeEntry[] = await res.json();
      setCache(CACHE_KEY, data);
      setEntries(data);
    } catch {
      setApiError("Tidak dapat terhubung ke database. Periksa koneksi dan konfigurasi.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    invalidateCache(CACHE_KEY);
    await fetchData();
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      e.intent.toLowerCase().includes(q) ||
      (e.tipe_pengguna ?? "").toLowerCase().includes(q) ||
      (e.deskripsi ?? "").toLowerCase().includes(q) ||
      (e.unit_pengelola ?? "").toLowerCase().includes(q);
    const matchTipePengguna = filterTipePengguna ? e.tipe_pengguna === filterTipePengguna : true;
    const matchTipeLayanan  = filterTipeLayanan  ? (e.tipe_layanan ?? "LAA") === filterTipeLayanan : true;
    return matchSearch && matchTipePengguna && matchTipeLayanan;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [filterTipePengguna, filterTipeLayanan].filter(Boolean).length;

  const resetAllFilters = () => {
    setSearch("");
    setFilterTipePengguna("");
    setFilterTipeLayanan("");
    setPage(1);
  };

  const handleSave = async (data: KnowledgeFormData) => {
    try {
      const res = await fetch(
        editTarget ? `/api/knowledge/${editTarget.id}` : "/api/knowledge",
        {
          method: editTarget ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setModalOpen(false);
      setEditTarget(null);
      refreshData();
      showToast("success", editTarget ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast("error", `Gagal menyimpan data${msg ? `: ${msg}` : ". Coba lagi."}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/knowledge/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteTarget(null);
      refreshData();
      showToast("success", "Data berhasil dihapus.");
    } catch {
      showToast("error", "Gagal menghapus data. Coba lagi.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {/* Error */}
      {apiError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
          <button onClick={refreshData} className="ml-auto underline text-red-600 hover:text-red-800 font-medium">Coba lagi</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e8edf5] overflow-hidden">
        <div className="px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 flex flex-col gap-2">
          <h2 className="text-base font-semibold text-gray-700">
            Daftar Knowledge <span className="text-gray-400 font-normal text-sm">({filtered.length} entri)</span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Multi-filter dropdown */}
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
                <div className="absolute left-0 md:left-auto md:right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-72 p-4 flex flex-col gap-4">
                  {/* Tipe Pengguna */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tipe Pengguna</label>
                    <CustomSelect
                      value={filterTipePengguna}
                      onChange={(v) => { setFilterTipePengguna(v); setPage(1); }}
                      options={[{ value: "", label: "Semua Pengguna" }, { value: "Mahasiswa", label: "Mahasiswa" }, { value: "Dosen", label: "Dosen" }]}
                    />
                  </div>

                  {/* Tipe Layanan */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tipe Layanan</label>
                    <CustomSelect
                      value={filterTipeLayanan}
                      onChange={(v) => { setFilterTipeLayanan(v); setPage(1); }}
                      options={[{ value: "", label: "Semua Tipe" }, { value: "LAA", label: "LAA" }, { value: "Referral", label: "Referral" }]}
                    />
                  </div>

                  {/* Reset */}
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

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Cari intent atau deskripsi..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition flex-1 min-w-0"
            />

            {/* Tambah Data */}
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Tambah Data
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr>
                <th className="th-cell w-10">No</th>
                <th className="th-cell">Intent</th>
                <th className="th-cell">Tipe Pengguna</th>
                <th className="th-cell">Tipe Layanan</th>
                <th className="th-cell">Deskripsi</th>
                <th className="th-cell">Platform</th>
                <th className="th-cell">Diperbarui</th>
                <th className="th-cell text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-6" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-6 bg-gray-100 rounded-full w-16" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      <div className="h-3 bg-gray-100 rounded w-56 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-40" />
                    </td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      <div className="flex justify-center gap-2">
                        <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                        <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                  {search || activeFilterCount > 0 ? "Tidak ada hasil yang cocok" : "Belum ada data knowledge"}
                </td></tr>
              ) : (
                paginated.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-800 font-medium">{entry.intent}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      {entry.tipe_pengguna
                        ? <span className={`${tipeColor(entry.tipe_pengguna)} text-xs font-medium px-2.5 py-1 rounded-full`}>{entry.tipe_pengguna}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      <span className={`${tipoLayananColor(entry.tipe_layanan ?? null)} text-xs font-medium px-2.5 py-1 rounded-full`}>
                        {entry.tipe_layanan ?? "LAA"}
                      </span>
                    </td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600 max-w-xs">
                      <p className="line-clamp-2">{entry.deskripsi || "—"}</p>
                    </td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600">{entry.platform || "—"}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-500 whitespace-nowrap">
                      {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString("id-ID") : "—"}
                    </td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditTarget(entry); setModalOpen(true); }}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteTarget(entry)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition" title="Hapus">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {modalOpen && (
        <KnowledgeModal
          entry={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSave={handleSave}
          existingEntries={entries}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Hapus Knowledge?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Data <strong>&quot;{deleteTarget.intent}&quot;</strong> akan dihapus secara permanen.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">Batal</button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
