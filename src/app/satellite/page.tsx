'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  UploadCloud,
  Trash2,
  Download,
  Sliders,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  History,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize,
  Clock,
  ShieldAlert,
  X,
  Globe,
  MapPin,
  Satellite,
  Compass,
  ArrowRight,
  Loader2
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore, PlasticScan } from '@/store/usePredictionStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Load Leaflet map component dynamically with SSR disabled to prevent compilation crashes
const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[350px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      <span className="text-xs text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const PRESETS = [
  { name: 'Manila Bay, PH', lat: 14.5995, lng: 120.9842 },
  { name: 'GPatch Area Alpha', lat: 35.0, lng: -140.0 },
  { name: 'Henderson Island', lat: -24.3683, lng: -128.3184 },
  { name: 'Ganges River Delta', lat: 22.0000, lng: 90.0000 },
  { name: 'Roatan Coast, HN', lat: 16.3267, lng: -86.5378 },
];

export default function SatelliteWorkspace() {
  const { scans, addScan, deleteScan } = usePredictionStore();
  const {
    apiEndpoint,
    mapTilerKey,
    sentinelClientId,
    sentinelClientSecret
  } = useSettingsStore();

  const [activeScan, setActiveScan] = useState<PlasticScan | null>(null);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowConf, setShowLowConf] = useState(false);

  // Map & Satellite Config State
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 14.5995,
    lng: 120.9842,
  });
  const [provider, setProvider] = useState<'sentinel' | 'maptiler'>('maptiler');
  const [dateFrom, setDateFrom] = useState('2025-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [maxCloudCoverage, setMaxCloudCoverage] = useState(20);
  const [bandConfiguration, setBandConfiguration] = useState<'true-color' | 'false-color'>('true-color');

  // Aspect ratio and inspector states
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState<number | null>(null);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Zoom & Pan states for inspector
  const [inspectZoom, setInspectZoom] = useState(1);
  const [inspectPanOffset, setInspectPanOffset] = useState({ x: 0, y: 0 });
  const [isInspectPanning, setIsInspectPanning] = useState(false);
  const [inspectPanStart, setInspectPanStart] = useState({ x: 0, y: 0 });

  // Measured displayed sizes for pixel-perfect coordinates scaling
  const [displayedDims, setDisplayedDims] = useState<{ w: number; h: number } | null>(null);
  const [displayedInspectDims, setDisplayedInspectDims] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inspectContainerRef = useRef<HTMLDivElement>(null);
  const inspectWrapperRef = useRef<HTMLDivElement>(null);

  // Load natural image dimensions when imageFile changes
  useEffect(() => {
    if (!imageFile) {
      setImageDims(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imageFile;
  }, [imageFile]);

  // ResizeObserver for main image wrapper
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      setDisplayedDims(null);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDisplayedDims({ w: width, h: height });
    });

    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, [imageFile]);

  // ResizeObserver for inspector image wrapper
  useEffect(() => {
    const wrapper = inspectWrapperRef.current;
    if (!wrapper || !isInspectOpen) {
      setDisplayedInspectDims(null);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDisplayedInspectDims({ w: width, h: height });
    });

    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, [isInspectOpen, imageFile]);

  // Coordinate helper: maps bounding box coordinates relative to original dimensions into current displayed layout dimensions
  const getBoxCoords = (box: any, dims: { w: number; h: number } | null) => {
    if (!dims || !imageDims) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const originalWidth = imageDims.w;
    const originalHeight = imageDims.h;
    const displayedWidth = dims.w;
    const displayedHeight = dims.h;

    const scaleX = displayedWidth / originalWidth;
    const scaleY = displayedHeight / originalHeight;

    const x1 = (box.x / 100) * originalWidth;
    const y1 = (box.y / 100) * originalHeight;
    const x2 = ((box.x + box.width) / 100) * originalWidth;
    const y2 = ((box.y + box.height) / 100) * originalHeight;

    const left = x1 * scaleX;
    const top = y1 * scaleY;
    const width = (x2 - x1) * scaleX;
    const height = (y2 - y1) * scaleY;

    return { left, top, width, height };
  };

  // Check backend health status on load or endpoint changes, polling every 5 seconds
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const healthUrl = apiEndpoint.replace('/predict', '/health');
        const res = await fetch(healthUrl, { cache: 'no-store' });
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, [apiEndpoint]);

  // Add native wheel event listener to handle zoom centered on cursor cleanly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (!imageFile) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      e.preventDefault();

      const zoomFactor = 0.15;
      const containerRect = container.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      const cursorX = e.clientX - containerRect.left;
      const cursorY = e.clientY - containerRect.top;

      setZoom((prevZoom) => {
        const nextZoom =
          e.deltaY < 0
            ? Math.min(prevZoom + zoomFactor, 5)
            : Math.max(prevZoom - zoomFactor, 1);

        if (nextZoom === 1) {
          setPanOffset({ x: 0, y: 0 });
        } else {
          setPanOffset((prevPan) => {
            const defaultLeft = wrapperRect.left - containerRect.left - prevPan.x;
            const defaultTop = wrapperRect.top - containerRect.top - prevPan.y;

            const cursorXInWrapper = e.clientX - wrapperRect.left;
            const cursorYInWrapper = e.clientY - wrapperRect.top;

            const origX = cursorXInWrapper / prevZoom;
            const origY = cursorYInWrapper / prevZoom;

            const nextPanX = cursorX - defaultLeft - origX * nextZoom;
            const nextPanY = cursorY - defaultTop - origY * nextZoom;

            return { x: nextPanX, y: nextPanY };
          });
        }
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [imageFile]);

  // Add native wheel event listener for inspector modal
  useEffect(() => {
    const container = inspectContainerRef.current;
    if (!container || !isInspectOpen) return;

    const handleInspectWheel = (e: WheelEvent) => {
      const wrapper = inspectWrapperRef.current;
      if (!wrapper) return;
      e.preventDefault();

      const zoomFactor = 0.15;
      const containerRect = container.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      const cursorX = e.clientX - containerRect.left;
      const cursorY = e.clientY - containerRect.top;

      setInspectZoom((prevZoom) => {
        const nextZoom =
          e.deltaY < 0
            ? Math.min(prevZoom + zoomFactor, 5)
            : Math.max(prevZoom - zoomFactor, 1);

        if (nextZoom === 1) {
          setInspectPanOffset({ x: 0, y: 0 });
        } else {
          setInspectPanOffset((prevPan) => {
            const defaultLeft = wrapperRect.left - containerRect.left - prevPan.x;
            const defaultTop = wrapperRect.top - containerRect.top - prevPan.y;

            const cursorXInWrapper = e.clientX - wrapperRect.left;
            const cursorYInWrapper = e.clientY - wrapperRect.top;

            const origX = cursorXInWrapper / prevZoom;
            const origY = cursorYInWrapper / prevZoom;

            const nextPanX = cursorX - defaultLeft - origX * nextZoom;
            const nextPanY = cursorY - defaultTop - origY * nextZoom;

            return { x: nextPanX, y: nextPanY };
          });
        }
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleInspectWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleInspectWheel);
    };
  }, [isInspectOpen]);

  // Translate coordinates from YOLO raw shape bounds into stored relative percentages
  const parseBoxes = (boxes: any[], naturalWidth: number, naturalHeight: number) => {
    return boxes.map((box) => {
      const { x1, y1, x2, y2, label, confidence } = box;
      const isNormalized = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1;

      if (isNormalized) {
        return {
          x: x1 * 100,
          y: y1 * 100,
          width: (x2 - x1) * 100,
          height: (y2 - y1) * 100,
          label: label || 'plastic',
          confidence: confidence || 0.9,
        };
      } else if (naturalWidth > 0 && naturalHeight > 0) {
        return {
          x: (x1 / naturalWidth) * 100,
          y: (y1 / naturalHeight) * 100,
          width: ((x2 - x1) / naturalWidth) * 100,
          height: ((y2 - y1) / naturalHeight) * 100,
          label: label || 'plastic',
          confidence: confidence || 0.9,
        };
      } else {
        return {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          label: label || 'plastic',
          confidence: confidence || 0.9,
        };
      }
    });
  };

  // Helper to compress local images to stay inside localStorage quota limits
  const compressImage = (dataUrl: string, maxDim = 800, quality = 0.65): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Convert Base64 Data URL to a File Object for Uploading
  const base64ToFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Execute Live YOLOv8 Inference on backend
  const runPrediction = async (file: File, locationName: string) => {
    setIsScanning(true);
    setError(null);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Inference engine returned status: ${res.status}`);
      }

      const resData = await res.json();
      const predictions = resData.predictions || [];
      const modelUsed = resData.model_used || 'best.pt';
      const modelPath = resData.model_path || 'weights/marin-plastic/best.pt';
      const inferenceTime = resData.inference_time_ms || 0;

      // Temporary local reader to read image data url for rendering
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read visual feed data url.'));
        reader.readAsDataURL(file);
      });

      setImageFile(dataUrl);

      const imgDims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = dataUrl;
      });

      const parsedBoxes = parseBoxes(predictions, imgDims.w, imgDims.h);
      const count = parsedBoxes.length;
      const avgConfidence =
        count > 0
          ? parseFloat(
              (
                (parsedBoxes.reduce((acc, curr) => acc + curr.confidence, 0) / count) *
                100
              ).toFixed(1)
            )
          : 100;

      let sizeClassification: 'Micro' | 'Macro' | 'Mixed' = 'Macro';
      const hasMicro = parsedBoxes.some((b) => b.label.includes('micro') || b.width < 5);
      const hasMacro = parsedBoxes.some((b) => !b.label.includes('micro') && b.width >= 5);
      if (hasMicro && hasMacro) sizeClassification = 'Mixed';
      else if (hasMicro) sizeClassification = 'Micro';

      const labels = Array.from(new Set(parsedBoxes.map((b) => b.label)));

      // Compress and persist
      const compressedUrl = await compressImage(dataUrl, 800, 0.65);

      const newScan: PlasticScan = {
        id: `scan-sat-${Date.now()}`,
        imageUrl: compressedUrl,
        timestamp: new Date().toISOString(),
        detectedCount: count,
        confidence: avgConfidence,
        labels,
        boundingBoxes: parsedBoxes,
        location: locationName,
        sizeClassification,
        modelUsed,
        modelPath,
        inferenceTimeMs: inferenceTime,
      };

      addScan(newScan);
      setActiveScan(newScan);
      setBackendOnline(true);
    } catch (err: any) {
      console.error('Inference error:', err);
      setBackendOnline(false);
      setError(err.message || 'Failed to communicate with YOLOv8 API server.');
      setActiveScan(null);
      setImageFile(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Process manual local image upload
  const processLocalUpload = (file: File) => {
    runPrediction(file, `Local: ${file.name.substring(0, 16)}`);
  };

  // Trigger Satellite Capture
  const handleCaptureSatellite = async () => {
    setIsCapturing(true);
    setError(null);
    const locationName = `${selectedCoords.lat.toFixed(4)}°N, ${selectedCoords.lng.toFixed(4)}°E (${provider === 'sentinel' ? 'Sentinel-2' : 'MapTiler'})`;

    try {
      if (provider === 'maptiler') {
        // Since MapTiler's Static Maps API requires a paid plan (returning 403 Access Denied),
        // we dynamically calculate and fetch a 3x3 grid of standard tiles (included in the free tier)
        // using our secure server-side GET tile proxy. We then stitch and crop them perfectly
        // on a client-side canvas so the user gets high-res satellite captures for FREE!
        const z = 15; // Zoom 15 is excellent for high-res plastic detection (approx. 2.4m/pixel)
        const lat = selectedCoords.lat;
        const lng = selectedCoords.lng;
        
        const lngRad = (lng * Math.PI) / 180;
        const latRad = (lat * Math.PI) / 180;
        const n = Math.pow(2, z);
        
        const xDecimal = ((lng + 180) / 360) * n;
        const yDecimal = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
        
        const cx = Math.floor(xDecimal);
        const cy = Math.floor(yDecimal);
        
        const canvas = document.createElement('canvas');
        const width = 768;
        const height = 768;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to create 2D canvas context for tile stitching.');
        }

        const tileSize = 512; // MapTiler progressive tiles are 512x512
        const targetPixelX = (1 + (xDecimal - cx)) * tileSize;
        const targetPixelY = (1 + (yDecimal - cy)) * tileSize;
        const cropLeft = targetPixelX - width / 2;
        const cropTop = targetPixelY - height / 2;

        const tilePromises: Promise<any>[] = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const tx = cx + dx;
            const ty = cy + dy;
            const tileUrl = `/api/satellite?provider=maptiler&z=${z}&x=${tx}&y=${ty}`;

            tilePromises.push(
              new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  const actualTileSize = img.naturalWidth || tileSize;
                  // Recalculate precisely using actual loaded dimensions
                  const tPixelX = (1 + (xDecimal - cx)) * actualTileSize;
                  const tPixelY = (1 + (yDecimal - cy)) * actualTileSize;
                  const cLeft = tPixelX - width / 2;
                  const cTop = tPixelY - height / 2;

                  const destX = (dx + 1) * actualTileSize - cLeft;
                  const destY = (dy + 1) * actualTileSize - cTop;
                  ctx.drawImage(img, destX, destY, actualTileSize, actualTileSize);
                  resolve(null);
                };
                img.onerror = () => {
                  // Fallback: draw a neutral dark green/blue background color if a tile fails to load
                  const actualTileSize = tileSize;
                  const tPixelX = (1 + (xDecimal - cx)) * actualTileSize;
                  const tPixelY = (1 + (yDecimal - cy)) * actualTileSize;
                  const cLeft = tPixelX - width / 2;
                  const cTop = tPixelY - height / 2;

                  const destX = (dx + 1) * actualTileSize - cLeft;
                  const destY = (dy + 1) * actualTileSize - cTop;
                  ctx.fillStyle = '#0f172a'; // slate-900 background
                  ctx.fillRect(destX, destY, actualTileSize, actualTileSize);
                  resolve(null);
                };
                img.src = tileUrl;
              })
            );
          }
        }

        await Promise.all(tilePromises);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const file = base64ToFile(dataUrl, `maptiler_${Date.now()}.jpg`);
        await runPrediction(file, locationName);
      } else {
        // Sentinel Hub via server proxy — credentials come from Settings or fall back to .env

        // Expand coordinates into a bounding box (about 4.4km x 4.4km box)
        const delta = 0.02;
        const bbox = [
          selectedCoords.lng - delta,
          selectedCoords.lat - delta,
          selectedCoords.lng + delta,
          selectedCoords.lat + delta,
        ];

        const proxyResponse = await fetch('/api/satellite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: 'sentinel',
            clientId: sentinelClientId,
            clientSecret: sentinelClientSecret,
            bbox,
            dateFrom,
            dateTo,
            maxCloudCoverage,
            bandConfiguration,
          }),
        });

        if (!proxyResponse.ok) {
          const proxyErr = await proxyResponse.json();
          throw new Error(proxyErr.error || 'Sentinel Hub API proxy failed.');
        }

        const data = await proxyResponse.json();
        const base64Url = data.imageUrl;

        const file = base64ToFile(base64Url, `sentinel_${Date.now()}.png`);
        await runPrediction(file, locationName);
      }
    } catch (err: any) {
      console.error('Capture error:', err);
      setError(err.message || 'Failed to capture satellite imagery.');
    } finally {
      setIsCapturing(false);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) processLocalUpload(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  // Zoom controls
  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const zoomOut = () =>
    setZoom((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Pan mouse controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (zoom === 1) {
      const ref = wrapperRef.current || containerRef.current;
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, x)));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    setIsPanning(true);
    const touch = e.touches[0];
    setPanStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y,
      });
    } else if (zoom === 1 && e.touches.length === 1) {
      if (!e.touches[0]) return;
      const ref = wrapperRef.current || containerRef.current;
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, x)));
    }
  };

  const getSeverity = (count: number) => {
    if (count === 0)
      return {
        label: 'Clean / Safe',
        color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      };
    if (count <= 3)
      return {
        label: 'Low Contamination',
        color: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
      };
    if (count <= 7)
      return {
        label: 'Moderate Threat',
        color: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
      };
    return {
      label: 'Severe Pollution Alert',
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    };
  };

  const downloadReport = (scan: PlasticScan, boxesToExport: any[]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Label,Confidence,X,Y,Width,Height',
        ...boxesToExport.map(
          (b) =>
            `${b.label},${b.confidence},${b.x.toFixed(2)},${b.y.toFixed(2)},${b.width.toFixed(
              2
            )},${b.height.toFixed(2)}`
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alcoma_sat_report_${scan.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering configurations
  const displayedBoxes = activeScan
    ? activeScan.boundingBoxes.filter((box) => showLowConf || box.confidence >= 0.55)
    : [];

  const displayedCount = displayedBoxes.length;

  const avgConfidence =
    displayedCount > 0
      ? parseFloat(
          (
            (displayedBoxes.reduce((acc, curr) => acc + curr.confidence, 0) /
              displayedCount) *
            100
          ).toFixed(1)
        )
      : 0;

  const displayedLabels = Array.from(new Set(displayedBoxes.map((b) => b.label)));

  let displayedSizeClassification: 'Micro' | 'Macro' | 'Mixed' = 'Macro';
  const hasMicro = displayedBoxes.some((b) => b.label.includes('micro') || b.width < 5);
  const hasMacro = displayedBoxes.some((b) => !b.label.includes('micro') && b.width >= 5);
  if (hasMicro && hasMacro) displayedSizeClassification = 'Mixed';
  else if (hasMicro) displayedSizeClassification = 'Micro';

  // Label offsets calculations to prevent overlaps
  const stackIndices = useMemo(() => {
    const indices: number[] = [];
    displayedBoxes.forEach((box, i) => {
      let maxIdx = -1;
      for (let j = 0; j < i; j++) {
        if (
          Math.abs(box.x - displayedBoxes[j].x) < 10 &&
          Math.abs(box.y - displayedBoxes[j].y) < 5
        ) {
          maxIdx = Math.max(maxIdx, indices[j]);
        }
      }
      indices.push(maxIdx + 1);
    });
    return indices;
  }, [displayedBoxes]);

  // Preset initial load
  useEffect(() => {
    if (scans.length > 0 && !activeScan) {
      // Find latest satellite scan if any, or default to latest scan
      const satScan = scans.find((s) => s.id.startsWith('scan-sat-')) || scans[0];
      setActiveScan(satScan);
      setImageFile(satScan.imageUrl);
    }
  }, [scans, activeScan]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Satellite Workspace</h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyze coordinates via live Sentinel-2 imagery & MapTiler captures using customized YOLOv8 intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {backendOnline === false ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Inference Offline
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Inference Engine Sync Active
            </span>
          )}
        </div>
      </div>

      {/* Warnings & Errors */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Operation Failed</span> — {error}
          </div>
        </div>
      )}

      {/* Main Grid: Left Map & Config (5 Cols) // Center Viewport (7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-grow">
        {/* COLUMN 1: SATELLITE CONSOLE & MAP */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <GlassCard className="flex flex-col gap-4 p-4 min-h-[350px]">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
                Geographic Coordinate Capture
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Click on map to drop target pin</span>
            </div>

            {/* Map Container */}
            <div className="w-full h-72 rounded-xl overflow-hidden relative border border-white/5 bg-slate-950">
              <SatelliteMap
                mapTilerKey={mapTilerKey}
                selectedCoords={selectedCoords}
                onCenterSelect={(lat, lng) => setSelectedCoords({ lat, lng })}
                presetCoords={PRESETS}
              />
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                Target Hotspot Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedCoords({ lat: p.lat, lng: p.lng })}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                      Math.abs(selectedCoords.lat - p.lat) < 0.0001 &&
                      Math.abs(selectedCoords.lng - p.lng) < 0.0001
                        ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 font-bold'
                        : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MapPin size={10} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Configuration Card */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
                Satellite Stream Provider
              </span>
            </div>

            {/* Provider Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 border border-white/5 rounded-xl">
              <button
                onClick={() => setProvider('maptiler')}
                className={`py-2 text-center rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  provider === 'maptiler'
                    ? 'bg-white/5 border border-white/10 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Globe size={12} />
                MapTiler Static
              </button>
              <button
                onClick={() => setProvider('sentinel')}
                className={`py-2 text-center rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  provider === 'sentinel'
                    ? 'bg-white/5 border border-white/10 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Satellite size={12} />
                Sentinel Hub
              </button>
            </div>

            {/* Sentinel Hub Settings Panel */}
            {provider === 'sentinel' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 pt-1 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Date Range From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Date Range To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                      Max Cloud Coverage
                    </label>
                    <span className="text-[10px] font-mono text-white">{maxCloudCoverage}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={maxCloudCoverage}
                    onChange={(e) => setMaxCloudCoverage(parseInt(e.target.value))}
                    className="w-full accent-white cursor-pointer opacity-70 hover:opacity-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                    Band Configuration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBandConfiguration('true-color')}
                      className={`py-1.5 text-center rounded-lg border text-[10px] font-semibold cursor-pointer transition-all ${
                        bandConfiguration === 'true-color'
                          ? 'border-white bg-white/5 text-white'
                          : 'border-white/5 bg-slate-950/20 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      True Color (B04-B03-B02)
                    </button>
                    <button
                      onClick={() => setBandConfiguration('false-color')}
                      className={`py-1.5 text-center rounded-lg border text-[10px] font-semibold cursor-pointer transition-all ${
                        bandConfiguration === 'false-color'
                          ? 'border-white bg-white/5 text-white'
                          : 'border-white/5 bg-slate-950/20 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      False Color (B08-B04-B03)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {provider === 'maptiler' && (
              <div className="text-[10px] text-slate-500 leading-normal p-1 bg-slate-950/20 border border-white/5 rounded-lg flex gap-2">
                <Info size={12} className="shrink-0 text-slate-400 mt-0.5" />
                <p>
                  MapTiler provides premium sub-meter color-balanced orthophotos. Captures are taken at zoom level 14 (approx. 9.5m/pixel grid).
                </p>
              </div>
            )}

            {/* Target Coordinates Details */}
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 text-[10px] space-y-1.5">
              <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                Target Telemetry Point
              </span>
              <div className="flex justify-between text-slate-400">
                <span>Latitude:</span>
                <span className="font-mono text-white font-semibold">{selectedCoords.lat.toFixed(6)}°</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Longitude:</span>
                <span className="font-mono text-white font-semibold">{selectedCoords.lng.toFixed(6)}°</span>
              </div>
            </div>

            {/* Action Trigger Buttons */}
            <div className="flex flex-col gap-2">
              <button
                disabled={isCapturing || isScanning}
                onClick={handleCaptureSatellite}
                className="w-full py-3 bg-white hover:bg-slate-100 disabled:bg-white/20 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                {isCapturing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Synchronizing Satellite Imagery...</span>
                  </>
                ) : (
                  <>
                    <Satellite size={14} />
                    <span>Capture & Detect Target Location</span>
                  </>
                )}
              </button>

              <div
                {...getRootProps()}
                className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-900/10 hover:bg-white/5 ${
                  isDragActive ? 'border-white' : 'border-white/5'
                }`}
              >
                <input {...getInputProps()} />
                <span className="text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                  <UploadCloud size={12} className="text-slate-400" />
                  Drag / Upload Local Satellite Photo
                </span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* COLUMN 2: MAIN VIEWPORT (DETECTION SUMMARY) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <GlassCard className="relative overflow-hidden flex-grow flex flex-col items-center justify-center min-h-[420px] p-4 bg-slate-950/20">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/50 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="absolute left-0 right-0 h-[1.5px] bg-white shadow-[0_0_10px_white] animate-scan z-30" />
                <div className="p-4 bg-slate-900 border border-white/10 rounded-lg flex items-center gap-3">
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  <span className="text-[10px] font-mono font-medium tracking-wider text-slate-300 uppercase">
                    Running YOLOv8 custom weights...
                  </span>
                </div>
              </div>
            )}

            {imageFile ? (
              <div className="w-full h-full flex flex-col justify-between gap-4">
                {/* Viewport Header */}
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="font-semibold text-slate-300 uppercase">
                      {activeScan ? activeScan.location : 'Visual Stream'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    {activeScan && (
                      <>
                        <button
                          onClick={() => setIsInspectOpen(true)}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20"
                        >
                          <Maximize size={10} />
                          <span>Inspect Full Resolution</span>
                        </button>
                        <span>|</span>
                        <button
                          onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                        >
                          {showBoundingBoxes ? <EyeOff size={12} /> : <Eye size={12} />}
                          <span>Bounding Boxes</span>
                        </button>
                      </>
                    )}
                    {zoom === 1 && <span>|</span>}
                    {zoom === 1 && <span>Slider compares Original / AI</span>}
                  </div>
                </div>

                {/* Main Viewport Container */}
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  onDoubleClick={resetZoom}
                  className={`relative w-full flex-1 min-h-[300px] rounded-xl overflow-hidden border border-white/5 select-none bg-slate-900 flex items-center justify-center ${
                    zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-ew-resize'
                  }`}
                >
                  {/* Floating Zoom Controls */}
                  <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-950/80 backdrop-blur border border-white/5 rounded-lg p-1">
                    <button
                      onClick={zoomIn}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={13} />
                    </button>
                    <button
                      onClick={zoomOut}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    {zoom > 1 && (
                      <button
                        onClick={resetZoom}
                        className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Reset Zoom"
                      >
                        <Maximize size={13} />
                      </button>
                    )}
                  </div>

                  {/* Transform Wrapper */}
                  <div
                    ref={wrapperRef}
                    className="max-w-full max-h-full w-auto h-auto relative"
                    style={{
                      aspectRatio: imageDims ? `${imageDims.w} / ${imageDims.h}` : 'auto',
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                      transformOrigin: 'top left',
                      transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      containerType: 'inline-size',
                    }}
                  >
                    <img
                      src={imageFile || undefined}
                      alt="Satellite snap scan"
                      className="w-full h-full object-contain pointer-events-none block"
                    />

                    {/* Bounding Box Render */}
                    {activeScan && showBoundingBoxes && displayedDims && (
                      <AnimatePresence>
                        {displayedBoxes.map((box, idx) => {
                          const coords = getBoxCoords(box, displayedDims);
                          const stackIndex = stackIndices[idx] || 0;
                          const isHovered = hoveredBoxIndex === idx;

                          const isNearTop = box.y < 8;
                          const isNearRight = box.x > 80;

                          return (
                            <motion.div
                              key={`${activeScan.id}-box-${idx}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              onMouseEnter={() => setHoveredBoxIndex(idx)}
                              onMouseLeave={() => setHoveredBoxIndex(null)}
                              className={`absolute border rounded pointer-events-auto transition-all ${
                                isHovered
                                  ? 'border-cyan-300 bg-cyan-400/[0.12] shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10'
                                  : hoveredBoxIndex !== null
                                    ? 'border-cyan-500/20 bg-cyan-500/[0.01] opacity-30'
                                    : 'border-cyan-400/80 bg-cyan-500/[0.04] shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                              }`}
                              style={{
                                left: `${coords.left}px`,
                                top: `${coords.top}px`,
                                width: `${coords.width}px`,
                                height: `${coords.height}px`,
                                borderWidth: `${1.2 / zoom}px`,
                              }}
                            >
                              <span
                                className={`absolute bg-slate-950/85 backdrop-blur-sm text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide whitespace-nowrap select-none transition-colors pointer-events-none ${
                                  isHovered
                                    ? 'text-cyan-300 border-cyan-400 shadow-md'
                                    : 'text-cyan-400 border-cyan-500/20'
                                }`}
                                style={{
                                  ...(isNearTop
                                    ? {
                                        top: `calc(2px + ${(stackIndex * 22) / zoom}px)`,
                                        bottom: 'auto',
                                        transformOrigin: isNearRight ? 'top right' : 'top left',
                                      }
                                    : {
                                        bottom: `calc(100% + ${4 / zoom}px + ${(stackIndex * 22) / zoom}px)`,
                                        top: 'auto',
                                        transformOrigin: isNearRight ? 'bottom right' : 'bottom left',
                                      }),
                                  ...(isNearRight
                                    ? { right: '0px', left: 'auto' }
                                    : { left: '0px', right: 'auto' }),
                                  transform: `scale(${1 / zoom})`,
                                  borderWidth: `${1 / zoom}px`,
                                }}
                              >
                                {box.label} {(box.confidence * 100).toFixed(0)}%
                              </span>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}

                    {/* Compare slider overlay */}
                    {zoom === 1 && (
                      <div
                        className="absolute inset-0 overflow-hidden border-r border-white/20 pointer-events-none"
                        style={{ width: `${sliderPos}%` }}
                      >
                        <img
                          src={imageFile || undefined}
                          alt="Original Viewport"
                          className="absolute inset-y-0 left-0 h-full max-w-none pointer-events-none"
                          style={{
                            width: '100cqw',
                          }}
                        />
                      </div>
                    )}

                    {/* Drag handle */}
                    {zoom === 1 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center shadow-lg">
                          <Sliders size={8} className="text-white rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-slate-500 space-y-2">
                <UploadCloud size={36} className="mx-auto text-slate-600 animate-pulse" />
                <p className="text-xs font-semibold text-slate-300">Awaiting Telemetry Ingestion</p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                  Click 'Capture & Detect' or upload a file to view YOLOv8 predictions and run live analysis reports.
                </p>
              </div>
            )}
          </GlassCard>

          {/* Quick Inference Panel */}
          {activeScan && (
            <GlassCard className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Live Inference Summary
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase">Detected Refuse</span>
                    <span className="text-lg font-bold text-white font-mono">{displayedCount}</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase">Avg Confidence</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {displayedCount > 0 ? `${avgConfidence}%` : '—'}
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase">Inference Speed</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {activeScan.inferenceTimeMs ? `${activeScan.inferenceTimeMs}ms` : '125ms'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">
                    Classification Labels
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {displayedLabels.length > 0 ? (
                      displayedLabels.map((lbl, i) => (
                        <span
                          key={i}
                          className="text-[8px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded uppercase"
                        >
                          {lbl}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8px] font-medium text-slate-500 italic bg-white/5 px-2 py-0.5 rounded">
                        No targets flagged
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                <div>
                  <span className="text-[8px] text-slate-500 font-bold block uppercase mb-1">
                    Severity Index
                  </span>
                  {(() => {
                    const sev = getSeverity(displayedCount);
                    return (
                      <div
                        className={`text-[9px] px-2 py-1 border rounded-lg font-bold tracking-wide uppercase inline-block ${sev.color}`}
                      >
                        {sev.label}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1.5 pt-2">
                  <button
                    onClick={() => downloadReport(activeScan, displayedBoxes)}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download size={10} />
                    Export CSV Report
                  </button>
                  <button
                    onClick={() => {
                      deleteScan(activeScan.id);
                      setActiveScan(null);
                      setImageFile(null);
                    }}
                    className="w-full py-2 bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 size={10} />
                    Delete Telemetry
                  </button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Historical telemetry bottom ribbon */}
      <div className="w-full space-y-3 pt-8 border-t border-white/5 mt-8">
        <div className="flex items-center gap-2">
          <History size={14} className="text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Satellite Scan History
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 overflow-x-auto pb-2 no-scrollbar">
          {scans
            .filter((s) => s.id.startsWith('scan-sat-'))
            .map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setActiveScan(s);
                  setImageFile(s.imageUrl);
                  resetZoom();
                }}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 shrink-0 ${
                  activeScan?.id === s.id
                    ? 'bg-white/5 border-white/20'
                    : 'bg-slate-950/20 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="aspect-[4/3] w-full rounded overflow-hidden border border-white/5 relative bg-slate-950">
                  <img src={s.imageUrl} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-slate-200 block truncate">
                    {s.location}
                  </span>
                  <span className="text-[8px] text-slate-500 block truncate font-mono">
                    {s.detectedCount} objects
                  </span>
                </div>
              </div>
            ))}
          {scans.filter((s) => s.id.startsWith('scan-sat-')).length === 0 && (
            <div className="col-span-full py-4 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              No historical satellite detections. Capture maps above to log results.
            </div>
          )}
        </div>
      </div>

      {/* Full resolution inspector modal */}
      <AnimatePresence>
        {isInspectOpen && activeScan && imageDims && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900/90 border border-white/10 rounded-2xl w-full h-full max-w-6xl flex flex-col md:flex-row overflow-hidden shadow-2xl"
            >
              {/* Left Compartment: Zoomable Viewport */}
              <div className="flex-1 relative flex flex-col bg-black/40 min-h-[300px] md:min-h-0">
                <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-slate-950/85 to-transparent text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-bold text-slate-200 uppercase tracking-wider">
                      Satellite Visual Inspector: {activeScan.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/60 backdrop-blur border border-white/5 rounded-lg px-2.5 py-1">
                    <span className="font-semibold text-slate-300">Resolution:</span>
                    <span className="font-mono text-cyan-400">
                      {imageDims.w} × {imageDims.h} px
                    </span>
                  </div>
                </div>

                <div
                  ref={inspectContainerRef}
                  onMouseDown={(e) => {
                    if (inspectZoom <= 1) return;
                    setIsInspectPanning(true);
                    setInspectPanStart({
                      x: e.clientX - inspectPanOffset.x,
                      y: e.clientY - inspectPanOffset.y,
                    });
                  }}
                  onMouseMove={(e) => {
                    if (isInspectPanning) {
                      setInspectPanOffset({
                        x: e.clientX - inspectPanStart.x,
                        y: e.clientY - inspectPanStart.y,
                      });
                    }
                  }}
                  onMouseUp={() => setIsInspectPanning(false)}
                  onMouseLeave={() => setIsInspectPanning(false)}
                  onTouchStart={(e) => {
                    if (inspectZoom <= 1 || e.touches.length !== 1) return;
                    setIsInspectPanning(true);
                    const touch = e.touches[0];
                    setInspectPanStart({
                      x: touch.clientX - inspectPanOffset.x,
                      y: touch.clientY - inspectPanOffset.y,
                    });
                  }}
                  onTouchMove={(e) => {
                    if (isInspectPanning && e.touches.length === 1) {
                      const touch = e.touches[0];
                      setInspectPanOffset({
                        x: touch.clientX - inspectPanStart.x,
                        y: touch.clientY - inspectPanStart.y,
                      });
                    }
                  }}
                  onTouchEnd={() => setIsInspectPanning(false)}
                  onDoubleClick={() => {
                    setInspectZoom(1);
                    setInspectPanOffset({ x: 0, y: 0 });
                  }}
                  className={`flex-1 flex items-center justify-center p-12 overflow-hidden select-none relative ${
                    inspectZoom > 1
                      ? isInspectPanning
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                      : 'cursor-default'
                  }`}
                >
                  {/* Floating Zoom Controls for Inspector */}
                  <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-slate-950/80 backdrop-blur border border-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setInspectZoom((z) => Math.min(z + 0.5, 5))}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setInspectZoom((z) => {
                          const next = Math.max(z - 0.5, 1);
                          if (next === 1) setInspectPanOffset({ x: 0, y: 0 });
                          return next;
                        })
                      }
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <ZoomOut size={14} />
                    </button>
                    {inspectZoom > 1 && (
                      <button
                        onClick={() => {
                          setInspectZoom(1);
                          setInspectPanOffset({ x: 0, y: 0 });
                        }}
                        className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Maximize size={14} />
                      </button>
                    )}
                  </div>

                  {/* Transformer Wrapper for Inspector */}
                  <div
                    ref={inspectWrapperRef}
                    className="max-w-full max-h-full w-auto h-auto relative"
                    style={{
                      aspectRatio: `${imageDims.w} / ${imageDims.h}`,
                      transform: `translate(${inspectPanOffset.x}px, ${inspectPanOffset.y}px) scale(${inspectZoom})`,
                      transformOrigin: 'top left',
                      transition: isInspectPanning ? 'none' : 'transform 0.15s ease-out',
                    }}
                  >
                    <img
                      src={imageFile || undefined}
                      alt="Full resolution inspector"
                      className="w-full h-full block pointer-events-none"
                    />

                    {/* Bounding Box Inside Inspector */}
                    {showBoundingBoxes && displayedInspectDims && (
                      <AnimatePresence>
                        {displayedBoxes.map((box, idx) => {
                          const coords = getBoxCoords(box, displayedInspectDims);
                          const stackIndex = stackIndices[idx] || 0;
                          const isHovered = hoveredBoxIndex === idx;

                          const isNearTop = box.y < 8;
                          const isNearRight = box.x > 80;

                          return (
                            <motion.div
                              key={`inspect-box-${idx}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              onMouseEnter={() => setHoveredBoxIndex(idx)}
                              onMouseLeave={() => setHoveredBoxIndex(null)}
                              className={`absolute border rounded pointer-events-auto transition-all ${
                                isHovered
                                  ? 'border-cyan-300 bg-cyan-400/[0.12] shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10'
                                  : hoveredBoxIndex !== null
                                    ? 'border-cyan-500/20 bg-cyan-500/[0.01] opacity-30'
                                    : 'border-cyan-400/80 bg-cyan-500/[0.04] shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                              }`}
                              style={{
                                left: `${coords.left}px`,
                                top: `${coords.top}px`,
                                width: `${coords.width}px`,
                                height: `${coords.height}px`,
                                borderWidth: `${1.2 / inspectZoom}px`,
                              }}
                            >
                              <span
                                className={`absolute bg-slate-950/85 backdrop-blur-sm text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide whitespace-nowrap select-none transition-colors pointer-events-none ${
                                  isHovered
                                    ? 'text-cyan-300 border-cyan-400 shadow-md'
                                    : 'text-cyan-400 border-cyan-500/20'
                                }`}
                                style={{
                                  ...(isNearTop
                                    ? {
                                        top: `calc(2px + ${(stackIndex * 22) / inspectZoom}px)`,
                                        bottom: 'auto',
                                        transformOrigin: isNearRight ? 'top right' : 'top left',
                                      }
                                    : {
                                        bottom: `calc(100% + ${4 / inspectZoom}px + ${(stackIndex * 22) / inspectZoom}px)`,
                                        top: 'auto',
                                        transformOrigin: isNearRight ? 'bottom right' : 'bottom left',
                                      }),
                                  ...(isNearRight
                                    ? { right: '0px', left: 'auto' }
                                    : { left: '0px', right: 'auto' }),
                                  transform: `scale(${1 / inspectZoom})`,
                                  borderWidth: `${1 / inspectZoom}px`,
                                }}
                              >
                                {box.label} {(box.confidence * 100).toFixed(0)}%
                              </span>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Compartment: Inspector Sidebar */}
              <div className="w-full md:w-80 shrink-0 flex flex-col justify-between p-6 bg-slate-950/45 border-t md:border-t-0 md:border-l border-white/5 overflow-y-auto no-scrollbar">
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="flex items-center gap-1.5">
                      <Sliders size={14} className="text-cyan-400" />
                      <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                        Inspector Telemetry
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsInspectOpen(false);
                        setInspectZoom(1);
                        setInspectPanOffset({ x: 0, y: 0 });
                      }}
                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                      <span className="text-[7.5px] text-slate-500 font-bold block uppercase">
                        Detected Targets
                      </span>
                      <span className="text-base font-bold text-white font-mono">{displayedCount}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                      <span className="text-[7.5px] text-slate-500 font-bold block uppercase">
                        Confidence
                      </span>
                      <span className="text-base font-bold text-white font-mono">
                        {displayedCount > 0 ? `${avgConfidence}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Detections List */}
                  <div className="space-y-2">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                      DETECTION INDEX ({displayedCount})
                    </span>
                    <div className="space-y-1.5 max-h-[220px] md:max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                      {displayedBoxes.map((box, idx) => {
                        const px1 = Math.round((box.x / 100) * imageDims.w);
                        const py1 = Math.round((box.y / 100) * imageDims.h);
                        const px2 = Math.round(((box.x + box.width) / 100) * imageDims.w);
                        const py2 = Math.round(((box.y + box.height) / 100) * imageDims.h);

                        return (
                          <div
                            key={`list-item-${idx}`}
                            onMouseEnter={() => setHoveredBoxIndex(idx)}
                            onMouseLeave={() => setHoveredBoxIndex(null)}
                            className={`p-2 rounded border text-[9px] font-mono transition-all flex flex-col gap-1 cursor-default ${
                              hoveredBoxIndex === idx
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                                : 'bg-white/[0.01] border-white/5 text-slate-300 hover:bg-white/[0.03] hover:border-white/10'
                            }`}
                          >
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-cyan-400 uppercase tracking-wide">
                                #{idx + 1}: {box.label}
                              </span>
                              <span className="bg-cyan-500/15 text-cyan-400 px-1 rounded">
                                {(box.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[8px] text-slate-500 flex flex-wrap gap-x-2">
                              <span>
                                X1: <b className="text-slate-400">{px1}</b>
                              </span>
                              <span>
                                Y1: <b className="text-slate-400">{py1}</b>
                              </span>
                              <span>
                                X2: <b className="text-slate-400">{px2}</b>
                              </span>
                              <span>
                                Y2: <b className="text-slate-400">{py2}</b>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {displayedCount === 0 && (
                        <div className="text-center py-4 text-[9px] text-slate-500 italic">
                          No detections to index.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <button
                    onClick={() => downloadReport(activeScan, displayedBoxes)}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-950 font-semibold text-[10px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download size={10} />
                    Export CSV Report
                  </button>
                  <button
                    onClick={() => {
                      setIsInspectOpen(false);
                      setInspectZoom(1);
                      setInspectPanOffset({ x: 0, y: 0 });
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-[10px] rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
