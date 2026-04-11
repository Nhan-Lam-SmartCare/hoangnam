import React, { useState } from "react";
import { showToast } from "../../../utils/toast";
interface ImportInventoryModalProps {
  onClose: () => void;
  onDownloadTemplate: () => void;
  onImport: (file: File) => Promise<void>;
}

const ImportInventoryModal: React.FC<ImportInventoryModalProps> = ({
  onClose,
  onDownloadTemplate,
  onImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        setSelectedFile(file);
      } else {
        showToast.warning(
          "Vui l├▓ng chß╗ìn tß╗çp Excel (.xlsx, .xls) hoß║╖c CSV (.csv)"
        );
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showToast.warning("Vui l├▓ng chß╗ìn tß╗çp ─æß╗â nhß║¡p");
      return;
    }

    setIsProcessing(true);
    try {
      await onImport(selectedFile);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Nhß║¡p tß╗ôn kho tß╗½ Excel/CSV
          </h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Download Template */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  H╞░ß╗¢ng dß║½n sß╗¡ dß╗Ñng
                </h3>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Tß║úi tß╗çp mß║½u</li>
                  <li>─Éiß╗ün th├┤ng tin sß║ún phß║⌐m v├áo tß╗çp</li>
                  <li>L╞░u tß╗çp v├á chß╗ìn ─æß╗â nhß║¡p</li>
                </ol>
                <button
                  onClick={onDownloadTemplate}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Tß║úi mß║½u Excel
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chß╗ìn tß╗çp ─æß╗â nhß║¡p
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isProcessing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <svg
                  className="w-12 h-12 text-slate-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Nhß║Ñn ─æß╗â chß╗ìn tß╗çp Excel hoß║╖c CSV
                </span>
                {selectedFile && (
                  <span className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                    ≡ƒôä {selectedFile.name}
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Hß╗ºy
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "─Éang xß╗¡ l├╜..." : "Nhß║¡p"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ImportInventoryModal;

