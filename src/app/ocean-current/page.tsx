'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  UploadCloud,
  Download,
  History,
  Clock,
  Compass,
  Play,
  Pause,
  RefreshCw,
  Wind,
  AlertTriangle,
  Loader2,
  Globe,
  MapPin,
  Activity,
  Sliders
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useOceanCurrentStore, CurrentPrediction } from '@/store/useOceanCurrentStore';
import { useSettingsStore } from '@/store/useSettingsStore';

const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[250px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      <span className="text-[10px] text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const CURRENT_REGIONS = [
  { name: 'Roatan Coast, HN', baseAngle: 240, baseVelocity: 1.4, lat: 16.3, lng: -86.5 },
  { name: 'Kuroshio Current system', baseAngle: 45, baseVelocity: 2.8, lat: 31.5, lng: 135.0 },
  { name: 'Gulf Stream Boundary', baseAngle: 30, baseVelocity: 3.2, lat: 35.0, lng: -75.0 },
  { name: 'Agulhas Current Delta', baseAngle: 210, baseVelocity: 2.5, lat: -35.0, lng: 20.0 },
  { name: 'Equatorial Countercurrent', baseAngle: 90, baseVelocity: 1.1, lat: 5.0, lng: -120.0 }
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export default function OceanCurrentWorkspace() {
  const {
    predictions,
    datasets,
    selectedRegion,
    forecastHorizon,
    scrubHour,
    isPlaying,
    addPrediction,
    addDataset,
    setSelectedRegion,
    setForecastHorizon,
    setScrubHour,
    setIsPlaying,
    clearHistory
  } = useOceanCurrentStore();

  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  // Sliders for manual "Own Values" control
  const [manualSpeed, setManualSpeed] = useState<number>(1.5);
  const [manualDirection, setManualDirection] = useState<number>(180);

  // States for "Satellite" control
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 35.0,
    lng: -75.0
  });
  const [satelliteSpeed, setSatelliteSpeed] = useState<number>(2.5);
  const [satelliteDirection, setSatelliteDirection] = useState<number>(45);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Active metrics output from API
  const [livePeakSpeed, setLivePeakSpeed] = useState<number>(2.02);
  const [liveDriftRisk, setLiveDriftRisk] = useState<string>('Moderate');
  const [liveConfidence, setLiveConfidence] = useState<number>(92);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePresetSelect = (preset: typeof CURRENT_REGIONS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
    setSelectedRegion(preset.name);
    setSatelliteSpeed(preset.baseVelocity);
    setSatelliteDirection(preset.baseAngle);
  };

  const handleMapCenterSelect = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setSelectedRegion(`Flow [${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E]`);
  };

  // Determine active parameters based on Mode Tab
  const activeSpeed = activeTab === 'own-values' ? manualSpeed : satelliteSpeed;
  const activeDirection = activeTab === 'own-values' ? manualDirection : satelliteDirection;
  
  // Apply time-scrub factor to speed and direction dynamically if playing
  const timeFactor = 1 + Math.sin(scrubHour / 12) * 0.15; 
  const currentSpeed = +(activeSpeed * timeFactor).toFixed(2);
  const currentDirection = Math.round((activeDirection + (scrubHour * 1.5)) % 360);

  // Helper to extract base URL
  const getBaseUrl = (endpoint: string) => {
    try {
      const parsed = new URL(endpoint);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      return 'http://127.0.0.1:8000';
    }
  };

  // Visual vectors particle field canvas animation
  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    canvas.width = canvas.parentElement?.clientWidth || 400;
    canvas.height = canvas.parentElement?.clientHeight || 280;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize particles
    const particleCount = 180;
    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        life: Math.random() * 100,
        maxLife: 60 + Math.random() * 80
      }));
    }

    const angleRad = (currentDirection * Math.PI) / 180;
    const speedScale = currentSpeed * 2.2;

    const render = () => {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.14)'; // trailing effect
      ctx.fillRect(0, 0, width, height);

      particlesRef.current.forEach((p) => {
        const localNoise = Math.sin(p.x * 0.008) * Math.cos(p.y * 0.008) * 0.8;
        const currentAngle = angleRad + localNoise;

        p.vx = Math.cos(currentAngle) * speedScale;
        p.vy = Math.sin(currentAngle) * speedScale;

        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
        ctx.strokeStyle = `rgba(34, 211, 238, ${Math.max(0.04, 1 - p.life / p.maxLife)})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10 || p.life >= p.maxLife) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.life = 0;
        }
      });

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mounted, currentDirection, currentSpeed, activeTab]);

  // Handle auto-playback of scrub timeline
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setScrubHour((scrubHour + 1) % 73); 
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, scrubHour, setScrubHour]);

  // Execute manual/simulation forecast calling backend FastAPI /predict-currents
  const executePrediction = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-currents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          velocity: manualSpeed,
          direction: manualDirection,
          forecast_horizon: forecastHorizon
        })
      });

      if (!res.ok) {
        throw new Error(`Inference engine failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);
      setLivePeakSpeed(data.peak_speed);
      setLiveDriftRisk(data.drift_risk);
      setLiveConfidence(data.confidence);

      const newPred: CurrentPrediction = {
        id: `current-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: selectedRegion,
        avgSpeed: activeSpeed,
        peakSpeed: data.peak_speed,
        direction: activeDirection,
        driftRisk: data.drift_risk,
        confidence: data.confidence
      };

      addPrediction(newPred);
    } catch (err: any) {
      console.error("Current altimetry prediction failed:", err);
      setError(err.message || "Failed to reach backend FastAPI.");
    } finally {
      setIsScanning(false);
    }
  };

  // Execute satellite currents scan calling backend FastAPI /predict-currents-satellite
  const handleSatellitePredict = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-currents-satellite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: selectedCoords.lat,
          longitude: selectedCoords.lng
        })
      });

      if (!res.ok) {
        throw new Error(`Satellite Currents API failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("Copernicus live telemetry fetched", data);
      setSatelliteSpeed(data.avg_speed);
      setSatelliteDirection(data.direction);

      setLivePeakSpeed(data.peak_speed);
      setLiveDriftRisk(data.drift_risk);
      setLiveConfidence(data.confidence);

      const newPred: CurrentPrediction = {
        id: `current-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: `Satellite [${selectedCoords.lat.toFixed(2)}, ${selectedCoords.lng.toFixed(2)}]`,
        avgSpeed: data.avg_speed,
        peakSpeed: data.peak_speed,
        direction: data.direction,
        driftRisk: data.drift_risk,
        confidence: data.confidence
      };
      addPrediction(newPred);

    } catch (err: any) {
      console.error("Currents satellite scan error:", err);
      setError(err.message || "Failed to query geostrophic altimetry indices.");
    } finally {
      setIsScanning(false);
    }
  };

  // CSV parsing
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const header = lines[0].toLowerCase();

        if (!header.includes('altimetry') && !header.includes('velocity')) {
          throw new Error("Dataset is missing columns ('Altimetry' or 'Velocity').");
        }

        addDataset({
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: lines.length - 1
        });

        const lastLine = lines[lines.length - 1].split(',');
        if (lastLine.length >= 2) {
          const parsedVel = parseFloat(lastLine[0]);
          const parsedDir = parseFloat(lastLine[1]);
          if (!isNaN(parsedVel)) setManualSpeed(Math.min(5, Math.max(0.1, parsedVel)));
          if (!isNaN(parsedDir)) setManualDirection(Math.min(360, Math.max(0, parsedDir)));
        }

        await executePrediction();
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV dataset.');
        setIsScanning(false);
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const exportCSV = () => {
    if (predictions.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Timestamp,Region,Avg_Velocity_ms,Peak_Velocity_ms,Flow_Direction_deg,Drift_Risk,Confidence",
         ...predictions.map(p => `${p.timestamp},${p.region},${p.avgSpeed},${p.peakSpeed},${p.direction},${p.driftRisk},${p.confidence}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ocean_current_vector_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wind className="text-cyan-400" size={20} />
            Ocean Current Vector Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">Satellite altimetry current forecasting and particle stream fluid velocity vectors.</p>
        </div>

        {/* Toggle switch */}
        <div className="flex gap-1.5 bg-slate-950/40 p-1 border border-white/5 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('own-values')}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'own-values'
                ? 'bg-white text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎛️ Own Values
          </button>
          <button
            onClick={() => setActiveTab('satellite')}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'satellite'
                ? 'bg-white text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛰️ Satellite
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* COLUMN 1: CONTROL PANE (Own values or Map Selector) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeTab === 'own-values' ? (
            <GlassCard className="p-6 space-y-6 bg-slate-900/10 flex-1 flex flex-col justify-between">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sliders size={16} className="text-cyan-400 animate-pulse" />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Own Values</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Navier-Stokes Model Tuning</span>
                  </div>
                </div>

                {/* Velocity slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Current Velocity</span>
                    <span className="text-cyan-400 font-mono font-bold">{manualSpeed.toFixed(2)} m/s</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.05"
                    value={manualSpeed}
                    onChange={(e) => setManualSpeed(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Heading Angle slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flow Heading Angle</span>
                    <span className="text-cyan-400 font-mono font-bold">{manualDirection}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={manualDirection}
                    onChange={(e) => setManualDirection(parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Forecast horizon */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Forecast Horizon</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[24, 48, 72].map((h) => (
                      <button
                        key={h}
                        onClick={() => setForecastHorizon(h)}
                        className={`py-1.5 text-center text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                          forecastHorizon === h 
                            ? 'bg-cyan-500/15 border-cyan-400 text-cyan-400' 
                            : 'border-white/5 bg-slate-950/20 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        +{h} Hours
                      </button>
                    ))}
                  </div>
                </div>

                {/* CSV Drag and Drop */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ingest Satellite Altimetry</span>
                  <div 
                    {...getRootProps()} 
                    className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[105px] ${
                      isDragActive 
                        ? 'border-cyan-400/40 bg-cyan-500/5' 
                        : 'border-white/5 bg-slate-950/20 hover:border-white/10'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud size={20} className="text-slate-400 mb-1.5" />
                    <span className="text-[11px] font-semibold text-slate-200 block mb-0.5">Drag & Drop CSV</span>
                    <span className="text-[8.5px] text-slate-500 block">Requires altimetry parameters</span>
                  </div>
                </div>

                {/* Dataset list */}
                {datasets.length > 0 && (
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-[10px] space-y-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Ingested CSV Feeds</span>
                    <div className="space-y-1 max-h-[70px] overflow-y-auto no-scrollbar">
                      {datasets.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5 border-b border-white/5 text-[9px] font-mono text-slate-400">
                          <span className="truncate max-w-[125px] font-medium text-slate-300">{d.filename}</span>
                          <span>{d.rowCount} fields</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ingestion Execute */}
                <button
                  onClick={executePrediction}
                  disabled={isScanning}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Solving Navier-Stokes...</span>
                    </>
                  ) : (
                    <span>Predict Current Flow</span>
                  )}
                </button>

              </div>
            </GlassCard>
          ) : (
            <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Globe size={16} className="text-cyan-400 animate-spin" style={{ animationDuration: '40s' }} />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Satellite</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Altimetry Coordinates Target</span>
                  </div>
                </div>

                {/* Target Zone Presets */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Current Vectors Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CURRENT_REGIONS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePresetSelect(preset)}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${
                          Math.abs(selectedCoords.lat - preset.lat) < 0.0001 &&
                          Math.abs(selectedCoords.lng - preset.lng) < 0.0001
                            ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {preset.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leaflet map */}
                <div className="flex-1 min-h-[250px] max-h-[320px] w-full relative rounded-xl overflow-hidden border border-white/5">
                  <SatelliteMap
                    mapTilerKey={mapTilerKey}
                    selectedCoords={selectedCoords}
                    onCenterSelect={handleMapCenterSelect}
                    presetCoords={[]}
                    mapId="leaflet-map-currents"
                  />
                </div>

                {/* Coordinates read */}
                <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Current Coordinates
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-cyan-400" />
                    <div className="text-[10px] font-mono text-slate-400">
                      LAT: <span className="text-slate-200 font-semibold">{selectedCoords.lat.toFixed(5)}°N</span> // 
                      LNG: <span className="text-slate-200 font-semibold">{selectedCoords.lng.toFixed(5)}°E</span>
                    </div>
                  </div>
                </div>

                {/* Execute Satellite Predict */}
                <button
                  onClick={handleSatellitePredict}
                  disabled={isScanning}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping CDSE Sentinel-6 Altimetry...</span>
                    </>
                  ) : (
                    <>
                      <Globe size={14} />
                      <span>Scan Copernicus Satellite</span>
                    </>
                  )}
                </button>

              </div>
            </GlassCard>
          )}
        </div>

        {/* COLUMN 2: FLOW VECTOR FIELD & COMPASS (Output Pane) - 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <GlassCard className="relative overflow-hidden flex-1 flex flex-col justify-between p-6 bg-slate-950/20">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/60 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl">
                <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Integrating Geostrophic Flow...</span>
              </div>
            )}

            {/* Fluid current-flow canvas visualization */}
            <div className="space-y-4 flex-1 flex flex-col justify-between font-sans">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>3. AI Quality Prognosis</span>
                <span className="font-mono text-cyan-400">geostrophic altimetry</span>
              </div>

              {/* Canvas viewport wrapper */}
              <div className="flex-1 w-full bg-slate-950 border border-white/5 rounded-xl min-h-[200px] relative overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-full block absolute inset-0 pointer-events-none" />
                
                {/* Visual compass layout info on top */}
                <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur border border-white/5 text-[8.5px] font-mono text-slate-400 rounded p-1 flex flex-col">
                  <span>Velocity: <b>{currentSpeed} m/s</b></span>
                  <span>Heading: <b>{currentDirection}°</b></span>
                </div>
              </div>

              {/* Compass dial */}
              <div className="flex items-center gap-4 bg-slate-950/30 border border-white/5 rounded-xl p-3">
                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center relative bg-slate-950 shrink-0">
                  <span className="absolute top-0.5 text-[6.5px] text-slate-600 font-bold">N</span>
                  <span className="absolute right-1 text-[6.5px] text-slate-600 font-bold">E</span>
                  <span className="absolute bottom-0.5 text-[6.5px] text-slate-600 font-bold">S</span>
                  <span className="absolute left-1 text-[6.5px] text-slate-600 font-bold">W</span>
                  <div 
                    className="w-0.5 h-8 bg-cyan-400 relative transition-transform duration-500" 
                    style={{ transform: `rotate(${currentDirection}deg)`, transformOrigin: '50% 50%' }}
                  >
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_cyan]" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Heading Vector</span>
                  <span className="text-xs font-bold text-white font-mono">{currentDirection}° Flow Angle</span>
                  <span className={`text-[10px] font-bold block ${
                    liveDriftRisk === 'High' ? 'text-red-400 animate-pulse' :
                    liveDriftRisk === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {liveDriftRisk} Drift Risk
                  </span>
                </div>
              </div>

              {/* Forecast confidence */}
              <div className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 space-y-1.5 text-[9px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[7.5px]">Inference Confidence</span>
                  <span className="text-cyan-400 font-mono font-bold">{liveConfidence}%</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${liveConfidence}%` }} />
                </div>
              </div>

              {/* Playback Scrub */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-cyan-400 cursor-pointer flex items-center justify-center transition-colors"
                    >
                      {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                    <button
                      onClick={() => {
                        setScrubHour(0);
                        setIsPlaying(false);
                      }}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-slate-400 cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <RefreshCw size={10} />
                    </button>
                  </div>
                  <span className="font-mono text-slate-400">T + {scrubHour}h Forecast</span>
                </div>

                <div className="relative w-full">
                  <input
                    type="range"
                    min="0"
                    max="72"
                    value={scrubHour}
                    onChange={(e) => {
                      setScrubHour(parseInt(e.target.value));
                      setIsPlaying(false);
                    }}
                    className="w-full accent-cyan-400 bg-slate-800"
                  />
                </div>
              </div>

            </div>
          </GlassCard>
        </div>

      </div>

      {/* BOTTOM SECTION: HISTORY TRACK */}
      <div className="w-full space-y-3 pt-8 border-t border-white/5 mt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Vector Telemetry Logs
            </h3>
          </div>
          {predictions.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer"
            >
              Clear Logs
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 overflow-x-auto pb-2 no-scrollbar">
          {predictions.map((p) => (
            <div
              key={p.id}
              className="p-2.5 rounded-lg border border-white/5 bg-slate-950/20 flex flex-col gap-1.5 shrink-0 min-w-[140px]"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-200 truncate max-w-[90px]">{p.region.split(' ')[0]}</span>
                <span className="text-[8px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1 rounded font-bold font-mono">
                  {p.confidence}%
                </span>
              </div>
              <div className="text-[9px] font-mono text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Avg Flow:</span>
                  <span className="text-slate-300 font-bold">{p.avgSpeed} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Flow:</span>
                  <span className="text-slate-300">{p.peakSpeed} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span>Heading:</span>
                  <span className="text-cyan-400 font-bold">{p.direction}°</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-600 mt-1">
                  <Clock size={8} />
                  <span>{new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}
          {predictions.length === 0 && (
            <div className="col-span-full py-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              No geostrophic currents prediction logs archived.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
