import { MissingItem } from "../types";

/**
 * Normalizes an Arabic or English product name for deterministic identification.
 */
export function normalizeProductName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "") // Remove Arabic diacritics
    .replace(/^(ال|و|وال|ب|بال)/, "") // Remove common Arabic prefixes
    .replace(/\s+/g, "-");
}

/**
 * Generates a deterministic canonical product ID based on category and product name.
 */
export function generateProductId(categoryId: string, productName: string): string {
  const cat = (categoryId || "general").trim().toLowerCase();
  const prod = normalizeProductName(productName);
  return `prod-${cat}-${prod}`;
}

/**
 * Parses numeric quantity from Arabic numerals (١, ٢, ٣...) or Western numerals (1, 2, 3...).
 */
export function parseQuantity(qtyStr: string | number | undefined | null): number {
  if (typeof qtyStr === "number") return qtyStr > 0 ? qtyStr : 1;
  if (!qtyStr) return 1;

  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let normalized = qtyStr.toString().trim();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.split(arabicNumerals[i]).join(i.toString());
  }

  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return 1;
  const val = parseFloat(match[0]);
  return isNaN(val) || val <= 0 ? 1 : val;
}

/**
 * Formats a numeric quantity into a clean Arabic or standard numeral string.
 */
export function formatQuantity(num: number, useArabic = true): string {
  if (num <= 0) return "0";
  const intVal = Math.round(num);
  const str = intVal.toString();
  if (!useArabic) return str;

  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str
    .split("")
    .map((char) => arabicNumerals[parseInt(char, 10)] ?? char)
    .join("");
}

export interface CartMutationResult {
  updatedItems: MissingItem[];
  mutatedItem: MissingItem;
  isNew: boolean;
  isDeleted?: boolean;
}

/**
 * Adds a product to the missing items/cart list or increments its quantity if already present.
 */
export function addOrIncrementCartItem(
  currentItems: MissingItem[],
  itemInput: Omit<MissingItem, "id" | "addedAt" | "completed">
): CartMutationResult {
  const canonicalProductId = itemInput.productId || generateProductId(itemInput.category, itemInput.name);
  const incomingQty = parseQuantity(itemInput.quantity);

  // Look for existing active (not completed) product with matching canonical product ID or matching category+normalized name
  const existingIndex = currentItems.findIndex((it) => {
    if (it.completed) return false;
    const itProductId = it.productId || generateProductId(it.category, it.name);
    return itProductId === canonicalProductId;
  });

  if (existingIndex !== -1) {
    const existing = currentItems[existingIndex];
    const currentQty = parseQuantity(existing.quantity);
    const newQty = currentQty + incomingQty;
    const updatedQtyStr = formatQuantity(newQty);

    const updatedItem: MissingItem = {
      ...existing,
      quantity: updatedQtyStr,
      urgency: itemInput.urgency === "high" ? "high" : existing.urgency,
      notes: itemInput.notes || existing.notes,
    };

    const updatedList = [...currentItems];
    updatedList[existingIndex] = updatedItem;

    return {
      updatedItems: updatedList,
      mutatedItem: updatedItem,
      isNew: false,
    };
  }

  // New item creation
  const newItem: MissingItem = {
    ...itemInput,
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: canonicalProductId,
    quantity: itemInput.quantity ? formatQuantity(incomingQty) : "١",
    addedAt: new Date().toISOString(),
    completed: false,
  };

  return {
    updatedItems: [newItem, ...currentItems],
    mutatedItem: newItem,
    isNew: true,
  };
}

/**
 * Increments the quantity of an existing item in the cart by 1.
 */
export function incrementCartItem(
  currentItems: MissingItem[],
  itemId: string
): { updatedItems: MissingItem[]; mutatedItem?: MissingItem } {
  const index = currentItems.findIndex((it) => it.id === itemId);
  if (index === -1) return { updatedItems: currentItems };

  const existing = currentItems[index];
  const currentQty = parseQuantity(existing.quantity);
  const newQty = currentQty + 1;
  const updatedItem: MissingItem = {
    ...existing,
    quantity: formatQuantity(newQty),
  };

  const updatedList = [...currentItems];
  updatedList[index] = updatedItem;

  return {
    updatedItems: updatedList,
    mutatedItem: updatedItem,
  };
}

/**
 * Decrements the quantity of an existing item in the cart by 1.
 * If the quantity reaches zero, the item is removed.
 */
export function decrementCartItem(
  currentItems: MissingItem[],
  itemId: string
): { updatedItems: MissingItem[]; mutatedItem?: MissingItem; isDeleted: boolean } {
  const index = currentItems.findIndex((it) => it.id === itemId);
  if (index === -1) return { updatedItems: currentItems, isDeleted: false };

  const existing = currentItems[index];
  const currentQty = parseQuantity(existing.quantity);
  const newQty = currentQty - 1;

  if (newQty <= 0) {
    // Quantity reached 0 -> Remove item
    return {
      updatedItems: currentItems.filter((it) => it.id !== itemId),
      mutatedItem: existing,
      isDeleted: true,
    };
  }

  const updatedItem: MissingItem = {
    ...existing,
    quantity: formatQuantity(newQty),
  };

  const updatedList = [...currentItems];
  updatedList[index] = updatedItem;

  return {
    updatedItems: updatedList,
    mutatedItem: updatedItem,
    isDeleted: false,
  };
}
