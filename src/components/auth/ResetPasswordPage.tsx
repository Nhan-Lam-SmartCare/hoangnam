/**
 * Reset Password Page
 * Handles password reset after clicking email link
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { showToast } from "../../utils/toast";
import { validatePassword } from "../../utils/validation";
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user has valid reset session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        // User should have a session from the reset link
        if (session) {
          setIsValidSession(true);
        } else {
          setError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }
      } catch (err) {
        console.error("Session check error:", err);
        setError("Có lỗi xảy ra. Vui lòng thử lại.");
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.ok) {
      setError(passwordValidation.error || "Mật khẩu không hợp lệ");
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setIsSuccess(true);
      showToast.success("Đặt lại mật khẩu thành công!");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "Không thể đặt lại mật khẩu");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Thành công!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Mật khẩu của bạn đã được đặt lại. Đang chuyển hướng đến trang đăng
            nhập...
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Đặt lại mật khẩu
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {!isValidSession ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Link không hợp lệ
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {error || "Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ."}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Xác nhận mật khẩu
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  "Đặt lại mật khẩu"
                )}
              </button>

              {/* Back to login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ← Quay lại đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
