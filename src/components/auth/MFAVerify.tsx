/**
 * MFA Verification Component
 * Shows when user with MFA enabled tries to login
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { showToast } from "../../utils/toast";
import { Shield, ArrowLeft } from "lucide-react";

interface MFAVerifyProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const MFAVerify = ({ onSuccess, onCancel }: MFAVerifyProps) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get the TOTP factor for verification
    const getFactors = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;

        const totpFactors = data?.totp || [];
        if (totpFactors.length > 0) {
          // Use the first verified factor
          const verifiedFactor = totpFactors.find(
            (f) => f.status === "verified"
          );
          if (verifiedFactor) {
            setFactorId(verifiedFactor.id);
          }
        }
      } catch (err) {
        console.error("Error getting MFA factors:", err);
      }
    };

    getFactors();
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Vui lòng nhập mã 6 chữ số");
      return;
    }

    if (!factorId) {
      setError("Không tìm thấy phương thức xác thực");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Create a challenge first
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      // Verify the challenge with the code
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (error) throw error;

      showToast.success("Xác thực thành công!");
      onSuccess();
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Mã xác thực không đúng hoặc đã hết hạn");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại đăng nhập
        </button>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {/* Icon */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Xác thực 2 bước
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Nhập mã 6 chữ số từ ứng dụng Authenticator của bạn
            </p>
          </div>

          {/* Code input */}
          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={handleKeyDown}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              className="w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            )}
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={isLoading || code.length !== 6}
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
                Đang xác thực...
              </span>
            ) : (
              "Xác nhận"
            )}
          </button>

          {/* Help text */}
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Mã sẽ thay đổi sau mỗi 30 giây.
            <br />
            Nếu gặp vấn đề, liên hệ quản trị viên.
          </p>
        </div>
      </div>
    </div>
  );
};
