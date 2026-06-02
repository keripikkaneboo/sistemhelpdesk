"use client";

import { useState, useEffect } from "react";
import { prodiColor } from "@/lib/badgeColors";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import Pagination from "@/components/Pagination";
import CustomSelect from "@/components/CustomSelect";

type DosenRow = {
  nip: string;
  nama: string;
  kode_dosen: string;
  nidn_nuptk: string;
  prodi: string;
};

const CACHE_KEY_DOSEN = "dosen";
const PAGE_SIZE = 50;

export default function KnowledgeDosen() {
  const [entries, setEntries] = useState<DosenRow[]>(() => getCache<DosenRow>(CACHE_KEY_DOSEN) ?? []);
  const [loading, setLoading] = useState(() => !getCache<DosenRow>(CACHE_KEY_DOSEN));
  const [search, setSearch] = useState("");
  const [filterProdi, setFilterProdi] = useState("");
  const [page, setPage] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);

  const CACHE_KEY = CACHE_KEY_DOSEN;

  const fetchData = async () => {
    const cached = getCache<DosenRow>(CACHE_KEY);
    if (cached) {
      setEntries(cached);
      setLoading(false);
      setApiError(null);
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/dosen");
      if (!res.ok) throw new Error();
      const data: DosenRow[] = await res.json();
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

  const prodiOptions = [...new Set(entries.map((e) => e.prodi).filter(Boolean))].sort();

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      e.nama.toLowerCase().includes(q) ||
      (e.nip ?? "").toLowerCase().includes(q) ||
      (e.kode_dosen ?? "").toLowerCase().includes(q) ||
      (e.prodi ?? "").toLowerCase().includes(q);
    const matchProdi = filterProdi ? e.prodi === filterProdi : true;
    return matchSearch && matchProdi;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterProdi = (v: string) => { setFilterProdi(v); setPage(1); };

  return (
    <div className="flex flex-col gap-4">
      {apiError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <span>{apiError}</span>
          <button onClick={refreshData} className="ml-auto underline text-red-600 hover:text-red-800 font-medium">Coba lagi</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-[#e8edf5] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-gray-700">
              Informasi Dosen{" "}
              <span className="text-gray-400 font-normal text-sm">({filtered.length} dosen)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Data dibaca dari tabel <span className="font-mono">users</span>. Kelola melalui menu Manajemen User.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <CustomSelect
              value={filterProdi}
              onChange={(v) => handleFilterProdi(v)}
              options={[{ value: "", label: "Semua Prodi" }, ...prodiOptions.map((p) => ({ value: p, label: p }))]}
              size="sm"
              className={filterProdi ? "border-red-400 text-red-600" : ""}
            />

            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari nama, NIP, atau kode dosen..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition w-56"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          Data dosen yang ditambahkan atau diedit akan otomatis di-embed oleh layanan auto_embedding dalam ±10 detik.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr>
                <th className="th-cell w-10">No</th>
                <th className="th-cell">NIP</th>
                <th className="th-cell">Nama</th>
                <th className="th-cell">Kode Dosen</th>
                <th className="th-cell">NIDN / NUPTK</th>
                <th className="th-cell">Program Studi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-6" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-28 font-mono" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-40" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                    <td className="px-3 py-2 md:px-6 md:py-4"><div className="h-6 bg-gray-100 rounded-full w-28" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  {search || filterProdi ? "Tidak ada hasil yang cocok" : "Belum ada data dosen"}
                </td></tr>
              ) : (
                paginated.map((entry, idx) => (
                  <tr key={entry.nip || idx} className="hover:bg-slate-50/80 transition">
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600 font-mono text-xs">{entry.nip || "—"}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-800 font-medium">{entry.nama}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600">{entry.kode_dosen || "—"}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4 text-gray-600">{entry.nidn_nuptk || "—"}</td>
                    <td className="px-3 py-2 md:px-6 md:py-4">
                      {entry.prodi
                        ? <span className={`${prodiColor(entry.prodi)} text-xs font-medium px-2.5 py-1 rounded-full`}>{entry.prodi}</span>
                        : <span className="text-gray-400">—</span>}
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
    </div>
  );
}
