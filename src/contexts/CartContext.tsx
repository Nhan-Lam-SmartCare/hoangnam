import React, { createContext, useState, useCallback } from "react";
import type { CartItem } from "../types";

interface CartContextType {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemQuantity: (itemId: string, quantity: number) => void;
  cartTotal: number;
  cartItemCount: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export const CartContext = createContext<CartContextType | undefined>(undefined);
export type { CartContextType };

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const clearCart = useCallback(() => setCartItems([]), []);

  const addToCart = useCallback((item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.partId === item.partId);
      if (existing) {
        // Hàng có IMEI: gộp theo DANH SÁCH MÁY, không cộng số lượng. Chọn lại
        // cùng một chiếc thì phải không đổi gì — cộng dồn sẽ tạo ra "2 chiếc"
        // trong khi chỉ có 1 máy thật.
        if (existing.unitIds?.length || item.unitIds?.length) {
          const mergedIds = Array.from(
            new Set([...(existing.unitIds || []), ...(item.unitIds || [])])
          );
          const mergedImeis = Array.from(
            new Set([...(existing.unitImeis || []), ...(item.unitImeis || [])])
          );
          return prev.map((i) =>
            i.partId === item.partId
              ? {
                  ...i,
                  unitIds: mergedIds,
                  unitImeis: mergedImeis,
                  quantity: mergedIds.length,
                }
              : i
          );
        }
        return prev.map((i) =>
          i.partId === item.partId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      // Máy đã chọn là nguồn sự thật cho số lượng ngay từ lúc thêm vào giỏ.
      if (item.unitIds?.length) {
        return [...prev, { ...item, quantity: item.unitIds.length }];
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.partId !== itemId));
  }, []);

  const updateCartItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(itemId);
        return;
      }
      setCartItems((prev) =>
        prev.map((i) => {
          if (i.partId !== itemId) return i;

          // Hàng có IMEI: giảm số lượng = bỏ bớt máy ở cuối danh sách. TĂNG thì
          // không thể, vì phải biết thêm CHIẾC NÀO — người dùng chọn lại ở modal.
          if (i.unitIds?.length) {
            const next = Math.min(quantity, i.unitIds.length);
            return {
              ...i,
              quantity: next,
              unitIds: i.unitIds.slice(0, next),
              unitImeis: i.unitImeis?.slice(0, next),
            };
          }

          return { ...i, quantity };
        })
      );
    },
    [removeFromCart]
  );

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        setCartItems,
        clearCart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        cartTotal,
        cartItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
