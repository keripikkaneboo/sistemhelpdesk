"use client";

import { useState, useEffect, useRef } from "react";
import UserModal, { UserEntry, UserFormData, UserRole } from "@/components/UserModal";
import { prodiColor } from "@/lib/badgeColors";
import { getCache, setCache, invalidateCache } from "@/lib/dataCache";
import Pagination from "@/components/Pagination";
import CustomSelect from "@/components/CustomSelect";

const TABS: { key: UserRole; label: string }[] = [
  { key: "mahasiswa", label: "Mahasiswa" },
  { key: "dosen",     label: "Dosen" },
  { key: "admin",     label: "Admin" },
];

const CSV_HEADERS: Record<UserRole, string[]> = {
  mahasiswa: ["NIM (Nomor Induk Mahasiswa)", "Nama", "Kelas"],  // format export iGracias
  dosen:     ["nip", "nama pegawai", "fakultas/unit", "prodi/lokasi kerja", "kode dosen", "nidn_nuptk"],
  admin:     ["nama", "nip"],
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/﻿/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(delim).map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ""));
}

type UploadResult = { inserted: number; skipped: number; errors: string[] } | null;

const PAGE_SIZE = 50;

export default function UserManagement() {
  const [tab, setTab] = useState<UserRole>("mahasiswa");
  const [entries, setEntries] = useState<UserEntry[]>(() => getCache<UserEntry>("users_mahasiswa") ?? []);
  const [loading, setLoading] = useState(() => !getCache<UserEntry>("users_mahasiswa"));
  const [search, setSearch] = useState("");
  const [filterProdi, setFilterProdi] = useState("");
  const [filterKelas, setFilterKelas] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserEntry | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    const cacheKey = `users_${tab}`;
    const cached = getCache<UserEntry>(cacheKey);
    if (cached) {
      setEntries(cached);
      setLoading(false);
      setApiError(null);
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const url = tab === "admin" ? "/api/users/admin" : `/api/users?role=${tab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const raw: (Omit<UserEntry, "role">)[] = await res.json();
      const data: UserEntry[] = tab === "admin"
        ? raw.map((u) => ({ ...u, role: "admin" as const }))
        : raw as UserEntry[];
      setCache(cacheKey, data);
      setEntries(data);
    } catch {
      setApiError("Tidak dapat terhubung ke database. Periksa koneksi dan konfigurasi.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    invalidateCache(`users_${tab}`);
    await fetchData();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node))
        setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setSearch("");
    setFilterProdi("");
    setFilterKelas("");
    setFilterOpen(false);
    setSelected(new Set());
    setUploadResult(null);
    setPage(1);
    const cached = getCache<UserEntry>(`users_${tab}`);
    if (cached) {
      setEntries(cached);
      setLoading(false);
    } else {
      setEntries([]);
      setLoading(true);
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const prodiOptions = [...new Set(entries.map((e) => e.prodi).filter(Boolean))].sort() as string[];
  const kelasOptions = tab === "mahasiswa"
    ? ([...new Set(entries.map((e) => e.kelas).filter(Boolean))].sort() as string[])
    : [];

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      e.nama.toLowerCase().includes(q) ||
      (e.nim_nip ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.prodi ?? "").toLowerCase().includes(q) ||
      (e.kode_dosen ?? "").toLowerCase().includes(q);
    const matchProdi = filterProdi ? e.prodi === filterProdi : true;
    const matchKelas = filterKelas ? e.kelas === filterKelas : true;
    return matchSearch && matchProdi && matchKelas;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [filterProdi, filterKelas].filter(Boolean).length;
  const resetAllFilters = () => { setSearch(""); setFilterProdi(""); setFilterKelas(""); setPage(1); };

  // Checkbox helpers — operate on current page only
  const allPageSelected = paginated.length > 0 && paginated.every((e) => selected.has(e.id));
  const somePageSelected = paginated.some((e) => selected.has(e.id));
  const someSelected = filtered.some((e) => selected.has(e.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedCount = [...selected].filter((id) => filtered.some((e) => e.id === id)).length;

  const handleSave = async (data: UserFormData) => {
    try {
      let url: string;
      let body: Record<string, unknown>;

      if (tab === "admin") {
        url = editTarget ? `/api/users/admin/${editTarget.id}` : "/api/users/admin";
        body = {
          nama: data.nama,
          nip: data.nim_nip,
          reset_password: data.reset_password,
        };
      } else {
        url = editTarget ? `/api/users/${editTarget.id}` : "/api/users";
        body = { ...data, role: tab };
      }

      const res = await fetch(url, {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setModalOpen(false);
      setEditTarget(null);
      refreshData();
      showToast("success", editTarget ? "Data berhasil diperbarui." : "User berhasil ditambahkan.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      showToast("error", `Gagal menyimpan data${msg ? `: ${msg}` : ". Coba lagi."}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const url = tab === "admin"
        ? `/api/users/admin/${deleteTarget.id}`
        : `/api/users/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteTarget(null);
      setSelected((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
      refreshData();
      showToast("success", "User berhasil dihapus.");
    } catch {
      showToast("error", "Gagal menghapus user. Coba lagi.");
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected].filter((id) => filtered.some((e) => e.id === id));
    try {
      if (tab === "admin") {
        await Promise.all(ids.map((id) => fetch(`/api/users/admin/${id}`, { method: "DELETE" })));
        setBulkDeleteOpen(false);
        setSelected(new Set());
        refreshData();
        showToast("success", `${ids.length} admin berhasil dihapus.`);
      } else {
        const res = await fetch("/api/users/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error();
        const { deleted } = await res.json();
        setBulkDeleteOpen(false);
        setSelected(new Set());
        refreshData();
        showToast("success", `${deleted} user berhasil dihapus.`);
      }
    } catch {
      showToast("error", "Gagal menghapus user. Coba lagi.");
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadResult(null);
    try {
      const rows = parseCSV(await file.text());
      if (rows.length === 0) { showToast("error", "File CSV kosong atau format tidak sesuai."); return; }
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: tab, rows }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload gagal");
      setUploadResult(result);
      refreshData();
      showToast("success", `Upload selesai: ${result.inserted} berhasil, ${result.skipped} dilewati.`);
    } catch (err) {
      showToast("error", `Gagal upload CSV${err instanceof Error ? `: ${err.message}` : "."}`);
    } finally {
      setUploading(false);
    }
  };

  const idLabel = tab === "mahasiswa" ? "NIM" : "NIP";
  const tabLabel = TABS.find((t) => t.key === tab)!.label;
  const colSpan = tab === "mahasiswa" ? 8 : tab === "dosen" ? 8 : 5;

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
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

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5 w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              tab === key ? "bg-red-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
            }`}>
            {label}
          </button>
        ))}
      </div>

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

      {/* Upload result errors */}
      {uploadResult && uploadResult.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg flex flex-col gap-1">
          <p className="font-medium">Beberapa baris gagal diimport:</p>
          <ul className="list-disc list-inside text-xs text-amber-700 max-h-24 overflow-y-auto">
            {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-[#e8edf5] overflow-hidden">
        {/* Header toolbar */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-700">
              Daftar {tabLabel}{" "}
              <span className="text-gray-400 font-normal text-sm">({filtered.length} user)</span>
            </h2>
            {/* Bulk delete button */}
            {someSelected && (
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-medium px-3 py-1.5 rounded-lg transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Hapus {selectedCount} Terpilih
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-filter */}
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
                <div className="absolute left-0 md:left-auto md:right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-64 p-4 flex flex-col gap-4">
                  {/* Prodi — hanya untuk mahasiswa dan dosen */}
                  {tab !== "admin" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Program Studi</label>
                      <CustomSelect
                        value={filterProdi}
                        onChange={(v) => { setFilterProdi(v); setPage(1); }}
                        options={[{ value: "", label: "Semua Prodi" }, ...prodiOptions.map((p) => ({ value: p, label: p }))]}
                      />
                    </div>
                  )}

                  {/* Kelas — hanya untuk tab Mahasiswa */}
                  {tab === "mahasiswa" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Kelas</label>
                      <CustomSelect
                        value={filterKelas}
                        onChange={(v) => { setFilterKelas(v); setPage(1); }}
                        options={[{ value: "", label: "Semua Kelas" }, ...kelasOptions.map((k) => ({ value: k, label: k }))]}
                      />
                    </div>
                  )}

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

            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={`Cari nama, ${idLabel}...`}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition flex-1 min-w-0" />

            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />

            {/* Upload CSV + Tambah — desktop only */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={`Format: ${CSV_HEADERS[tab].join(" ; ")}`}
              className="hidden md:flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {uploading
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" /></svg>
              }
              Upload CSV
            </button>
            <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="hidden md:flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Tambah {tabLabel}
            </button>

            {/* Dropdown Tambah — mobile only */}
            <div className="relative shrink-0 md:hidden" ref={addMenuRef}>
              <button
                onClick={() => setAddMenuOpen((p) => !p)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah {tabLabel}
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${addMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-44 overflow-hidden">
                  <button
                    onClick={() => { setEditTarget(null); setModalOpen(true); setAddMenuOpen(false); }}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Tambah Satuan
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setAddMenuOpen(false); }}
                    disabled={uploading}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {uploading
                      ? <svg className="w-4 h-4 animate-spin text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" /></svg>
                    }
                    Upload CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CSV hint */}
        <div className="px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
          Format CSV ({tabLabel}): <span className="font-mono">{CSV_HEADERS[tab].join(" ; ")}</span>
          {" — "}password default = {idLabel}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr>
                <th className="th-cell w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                </th>
                <th className="th-cell w-10">No</th>
                <th className="th-cell">Nama</th>
                <th className="th-cell">{idLabel}</th>
                {tab === "dosen" && <th className="th-cell">Kode</th>}
                {tab === "dosen" && <th className="th-cell">NIDN/NUPTK</th>}
                {tab !== "admin" && <th className="th-cell">Email</th>}
                {tab !== "admin" && <th className="th-cell">Program Studi</th>}
                {tab === "mahasiswa" && <th className="th-cell">Kelas</th>}
                <th className="th-cell text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-4 h-4 bg-gray-100 rounded" /></td>
                    <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-6 h-4 bg-gray-100 rounded" /></td>
                    <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-36 h-4 bg-gray-100 rounded" /></td>
                    <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-24 h-4 bg-gray-100 rounded font-mono" /></td>
                    {tab === "dosen" && <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-16 h-4 bg-gray-100 rounded" /></td>}
                    {tab === "dosen" && <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-20 h-4 bg-gray-100 rounded" /></td>}
                    {tab !== "admin" && <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-40 h-4 bg-gray-100 rounded" /></td>}
                    {tab !== "admin" && <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-24 h-6 bg-gray-100 rounded-full" /></td>}
                    {tab === "mahasiswa" && <td className="px-2 py-2 md:px-4 md:py-4"><div className="w-16 h-4 bg-gray-100 rounded" /></td>}
                    <td className="px-2 py-2 md:px-4 md:py-4">
                      <div className="flex justify-center gap-2">
                        <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                        <div className="w-7 h-7 bg-gray-100 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={colSpan} className="px-6 py-12 text-center text-gray-400">
                  {search || activeFilterCount > 0 ? "Tidak ada hasil yang cocok" : `Belum ada data ${tabLabel.toLowerCase()}`}
                </td></tr>
              ) : (
                paginated.map((entry, idx) => (
                  <tr key={entry.id} className={`transition ${selected.has(entry.id) ? "bg-red-50" : "hover:bg-slate-50/80"}`}>
                    <td className="px-2 py-2 md:px-4 md:py-4">
                      <input type="checkbox" checked={selected.has(entry.id)}
                        onChange={() => toggleOne(entry.id)}
                        className="w-4 h-4 accent-red-600 cursor-pointer" />
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-gray-800 font-medium">{entry.nama}</td>
                    <td className="px-2 py-2 md:px-4 md:py-4 text-gray-600 font-mono text-xs">{entry.nim_nip || "—"}</td>
                    {tab === "dosen" && <td className="px-2 py-2 md:px-4 md:py-4 text-gray-600">{entry.kode_dosen || "—"}</td>}
                    {tab === "dosen" && <td className="px-2 py-2 md:px-4 md:py-4 text-gray-600">{entry.nidn_nuptk || "—"}</td>}
                    {tab !== "admin" && <td className="px-2 py-2 md:px-4 md:py-4 text-gray-600">{entry.email || "—"}</td>}
                    {tab !== "admin" && (
                      <td className="px-2 py-2 md:px-4 md:py-4">
                        {entry.prodi
                          ? <span className={`${prodiColor(entry.prodi)} text-xs font-medium px-2.5 py-1 rounded-full`}>{entry.prodi}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    )}
                    {tab === "mahasiswa" && <td className="px-2 py-2 md:px-4 md:py-4 text-gray-600">{entry.kelas || "—"}</td>}
                    <td className="px-2 py-2 md:px-4 md:py-4">
                      <div className="flex items-center justify-center gap-2">
                        {tab !== 'admin' && (
                        <button onClick={() => { setEditTarget(entry); setModalOpen(true); }}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        )}
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

      {/* Modal tambah/edit */}
      {modalOpen && (
        <UserModal role={tab} entry={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSave={handleSave} />
      )}

      {/* Modal hapus satu */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Hapus User?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Data <strong>&quot;{deleteTarget.nama}&quot;</strong> akan dihapus secara permanen.
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

      {/* Modal bulk delete */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Hapus {selectedCount} User?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Semua data yang dipilih akan dihapus secara permanen dan tidak dapat dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkDeleteOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">Batal</button>
              <button onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition">Hapus Semua</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
