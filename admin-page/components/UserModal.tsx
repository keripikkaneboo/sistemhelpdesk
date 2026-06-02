"use client";

import { useEffect, useState } from "react";
import CustomSelect from "@/components/CustomSelect";

export type UserRole = "mahasiswa" | "dosen" | "admin";

export type UserEntry = {
  id: number;
  role: UserRole;
  nim_nip: string;
  nama: string;
  email?: string;
  prodi?: string;
  kelas?: string;
  kode_dosen?: string;
  nidn_nuptk?: string;
};

export type UserFormData = Omit<UserEntry, "id"> & { reset_password?: boolean };

type Props = {
  role: UserRole;
  entry?: UserEntry | null;
  onClose: () => void;
  onSave: (data: UserFormData) => void;
};

const PRODI_OPTIONS = [
  "S1 Teknik Elektro",
  "S1 Teknik Komputer",
  "S1 Teknik Telekomunikasi",
  "S1 Teknik Fisika",
  "S1 Teknik Biomedis",
  "S2 Teknik Elektro",
  "S3 Teknik Elektro",
];

const EMPTY: UserFormData = {
  role: "mahasiswa",
  nim_nip: "", nama: "", email: "", prodi: "",
  kelas: "", kode_dosen: "", nidn_nuptk: "", reset_password: false,
};

export default function UserModal({ role, entry, onClose, onSave }: Props) {
  const [form, setForm] = useState<UserFormData>({ ...EMPTY, role });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(entry ? { ...EMPTY, ...entry, reset_password: false } : { ...EMPTY, role });
    setError("");
  }, [entry, role]);

  const set = (key: keyof UserFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const idLabel = role === "mahasiswa" ? "NIM" : "NIP";
  const roleLabel = role === "mahasiswa" ? "Mahasiswa" : role === "dosen" ? "Dosen" : "Admin";

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.nama.trim()) { setError("Nama wajib diisi."); return; }
    if (!form.nim_nip.trim()) { setError(`${idLabel} wajib diisi.`); return; }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            {entry ? `Edit ${roleLabel}` : `Tambah ${roleLabel} Baru`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">

            {/* Nama */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Nama <span className="text-red-500">*</span></label>
              <input type="text" value={form.nama} onChange={(e) => set("nama", e.target.value)}
                placeholder="Masukkan nama lengkap..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
            </div>

            {/* NIM / NIP */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{idLabel} <span className="text-red-500">*</span></label>
              <input type="text" value={form.nim_nip} onChange={(e) => set("nim_nip", e.target.value)}
                placeholder={`Masukkan ${idLabel}...`}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
              {!entry && <p className="text-xs text-gray-400">Password default akan disamakan dengan {idLabel}.</p>}
            </div>

            {/* Dosen: Kode Dosen */}
            {role === "dosen" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Kode Dosen</label>
                <input type="text" value={form.kode_dosen ?? ""} onChange={(e) => set("kode_dosen", e.target.value)}
                  placeholder="Contoh: JKR"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
              </div>
            )}

            {/* Dosen: NIDN / NUPTK */}
            {role === "dosen" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">NIDN / NUPTK</label>
                <input type="text" value={form.nidn_nuptk ?? ""} onChange={(e) => set("nidn_nuptk", e.target.value)}
                  placeholder="Masukkan NIDN atau NUPTK..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
              </div>
            )}

            {/* Email — hanya mahasiswa dan dosen */}
            {role !== "admin" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)}
                  placeholder="Masukkan email..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
              </div>
            )}

            {/* Prodi — hanya mahasiswa dan dosen */}
            {role !== "admin" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Program Studi</label>
                <CustomSelect
                  value={form.prodi ?? ""}
                  onChange={(v) => set("prodi", v)}
                  size="sm"
                  placeholder="-- Pilih Program Studi --"
                  options={[{ value: "", label: "-- Pilih Program Studi --" }, ...PRODI_OPTIONS.map((p) => ({ value: p, label: p }))]}
                />
              </div>
            )}

            {/* Mahasiswa: Kelas */}
            {role === "mahasiswa" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Kelas</label>
                <input type="text" value={form.kelas ?? ""} onChange={(e) => set("kelas", e.target.value)}
                  placeholder="Contoh: TK-44-01"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 transition" />
              </div>
            )}

            {/* Reset password — hanya saat edit */}
            {entry && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.reset_password ?? false}
                  onChange={(e) => set("reset_password", e.target.checked)}
                  className="w-4 h-4 accent-red-600" />
                <span className="text-sm text-gray-600">
                  Reset password ke {idLabel} <span className="font-medium text-gray-800">{form.nim_nip}</span>
                </span>
              </label>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Batal
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
              {entry ? "Simpan Perubahan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
