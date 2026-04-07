import { useState, useCallback } from "react";

/**
 * useModal hook - Quản lý state cho modal
 * Cung cấp state và các hàm tiện ích để mở/đóng modal
 * @returns [isOpen, openModal, closeModal, toggleModal]
 */
export function useModal(
  initialState = false
): [boolean, () => void, () => void, () => void] {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return [isOpen, open, close, toggle];
}

/**
 * useModalWithData hook - Quản lý modal kèm data
 * Hữu ích khi cần mở modal với một item cụ thể (edit, detail, etc)
 * @returns { isOpen, data, openModal, closeModal }
 */
export function useModalWithData<T = unknown>(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState<T | null>(null);

  const openModal = useCallback((modalData?: T) => {
    if (modalData !== undefined) {
      setData(modalData);
    }
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return {
    isOpen,
    data,
    openModal,
    closeModal,
  };
}

export default useModal;
