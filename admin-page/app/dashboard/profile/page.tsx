"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", nip: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", nip: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.nama) setProfile({ name: data.nama, nip: data.nim_nip ?? "" });
      })
      .catch(() => {});
  }, []);

  const startEditingProfile = () => {
    setProfileForm({ name: profile.name, nip: profile.nip });
    setProfileError("");
    setEditingProfile(true);
  };

  const handleProfileSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileError("");
    if (!profileForm.name.trim() || !profileForm.nip.trim()) {
      setProfileError("Nama dan NIP wajib diisi.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: profileForm.name.trim(), nip: profileForm.nip.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json.error || "Gagal memperbarui profil.");
        return;
      }
      setProfile({ name: json.data.nama, nip: json.data.nip });
      setEditingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError("Tidak dapat terhubung ke server.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError("");
    if (passwords.new.length < 6) {
      setPasswordError("Password baru minimal 6 karakter.");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPasswordError("Konfirmasi password tidak cocok.");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: passwords.new }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error || "Gagal mengubah password.");
        return;
      }
      setPasswordSaved(true);
      setPasswords({ new: "", confirm: "" });
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      setPasswordError("Tidak dapat terhubung ke server.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4 md:p-8">
      <div className="mb-6 page-header animate-fade-up">
        <h1 className="text-2xl font-bold text-gray-800">Edit Profil</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola informasi akun admin</p>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Profile banner card */}
        <div className="rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#1e2a3a] px-6 py-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0">
              <Image
                src="/logo-fte.png"
                alt="avatar"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-white font-semibold text-base">{profile.name || "..."}</p>
              <p className="text-white/60 text-sm">{profile.nip || "..."}</p>
            </div>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
            <span className="inline-block bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Administrator
            </span>
            <span className="text-gray-400 text-xs">Fakultas Teknik Elektro · Telkom University</span>
          </div>
        </div>

        {/* Informasi Akun */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-red-600 rounded-full shrink-0" />
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Informasi Akun</h2>
            </div>
            {!editingProfile && (
              <button
                onClick={startEditingProfile}
                className="text-red-600 text-sm font-bold hover:underline shrink-0"
              >
                Ubah
              </button>
            )}
          </div>

          {editingProfile ? (
            <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Nama</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nama lengkap..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">NIP</label>
                <input
                  type="text"
                  value={profileForm.nip}
                  onChange={(e) => setProfileForm((p) => ({ ...p, nip: e.target.value }))}
                  placeholder="NIP..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition w-full"
                />
              </div>

              {profileError && <p className="text-red-500 text-sm">{profileError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingProfile(false); setProfileError(""); }}
                  className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm shadow-red-600/25 disabled:opacity-60"
                >
                  {profileSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500 font-medium">Nama</span>
                <span className="text-sm font-semibold text-gray-800">{profile.name || "..."}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500 font-medium">NIP</span>
                <span className="text-sm font-semibold text-gray-800 font-mono">{profile.nip || "..."}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500 font-medium">Role</span>
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">Administrator</span>
              </div>
              {profileSaved && (
                <p className="text-green-600 text-sm flex items-center gap-2 pt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Profil berhasil diperbarui
                </p>
              )}
            </div>
          )}
        </div>

        {/* Change password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 bg-orange-500 rounded-full shrink-0" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Ganti Password</h2>
          </div>
          <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Password Baru</label>
              <div className="relative">
                <input
                  type="text"
                  value={passwords.new}
                  onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                  placeholder="Minimal 6 karakter..."
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition w-full"
                  style={{ WebkitTextSecurity: showNewPassword ? "none" : "disc" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                  aria-label={showNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Konfirmasi Password Baru</label>
              <div className="relative">
                <input
                  type="text"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                  placeholder="Ulangi password baru..."
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition w-full"
                  style={{ WebkitTextSecurity: showConfirmPassword ? "none" : "disc" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
            {passwordSaved && (
              <p className="text-green-600 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Password berhasil diubah
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="px-5 py-2 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm shadow-red-600/25 disabled:opacity-60"
              >
                {passwordSaving ? "Menyimpan..." : "Ganti Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
