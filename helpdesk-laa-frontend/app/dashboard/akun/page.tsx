"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";

export default function AkunPage() {
  const router = useRouter();
  const { nimNip, userName, userRole, userEmail, setUserEmail } = useUser();

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      {/* Header */}
      <header className="bg-red-700 text-white px-4 py-3 flex items-center shadow-sm z-10 gap-4 shrink-0">
        <button
          className="p-1.5 -ml-1 rounded-full hover:bg-red-800 transition focus:outline-none"
          onClick={() => router.push("/dashboard/chat")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-7">
          <h2 className="text-base font-bold">Profil Pengguna</h2>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 flex flex-col min-h-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1">

          {/* Profil — layout horizontal agar hemat ruang */}
          <div className="bg-red-50 px-6 py-4 flex items-center gap-4 border-b border-gray-100 shrink-0">
            <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || "U")}&background=E11D48&color=fff&size=96&bold=true`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 leading-tight">{userName || "..."}</h2>
              <p className="text-red-600 font-semibold text-xs uppercase tracking-widest mt-0.5">{userRole}</p>
            </div>
          </div>

          {/* Detail */}
          <div className="px-6 py-4 space-y-4 flex-1">
            {/* NIM/NIP */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500 font-medium">Username (NIM/NIP)</span>
              <span className="text-gray-800 font-bold text-sm">{nimNip}</span>
            </div>

            {/* Email */}
            <div className="flex flex-col border-b border-gray-100 pb-3 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-medium">Alamat Email</span>
                {!userEmail && !isEditingEmail && (
                  <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">Harus Diisi</span>
                )}
              </div>
              {isEditingEmail ? (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="nama@email.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <button
                    onClick={async () => {
                      if (!newEmailInput.includes("@")) return alert("Format email tidak valid");
                      setIsUpdatingEmail(true);
                      try {
                        const res = await fetch("/api/auth/update-email", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: newEmailInput }),
                        });
                        const result = await res.json();
                        if (result.status === "success") {
                          setUserEmail(newEmailInput);
                          setIsEditingEmail(false);
                          alert("Email berhasil tersimpan permanen!");
                        } else {
                          alert(result.message);
                        }
                      } catch { alert("Gagal terhubung ke server untuk update email."); }
                      finally { setIsUpdatingEmail(false); }
                    }}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 shrink-0"
                    disabled={isUpdatingEmail}
                  >
                    {isUpdatingEmail ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-sm">{userEmail || "Belum diatur"}</span>
                  <button
                    onClick={() => { setNewEmailInput(userEmail); setIsEditingEmail(true); }}
                    className="text-red-600 text-sm font-bold hover:underline shrink-0 ml-2"
                  >
                    {userEmail ? "Ubah" : "Atur Sekarang"}
                  </button>
                </div>
              )}
            </div>

            {/* Keamanan Akun */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Keamanan Akun</h3>
              <button
                disabled={!userEmail}
                onClick={async () => {
                  setPasswordStatus("Sedang memproses permintaan...");
                  try {
                    const res = await fetch("/api/auth/reset-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nimNip }),
                    });
                    const result = await res.json();
                    if (result.status === "success") {
                      setPasswordStatus(`Link konfirmasi telah dikirim ke ${userEmail}. Silakan cek kotak masuk Anda.`);
                    } else {
                      setPasswordStatus("Gagal mengirim email. Pastikan data profil benar.");
                    }
                  } catch {
                    setPasswordStatus("Terjadi kesalahan jaringan/teknis saat mengirim email.");
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition shadow-sm text-sm ${
                  userEmail ? "bg-gray-800 text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                Ubah Password
              </button>
              {!userEmail && (
                <p className="text-[10px] text-center text-gray-400 mt-1.5">
                  *Lengkapi email terlebih dahulu untuk mengaktifkan fitur ubah password
                </p>
              )}
              {passwordStatus && (
                <p className="text-xs text-center text-green-600 font-medium mt-2 bg-green-50 p-2 rounded-lg">{passwordStatus}</p>
              )}
            </div>
          </div>

          {/* Logout */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-white text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-50 transition shadow-sm text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
