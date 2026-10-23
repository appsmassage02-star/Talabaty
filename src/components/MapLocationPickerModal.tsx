import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  Check,
  X,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Info,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (latitude: number, longitude: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  governorateName?: string;
  title?: string;
}

// Approximate coordinate centers for Egyptian governorates
const GOVERNORATE_COORDINATES: Record<string, [number, number]> = {
  'القاهرة': [30.0444, 31.2357],
  'الجيزة': [30.0131, 31.2089],
  'الإسكندرية': [31.2001, 29.9187],
  'الدقهلية': [31.0409, 31.3785],
  'البحر الأحمر': [27.2579, 33.8116],
  'البحيرة': [31.0364, 30.4697],
  'الفيوم': [29.3084, 30.8428],
  'الغربية': [30.7865, 31.0004],
  'الإسماعيلية': [30.5965, 32.2715],
  'المنوفية': [30.5568, 30.9991],
  'المنيا': [28.0871, 30.7618],
  'القليوبية': [30.2880, 31.1448],
  'الوادي الجديد': [25.4514, 30.5472],
  'السويس': [29.9668, 32.5498],
  'أسوان': [24.0889, 32.8998],
  'أسيوط': [27.1801, 31.1837],
  'بني سويف': [29.0661, 31.0994],
  'بورسعيد': [31.2653, 32.3019],
  'دمياط': [31.4175, 31.8144],
  'الشرقية': [30.5877, 31.5020],
  'جنوب سيناء': [28.5391, 33.9750],
  'كفر الشيخ': [31.1107, 30.9388],
  'مطروح': [31.3543, 27.2373],
  'الأقصر': [25.6872, 32.6396],
  'قنا': [26.1551, 32.7160],
  'شمال سيناء': [31.1316, 33.7984],
  'سوهـاج': [26.5569, 31.6948],
  'سوهاج': [26.5569, 31.6948],
};

const DEFAULT_EGYPT_CENTER: [number, number] = [30.0444, 31.2357]; // Cairo

// Create custom SVG Leaflet pin icon
function createCustomPinIcon() {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%); pointer-events: auto; cursor: grab;">
        <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.35));">
          <path d="M18 0C8.05888 0 0 8.05888 0 18C0 28.5 15.75 40.5 17.15 41.55C17.65 41.93 18.35 41.93 18.85 41.55C20.25 40.5 36 28.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="#059669"/>
          <circle cx="18" cy="17" r="7" fill="white"/>
          <circle cx="18" cy="17" r="3.5" fill="#047857"/>
        </svg>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
  });
}

