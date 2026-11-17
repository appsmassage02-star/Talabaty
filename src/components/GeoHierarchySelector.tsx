import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  getActiveAreas,
  getActiveCenters,
  getActiveGovernorates,
  normalizeArabicName,
  type GeoArea,
  type GeoCenter,
  type GeoGovernorate,
} from '../lib/geoService';

export interface GeoSelectionValue {
  governorateId: string;
  governorateName: string;
  centerId: string;
  centerName: string;
  areaId: string;
  areaName: string;
}

interface GeoHierarchySelectorProps {
  value: GeoSelectionValue;
  onChange: (next: GeoSelectionValue) => void;
  /** Used ONLY when editing a legacy address that lacks central geo IDs */
  initialLegacyNames?: {
    governorateName?: string;
    centerName?: string;
    areaName?: string;
  };
  disabled?: boolean;
  compact?: boolean;
}

export const GeoHierarchySelector: React.FC<GeoHierarchySelectorProps> = ({
  value,
  onChange,
  initialLegacyNames,
  disabled = false,
  compact = false,
}) => {
  const [governorates, setGovernorates] = useState<GeoGovernorate[]>([]);
  const [centers, setCenters] = useState<GeoCenter[]>([]);
  const [areas, setAreas] = useState<GeoArea[]>([]);

  const [loadingGovs, setLoadingGovs] = useState(false);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [legacyApplied, setLegacyApplied] = useState(false);

  // Keep refs synchronized to prevent stale closures inside async cascade effects
  const valueRef = useRef<GeoSelectionValue>(value);
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Reset legacy prefill flag if editing a different record
  useEffect(() => {
    setLegacyApplied(false);
  }, [
    initialLegacyNames?.governorateName,
    initialLegacyNames?.centerName,
    initialLegacyNames?.areaName,
  ]);

  // 1) Load active governorates from central geo_governorates
  useEffect(() => {
    let active = true;
    setLoadingGovs(true);
    setGeoError(null);

    getActiveGovernorates()
      .then((list) => {
        if (!active) return;
        setGovernorates(list);
      })
      .catch((err: any) => {
        if (!active) return;
        setGovernorates([]);
        setGeoError(err?.message || 'تعذر تحميل المحافظات من النظام الجغرافي المركزي');
      })
      .finally(() => {
        if (active) setLoadingGovs(false);
      });

    return () => {
      active = false;
    };
  }, [reloadNonce]);

  // 2) One-time pre-match for legacy address edits that lack governorateId
  useEffect(() => {
    if (
      legacyApplied ||
      value.governorateId ||
      !initialLegacyNames?.governorateName ||
      governorates.length === 0
    ) {
      return;
    }

    const normTarget = normalizeArabicName(initialLegacyNames.governorateName);
    const matched = governorates.find(
      (g) =>
        normalizeArabicName(g.name_ar) === normTarget ||
        normalizeArabicName(g.name_en) === normTarget
    );

    setLegacyApplied(true);
    if (matched) {
      onChangeRef.current({
        governorateId: matched.id,
        governorateName: matched.name_ar,
        centerId: '',
        centerName: '',
        areaId: '',
        areaName: '',
      });
    }
  }, [governorates, value.governorateId, initialLegacyNames, legacyApplied]);

  // 3) Load centers whenever governorateId changes
  useEffect(() => {
    let active = true;
    const requestedGovId = value.governorateId;

    if (!requestedGovId) {
      setCenters([]);
      setAreas([]);
      setLoadingCenters(false);
      return;
    }

    setCenters([]);
    setAreas([]);
    setLoadingCenters(true);
    setGeoError(null);

    getActiveCenters(requestedGovId)
      .then((list) => {
        if (!active || valueRef.current.governorateId !== requestedGovId) return;
        setCenters(list);

        const currentVal = valueRef.current;

        // If an existing centerId is selected, verify it belongs to active centers of this governorate
        if (currentVal.centerId) {
          const validCenter = list.find((c) => c.id === currentVal.centerId);
          if (!validCenter) {
            onChangeRef.current({
              ...currentVal,
              centerId: '',
              centerName: '',
              areaId: '',
              areaName: '',
            });
          } else if (currentVal.centerName !== validCenter.name_ar) {
            onChangeRef.current({
              ...currentVal,
              centerName: validCenter.name_ar,
            });
          }
          return;
        }

        // One-time pre-match for legacy center name
        if (!currentVal.centerId && initialLegacyNames?.centerName && list.length > 0) {
          const normTarget = normalizeArabicName(initialLegacyNames.centerName);
          const matchedCenter = list.find(
            (c) =>
              normalizeArabicName(c.name_ar) === normTarget ||
              normalizeArabicName(c.name_en) === normTarget
          );
          if (matchedCenter) {
            onChangeRef.current({
              ...currentVal,
              centerId: matchedCenter.id,
              centerName: matchedCenter.name_ar,
              areaId: '',
              areaName: '',
            });
          }
        }
      })
      .catch((err: any) => {
        if (!active || valueRef.current.governorateId !== requestedGovId) return;
        setCenters([]);
        setGeoError(err?.message || 'تعذر تحميل المراكز من النظام الجغرافي المركزي');
      })
      .finally(() => {
        if (active) setLoadingCenters(false);
      });

    return () => {
      active = false;
    };
  }, [value.governorateId, reloadNonce, initialLegacyNames?.centerName]);

  // 4) Load areas whenever centerId changes (direct Governorate -> Center -> Area hierarchy)
  useEffect(() => {
    let active = true;
    const requestedGovId = value.governorateId;
    const requestedCenterId = value.centerId;

    if (!requestedGovId || !requestedCenterId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    setAreas([]);
    setLoadingAreas(true);
    setGeoError(null);

    getActiveAreas(requestedGovId, requestedCenterId)
      .then((list) => {
        if (
          !active ||
          valueRef.current.governorateId !== requestedGovId ||
          valueRef.current.centerId !== requestedCenterId
        ) {
          return;
        }
        setAreas(list);

        const currentVal = valueRef.current;

        if (currentVal.areaId) {
          const currentArea = list.find((a) => a.id === currentVal.areaId);
          if (!currentArea) {
            onChangeRef.current({
              ...currentVal,
              areaId: '',
              areaName: '',
            });
            return;
          }
          if (currentVal.areaName !== currentArea.name_ar) {
            onChangeRef.current({
              ...currentVal,
              areaName: currentArea.name_ar,
            });
          }
          return;
        }

        if (initialLegacyNames?.areaName && list.length > 0) {
          const normTarget = normalizeArabicName(initialLegacyNames.areaName);
          const matchedArea = list.find(
            (a) =>
              normalizeArabicName(a.name_ar) === normTarget ||
              normalizeArabicName(a.name_en) === normTarget
          );
          if (matchedArea) {
            onChangeRef.current({
              ...currentVal,
              areaId: matchedArea.id,
              areaName: matchedArea.name_ar,
            });
          }
        }
      })
      .catch((err: any) => {
        if (
          !active ||
          valueRef.current.governorateId !== requestedGovId ||
          valueRef.current.centerId !== requestedCenterId
        ) {
          return;
        }
        setAreas([]);
        setGeoError(err?.message || 'تعذر تحميل المناطق من النظام الجغرافي المركزي');
      })
      .finally(() => {
        if (active) setLoadingAreas(false);
      });

    return () => {
      active = false;
    };
  }, [value.governorateId, value.centerId, reloadNonce, initialLegacyNames?.areaName]);

  const selectClass = compact
    ? 'w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 disabled:opacity-60'
    : 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 disabled:opacity-60';

  return (
    <div className="space-y-3" dir="rtl">
      {geoError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center justify-between gap-2">
          <span>⚠️ {geoError}</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-3 gap-2' : 'sm:grid-cols-3 gap-2.5'}`}>
        {/* 1. Governorate */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <span>المحافظة *</span>
            {loadingGovs && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
          </label>
          <select
            value={value.governorateId}
            disabled={disabled || loadingGovs}
            onChange={(e) => {
              const nextId = e.target.value;
              const gov = governorates.find((g) => g.id === nextId);
              setCenters([]);
              setAreas([]);
              onChange({
                governorateId: nextId,
                governorateName: gov?.name_ar || '',
                centerId: '',
                centerName: '',
                areaId: '',
                areaName: '',
              });
            }}
            className={selectClass}
            required
          >
            <option value="">
              {loadingGovs
                ? 'جاري تحميل المحافظات...'
                : governorates.length === 0
                ? 'لا توجد محافظات مفعّلة حالياً'
                : '-- اختر المحافظة --'}
            </option>
            {governorates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name_ar}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Center / City */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <span>المركز / المدينة *</span>
            {loadingCenters && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
          </label>
          <select
            value={value.centerId}
            disabled={disabled || !value.governorateId || loadingCenters}
            onChange={(e) => {
              const nextId = e.target.value;
              const center = centers.find((c) => c.id === nextId);
              setAreas([]);
              onChange({
                ...value,
                centerId: nextId,
                centerName: center?.name_ar || '',
                areaId: '',
                areaName: '',
              });
            }}
            className={selectClass}
            required
          >
            <option value="">
              {!value.governorateId
                ? 'اختر المحافظة أولاً'
                : loadingCenters
                ? 'جاري تحميل المراكز...'
                : centers.length === 0
                ? 'لا توجد مراكز مفعّلة لهذه المحافظة'
                : '-- اختر المركز / المدينة --'}
            </option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Area / Neighborhood */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <span>المنطقة / الحي *</span>
            {loadingAreas && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
          </label>
          <select
            value={value.areaId}
            disabled={disabled || !value.centerId || loadingAreas}
            onChange={(e) => {
              const nextId = e.target.value;
              const area = areas.find((a) => a.id === nextId);
              onChange({
                ...value,
                areaId: nextId,
                areaName: area?.name_ar || '',
              });
            }}
            className={selectClass}
            required
          >
            <option value="">
              {!value.centerId
                ? 'اختر المركز أولاً'
                : loadingAreas
                ? 'جاري تحميل المناطق...'
                : areas.length === 0
                ? 'لا توجد مناطق مفعّلة لهذا المركز'
                : '-- اختر المنطقة / الحي --'}
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name_ar}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
