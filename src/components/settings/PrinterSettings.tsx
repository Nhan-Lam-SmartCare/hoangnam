import React, { useEffect, useState } from 'react';
import { usePrinter, BluetoothDevice } from '../../hooks/usePrinter';
import { toast } from 'react-toastify';
import { Info } from 'lucide-react';

interface PrinterSettingsProps {
  settings: any;
  updateField: (field: any, value: any) => void;
  isOwner: boolean;
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({
  settings,
  updateField,
  isOwner,
}) => {
  const {
    isNative,
    pairedDevices,
    isLoadingDevices,
    connectedDevice,
    connectedAddress,
    isConnecting,
    scanPairedDevices,
    connectBluetooth,
    disconnectBluetooth,
    printViaBluetooth,
    printViaWiFi,
  } = usePrinter();

  const [printMode, setPrintMode] = useState<'wifi' | 'bluetooth'>(() => {
    return (localStorage.getItem('motocare_print_mode') as 'wifi' | 'bluetooth') || 'wifi';
  });

  const [selectedBTAddress, setSelectedBTAddress] = useState<string>(() => {
    return localStorage.getItem('motocare_bt_address') || '';
  });

  useEffect(() => {
    localStorage.setItem('motocare_print_mode', printMode);
  }, [printMode]);

  // If mobile, auto-scan devices on mount
  useEffect(() => {
    if (isNative && printMode === 'bluetooth') {
      scanPairedDevices().catch(() => {
        toast.error('Không thể quét thiết bị Bluetooth. Vui lòng kiểm tra quyền và bật Bluetooth.');
      });
    }
  }, [isNative, printMode, scanPairedDevices]);

  const handleConnect = async (device: BluetoothDevice) => {
    try {
      const success = await connectBluetooth(device.address);
      if (success) {
        localStorage.setItem('motocare_bt_address', device.address);
        setSelectedBTAddress(device.address);
        toast.success(`Đã kết nối thành công tới ${device.name}!`);
      } else {
        toast.error('Kết nối máy in thất bại.');
      }
    } catch (err: any) {
      toast.error(`Lỗi kết nối: ${err.message || err}`);
    }
  };

  const handleDisconnect = async () => {
    await disconnectBluetooth();
    localStorage.removeItem('motocare_bt_address');
    setSelectedBTAddress('');
    toast.info('Đã ngắt kết nối máy in.');
  };

  const handleTestPrint = async () => {
    if (printMode === 'wifi') {
      const testHtml = `
        <html>
          <head>
            <style>
              body { font-family: monospace; padding: 20px; text-align: center; }
              h2 { color: #2563eb; }
              hr { border: 1px dashed #ccc; }
            </style>
          </head>
          <body>
            <h2>SMARTCARE PRO</h2>
            <p>Hệ thống Quản lý Cửa hàng Điện tử</p>
            <hr />
            <p>BẢN IN THỬ NGHIỆM MẠNG WIFI/LAN</p>
            <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
            <p>Trạng thái: KẾT NỐI HOÀN HẢO</p>
            <hr />
          </body>
        </html>
      `;
      await printViaWiFi(testHtml);
      toast.success('Đã gửi lệnh in thử nghiệm WiFi.');
    } else {
      if (!connectedAddress) {
        toast.error('Vui lòng kết nối với máy in Bluetooth trước.');
        return;
      }
      
      const testText = `
================================
         SMARTCARE PRO
  He thong Quan ly Cua hang Dien tu
================================
Thoi gian: ${new Date().toLocaleString('vi-VN')}
Trang thai: KET NOI BT THANH CONG

Bao cao: MAY IN HOAT DONG TOT

--------------------------------
Cam on quy khach da tin tuong!
================================
\n\n\n\n`;
      await printViaBluetooth(testText);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Thiết lập máy in di động
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cấu hình phương thức và kết nối máy in hóa đơn trực tiếp từ ứng dụng.
        </p>
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Mode Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Chọn phương thức in mặc định:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setPrintMode('wifi')}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
              printMode === 'wifi'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  Máy in WiFi / LAN
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  In qua mạng nội bộ hoặc hệ thống Driver Android.
                </p>
              </div>
            </div>
            {printMode === 'wifi' && (
              <span className="text-blue-500 font-medium text-xs mt-3 self-end flex items-center gap-1">
                ✓ Đang hoạt động
              </span>
            )}
          </button>

          <button
            disabled={!isNative}
            onClick={() => setPrintMode('bluetooth')}
            className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
              !isNative
                ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700'
                : printMode === 'bluetooth'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📶</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  Máy in Bluetooth
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kết nối máy in nhiệt cầm tay mini (K80 / K58).
                </p>
              </div>
            </div>
            {!isNative ? (
              <span className="text-red-500 text-xs mt-3 self-end">
                ⚠ Chỉ khả dụng trên App Mobile
              </span>
            ) : printMode === 'bluetooth' ? (
              <span className="text-blue-500 font-medium text-xs mt-3 self-end flex items-center gap-1">
                ✓ Đang hoạt động
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Bluetooth Connection Setup */}
      {printMode === 'bluetooth' && isNative && (
        <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Kết nối Máy in Bluetooth
            </h4>
            <button
              onClick={scanPairedDevices}
              disabled={isLoadingDevices}
              className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1"
            >
              🔄 {isLoadingDevices ? 'Đang làm mới...' : 'Làm mới danh sách'}
            </button>
          </div>

          {connectedDevice ? (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-300">
                  🟢 Đã kết nối: {connectedDevice}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  Địa chỉ MAC: {connectedAddress}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
              >
                Ngắt kết nối
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                ⚪ Trạng thái: Chưa có máy in nào được kết nối.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Lưu ý: Bạn cần vào Cài đặt điện thoại và **Ghép đôi (Pair)** máy in Bluetooth trước, sau đó thiết bị sẽ hiển thị trong danh sách dưới đây.
              </p>
            </div>
          )}

          {/* List of paired devices */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Danh sách thiết bị đã ghép đôi:
            </p>
            {isLoadingDevices ? (
              <p className="text-xs text-slate-400 py-2">Đang tìm thiết bị máy in...</p>
            ) : pairedDevices.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Không tìm thấy thiết bị đã ghép đôi nào. Hãy ghép đôi thiết bị trong Cài đặt Android.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-48 overflow-y-auto">
                {pairedDevices.map((device) => {
                  const isThisConnected = connectedAddress === device.address;
                  return (
                    <div
                      key={device.address}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          🖨️ {device.name || 'Thiết bị không tên'}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          MAC: {device.address}
                        </p>
                      </div>
                      <button
                        onClick={() => handleConnect(device)}
                        disabled={isConnecting || isThisConnected}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          isThisConnected
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50'
                        }`}
                      >
                        {isThisConnected ? 'Đã kết nối' : isConnecting ? 'Đang kết nối...' : 'Kết nối'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paper Size Settings */}
      {settings && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-5 md:pt-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Khổ giấy in cấu hình
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chọn khổ giấy phù hợp với máy in của cửa hàng. Bấm "Lưu thay đổi" ở phía dưới sau khi thiết lập.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Receipt paper size */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                🧾 Phiếu sửa chữa:
              </label>
              {(() => {
                const PRESET_RECEIPT = ["58mm", "80mm", "A5", "A4"];
                const currentVal = settings.print_paper_size_receipt || localStorage.getItem("motocare_print_paper_size_receipt") || "80mm";
                const isCustom = !PRESET_RECEIPT.includes(currentVal);
                const selectVal = isCustom ? "__custom__" : currentVal;
                return (
                  <>
                    <select
                      value={selectVal}
                      onChange={(e) => {
                        const val = e.target.value === "__custom__" ? "100mm" : e.target.value;
                        updateField("print_paper_size_receipt", val);
                        localStorage.setItem("motocare_print_paper_size_receipt", val);
                      }}
                      disabled={!isOwner}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="58mm">58mm — Máy in bill nhỏ</option>
                      <option value="80mm">80mm — Máy in bill (mặc định)</option>
                      <option value="A5">A5 (148mm) — Giấy A5</option>
                      <option value="A4">A4 (210mm) — Giấy A4</option>
                      <option value="__custom__">✏️ Tùy chỉnh...</option>
                    </select>
                    {isCustom && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={30}
                          max={300}
                          value={parseInt(currentVal) || 100}
                          onChange={(e) => {
                            const v = Math.max(30, Math.min(300, Number(e.target.value) || 30));
                            const val = `${v}mm`;
                            updateField("print_paper_size_receipt", val);
                            localStorage.setItem("motocare_print_paper_size_receipt", val);
                          }}
                          disabled={!isOwner}
                          className="w-24 px-3 py-1.5 text-sm border border-blue-400 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50 font-mono"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">mm (chiều rộng)</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Sales paper size */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                🛍️ Hóa đơn bán hàng:
              </label>
              {(() => {
                const PRESET_SALES = ["58mm", "80mm", "A5", "A4"];
                const currentVal = settings.print_paper_size_sales || localStorage.getItem("motocare_print_paper_size_sales") || "80mm";
                const isCustom = !PRESET_SALES.includes(currentVal);
                const selectVal = isCustom ? "__custom__" : currentVal;
                return (
                  <>
                    <select
                      value={selectVal}
                      onChange={(e) => {
                        const val = e.target.value === "__custom__" ? "100mm" : e.target.value;
                        updateField("print_paper_size_sales", val);
                        localStorage.setItem("motocare_print_paper_size_sales", val);
                      }}
                      disabled={!isOwner}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="58mm">58mm — Máy in bill nhỏ</option>
                      <option value="80mm">80mm — Máy in bill (mặc định)</option>
                      <option value="A5">A5 (148mm) — Giấy A5</option>
                      <option value="A4">A4 (210mm) — Giấy A4</option>
                      <option value="__custom__">✏️ Tùy chỉnh...</option>
                    </select>
                    {isCustom && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={30}
                          max={300}
                          value={parseInt(currentVal) || 100}
                          onChange={(e) => {
                            const v = Math.max(30, Math.min(300, Number(e.target.value) || 30));
                            const val = `${v}mm`;
                            updateField("print_paper_size_sales", val);
                            localStorage.setItem("motocare_print_paper_size_sales", val);
                          }}
                          disabled={!isOwner}
                          className="w-24 px-3 py-1.5 text-sm border border-blue-400 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50 font-mono"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">mm (chiều rộng)</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Warranty paper size */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                🛡️ Phiếu bảo hành:
              </label>
              {(() => {
                const PRESET_WARRANTY = ["58mm", "80mm", "A5", "A4"];
                const currentVal = settings.print_paper_size_warranty || localStorage.getItem("motocare_print_paper_size_warranty") || "A5";
                const isCustom = !PRESET_WARRANTY.includes(currentVal);
                const selectVal = isCustom ? "__custom__" : currentVal;
                return (
                  <>
                    <select
                      value={selectVal}
                      onChange={(e) => {
                        const val = e.target.value === "__custom__" ? "100mm" : e.target.value;
                        updateField("print_paper_size_warranty", val);
                        localStorage.setItem("motocare_print_paper_size_warranty", val);
                      }}
                      disabled={!isOwner}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="58mm">58mm — Máy in bill nhỏ</option>
                      <option value="80mm">80mm — Máy in bill</option>
                      <option value="A5">A5 (148mm) — Giấy A5 (mặc định)</option>
                      <option value="A4">A4 (210mm) — Giấy A4</option>
                      <option value="__custom__">✏️ Tùy chỉnh...</option>
                    </select>
                    {isCustom && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={30}
                          max={300}
                          value={parseInt(currentVal) || 100}
                          onChange={(e) => {
                            const v = Math.max(30, Math.min(300, Number(e.target.value) || 30));
                            const val = `${v}mm`;
                            updateField("print_paper_size_warranty", val);
                            localStorage.setItem("motocare_print_paper_size_warranty", val);
                          }}
                          disabled={!isOwner}
                          className="w-24 px-3 py-1.5 text-sm border border-blue-400 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50 font-mono"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">mm (chiều rộng)</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Label size */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              🏷️ Kích thước tem mã vạch (mặc định):
            </label>
            {(() => {
              const PRESET_LABELS = [
                "20x35-dual", "30x20", "37x20", "40x30",
                "50x30", "60x40", "80x50", "100x80",
              ];
              const PRESET_LABEL_NAMES: Record<string, string> = {
                "20x35-dual": "22×35mm (giấy đôi)",
                "30x20": "30×20mm (nhỏ)",
                "37x20": "37×20mm",
                "40x30": "40×30mm (phổ biến)",
                "50x30": "50×30mm (vừa)",
                "60x40": "60×40mm (lớn)",
                "80x50": "80×50mm (max)",
                "100x80": "100×80mm (rất lớn)",
              };
              const currentVal = settings.print_label_size_default || "40x30";
              const isCustom = !PRESET_LABELS.includes(currentVal);
              const selectVal = isCustom ? "__custom__" : currentVal;
              return (
                <>
                  <select
                    value={selectVal}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        updateField("print_label_size_default", "45x25");
                      } else {
                        updateField("print_label_size_default", e.target.value);
                      }
                    }}
                    disabled={!isOwner}
                    className="w-full sm:w-1/2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    {PRESET_LABELS.map((key) => (
                      <option key={key} value={key}>
                        {PRESET_LABEL_NAMES[key] || key}
                      </option>
                    ))}
                    <option value="__custom__">✏️ Tùy chỉnh...</option>
                  </select>
                  {isCustom && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9x×]/gi, "").toLowerCase();
                          updateField("print_label_size_default", v);
                        }}
                        disabled={!isOwner}
                        placeholder="VD: 45x25"
                        className="w-32 px-3 py-1.5 text-sm border border-blue-400 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50 font-mono"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Rộng×Cao (mm)</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="mt-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 flex gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">💡 Hướng dẫn chọn khổ giấy:</p>
              <p>• <strong>58mm / 80mm:</strong> Dùng cho máy in hóa đơn nhiệt (POS). 80mm là phổ biến nhất.</p>
              <p>• <strong>A5:</strong> Khổ giấy nhỏ, phù hợp in phiếu bảo hành chuyên nghiệp.</p>
              <p>• <strong>A4:</strong> Khổ giấy tiêu chuẩn, dùng khi cần in chi tiết đầy đủ.</p>
              <p>• <strong>Tem mã vạch:</strong> Chọn theo khổ cuộn tem của máy in nhiệt (XP-360B, Godex, v.v.).</p>
            </div>
          </div>
        </div>
      )}

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Action Buttons */}
      <div className="pt-2">
        <button
          onClick={handleTestPrint}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          🖨️ Thực hiện in thử nghiệm
        </button>
      </div>
    </div>
  );
};
