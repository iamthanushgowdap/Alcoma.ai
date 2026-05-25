'use client';

import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  Satellite, 
  AlertTriangle, 
  TrendingUp, 
  Compass,
  Globe,
  Loader2,
  MapPin,
  Sliders,
  UploadCloud,
  Clock,
  History,
  Download
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import dynamic from 'next/dynamic';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore } from '@/store/usePredictionStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Dynamic Recharts import
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';

// Load Leaflet map component dynamically with SSR disabled to prevent compilation crashes
const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      <span className="text-xs text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const PRESETS = [
  { name: 'Ganges River Delta', lat: 22.0000, lng: 90.0000 },
  { name: 'Manila Bay, PH', lat: 14.5995, lng: 120.9842 },
  { name: 'Baltic Sea Coast', lat: 54.3520, lng: 18.6466 },
  { name: 'Gulf of Mexico', lat: 29.0000, lng: -90.0000 },
  { name: 'Great Barrier Reef', lat: -18.2871, lng: 147.6992 },
];

type SpecMode = 'chlorophyll' | 'temp' | 'turbidity';

export default function HabMonitoring() {
  const { habRiskIndex, setHabRiskIndex } = usePredictionStore();
  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode (toggled between own values and satellite)
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  // Specs & Heatmap state
  const [specMode, setSpecMode] = useState<SpecMode>('chlorophyll');
  const [algaeDensity, setAlgaeDensity] = useState(48); 
  const [heatmapGrid, setHeatmapGrid] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);

  // Satellite scanning states
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 22.0000,
    lng: 90.0000,
  });
  const [isScanning, setIsScanning] = useState(false);
  const [satelliteData, setSatelliteData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);

  // Dynamic warning bulletins list
  const [bulletins, setBulletins] = useState<any[]>([
    {
      type: 'critical',
      title: 'Red Tide Advisory',
      desc: 'Gymnodinium concentration in Sector 12 matches toxic levels. Avoid aquaculture extraction.',
      icon: AlertTriangle
    },
    {
      type: 'info',
      title: 'Sentinel Sync Successful',
      desc: 'Standard satellite spectrometer telemetry calibrations complete. Data offset corrected.',
      icon: Satellite
    }
  ]);

  // Telemetry run history log
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    generateHeatmap(algaeDensity);
  }, [algaeDensity]);

  // Helper to extract base url dynamically
  const getBaseUrl = (endpoint: string) => {
    try {
      const parsed = new URL(endpoint);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      return 'http://127.0.0.1:8000';
    }
  };

  // Generates randomized values based on the base algae density for spectrographic overlay grid
  const generateHeatmap = (base: number) => {
    const grid = Array.from({ length: 64 }).map(() => {
      const rand = Math.random() * 25 - 12;
      return Math.max(5, Math.min(100, Math.round(base + rand)));
    });
    setHeatmapGrid(grid);
  };

  // Forecast trend data mapping
  const bloomForecastData = [
    { day: 'T+24h', density: algaeDensity },
    { day: 'T+48h', density: Math.min(100, Math.round(algaeDensity * 1.1)) },
    { day: 'T+72h', density: Math.min(100, Math.round(algaeDensity * 1.25)) },
    { day: 'T+96h', density: Math.max(10, Math.round(algaeDensity * 0.9)) },
    { day: 'T+120h', density: Math.max(5, Math.round(algaeDensity * 0.7)) },
  ];

  // Helper to color pixels based on values
  const getPixelStyle = (val: number, mode: SpecMode) => {
    if (mode === 'chlorophyll') {
      if (val > 75) return 'bg-emerald-500 border border-white/10';
      if (val > 45) return 'bg-emerald-700/50';
      return 'bg-emerald-950/20 border border-emerald-500/5';
    }
    if (mode === 'temp') {
      if (val > 75) return 'bg-amber-500 border border-white/10';
      if (val > 45) return 'bg-amber-700/50';
      return 'bg-amber-950/20 border border-amber-500/5';
    }
    if (val > 75) return 'bg-white border border-white/10';
    if (val > 45) return 'bg-slate-500/50';
    return 'bg-slate-900/20 border border-slate-500/5';
  };

  // Query manual/ simulation API prediction
  const handleManualPredict = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const response = await fetch(`${baseUrl}/predict-hab`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          algae_density: algaeDensity,
          spec_mode: specMode
        })
      });

      if (!response.ok) {
        throw new Error(`Inference engine failed: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);

      setHabRiskIndex(data.hab_risk_index);
      
      const newLog = {
        id: `hab-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: 'Manual Calibration',
        density: algaeDensity,
        risk: data.hab_risk_index,
        level: data.risk_level
      };
      setHistoryLogs([newLog, ...historyLogs]);
      
      if (data.warning_bulletins && data.warning_bulletins.length > 0) {
        const bl = data.warning_bulletins[0];
        const newBulletin = {
          type: bl.type,
          title: bl.title,
          desc: bl.desc,
          icon: bl.type === 'critical' ? AlertTriangle : Satellite
        };
        setBulletins([newBulletin, ...bulletins.slice(0, 3)]);
      }

    } catch (err: any) {
      console.error("Manual HAB prediction failed:", err);
      setError(err.message || "Failed to connect to backend ML API. Ensure FastAPI server is running.");
    } finally {
      setIsScanning(false);
    }
  };

  // Query actual satellite prediction
  const handleSatelliteScan = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const response = await fetch(`${baseUrl}/predict-hab-satellite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: selectedCoords.lat,
          longitude: selectedCoords.lng
        })
      });

      if (!response.ok) {
        throw new Error(`Copernicus satellite API failure: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      console.log("Copernicus live HAB telemetry fetched", data);

      // Set density and risk
      setAlgaeDensity(data.algae_density);
      setHabRiskIndex(data.hab_risk_index);
      
      setSatelliteData({
        chlorophyll: data.chlorophyll,
        temp: data.temp,
        turbidity: data.turbidity,
        riskLevel: data.risk_level,
        probability: data.hab_risk_index,
        description: data.description,
        source: data.source
      });

      // Inject history log
      const newLog = {
        id: `hab-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: `Scan [${selectedCoords.lat.toFixed(2)}, ${selectedCoords.lng.toFixed(2)}]`,
        density: data.algae_density,
        risk: data.hab_risk_index,
        level: data.risk_level
      };
      setHistoryLogs([newLog, ...historyLogs]);

      // Inject warning bulletin
      if (data.warning_bulletins && data.warning_bulletins.length > 0) {
        const bl = data.warning_bulletins[0];
        const newBulletin = {
          type: bl.type,
          title: bl.title,
          desc: bl.desc,
          icon: bl.type === 'critical' ? AlertTriangle : Satellite
        };
        setBulletins([newBulletin, ...bulletins.slice(0, 3)]);
      }
    } catch (err: any) {
      console.error("Satellite HAB scanning failed:", err);
      setError(
        err.message || "Failed to query satellite pipeline. Ensure the ML FastAPI server is running."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
  };

  // CSV Drag and drop parser
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const header = lines[0].toLowerCase();

        if (!header.includes('density') && !header.includes('algae')) {
          throw new Error("Dataset is missing columns ('Algae_Density' or 'Density').");
        }

        setDatasets([
          {
            filename: file.name,
            uploadedAt: new Date().toISOString(),
            rowCount: lines.length - 1
          },
          ...datasets
        ]);

        const lastLine = lines[lines.length - 1].split(',');
        if (lastLine.length >= 1) {
          const parsedDensity = parseInt(lastLine[0]);
          if (!isNaN(parsedDensity)) {
            setAlgaeDensity(Math.min(95, Math.max(10, parsedDensity)));
          }
        }
        
        handleManualPredict();
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

  const exportLogs = () => {
    if (historyLogs.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Timestamp,Region,Algae_Density_Percent,Risk_Index_Percent,Risk_Level",
         ...historyLogs.map(p => `${p.timestamp},${p.region},${p.density},${p.risk},${p.level}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hab_monitoring_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Waves className="text-cyan-400" size={20} />
            Harmful Algal Bloom (HAB) Prognostics
          </h2>
          <p className="text-xs text-slate-400 mt-1">AI-powered early warning systems leveraging Copernicus spectral imagery models.</p>
        </div>

        {/* Operating Tab Switcher */}
        <div className="flex gap-1.5 bg-slate-950/40 p-1 border border-white/5 rounded-xl shrink-0">
          <button
            onClick={() => {
              setActiveTab('own-values');
              setSatelliteData(null);
            }}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'own-values'
                ? 'bg-white text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎛️ Own Values
          </button>
          <button
            onClick={() => {
              setActiveTab('satellite');
            }}
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

      {/* Main 2-Pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* LEFT COLUMN: CONTROL PANE (Own Values OR Satellite) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Visual Display Card */}
          <GlassCard className="relative overflow-hidden flex flex-col justify-between min-h-[460px] flex-1">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 z-10">
              <div className="flex items-center gap-2">
                <Satellite size={16} className="text-white animate-pulse" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Spectrographic Satellite Overlay
                </h3>
              </div>
              <div className="flex gap-2">
                {(['chlorophyll', 'temp', 'turbidity'] as SpecMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSpecMode(mode)}
                    className={`px-3 py-1.5 text-[9px] font-semibold rounded-lg uppercase tracking-wider transition-all cursor-pointer border ${
                      specMode === mode
                        ? 'bg-white border-white text-slate-950 font-bold'
                        : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Heatmap Grid Visual (Always displayed at center of left side) */}
            <div className="flex-1 flex items-center justify-center p-6 z-10">
              <div className="grid grid-cols-8 gap-2 bg-slate-950/40 p-4 border border-white/5 rounded-3xl backdrop-blur-md max-w-[320px] w-full aspect-square relative overflow-hidden">
                {heatmapGrid.map((val, idx) => (
                  <div
                    key={idx}
                    className={`rounded-md cursor-pointer transition-all duration-300 ${getPixelStyle(val, specMode)}`}
                    title={`Density: ${val}%`}
                  />
                ))}
              </div>
            </div>

            {/* Orbit / Coordinate footer metadata */}
            <div className="flex justify-between font-mono text-[9px] text-slate-500 border-t border-white/5 pt-4 z-10">
              <div className="flex items-center gap-1">
                <Compass size={10} />
                <span>
                  {activeTab === 'satellite' && satelliteData
                    ? `SOURCE: ${satelliteData.source}`
                    : 'ORBIT: Sentinel-2B // Altitude: 786km'
                  }
                </span>
              </div>
              <span>Spectral Bands: B04 (Red), B05 (Red Edge 1)</span>
            </div>

          </GlassCard>

          {/* DYNAMIC PANE CONTROLS */}
          {activeTab === 'own-values' ? (
            <GlassCard className="flex flex-col gap-5 justify-between">
              
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  Interactive Algae density simulator
                </span>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Chlorophyll Biomass Concentration</span>
                    <span className="text-white font-mono font-medium">{algaeDensity}% density</span>
                  </div>
                  <input
                    type="range" min="10" max="95" step="1" value={algaeDensity}
                    onChange={(e) => setAlgaeDensity(parseInt(e.target.value))}
                    className="w-full accent-white cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>

              {/* Drag and Drop CSV */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Spectral Dataset Ingestion</span>
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
                  <span className="text-[8.5px] text-slate-500 block">Requires columns: Algae_Density</span>
                </div>
              </div>

              {datasets.length > 0 && (
                <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-[10px] space-y-1.5">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Ingested CSV Feeds</span>
                  <div className="space-y-1 max-h-[60px] overflow-y-auto no-scrollbar">
                    {datasets.map((d, i) => (
                      <div key={i} className="flex justify-between items-center py-0.5 border-b border-white/5 text-[9px] font-mono text-slate-400">
                        <span className="truncate max-w-[125px] font-medium text-slate-300">{d.filename}</span>
                        <span>{d.rowCount} fields</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleManualPredict}
                disabled={isScanning}
                className="w-full py-3 bg-white text-slate-950 hover:bg-slate-100 disabled:bg-white/10 disabled:text-slate-500 font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calculating Algae Biomass...
                  </>
                ) : (
                  <>
                    <Sliders size={14} />
                    Execute Sonde Prediction
                  </>
                )}
              </button>

            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Target Ocean Zones
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${
                        Math.abs(selectedCoords.lat - preset.lat) < 0.0001 &&
                        Math.abs(selectedCoords.lng - preset.lng) < 0.0001
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-slate-950/30 border-white/5 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Map Selector */}
              <div className="h-[250px] w-full relative rounded-2xl overflow-hidden border border-white/10">
                <SatelliteMap
                  mapTilerKey={mapTilerKey}
                  selectedCoords={selectedCoords}
                  onCenterSelect={(lat, lng) => setSelectedCoords({ lat, lng })}
                  presetCoords={[]}
                  mapId="leaflet-map-hab"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-950/40 p-3 border border-white/5 rounded-2xl gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-cyan-400" />
                  <span className="text-slate-400">
                    LAT: <span className="text-white font-semibold">{selectedCoords.lat.toFixed(5)}</span> // 
                    LNG: <span className="text-white font-semibold">{selectedCoords.lng.toFixed(5)}</span>
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Sentinel-2 L2A Speeds
                </span>
              </div>

              {/* Execute Satellite scan */}
              <button
                onClick={handleSatelliteScan}
                disabled={isScanning}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Querying Copernicus Biogeochemical Spectral Telemetry...
                  </>
                ) : (
                  <>
                    <Globe size={14} />
                    Trigger Copernicus Satellite Spectral Scan
                  </>
                )}
              </button>
            </GlassCard>
          )}

        </div>

        {/* RIGHT COLUMN: AI PROGNOSIS / OUTPUT PANE - 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Risk Dial Card */}
          <GlassCard className="flex flex-col justify-between gap-6 min-h-[220px]">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Ecology Risk Index</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                habRiskIndex > 60 
                  ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                  : habRiskIndex > 30
                  ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                {habRiskIndex > 60 ? 'Critical' : habRiskIndex > 30 ? 'Moderate' : 'Stable'}
              </span>
            </div>

            <div className="flex justify-between items-center gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white tracking-tight">{habRiskIndex}</span>
                  <span className="text-xs text-slate-500 font-mono font-bold">%</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">HAB Bloom Severity</span>
                <p className="text-xs text-slate-300 leading-relaxed pt-1.5 font-normal">
                  {satelliteData 
                    ? satelliteData.description
                    : habRiskIndex > 60 
                    ? 'Environmental telemetry registers severe micro-algae growth. Potential neurotoxin blooms flagged near shorelines.' 
                    : 'Chlorophyll cell counts remain inside safe biological thresholds. Regular spectral sweeps advised.'
                  }
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-950 border border-white/5 shadow-inner shrink-0">
                <Waves className={`w-6 h-6 ${habRiskIndex > 60 ? 'text-red-400 animate-pulse' : 'text-white'} transition-colors`} />
              </div>
            </div>

            {/* Small satellite telemetry panel inside dial */}
            {satelliteData && (
              <div className="grid grid-cols-3 gap-2 bg-slate-950/30 border border-white/5 rounded-xl p-2 text-[10px] font-mono text-center">
                <div className="flex flex-col">
                  <span className="text-slate-500">Chlorophyll</span>
                  <span className="text-cyan-400 font-semibold">{satelliteData.chlorophyll.toFixed(2)} µg/L</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500">Sea SST</span>
                  <span className="text-amber-400 font-semibold">{satelliteData.temp.toFixed(1)}°C</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500">Turbidity</span>
                  <span className="text-slate-300 font-semibold">{satelliteData.turbidity.toFixed(1)} NTU</span>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Forecast Line Chart */}
          <GlassCard className="flex flex-col justify-between min-h-[200px]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Bloom density forecast</span>
              </div>
            </div>
            <div className="h-32 w-full relative">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bloomForecastData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                    <XAxis dataKey="day" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                    <ChartTooltip 
                      contentStyle={{ 
                        backgroundColor: '#020617', 
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontSize: 10
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="density" 
                      stroke="#ffffff" 
                      strokeWidth={1.5} 
                      dot={{ r: 2, stroke: '#ffffff', strokeWidth: 1, fill: '#020617' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                  Loading prognostics...
                </div>
              )}
            </div>
          </GlassCard>

          {/* Warning bulletins alerts */}
          <GlassCard className="flex-1 flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-3">
              <AlertTriangle size={14} className="text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Warning Bulletins
              </h3>
            </div>

            <div className="flex-1 space-y-3 max-h-[180px] overflow-y-auto pr-1 no-scrollbar text-xs">
              {bulletins.map((bl, idx) => {
                const IconComponent = bl.icon;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-3 p-3 border rounded-xl transition-all ${
                      bl.type === 'critical' 
                        ? 'bg-red-500/5 border-red-500/10' 
                        : 'bg-slate-950/20 border-white/5'
                    }`}
                  >
                    <IconComponent size={14} className={`${bl.type === 'critical' ? 'text-red-400' : 'text-slate-400'} shrink-0 mt-0.5`} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{bl.title}</span>
                      <span className="text-slate-400 text-[10px] mt-0.5 leading-relaxed font-normal">
                        {bl.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
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
              HAB Calibrations Archive
            </h3>
          </div>
          {historyLogs.length > 0 && (
            <div className="flex gap-4">
              <button 
                onClick={exportLogs}
                className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
              >
                <Download size={10} />
                Export CSV
              </button>
              <button 
                onClick={() => setHistoryLogs([])}
                className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer"
              >
                Clear Archive
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 overflow-x-auto pb-2 no-scrollbar">
          {historyLogs.map((p) => (
            <div
              key={p.id}
              className="p-2.5 rounded-lg border border-white/5 bg-slate-950/20 flex flex-col gap-1.5 shrink-0 min-w-[140px]"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-200 truncate max-w-[90px]">{p.region}</span>
                <span className={`w-2 h-2 rounded-full ${
                  p.level === 'Critical' || p.level === 'High' ? 'bg-red-400' :
                  p.level === 'Moderate' ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
              </div>
              <div className="text-[9px] font-mono text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Algae Density:</span>
                  <span className="text-slate-300 font-bold">{p.density}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Score:</span>
                  <span className="text-slate-300 font-bold">{p.risk}%</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-600 mt-1">
                  <Clock size={8} />
                  <span>{new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}
          {historyLogs.length === 0 && (
            <div className="col-span-full py-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              No historical calibrations logged. Predict algae bloom risk to log.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
