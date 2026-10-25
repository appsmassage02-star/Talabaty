import React, { useState, useMemo } from 'react';
import { MenuItem, FoodCartSelectedOption } from '../types/foodTypes';
import { useFood } from '../context/FoodContext';
import {
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

export const ItemCustomizerModal: React.FC<Props> = ({ item, onClose }) => {
  const { addToCart } = useFood();

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize mandatory default selections when opening
  React.useEffect(() => {
    if (item && item.optionGroups) {
      const initialMap: Record<string, string[]> = {};
      item.optionGroups.forEach((group) => {
        if (group.isRequired && group.options.length > 0) {
          initialMap[group.id] = [group.options[0].id];
        } else {
          initialMap[group.id] = [];
        }
      });
      setSelectedOptionsMap(initialMap);
      setQuantity(1);
      setNotes('');
      setValidationError(null);
    }
  }, [item]);

  // Toggle selection for an option
  const handleToggleOption = (groupId: string, optionId: string, group: NonNullable<MenuItem['optionGroups']>[number]) => {
    setValidationError(null);
    setSelectedOptionsMap((prev) => {
      const currentList = prev[groupId] || [];
      const isAlreadySelected = currentList.includes(optionId);

      // Single-choice (radio-like behavior)
      if (group.maxSelection === 1) {
        if (group.isRequired) {
          return { ...prev, [groupId]: [optionId] };
        } else {
          return { ...prev, [groupId]: isAlreadySelected ? [] : [optionId] };
        }
      }

      // Multi-choice (checkbox-like behavior)
      if (isAlreadySelected) {
        return {
          ...prev,
          [groupId]: currentList.filter((id) => id !== optionId),
        };
      } else {
        if (currentList.length >= group.maxSelection) {
          // Reached limit
          return prev;
        }
        return {
          ...prev,
          [groupId]: [...currentList, optionId],
        };
      }
    });
  };

  // Convert map to flat array of selected options
  const flatSelectedOptions: FoodCartSelectedOption[] = useMemo(() => {
    if (!item || !item.optionGroups) return [];
    const list: FoodCartSelectedOption[] = [];

    item.optionGroups.forEach((group) => {
      const selectedIds = selectedOptionsMap[group.id] || [];
      selectedIds.forEach((optId) => {
        const found = group.options.find((o) => o.id === optId);
        if (found) {
          list.push({
            groupId: group.id,
            groupName: group.name,
            optionId: found.id,
            optionName: found.name,
            price: found.price,
          });
        }
      });
    });

    return list;
  }, [item, selectedOptionsMap]);

  // Pricing calculations
  const addOnsTotal = flatSelectedOptions.reduce((sum, o) => sum + o.price, 0);
  const unitPrice = (item?.price || 0) + addOnsTotal;
  const totalPrice = unitPrice * quantity;

  // Validate mandatory option groups
  const validateSelections = (): boolean => {
    if (!item || !item.optionGroups) return true;

    for (const group of item.optionGroups) {
      const selected = selectedOptionsMap[group.id] || [];
      if (group.isRequired && selected.length < group.minSelection) {
        setValidationError(`يرجى تحديد اختيارك في قسم: "${group.name}"`);
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!item) return;
    if (!validateSelections()) return;

    addToCart(item, quantity, flatSelectedOptions, notes);
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Header with image */}
        <div className="relative h-44 sm:h-52 w-full bg-slate-100 shrink-0">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent" />
          
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 right-3 left-3 text-white">
            <span className="text-[10px] font-bold bg-emerald-600/90 text-white px-2 py-0.5 rounded-md inline-block mb-1">
              {item.restaurantName}
            </span>
            <h3 className="text-base sm:text-lg font-black leading-snug drop-shadow-md">
              {item.name}
            </h3>
          </div>
        </div>

        {/* Scrollable Options Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              {item.description}
            </p>
            <div className="flex items-baseline space-x-2 space-x-reverse pt-1">
              <span className="text-base font-black text-emerald-800 font-mono">
                {item.price.toFixed(2)} ج.م
              </span>
              <span className="text-[11px] text-slate-400">السعر الأساسي</span>
            </div>
          </div>

          {/* Validation Warning */}
          {validationError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 space-x-reverse animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Option Groups */}
          {item.optionGroups && item.optionGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {item.optionGroups.map((group) => {
                const selectedIds = selectedOptionsMap[group.id] || [];

                return (
                  <div key={group.id} className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 space-x-reverse">
                        <span className="text-xs font-black text-slate-900">
                          {group.name}
                        </span>
                        {group.isRequired ? (
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            إلزامي (اختر {group.minSelection})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            (اختياري - حتى {group.maxSelection})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {group.options.map((opt) => {
                        const isChecked = selectedIds.includes(opt.id);

                        return (
                          <label
                            key={opt.id}
                            onClick={() => handleToggleOption(group.id, opt.id, group)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-white border-emerald-500 shadow-2xs'
                                : 'bg-white/70 border-slate-200/70 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <div
                                className={`w-4 h-4 rounded-${
                                  group.maxSelection === 1 ? 'full' : 'md'
                                } border flex items-center justify-center transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-bold text-slate-800">
                                {opt.name}
                              </span>
                            </div>

                            <span className="text-xs font-extrabold text-slate-600 font-mono">
                              {opt.price > 0 ? `+${opt.price.toFixed(2)} ج.م` : 'مشمول'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Customer Notes */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              ملاحظاتك الخاصة على إعداد الصنف (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: بدون بصل، صوص خارجي، تسوية زيادة..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* Footer with Quantity Counter & Add Button */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {/* Quantity Controls */}
          <div className="flex items-center space-x-2 space-x-reverse bg-white border border-slate-200 rounded-2xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 flex items-center justify-center transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-black text-slate-900 font-mono">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-between shadow-lg shadow-emerald-600/25 transition-all"
          >
            <div className="flex items-center space-x-1.5 space-x-reverse">
              <ShoppingBag className="w-4 h-4 ml-1" />
              <span>إضافة للسلة</span>
            </div>
            <span className="font-mono text-xs sm:text-sm bg-black/20 px-2 py-0.5 rounded-lg">
              {totalPrice.toFixed(2)} ج.م
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
