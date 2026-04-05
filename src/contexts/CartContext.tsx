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
        return prev.map((i) =>
          i.partId === item.partId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
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
        prev.map((i) => (i.partId === itemId ? { ...i, quantity } : i))
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