export const MapLocationPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
  governorateName,
  title = 'تحديد موقع العنوان على الخريطة',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Local draft coordinates (independent of parent state until confirmed)
  const [draftLat, setDraftLat] = useState<number | null>(null);
  const [draftLng, setDraftLng] = useState<number | null>(null);

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [tileError, setTileError] = useState<boolean>(false);

  // Sync draft state on open
  useEffect(() => {
    if (isOpen) {
      const validLat =
        initialLat != null && !isNaN(initialLat) && initialLat >= -90 && initialLat <= 90
          ? Number(initialLat)
          : null;
      const validLng =
        initialLng != null && !isNaN(initialLng) && initialLng >= -180 && initialLng <= 180
          ? Number(initialLng)
          : null;

      setDraftLat(validLat);
      setDraftLng(validLng);
      setGpsError(null);
      setTileError(false);
    }
  }, [isOpen, initialLat, initialLng]);

  // Initialize and mount Leaflet map when modal is open
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Clean up any stale map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }

    const hasInitialCoords =
      initialLat != null &&
      initialLng != null &&
      !isNaN(initialLat) &&
      !isNaN(initialLng) &&
      initialLat >= -90 &&
      initialLat <= 90 &&
      initialLng >= -180 &&
      initialLng <= 180;

    let initialCenter: [number, number] = DEFAULT_EGYPT_CENTER;
    let initialZoom = 12;

    if (hasInitialCoords) {
      initialCenter = [Number(initialLat), Number(initialLng)];
      initialZoom = 16;
    } else if (governorateName && GOVERNORATE_COORDINATES[governorateName]) {
      initialCenter = GOVERNORATE_COORDINATES[governorateName];
      initialZoom = 12;
    }

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false, // We render our own UI controls
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // OpenStreetMap Tile Layer
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    tiles.on('tileerror', () => {
      setTileError(true);
    });

    tiles.addTo(map);

    // Attribution
    L.control
      .attribution({
        prefix: false,
        position: 'bottomleft',
      })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>')
      .addTo(map);

    const pinIcon = createCustomPinIcon();

    const placeOrUpdateMarker = (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));
      setDraftLat(roundedLat);
      setDraftLng(roundedLng);

      if (markerRef.current) {
        markerRef.current.setLatLng([roundedLat, roundedLng]);
      } else {
        const marker = L.marker([roundedLat, roundedLng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true,
        }).addTo(map);

        marker.on('dragend', (e) => {
          const markerLatLng = e.target.getLatLng();
          setDraftLat(Number(markerLatLng.lat.toFixed(6)));
          setDraftLng(Number(markerLatLng.lng.toFixed(6)));
        });

        markerRef.current = marker;
      }
    };

    // If initial coordinates exist, place the marker
    if (hasInitialCoords) {
      placeOrUpdateMarker(Number(initialLat), Number(initialLng));
    }

    // Map Click Listener to move or set marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      placeOrUpdateMarker(e.latlng.lat, e.latlng.lng);
    });

    // Invalidate map size after animation / modal display
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen, initialLat, initialLng, governorateName]);

  // Current GPS location trigger inside the modal
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsError('خدمة تحديد الموقع الجغرافي غير مدعومة في متصفحك أو جهازك.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setDraftLat(lat);
        setDraftLng(lng);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });

          const pinIcon = createCustomPinIcon();
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            const marker = L.marker([lat, lng], {
              icon: pinIcon,
              draggable: true,
              autoPan: true,
            }).addTo(mapInstanceRef.current);

            marker.on('dragend', (e) => {
              const markerLatLng = e.target.getLatLng();
              setDraftLat(Number(markerLatLng.lat.toFixed(6)));
              setDraftLng(Number(markerLatLng.lng.toFixed(6)));
            });

            markerRef.current = marker;
          }
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('تم رفض إذن الوصول للموقع. يرجى تفعيل إذن الموقع من إعدادات المتصفح.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('معلومات الموقع الجغرافي غير متاحة حالياً.');
            break;
          case error.TIMEOUT:
            setGpsError('انتهت مهلة استرجاع الموقع. يمكنك تحديد النقطة يدويًا بالضغط على الخريطة.');
            break;
          default:
            setGpsError('تعذر تحديد الموقع الجغرافي تلقائيًا.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleConfirm = () => {
    if (draftLat !== null && draftLng !== null) {
      onConfirm(draftLat, draftLng);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isCoordinatesSelected = draftLat !== null && draftLng !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[680px] border border-slate-200">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="text-[11px] text-slate-300">
                اضغط على الخريطة لتثبيت الدبوس، أو اسحبه للموقع الدقيق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning / Error Banners */}
        {tileError && (
          <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold flex items-center space-x-2 space-x-reverse shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              تعذر تحميل بعض أجزاء الخريطة. يرجى التحقق من اتصال الإنترنت، الخريطة التفاعلية تتطلب اتصالاً بالشبكة.
            </span>
          </div>
        )}

        {gpsError && (
          <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 space-x-reverse shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{gpsError}</span>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              className="text-xs text-rose-500 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Map Container Area */}
        <div className="relative flex-1 bg-slate-100 min-h-0 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Map Floating Actions */}
          <div className="absolute top-3 right-3 z-10 flex flex-col space-y-2 pointer-events-auto">
            {/* GPS Locate Me Button */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              title="تحديد موقعي الحالي عبر GPS"
              className="w-10 h-10 bg-white/95 hover:bg-white text-emerald-700 rounded-2xl shadow-md border border-slate-200/80 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
            >
              {isLocating ? (
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              ) : (
                <Crosshair className="w-5 h-5 text-emerald-600" />
              )}
            </button>

            {/* Zoom Controls */}
            <div className="bg-white/95 rounded-2xl shadow-md border border-slate-200/80 flex flex-col overflow-hidden">
              <button
                type="button"
                onClick={handleZoomIn}
                title="تكبير"
                className="w-10 h-9 hover:bg-slate-100 text-slate-700 flex items-center justify-center border-b border-slate-200 active:bg-slate-200"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="تصغير"
                className="w-10 h-9 hover:bg-slate-100 text-slate-700 flex items-center justify-center active:bg-slate-200"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Helper Badge */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none max-w-[240px] sm:max-w-xs">
            <div className="bg-slate-900/85 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl shadow-lg text-[11px] font-medium flex items-center space-x-1.5 space-x-reverse border border-white/10">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>انقر في أي مكان لتثبيت الدبوس ثم حركه للدقة</span>
            </div>
          </div>
        </div>

        {/* Footer with Selected Coordinates & Action Buttons */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="w-full sm:w-auto flex items-center space-x-2 space-x-reverse">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                isCoordinatesSelected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-right">
              {isCoordinatesSelected ? (
                <div>
                  <div className="text-xs font-black text-slate-900 flex items-center space-x-1.5 space-x-reverse">
                    <span>النقطة المحددة:</span>
                    <span dir="ltr" className="font-mono text-emerald-700 text-xs font-bold">
                      {draftLat?.toFixed(6)}, {draftLng?.toFixed(6)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    يمكنك سحب العلامة على الخريطة لتعديل الموقع
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-bold text-slate-700 block">
                    لم يتم اختيار نقطة بعد
                  </span>
                  <span className="text-[10px] text-slate-400">
                    اضغط على أي مكان بالخريطة لتحديد الموقع
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center justify-end space-x-2 space-x-reverse">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isCoordinatesSelected}
              className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 space-x-reverse transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد هذا الموقع</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
