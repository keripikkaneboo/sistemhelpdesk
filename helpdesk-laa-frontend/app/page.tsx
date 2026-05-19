"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import anime from "animejs";

function RobotMascot({ isFocused }: { isFocused: boolean }) {
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const eyeLineRef = useRef<SVGGElement>(null);
  const openEyesRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const leftWhiteRef = useRef<SVGCircleElement>(null);
  const rightWhiteRef = useRef<SVGCircleElement>(null);
  const visorRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isFocused) return;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const pupilX = Math.max(-6, Math.min(6, (e.clientX - windowWidth / 2) / 100));
      const pupilY = Math.max(-4, Math.min(4, (e.clientY - windowHeight / 2) / 100));
      const whiteX = Math.max(-4, Math.min(4, (e.clientX - windowWidth / 2) / 140));
      const whiteY = Math.max(-3, Math.min(3, (e.clientY - windowHeight / 2) / 140));
      const visorX = Math.max(-2, Math.min(2, (e.clientX - windowWidth / 2) / 250));
      const visorY = Math.max(-1.5, Math.min(1.5, (e.clientY - windowHeight / 2) / 250));
      anime({ targets: [leftPupilRef.current, rightPupilRef.current], translateX: pupilX, translateY: pupilY, duration: 800, easing: "easeOutElastic(1, .5)" });
      anime({ targets: [leftWhiteRef.current, rightWhiteRef.current], translateX: whiteX, translateY: whiteY, duration: 900, easing: "easeOutElastic(1, .4)" });
      anime({ targets: visorRef.current, translateX: visorX, translateY: visorY, duration: 1000, easing: "easeOutQuad" });
      anime({ targets: mouthRef.current, translateX: visorX, translateY: visorY, duration: 1000, easing: "easeOutQuad" });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) {
      anime({ targets: openEyesRef.current, opacity: 0, scaleY: 0.1, duration: 200, easing: "easeOutQuad" });
      anime({ targets: eyeLineRef.current, opacity: 1, duration: 300, delay: 100, easing: "easeInQuad" });
      anime({ targets: mouthRef.current, d: [{ value: "M45 74 Q60 74 75 74" }], duration: 200, easing: "easeOutQuad" });
    } else {
      anime({ targets: eyeLineRef.current, opacity: 0, duration: 200, easing: "easeOutQuad" });
      anime({ targets: openEyesRef.current, opacity: 1, scaleY: 1, duration: 400, delay: 100, easing: "easeOutElastic(1, .6)" });
      anime({ targets: mouthRef.current, d: [{ value: "M45 72 Q60 82 75 72" }], duration: 400, delay: 150, easing: "easeOutElastic(1, .6)" });
    }
  }, [isFocused]);

  return (
    <div className="flex justify-center mb-6">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="58" y="5" width="4" height="15" fill="#B91C1C" />
        <circle cx="60" cy="5" r="4" fill="#EF4444" />
        <rect x="25" y="20" width="70" height="65" rx="10" fill="#EF4444" stroke="#B91C1C" strokeWidth="3" />
        <rect ref={visorRef} x="35" y="35" width="50" height="25" rx="5" fill="#7F1D1D" />
        <g ref={openEyesRef} style={{ transformOrigin: "60px 47px" }}>
          <circle ref={leftWhiteRef} cx="47" cy="47" r="8" fill="white" />
          <circle ref={rightWhiteRef} cx="73" cy="47" r="8" fill="white" />
          <circle ref={leftPupilRef} cx="47" cy="47" r="4" fill="black" />
          <circle ref={rightPupilRef} cx="73" cy="47" r="4" fill="black" />
        </g>
        <g ref={eyeLineRef} opacity="0">
          <path d="M40 47H54" stroke="white" strokeWidth="4" strokeLinecap="round" className="animate-pulse" />
          <path d="M66 47H80" stroke="white" strokeWidth="4" strokeLinecap="round" className="animate-pulse" />
        </g>
        <path ref={mouthRef} d="M45 72 Q60 82 75 72" stroke="#B91C1C" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [nimNip, setNimNip] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotNimInput, setForgotNimInput] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Cek token reset password dari URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = new URLSearchParams(window.location.search).get("token");
      if (token) setResetToken(token);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nimNip, password }),
      });
      const result = await res.json();
      if (result.status === "success") {
        router.push("/dashboard/chat");
      } else {
        setLoginError(result.message);
      }
    } catch {
      setLoginError("Gagal terhubung ke server database.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <main className="flex items-center justify-center h-screen bg-gray-50 px-4 relative z-10">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          <RobotMascot isFocused={isInputFocused} />
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-red-700 mb-2">Helpdesk LAA FTE</h1>
            <p className="text-gray-500 text-sm">Silakan login untuk mengakses layanan kami</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="nimNip" className="block text-sm font-medium text-gray-700 mb-1">
                NIM Mahasiswa / NIP Dosen
              </label>
              <input
                id="nimNip"
                type="text"
                autoComplete="off"
                value={nimNip}
                onChange={(e) => setNimNip(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Masukkan NIM atau NIP..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Masukkan password..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{loginError}</div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-70 flex justify-center items-center"
            >
              {isLoggingIn ? "Memeriksa..." : "Masuk"}
            </button>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-sm text-red-600 hover:underline font-medium"
              >
                Lupa Password?
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Modal Reset Password (dari link email) */}
      {resetToken && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative">
            <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">Buat Password Baru</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Silakan masukkan password baru untuk akun Anda.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsUpdatingPassword(true);
                try {
                  const res = await fetch("/api/auth/update-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: resetToken, newPassword }),
                  });
                  const result = await res.json();
                  if (result.status === "success") {
                    alert("Password berhasil diubah! Silakan login menggunakan password baru.");
                    setResetToken(null);
                    setNewPassword("");
                    window.history.replaceState({}, document.title, "/");
                  } else {
                    alert(result.message);
                  }
                } catch { alert("Gagal menghubungi server."); }
                finally { setIsUpdatingPassword(false); }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition"
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition shadow-md mt-2"
              >
                {isUpdatingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lupa Password */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-6">
              Masukkan NIM/NIP Anda. Kami akan mengirimkan link reset ke email yang terdaftar.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Masukkan NIM atau NIP..."
                value={forgotNimInput}
                onChange={(e) => setForgotNimInput(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button
                  disabled={isSendingReset || !forgotNimInput}
                  onClick={async () => {
                    setIsSendingReset(true);
                    try {
                      const res = await fetch("/api/auth/reset-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nimNip: forgotNimInput }),
                      });
                      const result = await res.json();
                      if (result.status === "success") {
                        alert("Link reset password telah dikirim ke email Anda. Silakan cek Inbox/Spam.");
                        setIsForgotModalOpen(false);
                        setForgotNimInput("");
                      } else {
                        alert(result.message);
                      }
                    } catch { alert("Gagal menghubungi server."); }
                    finally { setIsSendingReset(false); }
                  }}
                  className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {isSendingReset ? "Mengirim..." : "Kirim Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
