'use client';

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  UploadCloud,
  Download,
  Sliders,
  AlertTriangle,
  History,
  Clock,
  Waves,
  Loader2,
  Globe,
  MapPin,
  Activity
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useUpwellingStore, UpwellingPrediction } from '@/store/useUpwellingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';

const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[250px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      <span className="text-[10px] text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const UPWELLING_REGIONS = [
  { name: 'GPatch Area Alpha', lat: 35.0, lng: -140.0, baseTemp: 14.5 },
  { name: 'Henderson Island', lat: -24.3, lng: -128.3, baseTemp: 22.0 },
  { name: 'Oregon Coast Upwelling', lat: 44.5, lng: -124.5, baseTemp: 11.2 },
  { name: 'Benguela Current system', lat: -22.9, lng: 14.4, baseTemp: 13.8 },
  { name: 'Peruvian Coastal Upwelling', lat: -12.0, lng: -77.2, baseTemp: 15.2 }
];

export default function UpwellingWorkspace() {
  const {
    predictions,
    datasets,
    selectedRegion,
    sstSlider,
    chlorophyllSlider,
    addPrediction,
    addDataset,
    setSelectedRegion,
    setSstSlider,
    setChlorophyllSlider,
    clearHistory
  } = useUpwellingStore();

  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 44.5,
    lng: -124.5
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Live Results values returned from API
  const [liveUpwellingIndex, setLiveUpwellingIndex] = useState<number>(65);
  const [liveRichness, setLiveRichness] = useState<string>('High');
  const [liveYield, setLiveYield] = useState<string>('Mackerel & Pelagic Concentration: HIGH (Expect high trawling yields in boundary fronts)');
  const [liveSummary, setLiveSummary] = useState<string>('Adjust physical parameters and execute calculations to evaluate deep Ekman transport indices.');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePresetSelect = (preset: typeof UPWELLING_REGIONS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
    setSelectedRegion(preset.name);
    setSstSlider(preset.baseTemp);
  };

  const handleMapCenterSelect = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setSelectedRegion(`Front [${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E]`);
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

  // Upwelling vertical profile trend data
  const getProfileData = () => {
    const mult = liveUpwellingIndex / 50.0;
    return [
      { depth: '0m (Surface)', Nitrates: +(0.1 * mult).toFixed(2), Phosphates: +(0.05 * mult).toFixed(2) },
      { depth: '50m', Nitrates: +(1.2 * mult).toFixed(2), Phosphates: +(0.4 * mult).toFixed(2) },
      { depth: '100m', Nitrates: +(4.5 * mult).toFixed(2), Phosphates: +(1.1 * mult).toFixed(2) },
      { depth: '200m (Deep)', Nitrates: +(12.4 * mult).toFixed(2), Phosphates: +(2.8 * mult).toFixed(2) }
    ];
  };

  // Run manual/simulation prediction calling backend FastAPI /predict-upwelling
  const executePrediction = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-upwelling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sst: sstSlider,
          chlorophyll: chlorophyllSlider
        })
      });

      if (!res.ok) {
        throw new Error(`Inference engine failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);
      setLiveUpwellingIndex(data.upwelling_index);
      setLiveRichness(data.richness_level);
      setLiveYield(data.fisheries_potential);
      setLiveSummary(data.nutrient_summary);

      const newPred: UpwellingPrediction = {
        id: `upwelling-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: selectedRegion,
        sst: +sstSlider.toFixed(2),
        chlorophyll: +chlorophyllSlider.toFixed(2),
        upwellingIndex: data.upwelling_index,
        richnessLevel: data.richness_level,
        yieldIndicator: data.fisheries_potential
      };

      addPrediction(newPred);
    } catch (err: any) {
      console.error("Upwelling prediction failed:", err);
      setError(err.message || "Failed to reach backend FastAPI.");
    } finally {
      setIsScanning(false);
    }
  };

  // Run satellite coordinate prediction calling backend FastAPI /predict-upwelling-satellite
  const handleSatellitePredict = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-upwelling-satellite`, {
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
        throw new Error(`Satellite upwelling API failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("Copernicus live telemetry fetched", data);
      setSstSlider(data.sst);
      setChlorophyllSlider(data.chlorophyll);

      setLiveUpwellingIndex(data.upwelling_index);
      setLiveRichness(data.richness_level);
      setLiveYield(data.fisheries_potential);
      setLiveSummary(data.nutrient_summary);

      const newPred: UpwellingPrediction = {
        id: `upwelling-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: `Satellite [${selectedCoords.lat.toFixed(2)}, ${selectedCoords.lng.toFixed(2)}]`,
        sst: data.sst,
        chlorophyll: data.chlorophyll,
        upwellingIndex: data.upwelling_index,
        richnessLevel: data.richness_level,
        yieldIndicator: data.fisheries_potential
      };
      addPrediction(newPred);

    } catch (err: any) {
      console.error("Upwelling satellite predict error:", err);
      setError(err.message || "Failed to query satellite altimetry pipeline.");
    } finally {
      setIsScanning(false);
    }
  };

  // CSV file parser
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

        if (!header.includes('sst') && !header.includes('chlorophyll')) {
          throw new Error("Dataset is missing columns ('SST' or 'Chlorophyll').");
        }

        addDataset({
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: lines.length - 1
        });

        const lastLine = lines[lines.length - 1].split(',');
        if (lastLine.length >= 2) {
          const parsedSST = parseFloat(lastLine[0]);
          const parsedChl = parseFloat(lastLine[1]);
          if (!isNaN(parsedSST)) setSstSlider(Math.min(30, Math.max(10, parsedSST)));
          if (!isNaN(parsedChl)) setChlorophyllSlider(Math.min(15, Math.max(0.1, parsedChl)));
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
      + ["Timestamp,Region,SST_C,Chlorophyll_ugL,Upwelling_Index,Nutrient_Richness",
         ...predictions.map(p => `${p.timestamp},${p.region},${p.sst},${p.chlorophyll},${p.upwellingIndex},${p.richnessLevel}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `upwelling_prediction_${Date.now()}.csv`);
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
            <Waves className="text-cyan-400" size={20} />
            Upwelling Zone Intelligence Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">SST anomalies and Ekman carbon pump telemetry for fisheries productivity forecasting.</p>
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

      {/* Main Grid 2-Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* COLUMN 1: CONTROL PANE (Own values or Map Selector) - 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeTab === 'own-values' ? (
            <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sliders size={16} className="text-cyan-400 animate-pulse" />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Own Values</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Ocean Temperature Calibration</span>
                  </div>
                </div>

                {/* SST Control */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sea Surface Temperature (SST)</span>
                    <span className="text-cyan-400 font-mono font-bold">{sstSlider.toFixed(1)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="10.0"
                    max="30.0"
                    step="0.1"
                    value={sstSlider}
                    onChange={(e) => setSstSlider(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase">
                    <span>Deep water (Cold)</span>
                    <span>Stratified (Warm)</span>
                  </div>
                </div>

                {/* Chlorophyll Control */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Surface Chlorophyll-a</span>
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
                </div>

                {/* Ingest */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Environmental Altimetry Ingest</span>
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
                    <span className="text-[8.5px] text-slate-500 block">Requires columns: SST, Chlorophyll</span>
                  </div>
                </div>

                {/* Dataset list */}
                {datasets.length > 0 && (
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-[10px] space-y-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block font-sans">Ingested CSV Feeds</span>
                    <div className="space-y-1 max-h-[70px] overflow-y-auto no-scrollbar">
                      {datasets.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5 border-b border-white/5 text-[9px] font-mono text-slate-400">
                          <span className="truncate max-w-[125px] font-medium text-slate-300">{d.filename}</span>
                          <span>{d.rowCount} rows</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execute Pred */}
                <button
                  onClick={executePrediction}
                  disabled={isScanning}
                  className="w-full py-3 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Upwelling Indexes...</span>
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
                  <Globe size={16} className="text-cyan-400 animate-spin" style={{ animationDuration: '40s' }} />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Satellite</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Copernicus Thermal Upwelling Target</span>
                  </div>
                </div>

                {/* Target Zone Presets */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Upwelling Targets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {UPWELLING_REGIONS.map((preset, idx) => (
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
                    mapId="leaflet-map-upwelling"
                  />
                </div>

                {/* Coordinates read */}
                <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Upwelling Coordinates
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-cyan-400" />
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
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg mt-auto animate-none"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping Sentinel-3 Thermal Gradients...</span>
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

        {/* COLUMN 2: AI DIAGNOSTICS & BAR CHART (Output Pane) - 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <GlassCard className="relative overflow-hidden flex-1 flex flex-col justify-between p-6 bg-slate-950/20">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/60 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl">
                <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Evaluating Thermal Fronts...</span>
              </div>
            )}

            {/* Ocean Thermal Visualization Map */}
            <div className="space-y-4 flex-1 flex flex-col justify-between font-sans">
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                  <span>3. AI Quality Prognosis</span>
                  <span className="font-mono text-cyan-400">SST Mapping</span>
                </div>

                {/* Thermal Grid */}
                <div className="aspect-video w-full bg-slate-950/50 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                    <path 
                      d="M-50,80 Q100,20 250,80 T550,80" 
                      fill="none" 
                      stroke="rgba(34, 211, 238, 0.1)" 
                      strokeWidth="1.5" 
                      strokeDasharray="5,5" 
                    />
                    <path 
                      d="M-50,140 Q100,90 250,140 T550,140" 
                      fill="none" 
                      stroke="rgba(34, 211, 238, 0.15)" 
                      strokeWidth="2" 
                    />
                  </svg>

                  {/* Animated Upwelling Hotspot Pulse */}
                  {liveUpwellingIndex >= 50 && (
                    <div className="absolute flex items-center justify-center">
                      <motion.div 
                        className="absolute w-20 h-20 rounded-full border border-cyan-400/30"
                        animate={{ scale: [1, 2, 1], opacity: [0.6, 0.1, 0.6] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div 
                        className="absolute w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center border border-cyan-400/60"
                        animate={{ scale: [0.9, 1.1, 0.9] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                      </motion.div>
                    </div>
                  )}

                  <div 
                    className="absolute inset-0 transition-colors duration-1000"
                    style={{
                      background: `radial-gradient(circle, rgba(34, 211, 238, ${Math.max(0.05, (liveUpwellingIndex / 100) * 0.4)}) 0%, rgba(244, 63, 94, ${Math.max(0.05, (sstSlider / 30.0) * 0.18)}) 100%)`
                    }}
                  />

                  <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur border border-white/5 text-[8px] font-mono text-slate-400 rounded-lg p-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="w-1 bg-rose-500 h-1 rounded-full" />
                      <span>Stratified surface layers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1 bg-cyan-400 h-1 rounded-full" />
                      <span>Predicted Upwelling fronts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upwelling score dial */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Upwelling Intensity</span>
                  <span className="text-xs font-bold text-white font-mono">{liveUpwellingIndex}%</span>
                </div>
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Mixing Status</span>
                  <span className={`text-[9px] font-bold uppercase truncate ${
                    liveUpwellingIndex >= 80 ? 'text-cyan-400 animate-pulse' :
                    liveUpwellingIndex >= 55 ? 'text-emerald-400' :
                    liveUpwellingIndex >= 30 ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {liveRichness}
                  </span>
                </div>
              </div>

              {/* Yield summary */}
              <div className="bg-slate-950/20 border border-white/5 rounded-xl p-2.5">
                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Fisheries Potential</span>
                <p className="text-[10px] text-slate-300 leading-normal font-semibold mt-0.5">{liveYield}</p>
              </div>

              {/* Dynamic Recharts depth profile */}
              <div className="h-32 w-full relative pt-1.5 border-t border-white/5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Vertical Nutrients Depth Profile</span>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={getProfileData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <XAxis dataKey="depth" stroke="#334155" fontSize={8} tickLine={false} axisLine={false} />
                      <YAxis stroke="#334155" fontSize={8} tickLine={false} axisLine={false} />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff', fontSize: '9px' }} 
                      />
                      <Bar dataKey="Nitrates" fill="#22d3ee" radius={[2, 2, 0, 0]} name="Nitrates (µmol/kg)" />
                      <Bar dataKey="Phosphates" fill="#10b981" radius={[2, 2, 0, 0]} name="Phosphates (µmol/kg)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>

              {/* Export Actions */}
              <button
                onClick={exportCSV}
                disabled={predictions.length === 0}
                className="w-full py-2 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
              Upwelling Prediction Timeline
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
                  p.upwellingIndex >= 80 ? 'bg-cyan-400' :
                  p.upwellingIndex >= 55 ? 'bg-emerald-400' :
                  p.upwellingIndex >= 30 ? 'bg-amber-400' : 'bg-slate-600'
                }`} />
              </div>
              <div className="text-[9px] font-mono text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>SST:</span>
                  <span className="text-slate-300 font-bold">{p.sst}°C</span>
                </div>
                <div className="flex justify-between">
                  <span>Chl-a:</span>
                  <span className="text-slate-300">{p.chlorophyll} µg/L</span>
                </div>
                <div className="flex justify-between">
                  <span>Intensity:</span>
                  <span className="text-cyan-400 font-bold">{p.upwellingIndex}%</span>
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
              No historical forecasts timeline logged. Predict an upwelling above to begin logging.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
