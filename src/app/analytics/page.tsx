'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  Cpu,
  Layers,
  Database,
  FileText,
  Activity,
  Wind,
  Sun,
  Waves,
  Droplets
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore } from '@/store/usePredictionStore';

// Dynamic Recharts import
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

export default function Analytics() {
  const [mounted, setMounted] = useState(false);
  const { scans, waterPredictions } = usePredictionStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Format dates for chart X-axis
  const formatChartDate = (timestampStr: string) => {
    try {
      const d = new Date(timestampStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // 1. Process Plastic Scans Data
  const sortedScans = [...scans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const plasticTrendsData = sortedScans.map((s) => ({
    name: formatChartDate(s.timestamp),
    count: s.detectedCount,
    confidence: s.confidence,
    location: s.location
  }));

  // 2. Process Water Quality Data
  const sortedWater = [...waterPredictions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const waterTrendsData = sortedWater.map((w) => ({
    name: formatChartDate(w.timestamp),
    score: w.score,
    temp: w.temp,
    pH: w.pH
  }));

  // Aggregate stats
  const totalScans = scans.length;
  const totalPlasticsDetected = scans.reduce((acc, curr) => acc + curr.detectedCount, 0);
  const avgWqiScore = waterPredictions.length > 0
    ? Math.round(waterPredictions.reduce((acc, curr) => acc + curr.score, 0) / waterPredictions.length)
    : 0;
  const averageConfidence = scans.length > 0
    ? parseFloat((scans.reduce((acc, curr) => acc + curr.confidence, 0) / scans.length).toFixed(1))
    : 0;

  // Export full raw local storage logs
  const exportLogs = () => {
    const dataObj = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalScans,
        totalPlasticsDetected,
        avgWqiScore,
        averageConfidence
      },
      scans,
      waterPredictions
    };

    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alcoma-ocean-telemetry-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-80px)] justify-between">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="flex items-center gap-4 p-5 bg-slate-900/10">
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-slate-300">
            <Cpu size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Scans Run</span>
            <span className="text-xl font-bold text-white font-mono">{totalScans}</span>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4 p-5 bg-slate-900/10">
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-slate-300">
            <Layers size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Plastics Detected</span>
            <span className="text-xl font-bold text-white font-mono">{totalPlasticsDetected}</span>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4 p-5 bg-slate-900/10">
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-slate-300">
            <Activity size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Water Index</span>
            <span className="text-xl font-bold text-white font-mono">{avgWqiScore} <span className="text-xs text-slate-500 font-normal">/100</span></span>
          </div>
        </GlassCard>

        {/* Download Data CTA Card */}
        <GlassCard className="flex items-center justify-between p-5 bg-slate-900/10">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Raw Telemetry</span>
            <span className="text-xs font-semibold text-slate-300">Local Logs File</span>
          </div>
          <button
            onClick={exportLogs}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-950 font-semibold text-[10px] rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download size={11} />
            Export Data
          </button>
        </GlassCard>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-stretch">
        
        {/* Chart 1: Plastics Detected Count */}
        <GlassCard className="flex flex-col justify-between p-6 bg-slate-900/10 min-h-[360px]">
          <div className="space-y-1 mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Detected Plastics Count Over Time
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Refuse units identified inside satellite/drone ingestion pipelines.
            </span>
          </div>

          <div className="flex-1 w-full relative">
            {mounted && plasticTrendsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={plasticTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPlastics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={9} />
                  <YAxis stroke="#475569" fontSize={9} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Plastics Count"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorPlastics)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                Awaiting telemetry scan data...
              </div>
            )}
          </div>
        </GlassCard>

        {/* Chart 2: Water Quality Index Trend */}
        <GlassCard className="flex flex-col justify-between p-6 bg-slate-900/10 min-h-[360px]">
          <div className="space-y-1 mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Water Quality Index (WQI) Trends
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              ML evaluated health scores (0-100 threshold indices).
            </span>
          </div>

          <div className="flex-1 w-full relative">
            {mounted && waterTrendsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waterTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={9} />
                  <YAxis stroke="#475569" fontSize={9} domain={[0, 100]} />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="WQI Score"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    dot={{ stroke: '#ffffff', strokeWidth: 1, r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                Awaiting water quality telemetry reports...
              </div>
            )}
          </div>
        </GlassCard>

      </div>

      {/* SECTION 3: PLATFORM CORE MODULES INGESTION STATUS */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Scientific Modules Telemetry Status
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            Active status, validation metrics, and algorithm ingestion reports for all six platform projects.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Marine Plastic Detection */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plastic Detection</span>
              <Layers size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                {totalScans} Scans Sync
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                {totalPlasticsDetected} Refuse Items Verified ({averageConfidence}% avg conf)
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">YOLOv8 Active</span>
            </div>
          </GlassCard>

          {/* Card 2: Water Quality Sonde */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Water Quality</span>
              <Droplets size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                {waterPredictions.length} Sonde Logs
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                {avgWqiScore}% Avg Chemical Health Rating
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">RF Classifier Active</span>
            </div>
          </GlassCard>

          {/* Card 3: Phytoplankton Dynamics */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Phytoplankton Dynamics</span>
              <Activity size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                Sentinel-3 Telemetry
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                Primary productivity & biomass ratio metrics
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Copernicus Sync</span>
            </div>
          </GlassCard>

          {/* Card 4: Upwelling Zone Pumps */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Upwelling Zones</span>
              <TrendingUp size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                Ekman Boundary Pumps
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                Deep sub-surface nutrient enrichment tracking
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Telemetry Active</span>
            </div>
          </GlassCard>

          {/* Card 5: Ocean Current Vectors */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ocean Currents</span>
              <Wind size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                Sentinel-6 Altimeter
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                Geostrophic drift & particle simulator synchronized
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Vectors Synced</span>
            </div>
          </GlassCard>

          {/* Card 6: Coral Bleaching watch */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Coral Bleaching</span>
              <Sun size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                Degree Heating Weeks
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                Thermal anomalies & Acropora watch indices
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Active Watch</span>
            </div>
          </GlassCard>

          {/* Card 7: HAB Bloom Monitoring */}
          <GlassCard className="flex flex-col justify-between p-5 bg-slate-900/10 h-36">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HAB Monitoring</span>
              <Waves size={14} className="text-slate-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-mono block">
                Risk Index: 45%
              </span>
              <span className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 block">
                Spectral NDCI microalgae density sweeps
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Sync Successful</span>
            </div>
          </GlassCard>
        </div>
      </div>

    </div>
  );
}
