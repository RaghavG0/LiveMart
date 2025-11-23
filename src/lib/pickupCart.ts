/**
 * Utility functions for managing pickup cart in localStorage
 */

export interface PickupCartItem {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock_quantity: number;
    image_url: string | null;
    is_available: boolean;
    seller_id: string;
    seller_name?: string;
    seller_address?: string;
  };
  quantity: number;
}

const PICKUP_CART_KEY = 'pickup_cart';

/**
 * Get all items in pickup cart
 */
export const getPickupCart = (): PickupCartItem[] => {
  try {
    const stored = localStorage.getItem(PICKUP_CART_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading pickup cart from localStorage:', error);
    return [];
  }
};

/**
 * Add item to pickup cart
 */
export const addToPickupCart = (product: PickupCartItem['product'], quantity: number = 1): void => {
  try {
    const cart = getPickupCart();
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    
    if (existingIndex >= 0) {
      // Update quantity if item exists
      const newQuantity = cart[existingIndex].quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        throw new Error(`Cannot add more. Only ${product.stock_quantity} available.`);
      }
      cart[existingIndex].quantity = newQuantity;
    } else {
      // Add new item
      if (quantity > product.stock_quantity) {
        throw new Error(`Cannot add ${quantity}. Only ${product.stock_quantity} available.`);
      }
      cart.push({ product, quantity });
    }
    
    localStorage.setItem(PICKUP_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error adding to pickup cart:', error);
    throw error;
  }
};

/**
 * Update quantity of item in pickup cart
 */
export const updatePickupCartQuantity = (productId: string, quantity: number): void => {
  try {
    const cart = getPickupCart();
    const item = cart.find(item => item.product.id === productId);
    
    if (!item) {
      throw new Error('Item not found in cart');
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      removeFromPickupCart(productId);
      return;
    }
    
    if (quantity > item.product.stock_quantity) {
      throw new Error(`Cannot add more. Only ${item.product.stock_quantity} available.`);
    }
    
    item.quantity = quantity;
    localStorage.setItem(PICKUP_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error updating pickup cart:', error);
    throw error;
  }
};

/**
 * Remove item from pickup cart
 */
export const removeFromPickupCart = (productId: string): void => {
  try {
    const cart = getPickupCart().filter(item => item.product.id !== productId);
    localStorage.setItem(PICKUP_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error removing from pickup cart:', error);
    throw error;
  }
};

/**
 * Clear pickup cart
 */
export const clearPickupCart = (): void => {
  try {
    localStorage.removeItem(PICKUP_CART_KEY);
  } catch (error) {
    console.error('Error clearing pickup cart:', error);
  }
};

/**
 * Get total number of items in pickup cart
 */
export const getPickupCartItemCount = (): number => {
  const cart = getPickupCart();
  return cart.reduce((sum, item) => sum + item.quantity, 0);
};

/**
 * Get total amount of pickup cart
 */
export const getPickupCartTotal = (): number => {
  const cart = getPickupCart();
  return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
};

