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
  Sun,
  Loader2,
  Globe,
  MapPin,
  Activity
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useCoralBleachingStore, BleachingPrediction } from '@/store/useCoralBleachingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from 'recharts';

const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[250px] bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
      <span className="text-[10px] text-slate-500 font-medium">Initializing Interactive Map...</span>
    </div>
  ),
});

const REEF_REGIONS = [
  { name: 'Great Barrier Reef', lat: -18.2871, lng: 147.6992, vulnerability: 0.85 },
  { name: 'Maldives Coral Reefs', lat: 3.2028, lng: 73.2207, vulnerability: 0.92 },
  { name: 'Red Sea Coastal Reef', lat: 22.0000, lng: 38.0000, vulnerability: 0.65 },
  { name: 'Coral Triangle, Indo-Pac', lat: -2.0000, lng: 125.0000, vulnerability: 0.78 },
  { name: 'Caribbean Barrier Reef', lat: 17.1899, lng: -87.7972, vulnerability: 0.88 }
];

export default function CoralBleachingWorkspace() {
  const {
    predictions,
    datasets,
    selectedRegion,
    dhwSlider,
    parSlider,
    addPrediction,
    addDataset,
    setSelectedRegion,
    setDhwSlider,
    setParSlider,
    clearHistory
  } = useCoralBleachingStore();

  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: -18.2871,
    lng: 147.6992
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Live Results values returned from API
  const [liveSeverity, setLiveSeverity] = useState<number>(38);
  const [liveBleachingLevel, setLiveBleachingLevel] = useState<string>('Watch');
  const [liveSurvival, setLiveSurvival] = useState<number>(75);
  const [liveVulnerability, setLiveVulnerability] = useState<number>(0.85);
  const [liveMitigations, setLiveMitigations] = useState<string[]>([
    'Schedule bi-weekly high-definition camera surveillance sweeps.',
    'Establish coral recruits boundary lines protections.',
    'Monitor local sea temperature trends for persistent heating cycles.'
  ]);
  const [liveDescription, setLiveDescription] = useState<string>('Adjust DHW/PAR parameters or scan coordinates on the Leaflet map to compute reef bleaching status.');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePresetSelect = (preset: typeof REEF_REGIONS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
    setSelectedRegion(preset.name);
    setLiveVulnerability(preset.vulnerability);
  };

  const handleMapCenterSelect = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setSelectedRegion(`Reef [${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E]`);
    // Determine vulnerability deterministically
    const coordHash = absHash(`${lat},${lng}`);
    const vul = 0.65 + (coordHash % 30) / 100.0;
    setLiveVulnerability(vul);
  };

  const absHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
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

  // Radar stress chart data
  const getRadarData = () => {
    const scale = liveSeverity / 100.0;
    return [
      { subject: 'Thermal stress', A: Math.round(dhwSlider * 8), fullMark: 100 },
      { subject: 'Solar irradiance', A: Math.round(parSlider / 5), fullMark: 100 },
      { subject: 'UV anomaly', A: Math.round(scale * 95), fullMark: 100 },
      { subject: 'Bleaching Severity', A: liveSeverity, fullMark: 100 },
      { subject: 'Benthic Stress', A: Math.round(scale * 88 + (liveVulnerability * 10)), fullMark: 100 },
      { subject: 'Resilience capacity', A: liveSurvival, fullMark: 100 }
    ];
  };

  // Run manual/simulation prediction calling backend FastAPI /predict-coral-bleaching
  const executePrediction = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-coral-bleaching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dhw: dhwSlider,
          par: parSlider,
          vulnerability: liveVulnerability
        })
      });

      if (!res.ok) {
        throw new Error(`Inference engine failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);
      setLiveSeverity(data.severity_score);
      setLiveBleachingLevel(data.bleaching_level);
      setLiveSurvival(data.survival_probability);
      setLiveMitigations(data.mitigation_strategies);
      setLiveDescription(data.ecology_description);

      const newPred: BleachingPrediction = {
        id: `coral-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: selectedRegion,
        dhw: +dhwSlider.toFixed(2),
        par: +parSlider.toFixed(2),
        severityScore: data.severity_score,
        bleachingLevel: data.bleaching_level,
        survivalProbability: data.survival_probability
      };

      addPrediction(newPred);
    } catch (err: any) {
      console.error("Coral bleaching prediction failed:", err);
      setError(err.message || "Failed to reach backend FastAPI.");
    } finally {
      setIsScanning(false);
    }
  };

  // Run satellite coordinate prediction calling backend FastAPI /predict-coral-bleaching-satellite
  const handleSatellitePredict = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const res = await fetch(`${baseUrl}/predict-coral-bleaching-satellite`, {
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
        throw new Error(`Satellite bleaching API failed: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();
      console.log("Copernicus live telemetry fetched", data);
      setDhwSlider(data.dhw);
      setParSlider(data.par);
      setLiveVulnerability(data.vulnerability);

      setLiveSeverity(data.severity_score);
      setLiveBleachingLevel(data.bleaching_level);
      setLiveSurvival(data.survival_probability);
      setLiveMitigations(data.mitigation_strategies);
      setLiveDescription(data.ecology_description);

      const newPred: BleachingPrediction = {
        id: `coral-${Date.now()}`,
        timestamp: new Date().toISOString(),
        region: `Satellite [${selectedCoords.lat.toFixed(2)}, ${selectedCoords.lng.toFixed(2)}]`,
        dhw: data.dhw,
        par: data.par,
        severityScore: data.severity_score,
        bleachingLevel: data.bleaching_level,
        survivalProbability: data.survival_probability
      };
      addPrediction(newPred);

    } catch (err: any) {
      console.error("Bleaching satellite predict error:", err);
      setError(err.message || "Failed to query satellite altimetry indices.");
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

        if (!header.includes('dhw') && !header.includes('par')) {
          throw new Error("Dataset is missing columns ('DHW' or 'PAR').");
        }

        addDataset({
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: lines.length - 1
        });

        const lastLine = lines[lines.length - 1].split(',');
        if (lastLine.length >= 2) {
          const parsedDHW = parseFloat(lastLine[0]);
          const parsedPAR = parseFloat(lastLine[1]);
          if (!isNaN(parsedDHW)) setDhwSlider(Math.min(15, Math.max(0, parsedDHW)));
          if (!isNaN(parsedPAR)) setParSlider(Math.min(800, Math.max(50, parsedPAR)));
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
      + ["Timestamp,Region,DHW_degWeeks,PAR_umol,Severity_Score,Bleaching_Alert_Level,Survival_Probability",
         ...predictions.map(p => `${p.timestamp},${p.region},${p.dhw},${p.par},${p.severityScore},${p.bleachingLevel},${p.survivalProbability}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `coral_bleaching_forecasting_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCoralColor = () => {
    const ratio = liveSeverity / 100.0;
    const r = Math.round(20 + ratio * 215); 
    const g = Math.round(180 + ratio * 60); 
    const b = Math.round(166 + ratio * 80); 
    return `rgb(${r}, ${g}, ${b})`;
  };

  const coralColor = getCoralColor();

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sun className="text-pink-400 animate-pulse" size={20} />
            Coral Bleaching Forecasting Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">Thermal Degree Heating Weeks (DHW) and PAR light index stress forecasting for reef resilience.</p>
        </div>
        
        {/* Toggle mode */}
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
            <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sliders size={16} className="text-pink-400 animate-pulse" />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Own Values</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Benthic Stress Calibration</span>
                  </div>
                </div>

                {/* DHW anomaly Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Degree Heating Weeks (DHW)</span>
                    <span className="text-pink-400 font-mono font-bold">{dhwSlider.toFixed(1)} °C-weeks</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="16.0"
                    step="0.1"
                    value={dhwSlider}
                    onChange={(e) => setDhwSlider(parseFloat(e.target.value))}
                    className="w-full accent-pink-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase">
                    <span>Safe (0 DHW)</span>
                    <span>Critical Bleaching (&gt;8 DHW)</span>
                  </div>
                </div>

                {/* PAR light Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solar Irradiance (PAR)</span>
                    <span className="text-amber-400 font-mono font-bold">{parSlider.toFixed(0)} µmol/m²/s</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="800"
                    step="10"
                    value={parSlider}
                    onChange={(e) => setParSlider(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase">
                    <span>Turbid / Shade</span>
                    <span>Clear Sky Extreme</span>
                  </div>
                </div>

                {/* Reef CSV Dropzone */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Environmental Altimetry Ingest</span>
                  <div 
                    {...getRootProps()} 
                    className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[105px] ${
                      isDragActive 
                        ? 'border-pink-400/40 bg-pink-500/5' 
                        : 'border-white/5 bg-slate-950/20 hover:border-white/10'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud size={20} className="text-slate-400 mb-1.5" />
                    <span className="text-[11px] font-semibold text-slate-200 block mb-0.5">Drag & Drop CSV</span>
                    <span className="text-[8.5px] text-slate-500 block">Requires columns: DHW, PAR</span>
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
                          <span>{d.rowCount} records</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execute Pred */}
                <button
                  onClick={executePrediction}
                  disabled={isScanning}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 mt-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Chloroplast Physics...</span>
                    </>
                  ) : (
                    <>
                      <Activity size={13} />
                      <span>Predict Bleaching Risk</span>
                    </>
                  )}
                </button>

              </div>
            </GlassCard>
          ) : (
            <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Globe size={16} className="text-pink-400 animate-spin" style={{ animationDuration: '40s' }} />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">1. Satellite</h2>
                    <span className="text-[9px] text-slate-500 font-medium">Reef Surveillance Target</span>
                  </div>
                </div>

                {/* Target Zone Presets */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Reef Ecosystem Hotspots
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {REEF_REGIONS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePresetSelect(preset)}
                        className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${
                          Math.abs(selectedCoords.lat - preset.lat) < 0.0001 &&
                          Math.abs(selectedCoords.lng - preset.lng) < 0.0001
                            ? 'bg-pink-500/15 border-pink-400 text-pink-300'
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
                    mapId="leaflet-map-bleaching"
                  />
                </div>

                {/* Coordinates read */}
                <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Reef Coordinates
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-pink-400" />
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
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg mt-auto animate-none"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping CDSE Sentinel-3 Thermal Gradients...</span>
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

        {/* COLUMN 2: CORAL MORPHING & RADAR STRESS (Output Pane) - 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <GlassCard className="relative overflow-hidden flex-1 flex flex-col justify-between p-6 bg-slate-950/20">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/60 z-20 pointer-events-none flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl">
                <div className="w-6 h-6 rounded-full border-2 border-pink-400 border-t-transparent animate-spin mb-2" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Evaluating Symbiosis Index...</span>
              </div>
            )}

            {/* Coral Reef Bleaching Graphic visual simulation */}
            <div className="space-y-4 flex-1 flex flex-col justify-between font-sans">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>3. AI Quality Prognosis</span>
                <span className="font-mono text-pink-400">Reef Status Model</span>
              </div>

              {/* Branched coral branching SVG overlay */}
              <div className="flex-grow w-full bg-slate-950 border border-white/5 rounded-xl min-h-[160px] relative overflow-hidden flex items-center justify-center py-2">
                <motion.svg
                  className="w-36 h-36 drop-shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                  viewBox="0 0 100 100"
                  animate={{ 
                    rotate: [-1.5, 1.5, -1.5],
                    y: [-1.5, 1.5, -1.5]
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity, 
                    ease: 'easeInOut' 
                  }}
                >
                  <path d="M50,90 Q48,60 50,45" fill="none" stroke={coralColor} strokeWidth="6" strokeLinecap="round" />
                  <path d="M50,70 Q30,55 25,40" fill="none" stroke={coralColor} strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M30,51 Q20,40 18,30" fill="none" stroke={coralColor} strokeWidth="3" strokeLinecap="round" />
                  <path d="M50,58 Q70,45 78,35" fill="none" stroke={coralColor} strokeWidth="4" strokeLinecap="round" />
                  <path d="M68,48 Q82,40 85,28" fill="none" stroke={coralColor} strokeWidth="3" strokeLinecap="round" />
                  <path d="M50,45 Q42,30 45,18" fill="none" stroke={coralColor} strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M50,45 Q58,32 55,20" fill="none" stroke={coralColor} strokeWidth="3.5" strokeLinecap="round" />
                </motion.svg>

                <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur border border-white/5 text-[7.5px] font-mono text-slate-400 rounded-lg p-1.5 flex flex-col">
                  <span>Reef Status:</span>
                  <span className="font-bold text-white uppercase tracking-wider">{liveBleachingLevel.split(' (')[0]}</span>
                </div>
              </div>

              {/* Assessment Panel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider font-mono">Severity Index</span>
                  <span className="text-xs font-bold text-white font-mono">{liveSeverity}%</span>
                </div>
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5 text-center">
                  <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider font-mono">Survival Rate</span>
                  <span className={`text-xs font-bold font-mono ${
                    liveSurvival <= 30 ? 'text-red-400 animate-pulse' :
                    liveSurvival <= 60 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>{liveSurvival}%</span>
                </div>
              </div>

              {/* AI Description */}
              <div className="bg-slate-950/20 border border-white/5 rounded-xl p-2.5">
                <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Thermal stress summary</span>
                <p className="text-[9.5px] text-slate-400 leading-relaxed font-normal mt-0.5">{liveDescription}</p>
              </div>

              {/* Radar Stress Profile Chart */}
              <div className="h-32 w-full relative pt-1.5 border-t border-white/5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Benthic Stress Vector Radar</span>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="85%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="subject" stroke="#475569" fontSize={6.5} />
                      <PolarRadiusAxis stroke="rgba(255,255,255,0.05)" fontSize={6.5} />
                      <Radar name="Stress Profile" dataKey="A" stroke="#f472b6" fill="#f472b6" fillOpacity={0.15} />
                    </RadarChart>
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
              Health Evaluation Archives
            </h3>
          </div>
          {predictions.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer"
            >
              Clear Archives
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
                  p.severityScore >= 75 ? 'bg-red-400' :
                  p.severityScore >= 50 ? 'bg-amber-400' :
                  p.severityScore >= 25 ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
              </div>
              <div className="text-[9px] font-mono text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>DHW stress:</span>
                  <span className="text-slate-300 font-bold">{p.dhw}°C-weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>PAR light:</span>
                  <span className="text-slate-300">{p.par} µmol</span>
                </div>
                <div className="flex justify-between">
                  <span>Severity:</span>
                  <span className="text-pink-400 font-bold">{p.severityScore}%</span>
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
              No historical health evaluations logged. Predict bleaching risk to log.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
