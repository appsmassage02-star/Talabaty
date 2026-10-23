import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  MapPin,
  Search,
  CheckCircle,
  XCircle,
  X,
  Truck,
  DollarSign,
  Save,
  RotateCcw,
} from 'lucide-react';

export const GovernorateSettingsModal: React.FC = () => {
  const {
    isGovernoratesModalOpen,
    setIsGovernoratesModalOpen,
    governoratesSettings,
    updateGovernorateSetting,
    activeRole,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingFees, setEditingFees] = useState<{ [govName: string]: number }>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const filteredGovs = useMemo(() => {
    if (!searchQuery.trim()) return governoratesSettings;
    const q = searchQuery.trim().toLowerCase();
    return governoratesSettings.filter((g) =>
      g.governorate_name.toLowerCase().includes(q)
    );
  }, [governoratesSettings, searchQuery]);

  if (!isGovernoratesModalOpen) return null;

  const handleToggleGov = async (govName: string, currentActive: boolean, currentFee: number) => {
    const fee = editingFees[govName] !== undefined ? editingFees[govName] : currentFee;
    const res = await updateGovernorateSetting(govName, !currentActive, fee);
    if (res.success) {
      showToast(
        !currentActive
          ? `تم تفعيل التوصيل لمحافظة ${govName}`
          : `تم تعطيل التوصيل لمحافظة ${govName}`
      );
    }
  };

  const handleFeeChange = (govName: string, val: string) => {
    const num = Number(val) || 0;
    setEditingFees((prev) => ({ ...prev, [govName]: num }));
  };

  const handleSaveFee = async (govName: string, isActive: boolean, defaultFee: number) => {
    const feeToSave = editingFees[govName] !== undefined ? editingFees[govName] : defaultFee;
    setIsSaving(true);
    const res = await updateGovernorateSetting(govName, isActive, feeToSave);
    setIsSaving(false);
    if (res.success) {
      showToast(`تم حفظ سعر توصيل محافظة ${govName}: ${feeToSave} ج.م`);
    } else {
      showToast('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div
      id="governorates-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                إعدادات المحافظات ورسوم التوصيل
              </h2>
              <p className="text-xs text-slate-500">
                تحديد المحافظات المتاح لها التوصيل ورسوم الشحن المعتمدة لكل محافظة
              </p>
            </div>
          </div>
          <button
            id="close-gov-settings-btn"
            onClick={() => setIsGovernoratesModalOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="mx-4 mt-3 p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            {toastMsg}
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن المحافظة (القاهرة، الجيزة، الإسكندرية...)"
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-blue-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
          </div>
        </div>

        {/* Body List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredGovs.map((gov) => {
            const currentFee =
              editingFees[gov.governorate_name] !== undefined
                ? editingFees[gov.governorate_name]
                : gov.delivery_fee;
            const hasModifiedFee =
              editingFees[gov.governorate_name] !== undefined &&
              editingFees[gov.governorate_name] !== gov.delivery_fee;

            return (
              <div
                key={gov.governorate_name}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  gov.is_active
                    ? 'bg-white border-slate-200 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200/60 opacity-70'
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <button
                    onClick={() =>
                      handleToggleGov(gov.governorate_name, gov.is_active, gov.delivery_fee)
                    }
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      gov.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                    }`}
                    title={gov.is_active ? 'تعطيل التوصيل' : 'تفعيل التوصيل'}
                  >
                    {gov.is_active ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </button>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <span>{gov.governorate_name}</span>
                      {!gov.is_active && (
                        <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded-md">
                          معطل
                        </span>
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      كود: {gov.governorate_code || 'EG'}
                    </span>
                  </div>
                </div>

                {/* Delivery Fee Input & Save */}
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="flex items-center space-x-1 space-x-reverse bg-slate-100 rounded-xl px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={currentFee}
                      onChange={(e) => handleFeeChange(gov.governorate_name, e.target.value)}
                      className="w-14 bg-transparent text-center font-bold text-xs text-slate-800 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">ج.م</span>
                  </div>

                  {hasModifiedFee && (
                    <button
                      onClick={() =>
                        handleSaveFee(gov.governorate_name, gov.is_active, gov.delivery_fee)
                      }
                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      title="حفظ السعر"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>إجمالي المحافظات: {governoratesSettings.length}</span>
          <span>
            المفعلة للتوصيل: {governoratesSettings.filter((g) => g.is_active).length}
          </span>
        </div>
      </div>
    </div>
  );
};
