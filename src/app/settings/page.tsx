'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Trash2,
  RefreshCw,
  Sliders,
  Database,
  Cpu,
  Globe,
  AlertTriangle,
  Copy
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePredictionStore } from '@/store/usePredictionStore';

export default function SettingsPage() {
  const {
    theme,
    apiEndpoint,
    particlesQty,
    animationsEnabled,
    mapTilerKey,
    sentinelClientId,
    sentinelClientSecret,
    setTheme,
    setApiEndpoint,
    setParticlesQty,
    toggleAnimations,
    setMapTilerKey,
    setSentinelClientId,
    setSentinelClientSecret,
    resetSettings
  } = useSettingsStore();

  const { scans, waterPredictions, resetAllData, clearScans, clearWaterPredictions } = usePredictionStore();

  // Wipes all localStorage states and refreshes
  const handleWipeDatabase = () => {
    if (confirm('CAUTION: This will wipe all uploaded images, telemetry reports, and local logs. Proceed?')) {
      clearScans();
      clearWaterPredictions();
      localStorage.clear();
      alert('Local database wiped successfully.');
      window.location.reload();
    }
  };

  // Re-seeds mock data
  const handleResetToSeeds = () => {
    resetAllData();
    alert('Local database re-seeded with mock telemetry datasets.');
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: UI CUSTOMIZATION & API CONFIGURATION (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* API Configuration Card */}
          <GlassCard className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <Globe size={16} className="text-white" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Inference Engine Configuration
              </h3>
            </div>

            <div className="space-y-2">
              <label htmlFor="api-endpoint" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                FastAPI Host URL
              </label>
              <div className="relative">
                <input
                  id="api-endpoint"
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="e.g. http://localhost:8000/predict"
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                Alcoma.ai queries this endpoint using a <code className="font-mono text-slate-400">multipart/form-data</code> POST request containing the image file under the key <code className="font-mono text-slate-400">file</code>. When down or offline, the platform falls back to simulated inference parameters.
              </p>

              {/* Dynamic Warning Alert Card */}
              {apiEndpoint !== 'https://iamthanushgowda-alcoma-api.hf.space/predict' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs space-y-2 mt-3"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <AlertTriangle size={14} />
                    <span>Active Host Endpoint Changed</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Warning: Changing this endpoint will cause the current production API connection to go offline. Live machine learning detections will be disabled unless your custom server is active and running. Be aware before changing.
                  </p>
                </motion.div>
              )}

              {/* Helper Restoration Box */}
              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-3 mt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Default Production API Endpoint
                    </span>
                    <code className="font-mono text-cyan-400 text-xs block break-all select-all">
                      https://iamthanushgowda-alcoma-api.hf.space/predict
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('https://iamthanushgowda-alcoma-api.hf.space/predict');
                      alert('Default production API URL copied to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-lg text-[10px] font-semibold text-white tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 self-start md:self-center cursor-pointer font-sans"
                  >
                    <Copy size={12} />
                    Copy Endpoint
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  If you mistakenly changed the API endpoint or live detections are offline, copy and paste the default production API above to restore all detection capabilities, or use your local endpoint <code className="font-mono text-slate-400">http://127.0.0.1:8000/predict</code> when running your local development server (`npm run dev`).
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Satellite Imagery Configuration */}
          <GlassCard className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <Globe size={16} className="text-white" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Map Tiles Configuration
              </h3>
            </div>

            <div className="space-y-4">
              {/* MapTiler Key */}
              <div className="space-y-2">
                <label htmlFor="maptiler-key" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  MapTiler API Key
                </label>
                <input
                  id="maptiler-key"
                  type="password"
                  value={mapTilerKey}
                  onChange={(e) => setMapTilerKey(e.target.value)}
                  placeholder="Enter MapTiler API Key"
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                />
                
                {/* Visual Explanation list */}
                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-3 mt-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Why is this key required?
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    MapTiler is the high-performance GIS tiles engine powering Alcoma.ai. It is required to render interactive vector basemaps, compute multi-spectral Copernicus satellite coordinate zooms, and stitch hydrodynamic ocean currents canvas flows in the manual and satellite workspaces.
                  </p>
                  
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pt-1">
                    How to get your free key:
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    1. Go to <a href="https://maptiler.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">maptiler.com</a> and sign up for a free developer account (no credit card required).<br/>
                    2. Go to your **MapTiler Cloud Admin** dashboard.<br/>
                    3. Under **Credentials & Keys**, copy your primary API Key and paste it into the field above.
                  </p>
                  
                  {/* Deployment environment variable tips */}
                  <div className="border-t border-white/5 pt-3 mt-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                      💡 Production Deployment Tip (Vercel)
                    </span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      To avoid entering this key manually every time you clear browser cookies or open private windows, define it in your Vercel Project Settings as an environment variable:<br/>
                      • <strong>Key:</strong> <code className="font-mono text-slate-400">NEXT_PUBLIC_MAPTILER_KEY</code><br/>
                      • <strong>Value:</strong> <code className="font-mono text-slate-400">your-maptiler-api-key-here</code>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </GlassCard>

          {/* UI Preferences Card */}
          <GlassCard className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <Settings size={16} className="text-white" />
              <h3 className="text-base font-bold text-white tracking-tight">
                User Interface Settings
              </h3>
            </div>

            {/* Sub-Theme Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Color Sub-Theme</span>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'deep-ocean', name: 'Deep Ocean' },
                  { id: 'midnight', name: 'Midnight' }
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id as any)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center cursor-pointer transition-all ${
                      theme === th.id
                        ? 'border-white bg-white/5 text-white'
                        : 'border-white/5 bg-slate-950/20 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Particle quantity slider */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Canvas Particle Quantity</span>
                <span className="text-white font-mono font-medium">{particlesQty} units</span>
              </div>
              <input
                type="range" min="10" max="180" step="5" value={particlesQty}
                onChange={(e) => setParticlesQty(parseInt(e.target.value))}
                className="w-full accent-white cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-white">Animations</span>
                <span className="text-[10px] text-slate-500">Enable transitions and background canvas particles</span>
              </div>
              <button
                onClick={toggleAnimations}
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all flex items-center ${
                  animationsEnabled ? 'bg-white justify-end' : 'bg-slate-900 justify-start border border-white/5'
                }`}
              >
                <motion.div layout className={`w-4 h-4 rounded-full ${animationsEnabled ? 'bg-slate-950' : 'bg-slate-500'}`} />
              </button>
            </div>

            {/* Reset Settings */}
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                onClick={resetSettings}
                className="px-4 py-2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Reset UI Defaults
              </button>
            </div>

          </GlassCard>

        </div>

        {/* RIGHT COLUMN: DATABASE MANAGEMENT CONSOLE (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <GlassCard className="flex-grow flex flex-col justify-between min-h-[360px] gap-6">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                <Database size={16} className="text-white" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Local Database Administration
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Alcoma.ai uses a LocalStorage engine to simulate server-side telemetry storage. You can check current tables index loads here.
              </p>

              {/* Db statistics cards */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs">
                  <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">yolo_plastic_scans</span>
                  <span className="text-white font-mono font-semibold">{scans.length} rows</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs">
                  <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">ml_water_predictions</span>
                  <span className="text-white font-mono font-semibold">{waterPredictions.length} rows</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs">
                  <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">system_preferences</span>
                  <span className="text-slate-200 font-mono font-semibold">Active Sync</span>
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
              
              <button
                onClick={handleResetToSeeds}
                className="w-full py-3 bg-slate-950 border border-white/5 hover:bg-white/5 hover:border-white/20 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
              >
                <RefreshCw size={14} className="text-white" />
                Re-seed Default Datasets
              </button>

              <button
                onClick={handleWipeDatabase}
                className="w-full py-3 bg-red-950/10 border border-red-500/10 hover:border-red-500/30 hover:bg-red-950/20 text-red-400 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Trash2 size={14} />
                Wipe Local Database
              </button>

            </div>

          </GlassCard>

        </div>

      </div>
    </div>
  );
}

