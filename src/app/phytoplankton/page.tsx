'use client';

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  UploadCloud,
  Download,
  Sliders,
  AlertTriangle,
  History,
  Clock,
  Layers,
  Compass,
  Loader2,
  Globe,
  MapPin,
  Activity
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { usePhytoplanktonStore, PhytoplanktonPrediction } from '@/store/usePhytoplanktonStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';

const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[250px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      <span className="text-[10px] text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const REGIONS = [
  { name: 'Manila Bay, PH', lat: 14.5995, lng: 120.9842 },
  { name: 'Ganges River Delta', lat: 22.0000, lng: 90.0000 },
  { name: 'Pacific Patch Alpha', lat: 35.0, lng: -140.0 },
  { name: 'Baltic Sea Coast', lat: 54.5, lng: 18.5 },
  { name: 'Gulf of Mexico', lat: 25.0, lng: -90.0 }
];

export default function PhytoplanktonWorkspace() {
  const {
    predictions,
    datasets,
    selectedRegion,
    chlorophyllSlider,
    temperatureSlider,
    addPrediction,
    addDataset,
    setSelectedRegion,
    setChlorophyllSlider,
    setTemperatureSlider,
    clearHistory
  } = usePhytoplanktonStore();

  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 14.5995,
    lng: 120.9842
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Live Results values returned from API
  const [liveBloomRisk, setLiveBloomRisk] = useState<string>('Low');
  const [liveProductivity, setLiveProductivity] = useState<number>(45);
  const [liveInsights, setLiveInsights] = useState<string>('Adjust parameters and execute calculations to generate primary ecological insights.');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePresetSelect = (preset: typeof REGIONS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
    setSelectedRegion(preset.name);
  };

  const handleMapCenterSelect = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setSelectedRegion(`Zone [${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E]`);
  };

  // Helper to extract base URL
  const getBaseUrl = (endpoint: string) => {
    try {
      const parsed = new URL(endpoint);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      return 'http://127.0.0.1:8000';
    }
  };

  // Recharts trend data updating relative to chlorophyll values
  const getTrendData = () => {
    const scale = chlorophyllSlider;
    return [
      { day: 'Mon', density: +(scale * 0.7).toFixed(2), temp: temperatureSlider - 1.2 },
      { day: 'Tue', density: +(scale * 0.85).toFixed(2), temp: temperatureSlider - 0.5 },
      { day: 'Wed', density: +(scale * 0.6).toFixed(2), temp: temperatureSlider - 0.8 },
      { day: 'Thu', density: +(scale * 1.1).toFixed(2), temp: temperatureSlider + 0.3 },
      { day: 'Fri', density: +(scale * 0.95).toFixed(2), temp: temperatureSlider },
      { day: 'Sat', density: +(scale * 1.3).toFixed(2), temp: temperatureSlider + 0.6 },
      { day: 'Sun', density: +scale.toFixed(2), temp: temperatureSlider }
    ];
  };

  // Trigger Local Analysis Execution calling backend FastAPI /predict-phytoplankton
  const triggerAnalysis = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-phytoplankton`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chlorophyll: chlorophyllSlider,
          temperature: temperatureSlider
        })
      });

      if (!res.ok) {
        throw new Error(`Inference engine failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);
      setLiveBloomRisk(data.bloom_risk);
      setLiveProductivity(data.productivity_index);
      setLiveInsights(data.insights);

      const newPred: PhytoplanktonPrediction = {
        id: `phyto-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: selectedRegion,
        chlorophyllConcentration: +chlorophyllSlider.toFixed(2),
        temperature: +temperatureSlider.toFixed(2),
        bloomRisk: data.bloom_risk,
        productivityIndex: data.productivity_index,
        impactSummary: data.insights
      };
      
      addPrediction(newPred);
    } catch (err: any) {
      console.error("Phytoplankton prediction error:", err);
      setError(err.message || "Failed to reach backend FastAPI. Make sure the backend server is running.");
    } finally {
      setIsScanning(false);
    }
  };

  // Satellite Scanning calling backend FastAPI /predict-phytoplankton-satellite
  const handleSatellitePredict = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-phytoplankton-satellite`, {
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
        throw new Error(`Satellite inference API failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("Copernicus live telemetry fetched", data);
      
      // Update sliders
      setChlorophyllSlider(data.chlorophyll);
      setTemperatureSlider(data.temperature);

      setLiveBloomRisk(data.bloom_risk);
      setLiveProductivity(data.productivity_index);
      setLiveInsights(data.insights);

      const newPred: PhytoplanktonPrediction = {
        id: `phyto-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: `Satellite [${selectedCoords.lat.toFixed(2)}, ${selectedCoords.lng.toFixed(2)}]`,
        chlorophyllConcentration: data.chlorophyll,
        temperature: data.temperature,
        bloomRisk: data.bloom_risk,
        productivityIndex: data.productivity_index,
        impactSummary: data.insights
      };
      addPrediction(newPred);

    } catch (err: any) {
      console.error("Phytoplankton satellite scan failed:", err);
      setError(err.message || "Failed to query satellite indices pipeline.");
    } finally {
      setIsScanning(false);
    }
  };

  // CSV Ingestion Parser
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
        
        if (!header.includes('chlorophyll') && !header.includes('temp')) {
          throw new Error("Dataset is missing required variables ('Chlorophyll' or 'Temperature' columns).");
        }

        addDataset({
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: lines.length - 1
        });

        const lastLine = lines[lines.length - 1].split(',');
        if (lastLine.length >= 2) {
          const parsedChl = parseFloat(lastLine[0]);
          const parsedTemp = parseFloat(lastLine[1]);
          if (!isNaN(parsedChl)) setChlorophyllSlider(Math.min(15, Math.max(0.1, parsedChl)));
          if (!isNaN(parsedTemp)) setTemperatureSlider(Math.min(35, Math.max(10, parsedTemp)));
        }

        await triggerAnalysis();
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
    const data = predictions;
    if (data.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Timestamp,Region,Chlorophyll_ugL,Temperature_C,Bloom_Risk,Productivity_Index", 
         ...data.map(p => `${p.timestamp},${p.region},${p.chlorophyllConcentration},${p.temperature},${p.bloomRisk},${p.productivityIndex}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `phytoplankton_dynamics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="text-emerald-400" size={20} />
            Phytoplankton Dynamics Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">Satellite ocean-color analytics and microalgae density trend prognostics.</p>
        </div>
        
        {/* Toggle Mode */}
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

      {/* Main 2-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* COLUMN 1: CONTROL PANE (Own Values or Satellite map) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeTab === 'own-values' ? (
            <GlassCard className="p-6 space-y-6 bg-slate-900/10 flex-1 flex flex-col justify-between">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sliders size={16} className="text-emerald-400 animate-pulse" />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Own Values</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Sonde Parameter Calibration</span>
                  </div>
                </div>

                {/* Chlorophyll Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chlorophyll-a density</span>
                    <span className="text-emerald-400 font-mono font-bold">{chlorophyllSlider.toFixed(2)} µg/L</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="15.0"
                    step="0.05"
                    value={chlorophyllSlider}
                    onChange={(e) => setChlorophyllSlider(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase">
                    <span>Oligotrophic (Low)</span>
                    <span>Hypertrophic (Extreme)</span>
                  </div>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sea Surface Temperature</span>
                    <span className="text-slate-300 font-mono font-bold">{temperatureSlider.toFixed(1)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="10.0"
                    max="35.0"
                    step="0.1"
                    value={temperatureSlider}
                    onChange={(e) => setTemperatureSlider(parseFloat(e.target.value))}
                    className="w-full accent-slate-400 cursor-pointer"
                  />
                </div>

                {/* Spectral Dataset Ingestion */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Spectral Dataset Ingestion</span>
                  <div 
                    {...getRootProps()} 
                    className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[105px] ${
                      isDragActive 
                        ? 'border-emerald-400/40 bg-emerald-500/5' 
                        : 'border-white/5 bg-slate-950/20 hover:border-white/10'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud size={20} className="text-slate-400 mb-1.5" />
                    <span className="text-[11px] font-semibold text-slate-200 block mb-0.5">Drag & Drop CSV</span>
                    <span className="text-[8.5px] text-slate-500 block">Chlorophyll, Temperature columns</span>
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
                          <span>{d.rowCount} records</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trigger Button */}
                <button
                  onClick={triggerAnalysis}
                  disabled={isScanning}
                  className="w-full py-3 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Bloom Models...</span>
                    </>
                  ) : (
                    <>
                      <Activity size={13} />
                      <span>Execute Sonde Prediction</span>
                    </>
                  )}
                </button>

              </div>
            </GlassCard>
          ) : (
            <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Globe size={16} className="text-emerald-400 animate-spin" style={{ animationDuration: '40s' }} />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Satellite</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Copernicus Plankton Monitor Target</span>
                  </div>
                </div>

                {/* Target Zone Presets */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Delta Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {REGIONS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePresetSelect(preset)}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${
                          Math.abs(selectedCoords.lat - preset.lat) < 0.0001 &&
                          Math.abs(selectedCoords.lng - preset.lng) < 0.0001
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                            : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {preset.name}
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
                    mapId="leaflet-map-phytoplankton"
                  />
                </div>

                {/* Coordinates read */}
                <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Bounding Coordinates
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-emerald-400" />
                    <div className="text-[10px] font-mono text-slate-400">
                      LAT: <span className="text-slate-200 font-semibold">{selectedCoords.lat.toFixed(5)}°N</span> // 
                      LNG: <span className="text-slate-200 font-semibold">{selectedCoords.lng.toFixed(5)}°E</span>
                    </div>
                  </div>
                </div>

                {/* Satellite Prediction Action */}
                <button
                  onClick={handleSatellitePredict}
                  disabled={isScanning}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping Sentinel-3 Indices...</span>
                    </>
                  ) : (
                    <>
                      <Globe size={13} />
                      <span>Scan Copernicus Satellite</span>
                    </>
                  )}
                </button>

              </div>
            </GlassCard>
          )}
        </div>

        {/* COLUMN 2: AI DIAGNOSTICS & HEATMAP (Output Pane) - 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-950/20 relative">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/60 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-2" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Scanning Grid Indices...</span>
              </div>
            )}

            {/* Visual Ocean Grid & Charts */}
            <div className="space-y-4 flex-1 flex flex-col justify-between font-sans">
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                  <span>3. AI Quality Prognosis</span>
                  <span className="font-mono text-emerald-400">10m Grid Resolution</span>
                </div>

                {/* Heat Grid */}
                <div className="aspect-video w-full bg-slate-950/50 rounded-xl border border-white/5 grid grid-cols-8 gap-1 p-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-transparent animate-pulse" />
                  
                  {Array.from({ length: 64 }).map((_, idx) => {
                    const cellHash = Math.abs(Math.sin(idx * 73.54 + selectedCoords.lat));
                    const factor = Math.min(1.0, Math.max(0.05, (chlorophyllSlider / 15.0) * cellHash * 1.5));
                    
                    const background = liveBloomRisk === 'Critical' 
                      ? `rgba(163, 230, 53, ${factor})` 
                      : liveBloomRisk === 'High' 
                      ? `rgba(52, 211, 153, ${factor * 0.9})` 
                      : `rgba(16, 185, 129, ${factor * 0.75})`;

                    return (
                      <motion.div
                        key={idx}
                        className="rounded-sm relative group cursor-crosshair border border-white/[0.02]"
                        animate={{ scale: [0.97, 1.02, 0.97] }}
                        transition={{ 
                          duration: 3 + cellHash * 4, 
                          repeat: Infinity, 
                          ease: 'easeInOut' 
                        }}
                        style={{ background }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Assessment Panel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Estimated Risk</span>
                  <span className={`text-xs font-mono font-bold uppercase ${
                    liveBloomRisk === 'Critical' ? 'text-red-400 animate-pulse' :
                    liveBloomRisk === 'High' ? 'text-amber-400' :
                    liveBloomRisk === 'Moderate' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>
                    {liveBloomRisk} Risk
                  </span>
                </div>

                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Productivity</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {liveProductivity}/100
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 bg-slate-950/20 border border-white/5 rounded-xl p-3">
                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Primary Impact Analysis</span>
                <p className="text-[10px] text-slate-400 leading-relaxed font-normal">{liveInsights}</p>
              </div>

              {/* Time-series trend chart */}
              <div className="h-32 w-full relative pt-2 border-t border-white/5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">7-Day Biomass Density Trend</span>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={getTrendData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorPlankton" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#334155" fontSize={8} tickLine={false} axisLine={false} />
                      <YAxis stroke="#334155" fontSize={8} tickLine={false} axisLine={false} />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff', fontSize: '9px' }} 
                      />
                      <Area type="monotone" dataKey="density" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPlankton)" name="Chlorophyll µg/L" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>

              {/* Actions */}
              <button
                onClick={exportCSV}
                disabled={predictions.length === 0}
                className="w-full py-2 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors mt-2"
              >
                <Download size={11} />
                Export Telemetry CSV
              </button>

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
              Dynamics Telemetry Archive
            </h3>
          </div>
          {predictions.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer"
            >
              Clear Archive
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
                <span className={`w-2 h-2 rounded-full ${
                  p.bloomRisk === 'Critical' ? 'bg-red-400' :
                  p.bloomRisk === 'High' ? 'bg-amber-400' :
                  p.bloomRisk === 'Moderate' ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
              </div>
              <div className="text-[9px] font-mono text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Chl-a:</span>
                  <span className="text-slate-300 font-bold">{p.chlorophyllConcentration} µg/L</span>
                </div>
                <div className="flex justify-between">
                  <span>Temp:</span>
                  <span className="text-slate-300">{p.temperature}°C</span>
                </div>
                <div className="flex justify-between">
                  <span>Prod:</span>
                  <span className="text-emerald-400 font-bold">{p.productivityIndex}%</span>
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
              No historical calculations archived. Execute a model above to begin logging.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
