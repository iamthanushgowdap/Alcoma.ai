'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Sliders,
  Activity,
  History,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Globe,
  Loader2,
  MapPin,
  Waves
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore, WaterPrediction } from '@/store/usePredictionStore';
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
  { name: 'Ganges River Delta', lat: 22.0000, lng: 90.0000 },
  { name: 'Manila Bay, PH', lat: 14.5995, lng: 120.9842 },
  { name: 'Baltic Sea Coast', lat: 54.3520, lng: 18.6466 },
  { name: 'Gulf of Mexico', lat: 29.0000, lng: -90.0000 },
  { name: 'Great Barrier Reef', lat: -18.2871, lng: 147.6992 },
];

const SCENARIOS = [
  {
    name: 'Pristine Coastal Lagoon',
    temp: 22.0,
    pH: 8.2,
    dissolvedOxygen: 8.5,
    salinity: 35.0,
    turbidity: 0.5,
    chlorophyll: 0.2,
    nitrate: 0.05,
  },
  {
    name: 'Agricultural Estuary Runoff',
    temp: 26.0,
    pH: 7.4,
    dissolvedOxygen: 4.8,
    salinity: 30.0,
    turbidity: 6.8,
    chlorophyll: 5.5,
    nitrate: 2.2,
  },
  {
    name: 'Severe Algal Bloom Tide',
    temp: 28.5,
    pH: 6.8,
    dissolvedOxygen: 2.1,
    salinity: 24.0,
    turbidity: 14.5,
    chlorophyll: 24.0,
    nitrate: 4.5,
  }
];

