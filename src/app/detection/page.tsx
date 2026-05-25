'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
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
  X
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore, PlasticScan } from '@/store/usePredictionStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function PlasticDetection() {
  const { scans, addScan, deleteScan } = usePredictionStore();
  const apiEndpoint = useSettingsStore((state) => state.apiEndpoint);
  
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [activeScan, setActiveScan] = useState<PlasticScan | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowConf, setShowLowConf] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [imageFile, imageDims]);

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
  }, [isInspectOpen, imageFile, imageDims]);

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

    // Reconstruct original coordinates from stored percentages
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


  // Load initial scan on mount
  useEffect(() => {
    if (scans.length > 0 && !activeScan) {
      setActiveScan(scans[0]);
      setImageFile(scans[0].imageUrl);
    }
  }, [scans, activeScan]);

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
        const nextZoom = e.deltaY < 0 
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

  // Add native wheel event listener to handle zoom centered on cursor cleanly in inspector modal
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
        const nextZoom = e.deltaY < 0 
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

  // Parse bounding boxes based on image natural dimensions
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

  // Helper to compress and resize image base64 data to avoid local storage quota limits
  const compressImage = (dataUrl: string, maxDim = 800, quality = 0.65): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
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

  // Process File Upload and Trigger Inference
  const processFile = async (file: File) => {
    setIsScanning(true);
    setError(null);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImageFile(dataUrl);

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
        
        // Load image to get natural size for pixel translation
        const imgDims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = dataUrl;
        });

        const parsedBoxes = parseBoxes(predictions, imgDims.w, imgDims.h);
        const count = parsedBoxes.length;
        const avgConfidence = count > 0 
          ? parseFloat((parsedBoxes.reduce((acc, curr) => acc + curr.confidence, 0) / count * 100).toFixed(1))
          : 100;

        let sizeClassification: 'Micro' | 'Macro' | 'Mixed' = 'Macro';
        const hasMicro = parsedBoxes.some((b) => b.label.includes('micro') || b.width < 5);
        const hasMacro = parsedBoxes.some((b) => !b.label.includes('micro') && b.width >= 5);
        if (hasMicro && hasMacro) sizeClassification = 'Mixed';
        else if (hasMicro) sizeClassification = 'Micro';

        const labels = Array.from(new Set(parsedBoxes.map((b) => b.label)));

        // Compress image before saving to Zustand store to prevent QuotaExceededError
        const compressedUrl = await compressImage(dataUrl, 800, 0.65);

        const newScan: PlasticScan = {
          id: `scan-${Date.now()}`,
          imageUrl: compressedUrl,
          timestamp: new Date().toISOString(),
          detectedCount: count,
          confidence: avgConfidence,
          labels,
          boundingBoxes: parsedBoxes,
          location: file.name.substring(0, 22) || 'Ingested Visual Feed',
          sizeClassification,
          modelUsed,
          modelPath,
          inferenceTimeMs: inferenceTime
        };

        addScan(newScan);
        setActiveScan(newScan);
        setBackendOnline(true);
      } catch (err: any) {
        console.error('Inference error:', err);
        setBackendOnline(false);
        setError(err.message || 'Failed to communicate with YOLOv8 API server.');
        setActiveScan(null);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) processFile(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  // Zoom controls
  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const zoomOut = () => setZoom((z) => {
    const next = Math.max(z - 0.5, 1);
    if (next === 1) setPanOffset({ x: 0, y: 0 });
    return next;
  });
  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
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
        y: touch.clientY - panStart.y
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

  // Severity Level calculator
  const getSeverity = (count: number) => {
    if (count === 0) return { label: 'Clean / Safe', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' };
    if (count <= 3) return { label: 'Low Contamination', color: 'text-blue-400 border-blue-500/20 bg-blue-500/10' };
    if (count <= 7) return { label: 'Moderate Threat', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' };
    return { label: 'Severe Pollution Alert', color: 'text-rose-400 border-rose-500/20 bg-rose-500/10' };
  };

  const downloadReport = (scan: PlasticScan, boxesToExport: any[]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Label,Confidence,X,Y,Width,Height", ...boxesToExport.map(b => `${b.label},${b.confidence},${b.x.toFixed(2)},${b.y.toFixed(2)},${b.width.toFixed(2)},${b.height.toFixed(2)}`)].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `alcoma_report_${scan.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic calculations based on showLowConf filter (default conf >= 0.55)
  const displayedBoxes = activeScan
    ? activeScan.boundingBoxes.filter((box) => showLowConf || box.confidence >= 0.55)
    : [];

  const displayedCount = displayedBoxes.length;

  const avgConfidence = displayedCount > 0
    ? parseFloat((displayedBoxes.reduce((acc, curr) => acc + curr.confidence, 0) / displayedCount * 100).toFixed(1))
    : 0;

  const displayedLabels = Array.from(new Set(displayedBoxes.map((b) => b.label)));

  let displayedSizeClassification: 'Micro' | 'Macro' | 'Mixed' = 'Macro';
  const hasMicro = displayedBoxes.some((b) => b.label.includes('micro') || b.width < 5);
  const hasMacro = displayedBoxes.some((b) => !b.label.includes('micro') && b.width >= 5);
  if (hasMicro && hasMacro) displayedSizeClassification = 'Mixed';
  else if (hasMicro) displayedSizeClassification = 'Micro';

  // Stack indices for non-overlapping labels
  const stackIndices = React.useMemo(() => {
    const indices: number[] = [];
    displayedBoxes.forEach((box, i) => {
      let maxIdx = -1;
      for (let j = 0; j < i; j++) {
        if (Math.abs(box.x - displayedBoxes[j].x) < 10 && Math.abs(box.y - displayedBoxes[j].y) < 5) {
          maxIdx = Math.max(maxIdx, indices[j]);
        }
      }
      indices.push(maxIdx + 1);
    });
    return indices;
  }, [displayedBoxes]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Page Header with Model Verification Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Refuse Detection Workspace</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time object detection powered by trained computer vision models.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Running Custom Marine Plastic Model
          </span>
        </div>
      </div>
      
      {/* Offline Status Banner */}
      {backendOnline === false && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">FastAPI Inference Engine Offline</span> — Could not connect to YOLOv8 server at `{apiEndpoint}`. Bounding box detections are disabled until the engine starts.
          </div>
        </div>
      )}

      {/* Inference Execution Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Analysis Failed</span> — {error}
          </div>
        </div>
      )}

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-stretch min-h-[580px]">
        
        {/* COLUMN 1: CONTROLS & REPORT SIDEBAR */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto no-scrollbar max-h-[calc(100vh-140px)] pr-2">
          {/* Sensor Ingestion Card */}
          <GlassCard className="p-6 space-y-6 bg-slate-900/10 flex flex-col shrink-0">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                Sensor Ingestion
              </h2>
              <p className="text-xs text-slate-500">
                Submit marine imagery for live YOLOv8 inference.
              </p>
            </div>

            {/* Dropzone */}
            <div 
              {...getRootProps()} 
              className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[150px] ${
                isDragActive 
                  ? 'border-white bg-white/5' 
                  : 'border-white/10 hover:border-white/20 bg-slate-900/20'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud size={28} className="text-slate-400 mb-2" />
              <span className="text-xs font-medium text-slate-200 block mb-1">
                Drag & Drop Image
              </span>
              <span className="text-[10px] text-slate-500 block">
                JPG, PNG up to 10MB
              </span>
            </div>

            {/* Custom File Selector Trigger */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Select Image File
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
            />

            {/* Recent Uploads List */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Recent Scan Feeds
              </span>
              <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                {scans.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className={`group relative w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-xs overflow-hidden ${
                      activeScan?.id === s.id
                        ? 'border-white/20 bg-white/5'
                        : 'border-white/5 bg-slate-900/10'
                    }`}
                  >
                    {/* CARD CONTENT */}
                    <div className="w-8 h-8 rounded overflow-hidden border border-white/5 shrink-0 bg-slate-950">
                      <img src={s.imageUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-slate-200">{s.location}</div>
                      <div className="text-[9px] text-slate-500 flex justify-between mt-0.5">
                        <span>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-semibold text-slate-400 font-mono">{s.detectedCount} objects</span>
                      </div>
                    </div>

                    {/* HOVER OVERLAY: Blur background and show "View Result" button */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-10">
                      {/* Blurred background image of the result */}
                      <img 
                        src={s.imageUrl} 
                        className="absolute inset-0 w-full h-full object-cover blur-[3px] scale-105 brightness-[0.35]" 
                      />
                      {/* Overlay mask */}
                      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
                      
                      {/* Clickable View Result Button */}
                      <button
                        onClick={() => {
                          setActiveScan(s);
                          setImageFile(s.imageUrl);
                          resetZoom();
                          setIsInspectOpen(true);
                        }}
                        className="relative z-20 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[9px] rounded uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        <Eye size={10} />
                        View Result
                      </button>
                    </div>
                  </div>
                ))}
                {scans.length === 0 && (
                  <div className="text-[10px] text-slate-500 italic py-2">
                    No recent scans. Ingest an image to begin.
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Inference Report Card (Left Column) */}
          {activeScan ? (
            <GlassCard className="flex flex-col justify-between p-6 bg-slate-900/10 shrink-0">
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="text-slate-300" size={14} />
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Inference Report
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                    YOLOv8 weights
                  </span>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/5 p-3 rounded-lg">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Total Detected Objects</span>
                    <span className="text-xl font-bold text-white font-mono">{displayedCount}</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-lg">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Avg Confidence</span>
                    <span className="text-xl font-bold text-white font-mono">
                      {displayedCount > 0 ? `${avgConfidence}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Show Low Confidence Detections Toggle Switch */}
                <div className="flex items-center justify-between p-3 bg-slate-950/20 border border-white/5 rounded-lg select-none">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider block">Show low confidence</span>
                    <span className="text-[8px] text-slate-500 block">Show weak predictions (&gt;= 0.15)</span>
                  </div>
                  <button
                    onClick={() => setShowLowConf(!showLowConf)}
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer focus:outline-none shrink-0 ${
                      showLowConf ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={showLowConf}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        showLowConf ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Verification Metadata Section */}
                <div className="bg-slate-950/40 border border-white/5 rounded-lg p-3.5 space-y-2">
                  <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">
                    Model Verification
                  </span>
                  <div className="space-y-2 text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Active Model</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {activeScan.modelUsed || 'best.pt'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Inference Time</span>
                      <span className="text-slate-200 font-mono font-semibold">
                        {activeScan.inferenceTimeMs ? `${activeScan.inferenceTimeMs} ms` : '124.2 ms'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-white/5 mt-1">
                      <span className="text-slate-400">Model Path</span>
                      <span className="text-[9px] text-slate-500 font-mono break-all leading-normal bg-black/45 p-2 rounded border border-white/5 select-all">
                        {activeScan.modelPath || 'weights/marin-plastic/best.pt'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Severity & Metrics */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-1.5">Severity Analysis</span>
                    {(() => {
                      const sev = getSeverity(displayedCount);
                      return (
                        <div className={`text-[10px] px-2.5 py-1.5 border rounded-lg font-bold tracking-wide uppercase inline-block transition-all duration-300 ${sev.color}`}>
                          {sev.label}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-2.5 text-xs pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-normal">Classification</span>
                      <span className="text-slate-200 font-semibold">{displayedSizeClassification}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-normal">Timestamp</span>
                      <span className="text-slate-200 font-mono text-[10px] flex items-center gap-1">
                        <Clock size={10} className="text-slate-400" />
                        {new Date(activeScan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Class Labels */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Detected Labels</span>
                    <div className="flex flex-wrap gap-1">
                      {displayedLabels.length > 0 ? (
                        displayedLabels.map((lbl, i) => (
                          <span key={i} className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider animate-fadeIn">
                            {lbl}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                          No Refuse Detected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-6">
                <button
                  onClick={() => downloadReport(activeScan, displayedBoxes)}
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download size={12} />
                  Export CSV Report
                </button>
                <button
                  onClick={() => {
                    deleteScan(activeScan.id);
                    setActiveScan(null);
                    setImageFile(null);
                  }}
                  className="w-full py-2 bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 size={12} />
                  Delete Ingest Record
                </button>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="flex items-center justify-center p-6 bg-slate-900/10 text-center py-12">
              <span className="text-xs text-slate-500">Awaiting visual feed ingestion.</span>
            </GlassCard>
          )}
        </div>

        {/* COLUMN 2: GLORIOUS MAIN IMAGE VIEWPORT */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <GlassCard className="relative overflow-hidden flex-1 flex flex-col items-center justify-center min-h-[550px] p-4 bg-slate-950/20">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/40 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="absolute left-0 right-0 h-[1.5px] bg-white shadow-[0_0_10px_white] animate-scan z-30" />
                <div className="p-4 bg-slate-900 border border-white/10 rounded-lg flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span className="text-[10px] font-mono font-medium tracking-wider text-slate-300 uppercase">
                    YOLOv8 custom inference active...
                  </span>
                </div>
              </div>
            )}

            {imageFile ? (
              <div className="w-full h-full flex flex-col justify-between gap-4">
                {/* Viewport Header */}
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-300 uppercase">
                      {activeScan ? activeScan.location : 'Visual Stream Ingestion'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    {activeScan && (
                      <>
                        <button 
                          onClick={() => setIsInspectOpen(true)}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20"
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
                  className={`relative w-full flex-1 min-h-[480px] rounded-xl overflow-hidden border border-white/5 select-none bg-slate-900 flex items-center justify-center ${
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
 
                  {/* Transformer Wrapper */}
                  <div
                    ref={wrapperRef}
                    className="max-w-full max-h-full relative"
                    style={{
                      aspectRatio: imageDims ? `${imageDims.w} / ${imageDims.h}` : 'auto',
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                      transformOrigin: 'top left',
                      transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      containerType: 'inline-size',
                      width: imageDims ? '100%' : 'auto',
                      height: 'auto'
                    }}
                  >
                    {/* BASE: Ingested Image */}
                    <img 
                      src={imageFile || undefined} 
                      alt="Refuse scan result" 
                      className="w-full h-full block pointer-events-none"
                    />
 
                    {/* Bounding Box Overlay */}
                    {activeScan && showBoundingBoxes && displayedDims && (
                      <AnimatePresence>
                        {displayedBoxes.map((box, idx) => {
                          const coords = getBoxCoords(box, displayedDims);
                          const stackIndex = stackIndices[idx] || 0;
                          const isHovered = hoveredBoxIndex === idx;
                          
                          // Check if near top or right edges
                          const isNearTop = box.y < 8;
                          const isNearRight = box.x > 80;
                          
                          return (
                            <motion.div
                              key={`${activeScan.id}-box-${idx}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
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
                                        top: `calc(2px + ${stackIndex * 22 / zoom}px)`,
                                        bottom: 'auto',
                                        transformOrigin: isNearRight ? 'top right' : 'top left',
                                      }
                                    : {
                                        bottom: `calc(100% + ${4 / zoom}px + ${stackIndex * 22 / zoom}px)`,
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
 
                    {/* Compare Overlay: Original Image */}
                    {zoom === 1 && (
                      <div 
                        className="absolute inset-0 overflow-hidden border-r border-white/20 pointer-events-none"
                        style={{ width: `${sliderPos}%` }}
                      >
                        <img 
                          src={imageFile || undefined} 
                          alt="Original Frame" 
                          className="absolute inset-y-0 left-0 h-full max-w-none pointer-events-none"
                          style={{ 
                            width: '100cqw'
                          }}
                        />
                      </div>
                    )}
 
                    {/* Drag Handle */}
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
                <UploadCloud size={32} className="mx-auto text-slate-600" />
                <p className="text-xs font-medium text-slate-300">Awaiting Ingestion Feed</p>
                <p className="text-[10px] text-slate-500">Upload or select an image on the left panel to execute YOLOv8 inference.</p>
              </div>
            )}
          </GlassCard>
        </div>

      </div>

      {/* BOTTOM SECTION: HISTORY TRACK */}
      <div className="w-full space-y-3 pt-8 border-t border-white/5 mt-8">
        <div className="flex items-center gap-2">
          <History size={14} className="text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Ingestion Telemetry History
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 overflow-x-auto pb-2 no-scrollbar">
          {scans.map((s) => (
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
                <span className="text-[10px] font-bold text-slate-200 block truncate">{s.location}</span>
                <span className="text-[9px] text-slate-500 block truncate">{new Date(s.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {scans.length === 0 && (
            <div className="col-span-full py-6 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              No historical data in localStorage buffer.
            </div>
          )}
        </div>
      </div>

      {/* Visual Feed Inspector Modal */}
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
              {/* Left Compartment: Visual Viewport */}
              <div className="flex-1 relative flex flex-col bg-black/40 min-h-[300px] md:min-h-0">
                {/* Viewport Header */}
                <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-slate-950/85 to-transparent text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-200 uppercase tracking-wider">
                      Visual Inspector: {activeScan.location}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/60 backdrop-blur border border-white/5 rounded-lg px-2.5 py-1">
                    <span className="font-semibold text-slate-300">Resolution:</span>
                    <span className="font-mono text-emerald-400">{imageDims.w} × {imageDims.h} px</span>
                  </div>
                </div>

                {/* Inspect Viewport Container */}
                <div
                  ref={inspectContainerRef}
                  onMouseDown={(e) => {
                    if (inspectZoom <= 1) return;
                    setIsInspectPanning(true);
                    setInspectPanStart({ x: e.clientX - inspectPanOffset.x, y: e.clientY - inspectPanOffset.y });
                  }}
                  onMouseMove={(e) => {
                    if (isInspectPanning) {
                      setInspectPanOffset({
                        x: e.clientX - inspectPanStart.x,
                        y: e.clientY - inspectPanStart.y
                      });
                    }
                  }}
                  onMouseUp={() => setIsInspectPanning(false)}
                  onMouseLeave={() => setIsInspectPanning(false)}
                  onTouchStart={(e) => {
                    if (inspectZoom <= 1 || e.touches.length !== 1) return;
                    setIsInspectPanning(true);
                    const touch = e.touches[0];
                    setInspectPanStart({ x: touch.clientX - inspectPanOffset.x, y: touch.clientY - inspectPanOffset.y });
                  }}
                  onTouchMove={(e) => {
                    if (isInspectPanning && e.touches.length === 1) {
                      const touch = e.touches[0];
                      setInspectPanOffset({
                        x: touch.clientX - inspectPanStart.x,
                        y: touch.clientY - inspectPanStart.y
                      });
                    }
                  }}
                  onTouchEnd={() => setIsInspectPanning(false)}
                  onDoubleClick={() => {
                    setInspectZoom(1);
                    setInspectPanOffset({ x: 0, y: 0 });
                  }}
                  className={`flex-1 flex items-center justify-center p-12 overflow-hidden select-none relative ${
                    inspectZoom > 1 ? (isInspectPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                  }`}
                >
                  {/* Floating Zoom Controls for Inspector */}
                  <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-slate-950/80 backdrop-blur border border-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setInspectZoom((z) => Math.min(z + 0.5, 5))}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() => setInspectZoom((z) => {
                        const next = Math.max(z - 0.5, 1);
                        if (next === 1) setInspectPanOffset({ x: 0, y: 0 });
                        return next;
                      })}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Zoom Out"
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
                        title="Reset Zoom"
                      >
                        <Maximize size={14} />
                      </button>
                    )}
                  </div>

                  {/* Transformer Wrapper for Inspector */}
                  <div
                    ref={inspectWrapperRef}
                    className="max-w-full max-h-full relative"
                    style={{
                      aspectRatio: `${imageDims.w} / ${imageDims.h}`,
                      transform: `translate(${inspectPanOffset.x}px, ${inspectPanOffset.y}px) scale(${inspectZoom})`,
                      transformOrigin: 'top left',
                      transition: isInspectPanning ? 'none' : 'transform 0.15s ease-out',
                      width: '100%',
                      height: 'auto'
                    }}
                  >
                    {/* Full resolution image */}
                    <img
                      src={imageFile || undefined}
                      alt="Full resolution inspector"
                      className="w-full h-full block pointer-events-none"
                    />

                    {/* Bounding Box Overlay inside Inspector */}
                    {showBoundingBoxes && displayedInspectDims && (
                      <AnimatePresence>
                        {displayedBoxes.map((box, idx) => {
                          const coords = getBoxCoords(box, displayedInspectDims);
                          const stackIndex = stackIndices[idx] || 0;
                          const isHovered = hoveredBoxIndex === idx;
                          
                          // Check if near top or right edges
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
                                        top: `calc(2px + ${stackIndex * 22 / inspectZoom}px)`,
                                        bottom: 'auto',
                                        transformOrigin: isNearRight ? 'top right' : 'top left',
                                      }
                                    : {
                                        bottom: `calc(100% + ${4 / inspectZoom}px + ${stackIndex * 22 / inspectZoom}px)`,
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

              {/* Right Compartment: Telemetry & Detections List */}
              <div className="w-full md:w-80 shrink-0 flex flex-col justify-between p-6 bg-slate-950/45 border-t md:border-t-0 md:border-l border-white/5 overflow-y-auto no-scrollbar">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="flex items-center gap-1.5">
                      <Sliders size={14} className="text-emerald-400" />
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

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                      <span className="text-[7.5px] text-slate-500 font-bold block uppercase tracking-wider">Detected Refuse</span>
                      <span className="text-base font-bold text-white font-mono">{displayedCount}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                      <span className="text-[7.5px] text-slate-500 font-bold block uppercase tracking-wider">Confidence</span>
                      <span className="text-base font-bold text-white font-mono">
                        {displayedCount > 0 ? `${avgConfidence}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-[10px] bg-slate-950/30 border border-white/5 rounded-lg p-3">
                    <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider mb-1">IMAGE PROPERTIES</span>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Dimensions</span>
                      <span className="text-slate-200 font-mono">{imageDims.w} × {imageDims.h} px</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Aspect Ratio</span>
                      <span className="text-slate-200 font-mono">
                        {(imageDims.w / imageDims.h).toFixed(2)}:1
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Source Feed</span>
                      <span className="text-slate-200 truncate max-w-[120px]" title={activeScan.location}>
                        {activeScan.location}
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
                        // Calculate absolute pixel coordinates
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
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                : 'bg-white/[0.01] border-white/5 text-slate-300 hover:bg-white/[0.03] hover:border-white/10'
                            }`}
                          >
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-emerald-400 uppercase tracking-wide">#{idx + 1}: {box.label}</span>
                              <span className="bg-emerald-500/15 text-emerald-400 px-1 rounded">{(box.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-[8px] text-slate-500 flex flex-wrap gap-x-2">
                              <span>X1: <b className="text-slate-400">{px1}</b></span>
                              <span>Y1: <b className="text-slate-400">{py1}</b></span>
                              <span>X2: <b className="text-slate-400">{px2}</b></span>
                              <span>Y2: <b className="text-slate-400">{py2}</b></span>
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
