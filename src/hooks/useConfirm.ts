import { useState, useCallback } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "green";
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

export const useConfirm = () => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Xác nhận",
    cancelText: "Hủy",
    confirmColor: "blue",
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  return {
    confirm,
    confirmState: state,
    handleConfirm,
    handleCancel,
  };
};

// Usage example:
// const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
//
// const handleDelete = async () => {
//   const confirmed = await confirm({
//     title: "Xác nhận xóa",
//     message: "Bạn có chắc chắn muốn xóa item này?",
//     confirmColor: "red",
//   });
//
//   if (confirmed) {
//     // Do delete
//   }
// };
//
// <ConfirmModal
//   isOpen={confirmState.isOpen}
//   title={confirmState.title}
//   message={confirmState.message}
//   confirmText={confirmState.confirmText}
//   cancelText={confirmState.cancelText}
//   confirmColor={confirmState.confirmColor}
//   onConfirm={handleConfirm}
//   onCancel={handleCancel}
// />