export default function WaterQuality() {
  const { waterPredictions, addWaterPrediction, clearWaterPredictions } = usePredictionStore();
  const { mapTilerKey, apiEndpoint } = useSettingsStore();

  // Active Operating Mode
  const [activeTab, setActiveTab] = useState<'own-values' | 'satellite'>('own-values');

  // Interactive Sonde States
  const [temp, setTemp] = useState(24.0);
  const [pH, setPH] = useState(8.1);
  const [dissolvedOxygen, setDissolvedOxygen] = useState(7.5);
  const [salinity, setSalinity] = useState(35.0);
  const [turbidity, setTurbidity] = useState(1.5);
  const [chlorophyll, setChlorophyll] = useState(1.0);
  const [nitrate, setNitrate] = useState(0.2);

  // Satellite Specific States
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: 22.0000,
    lng: 90.0000,
  });
  const [satelliteTelemetry, setSatelliteTelemetry] = useState<any | null>(null);

  const [isPredicting, setIsPredicting] = useState(false);
  const [activeResult, setActiveResult] = useState<WaterPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'list' | 'trend'>('list');
  const [isMounted, setIsMounted] = useState(false);

  // Set hydration/mount state and sync first prediction
  useEffect(() => {
    setIsMounted(true);
    if (waterPredictions.length > 0 && !activeResult) {
      setActiveResult(waterPredictions[0]);
    }
  }, [waterPredictions, activeResult]);

  const loadScenario = (sc: typeof SCENARIOS[0]) => {
    setTemp(sc.temp);
    setPH(sc.pH);
    setDissolvedOxygen(sc.dissolvedOxygen);
    setSalinity(sc.salinity);
    setTurbidity(sc.turbidity);
    setChlorophyll(sc.chlorophyll);
    setNitrate(sc.nitrate);
    setError(null);
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

  // Predict using manually entered Sliders
  const handlePredict = async () => {
    setIsPredicting(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const response = await fetch(`${baseUrl}/predict-water-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Temperature: temp,
          pH: pH,
          Dissolved_Oxygen: dissolvedOxygen,
          Salinity: salinity,
          Turbidity: turbidity,
          Chlorophyll: chlorophyll,
          Nitrate: nitrate
        })
      });

      if (!response.ok) {
        throw new Error(`FastAPI server error: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      console.log("FastAPI connected successfully");
      console.log("Prediction received", data);

      const mlPrediction = data.prediction; 
      const mlConfidence = data.confidence; 

      let score = 50;
      let status: 'Good' | 'Bad' | 'Critical' = 'Bad';
      
      if (mlPrediction === 'Good') {
        score = Math.round(mlConfidence);
        status = 'Good';
      } else {
        score = Math.round(100 - mlConfidence);
        status = score < 30 ? 'Critical' : 'Bad';
      }

      let explanation = '';
      let recommendations: string[] = [];

      if (mlPrediction === 'Good') {
        explanation = `Water quality is classified as GOOD with ${mlConfidence}% prediction confidence. Sonde telemetry indicates stable thermal and chemical parameters matching a healthy coastal buffer zone.`;
        recommendations = [
          'Continue baseline telemetry checks weekly.',
          'Maintain natural coastal wetlands and buffers.',
          'No biological interventions required.'
        ];
      } else {
        explanation = `Water quality is classified as BAD/CRITICAL with ${mlConfidence}% prediction confidence. High turbidity or nutrient concentration presents a high risk of hypoxia and eutrophication.`;
        recommendations = [
          'Audit upstream agricultural/industrial runoff channels.',
          'Consider deployment of active aeration rigs.',
          'Increase tracking cadence and alert local taskforce.'
        ];
      }

      const newPrediction: WaterPrediction = {
        id: `wp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        temp,
        pH,
        dissolvedOxygen,
        salinity,
        turbidity,
        chlorophyll,
        nitrate,
        score,
        status,
        explanation,
        recommendations
      };

      addWaterPrediction(newPrediction);
      setActiveResult(newPrediction);
      setSatelliteTelemetry(null); // clear satellite metadata
    } catch (err: any) {
      console.error("Prediction failed:", err);
      setError(
        err.message || "Failed to communicate with local FastAPI backend. Please ensure the backend server is running."
      );
    } finally {
      setIsPredicting(false);
    }
  };

  // Predict using Real Copernicus Satellite data from map coordinates
  const handleSatellitePredict = async () => {
    setIsPredicting(true);
    setError(null);

    try {
      const baseUrl = getBaseUrl(apiEndpoint);
      const response = await fetch(`${baseUrl}/predict-water-quality-satellite`, {
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
      console.log("Copernicus live telemetry fetched", data);

      const tel = data.telemetry;
      const wq = data.water_quality;
      const ab = data.algal_bloom;

      // Sync Sonde Sliders with real satellite numbers
      setTemp(tel.Temperature);
      setPH(tel.pH);
      setDissolvedOxygen(tel.Dissolved_Oxygen);
      setSalinity(tel.Salinity);
      setTurbidity(tel.Turbidity);
      setChlorophyll(tel.Chlorophyll);
      setNitrate(tel.Nitrate);

      // Map binary classifiers to active results
      let score = 50;
      let status: 'Good' | 'Bad' | 'Critical' = 'Bad';
      
      if (wq.prediction === 'Good') {
        score = Math.round(wq.confidence);
        status = 'Good';
      } else {
        score = Math.round(100 - wq.confidence);
        status = score < 30 ? 'Critical' : 'Bad';
      }

      const explanation = `Copernicus Satellite Analysis at [${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lng.toFixed(4)}]: Water is classified as ${wq.prediction.toUpperCase()} (${wq.confidence}% confidence). Algal Bloom Risk is ${ab.risk_level.toUpperCase()} (${ab.probability}% probability) — ${ab.description}`;

      const recommendations = [
        `Telemetry Source: ${data.source}`,
        `Algae Risk Level: ${ab.risk_level} (${ab.probability}% likelihood)`,
        wq.prediction === 'Good' 
          ? 'No immediate biological action required; coordinate regular spectral audits.' 
          : 'Flagged zone: Trigger watershed mitigation protocol and inspect nearshore runoff outlets.'
      ];

      const newPrediction: WaterPrediction = {
        id: `wp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        temp: tel.Temperature,
        pH: tel.pH,
        dissolvedOxygen: tel.Dissolved_Oxygen,
        salinity: tel.Salinity,
        turbidity: tel.Turbidity,
        chlorophyll: tel.Chlorophyll,
        nitrate: tel.Nitrate,
        score,
        status,
        explanation,
        recommendations
      };

      addWaterPrediction(newPrediction);
      setActiveResult(newPrediction);
      setSatelliteTelemetry({
        source: data.source,
        algalBloomRisk: ab.risk_level,
        algalBloomProb: ab.probability,
        algalBloomDesc: ab.description
      });
    } catch (err: any) {
      console.error("Satellite scanning failed:", err);
      setError(
        err.message || "Failed to query satellite pipeline. Ensure FastAPI server is running."
      );
    } finally {
      setIsPredicting(false);
    }
  };

  // Map presets select
  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
  };

  // Recharts trend formatting
  const trendData = [...waterPredictions]
    .reverse()
    .map((wp) => ({
      time: new Date(wp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: wp.score,
      label: wp.status
    }));

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Premium Cohesive Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="text-cyan-400" size={20} />
            Coastal Water Quality ML Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sentinel-2 satellite remote sensing indices and physical parameter calibration for benthic quality forecasting.
          </p>
        </div>
        
        {/* Tab switch */}
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

      {/* 2-Pane Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        
        {/* COLUMN 1: CONTROL PANE (Own Values or Satellite) - 7 Cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeTab === 'own-values' ? (
            <GlassCard className="flex-grow flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sliders size={16} className="text-emerald-400 animate-pulse" />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                      1. Own Values
                    </h2>
                    <span className="text-[9px] text-slate-500 font-medium">Sonde Parameter Calibration</span>
                  </div>
                </div>

                {/* Scenario presets selection */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Simulation Scenarios
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS.map((sc, i) => (
                      <button
                        key={i}
                        onClick={() => loadScenario(sc)}
                        className="px-2.5 py-1 bg-slate-950/30 hover:bg-white/5 border border-white/5 hover:border-white/10 text-[9.5px] font-bold uppercase tracking-wide rounded-md cursor-pointer transition-all text-slate-300"
                      >
                        {sc.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders collection */}
                <div className="space-y-3.5 overflow-y-auto no-scrollbar max-h-[380px] pr-1 py-1 flex-1 flex flex-col justify-center">
                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Temperature</span>
                      <span className="text-slate-200 font-mono font-bold">{temp.toFixed(1)}°C</span>
                    </div>
                    <input
                      type="range" min="10" max="35" step="0.5" value={temp}
                      onChange={(e) => setTemp(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* pH */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">pH Index</span>
                      <span className="text-slate-200 font-mono font-bold">{pH.toFixed(1)}</span>
                    </div>
                    <input
                      type="range" min="5" max="10" step="0.1" value={pH}
                      onChange={(e) => setPH(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Dissolved Oxygen */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Dissolved Oxygen</span>
                      <span className="text-slate-200 font-mono font-bold">{dissolvedOxygen.toFixed(1)} mg/L</span>
                    </div>
                    <input
                      type="range" min="1.0" max="15.0" step="0.1" value={dissolvedOxygen}
                      onChange={(e) => setDissolvedOxygen(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Salinity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Salinity</span>
                      <span className="text-slate-200 font-mono font-bold">{salinity.toFixed(1)} PSU</span>
                    </div>
                    <input
                      type="range" min="15" max="40" step="0.5" value={salinity}
                      onChange={(e) => setSalinity(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Turbidity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Turbidity</span>
                      <span className="text-slate-200 font-mono font-bold">{turbidity.toFixed(1)} NTU</span>
                    </div>
                    <input
                      type="range" min="0" max="20" step="0.1" value={turbidity}
                      onChange={(e) => setTurbidity(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Chlorophyll */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Chlorophyll-A</span>
                      <span className="text-slate-200 font-mono font-bold">{chlorophyll.toFixed(1)} µg/L</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="0.5" value={chlorophyll}
                      onChange={(e) => setChlorophyll(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Nitrate */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Nitrate</span>
                      <span className="text-slate-200 font-mono font-bold">{nitrate.toFixed(2)} mg/L</span>
                    </div>
                    <input
                      type="range" min="0" max="6" step="0.05" value={nitrate}
                      onChange={(e) => setNitrate(parseFloat(e.target.value))}
                      className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sonde Execute Button */}
                <button
                  onClick={handlePredict}
                  disabled={isPredicting}
                  className="w-full py-3 bg-white hover:bg-slate-100 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-lg mt-auto"
                >
                  {isPredicting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Solving Random Forest...</span>
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
            <GlassCard className="flex-grow flex flex-col justify-between p-6 bg-slate-900/10 border-white/5">
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Globe size={16} className="text-cyan-400 animate-spin" style={{ animationDuration: '40s' }} />
                  <div className="flex flex-col">
                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                      1. Satellite
                    </h2>
                    <span className="text-[9px] text-slate-500 font-medium">Copernicus Satellite Feed Target</span>
                  </div>
                </div>

                {/* Target Zone Presets */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Delta & Estuary Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset, idx) => (
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
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Leaflet Map Wrapper */}
                <div className="flex-1 min-h-[250px] max-h-[320px] w-full relative rounded-xl overflow-hidden border border-white/5">
                  <SatelliteMap
                    mapTilerKey={mapTilerKey}
                    selectedCoords={selectedCoords}
                    onCenterSelect={(lat, lng) => setSelectedCoords({ lat, lng })}
                    presetCoords={[]}
                    mapId="leaflet-map-wq"
                  />
                </div>

                {/* Selected coordinates telemetry */}
                <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Bounding Coordinates
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
                  disabled={isPredicting}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-slate-500 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg mt-auto"
                >
                  {isPredicting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping CDSE Sentinel-2 Ocean Gradients...</span>
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

        {/* COLUMN 2: WATER QUALITY RESULTS & ARCHIVE HISTORY - 5 Cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex-1 flex flex-col gap-6">
            <AnimatePresence mode="wait">
              {activeResult && !isPredicting ? (
                <motion.div
                  key="result-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="flex-grow flex flex-col"
                >
                  <GlassCard className="flex-1 flex flex-col justify-between p-6 bg-slate-950/20 border-white/5">
                    <div className="space-y-4 flex-1 flex flex-col justify-between">
                      
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                          Environmental Assessment
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                          activeResult.status === 'Good' 
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                            : activeResult.status === 'Bad'
                            ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                            : 'text-red-400 bg-red-500/10 border border-red-500/20'
                        }`}>
                          {activeResult.status}
                        </span>
                      </div>

                      {/* Score display */}
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-500">Water Quality Index Score</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-bold tracking-tight text-white">{activeResult.score}</span>
                            <span className="text-xs text-slate-500 font-semibold uppercase font-mono">/100</span>
                          </div>
                        </div>
                        
                        {/* Gauge bar */}
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              activeResult.status === 'Good' 
                                ? 'bg-emerald-400' 
                                : activeResult.status === 'Bad' 
                                ? 'bg-amber-400' 
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${activeResult.score}%` }}
                          />
                        </div>
                      </div>

                      {/* Satellite Specific Algal Bloom widget */}
                      {satelliteTelemetry && (
                        <div className="bg-slate-950/40 border border-cyan-500/10 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Waves size={13} className="text-cyan-400 animate-pulse" />
                              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wide">Algal Bloom Prognostic</span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              satelliteTelemetry.algalBloomRisk === 'Critical' || satelliteTelemetry.algalBloomRisk === 'High'
                                ? 'text-red-400 bg-red-500/10 border border-red-500/25'
                                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25'
                            }`}>
                              {satelliteTelemetry.algalBloomRisk} Risk
                            </span>
                          </div>
                          <div className="flex items-center gap-2 justify-between">
                            <span className="text-[10px] text-slate-500">Bloom Probability</span>
                            <span className="text-xs font-mono font-bold text-white">{satelliteTelemetry.algalBloomProb}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                satelliteTelemetry.algalBloomRisk === 'Critical' || satelliteTelemetry.algalBloomRisk === 'High' ? 'bg-red-500' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${satelliteTelemetry.algalBloomProb}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Sonde Telemetry Metrics grid */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/20 border border-white/5 rounded-lg p-2.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Temp</span>
                          <span className="text-slate-300 font-mono font-bold">{activeResult.temp.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Dissolved O2</span>
                          <span className="text-slate-300 font-mono font-bold">{activeResult.dissolvedOxygen.toFixed(1)} mg/L</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">pH Index</span>
                          <span className="text-slate-300 font-mono font-bold">{activeResult.pH.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Salinity</span>
                          <span className="text-slate-300 font-mono font-bold">{activeResult.salinity.toFixed(1)} PSU</span>
                        </div>
                        <div className="flex justify-between col-span-2 border-t border-white/5 pt-1.5 mt-1">
                          <span className="text-slate-500">Chlorophyll-A</span>
                          <span className="text-slate-200 font-mono font-bold">{activeResult.chlorophyll.toFixed(2)} µg/L</span>
                        </div>
                      </div>

                      {/* Condition Explanation */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                          Condition Analysis
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed font-normal">
                          {activeResult.explanation}
                        </p>
                      </div>

                      {/* Recommendations */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                          Mitigation Recommendations
                        </span>
                        <div className="space-y-1.5">
                          {activeResult.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/20 border border-white/5 rounded-lg p-2">
                              <ChevronRight size={12} className="text-white shrink-0 mt-0.5" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ) : (
                <GlassCard className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-500 gap-3 border-dashed border-white/10 bg-slate-900/10">
                  <Activity size={24} className="text-slate-600 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Awaiting Telemetry Calculation
                  </span>
                  <span className="text-[10px] max-w-[200px] leading-relaxed">
                    Modify the input telemetry parameters or select coordinate points on the Copernicus map, then execute prediction models to run.
                  </span>
                </GlassCard>
              )}
            </AnimatePresence>

            {/* Interactive Historical & Trend Visualizer Card */}
            <GlassCard className="max-h-[300px] flex flex-col justify-between p-6 border-white/5 mt-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex gap-4">
                  <button
                    onClick={() => setHistoryTab('list')}
                    className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      historyTab === 'list' ? 'text-white' : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <History size={13} />
                    Logs
                  </button>
                  <button
                    onClick={() => setHistoryTab('trend')}
                    className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      historyTab === 'trend' ? 'text-white' : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <TrendingUp size={13} />
                    Trend Chart
                  </button>
                </div>
                {waterPredictions.length > 0 && (
                  <button
                    onClick={clearWaterPredictions}
                    className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 no-scrollbar mt-3 h-[200px] flex flex-col justify-center">
                {historyTab === 'list' ? (
                  <div className="space-y-2 overflow-y-auto h-full pr-1 no-scrollbar">
                    {waterPredictions.map((wp) => (
                      <div
                        key={wp.id}
                        onClick={() => {
                          setActiveResult(wp);
                          // reconstruct satellite metadata if we detect it was a satellite log
                          if (wp.explanation.includes('Copernicus')) {
                            const riskMatch = wp.explanation.match(/Risk is (\w+) \((\d+\.?\d*)%\)/);
                            setSatelliteTelemetry({
                              source: wp.recommendations[0] || 'Copernicus Satellite',
                              algalBloomRisk: riskMatch ? riskMatch[1] : 'Unknown',
                              algalBloomProb: riskMatch ? riskMatch[2] : '0'
                            });
                          } else {
                            setSatelliteTelemetry(null);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                          activeResult?.id === wp.id
                            ? 'bg-white/5 border-white/20'
                            : 'bg-slate-950/20 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 text-left">
                          <span className="text-[10px] font-bold text-white">
                            {wp.explanation.includes('Copernicus') ? 'Satellite Scan' : 'Sonde Calibration'}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono">
                            {new Date(wp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${
                          wp.status === 'Good' ? 'text-emerald-400' : wp.status === 'Bad' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          Score: {wp.score}%
                        </span>
                      </div>
                    ))}
                    {waterPredictions.length === 0 && (
                      <div className="py-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        No history logs archived.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full w-full relative pt-2">
                    {waterPredictions.length > 1 ? (
                      <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" stroke="#475569" fontSize={8} tickLine={false} axisLine={false} />
                          <YAxis stroke="#475569" fontSize={8} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#020617', 
                              borderColor: 'rgba(255,255,255,0.05)', 
                              borderRadius: '8px', 
                              color: '#fff', 
                              fontSize: '9px' 
                            }} 
                          />
                          <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={1.5} fillOpacity={1} fill="url(#colorScore)" name="Quality Score" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="py-6 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Need at least 2 logs to render trend charts.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

      </div>

    </div>
  );
}
