import React from "react";
import { Shield, Info } from "lucide-react";
import { MFASetup } from "../../auth/MFASetup";

interface SecurityTabProps {
  isOwner: boolean;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ isOwner }) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
        Bảo mật tài khoản
      </h2>

      {isOwner ? (
        <div className="space-y-6">
          {/* 2FA Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 md:p-6">
            <div className="flex items-start gap-3 md:gap-4 mb-4">
              <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
                  Xác thực 2 bước (2FA)
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Bảo vệ tài khoản của bạn bằng một lớp bảo mật bổ sung.
                  Sau khi bật, bạn sẽ cần nhập mã từ ứng dụng
                  Authenticator mỗi khi đăng nhập.
                </p>
              </div>
            </div>

            {/* MFA Setup Component */}
            <MFASetup />
          </div>

          {/* Security Tips */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 md:p-6">
            <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-3">
              Mẹo bảo mật
            </h3>
            <ul className="space-y-2 text-xs md:text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Sử dụng mật khẩu mạnh với ít nhất 8 ký tự, bao gồm chữ
                hoa, chữ thường và số
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Bật xác thực 2 bước (2FA) để bảo vệ tài khoản
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Không chia sẻ mật khẩu hoặc mã xác thực với bất kỳ ai
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Đăng xuất khi sử dụng máy tính công cộng
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Thường xuyên kiểm tra nhật ký hoạt động của tài khoản
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium mb-1">Quyền hạn chế</p>
            <p>
              Chỉ chủ cửa hàng (Owner) mới có thể thiết lập xác thực 2
              bước. Liên hệ chủ cửa hàng để được hỗ trợ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
