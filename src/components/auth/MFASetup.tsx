/**
 * MFA Setup Component
 * Allows owners to enroll in TOTP-based 2FA
 * Can be embedded directly in Settings page
 */
import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { showToast } from "../../utils/toast";
import { Copy, Check, Smartphone, Key, Loader2 } from "lucide-react";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export const MFASetup = () => {
  const [step, setStep] = useState<"list" | "enroll" | "verify">("list");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [error, setError] = useState("");

  // Load existing MFA factors on mount
  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
      setStep("list");
    } catch (err) {
      console.error("Error loading MFA factors:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start MFA enrollment
  const startEnrollment = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep("verify");
      }
    } catch (err: any) {
      console.error("Error enrolling MFA:", err);
      setError(err.message || "Không thể bắt đầu thiết lập 2FA");
      showToast.error("Không thể bắt đầu thiết lập 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify and complete enrollment
  const verifyEnrollment = async () => {
    if (verifyCode.length !== 6) {
      setError("Vui lòng nhập mã 6 chữ số");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode,
      });

      if (error) throw error;

      showToast.success("Bật 2FA thành công!");
      await loadFactors();
      setStep("list");
      setVerifyCode("");
    } catch (err: any) {
      console.error("Error verifying MFA:", err);
      setError(err.message || "Mã xác thực không đúng");
    } finally {
      setIsLoading(false);
    }
  };

  // Unenroll (disable) MFA
  const unenrollFactor = async (id: string) => {
    if (!confirm("Bạn có chắc muốn tắt 2FA? Tài khoản sẽ kém an toàn hơn.")) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;

      showToast.success("Đã tắt 2FA");
      await loadFactors();
    } catch (err: any) {
      console.error("Error unenrolling MFA:", err);
      showToast.error(err.message || "Không thể tắt 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  // Copy secret to clipboard
  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error("Không thể sao chép");
    }
  };

  // Loading state
  if (isLoading && step === "list") {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-slate-500 dark:text-slate-400">
          Đang tải...
        </span>
      </div>
    );
  }

  // List existing factors
  if (step === "list") {
    return (
      <div className="space-y-4">
        {/* Existing factors */}
        {factors.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Phương thức đã thiết lập:
            </p>
            {factors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-300">
                      {factor.friendly_name || "Authenticator App"}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Đã kích hoạt •{" "}
                      {new Date(factor.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => unenrollFactor(factor.id)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  Tắt
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <Key className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              2FA chưa được bật
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Bật xác thực 2 bước để bảo vệ tài khoản của bạn
            </p>
          </div>
        )}

        {/* Add new factor button */}
        {factors.length === 0 && (
          <button
            onClick={startEnrollment}
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Bật 2FA ngay"
            )}
          </button>
        )}
      </div>
    );
  }

  // Verify enrollment step
  if (step === "verify") {
    return (
      <div className="space-y-5">
        {/* QR Code */}
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Quét mã QR bằng ứng dụng Authenticator
          </p>
          {qrCode && (
            <div className="inline-block p-3 bg-white rounded-xl shadow-lg border border-slate-200">
              <img src={qrCode} alt="QR Code" className="w-40 h-40 mx-auto" />
            </div>
          )}
        </div>

        {/* Manual entry */}
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            Hoặc nhập mã thủ công:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-slate-200 dark:bg-slate-600 rounded text-xs font-mono break-all text-slate-800 dark:text-slate-200">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Sao chép"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Verify code input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Nhập mã 6 chữ số từ ứng dụng:
          </label>
          <input
            type="text"
            value={verifyCode}
            onChange={(e) =>
              setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.3em] border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStep("list");
              setVerifyCode("");
              setError("");
            }}
            className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={verifyEnrollment}
            disabled={isLoading || verifyCode.length !== 6}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xác thực...
              </>
            ) : (
              "Xác nhận"
            )}
          </button>
        </div>

        {/* App suggestions */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            <span className="font-medium">Ứng dụng đề xuất:</span> Google
            Authenticator, Authy, Microsoft Authenticator, 1Password
          </p>
        </div>
      </div>
    );
  }

  return null;
};
