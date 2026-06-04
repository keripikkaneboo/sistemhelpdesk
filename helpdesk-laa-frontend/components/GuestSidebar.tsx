"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuestSidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [modalType, setModalType] = useState<"tiket" | "profil" | null>(null);

  const isChat = pathname === "/guest";

  const MODAL_CONTENT = {
    tiket: {
      title: "Butuh Bantuan Lebih Lanjut?",
      description:
        "Apabila pertanyaan Anda membutuhkan penanganan khusus dari admin LAA, silakan login terlebih dahulu untuk membuat tiket.",
    },
    profil: {
      title: "Kelola Profil Anda",
      description: "Untuk mengubah profil, silakan login terlebih dahulu.",
    },
  };

  return (
    <>
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:shrink-0
          ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Profil */}
          <div className="relative p-6 flex flex-col items-center border-b border-gray-100 bg-gray-50/30">
            <button
              className="absolute top-4 right-4 md:hidden text-gray-400 hover:text-red-600 focus:outline-none"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-20 h-20 rounded-full border-2 border-gray-400 p-1 mb-3 shadow-md bg-white">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                <img
                  src={`https://ui-avatars.com/api/?name=G&background=6B7280&color=fff&bold=true`}
                  alt="Guest"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="text-center">
              <h2
                onClick={() => setModalType("profil")}
                className="text-lg font-bold text-gray-800 leading-tight cursor-pointer hover:text-red-600 transition-colors"
                title="Login untuk akses profil"
              >
                Guest
              </h2>
              <div className="mt-2 inline-block px-3 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                TAMU
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            {/* Menu Utama */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu Utama</p>
              <nav className="space-y-1">
                <button
                  onClick={() => { router.push("/guest"); onClose(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg font-medium transition flex items-center gap-3 ${
                    isChat ? "bg-red-50 text-red-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  💬 Chat Baru
                </button>
                <button
                  onClick={() => setModalType("tiket")}
                  className="w-full text-left px-3 py-2.5 rounded-lg font-medium transition flex items-center gap-3 text-gray-400 hover:bg-gray-50 cursor-pointer"
                  title="Login diperlukan"
                >
                  🎫 Daftar Tiket
                  <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-normal">Login</span>
                </button>
              </nav>
            </div>

            {/* Layanan Cepat */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Layanan Cepat</p>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="https://igracias.telkomuniversity.ac.id/index.php" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                    🔗 iGracias Tel-U
                  </a>
                </li>
                <li>
                  <a href="https://lms.telkomuniversity.ac.id/" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                    🔗 CeLOE LMS
                  </a>
                </li>
                <li>
                  <a href="https://linktr.ee/laa.fte" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-red-600 rounded-lg transition">
                    🔗 Web Fakultas
                  </a>
                </li>
              </ul>
            </div>

            {/* Info Guest */}
            <div className="px-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p className="font-semibold mb-1">Mode Tamu</p>
                <p>Riwayat chat tidak disimpan. Login untuk fitur lengkap.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-white">
            <h1 className="text-xl font-bold text-red-700 tracking-tight">LAA FTE</h1>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Telkom University</p>
          </div>
        </div>
      </aside>

      {/* Modal Login Required */}
      {modalType && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setModalType(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7 text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
              {MODAL_CONTENT[modalType].title}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              {MODAL_CONTENT[modalType].description}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalType(null)}
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
    </>
  );
}
