import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { MFAVerify } from "./MFAVerify";
import { supabase } from "../../supabaseClient";
import { checkRateLimit, resetRateLimit } from "../../utils/security";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, completeMFAVerification, mfaRequired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMFAVerify, setShowMFAVerify] = useState(false);
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Rate limiting state
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check rate limit before attempting login
    const rateLimitKey = `login:${email.toLowerCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      lockoutMs: 30 * 60 * 1000, // 30 minutes
    });

    if (!rateCheck.allowed) {
      setLockedUntil(rateCheck.lockedUntil || null);
      const minutes = rateCheck.lockedUntil
        ? Math.ceil((rateCheck.lockedUntil.getTime() - Date.now()) / 60000)
        : 30;
      setError(`Quá nhiều lần thử. Vui lòng đợi ${minutes} phút.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);
      // Reset rate limit on successful login
      resetRateLimit(rateLimitKey);

      if (result.mfaRequired) {
        // Show MFA verification screen
        setShowMFAVerify(true);
        setIsLoading(false);
        return;
      }

      showToast.success("Đăng nhập thành công!");
      navigate("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Đăng nhập thất bại";

      // Check remaining attempts
      const remainingCheck = checkRateLimit(rateLimitKey);
      if (remainingCheck.remainingAttempts > 0) {
        setError(
          `${errorMessage}. Còn ${remainingCheck.remainingAttempts} lần thử.`
        );
      } else {
        setLockedUntil(remainingCheck.lockedUntil || null);
        setError(`${errorMessage}. Tài khoản tạm khóa 30 phút.`);
      }
      showToast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      showToast.error("Vui lòng nhập email");
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetSent(true);
      showToast.success("Đã gửi email đặt lại mật khẩu!");
    } catch (err: any) {
      console.error("Reset password error:", err);
      showToast.error(err.message || "Không thể gửi email đặt lại mật khẩu");
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail("");
    setResetSent(false);
  };

  const handleMFASuccess = () => {
    completeMFAVerification();
    showToast.success("Đăng nhập thành công!");
    navigate("/dashboard");
  };

  const handleMFACancel = async () => {
    setShowMFAVerify(false);
    setPassword("");
    // Sign out the partial session
    try {
      const { supabase } = await import("../../supabaseClient");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  // Show MFA verification screen if required
  if (showMFAVerify || mfaRequired) {
    return (
      <MFAVerify onSuccess={handleMFASuccess} onCancel={handleMFACancel} />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl mb-4 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
            <img
              src="/logo-smartcare.png"
              alt="Nhạn-Lâm SmartCare"
              className="w-full h-full object-contain p-1.5"
              onError={(e) => {
                // Fallback to icon if logo not found yet
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = "";
                  const span = document.createElement("span");
                  span.className = "text-blue-600 dark:text-blue-400";
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            MotoCare
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Hệ thống quản lý cửa hàng xe máy
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Đăng nhập
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Ghi nhớ đăng nhập
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !!lockedUntil}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            © 2025 MotoCare. Phiên bản 1.0.0
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            {!resetSent ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={closeForgotPassword}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Quên mật khẩu?
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nhập email để nhận link đặt lại mật khẩu
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi link đặt lại mật khẩu"
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Đã gửi email!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Vui lòng kiểm tra hộp thư <strong>{resetEmail}</strong> và
                  nhấp vào link để đặt lại mật khẩu.
                </p>
                <button
                  onClick={closeForgotPassword}
                  className="px-6 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
