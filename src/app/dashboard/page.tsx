'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Eye, 
  Waves, 
  Cpu, 
  ShieldAlert, 
  TrendingUp, 
  CheckCircle2, 
  ArrowUpRight,
  Compass
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { usePredictionStore } from '@/store/usePredictionStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Dynamic Recharts import or safety check to avoid hydration issues
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  
  const { scans, waterPredictions, habRiskIndex } = usePredictionStore();
  const apiEndpoint = useSettingsStore((state) => state.apiEndpoint);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ping backend to check if live FastAPI inference is online
  useEffect(() => {
    if (!mounted) return;
    
    const checkBackend = async () => {
      try {
        const url = new URL(apiEndpoint);
        const baseUrl = `${url.protocol}//${url.host}/`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        await fetch(baseUrl, { 
          method: 'GET',
          signal: controller.signal,
          mode: 'no-cors'
        });
        clearTimeout(timeoutId);
        setBackendOnline(true);
      } catch (err) {
        setBackendOnline(false);
      }
    };
    
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, [apiEndpoint, mounted]);

  // Compute aggregate stats from store
  const totalScannedItems = scans.reduce((acc, s) => acc + s.detectedCount, 0);
  const avgConfidence = scans.length > 0 
    ? Math.round(scans.reduce((acc, s) => acc + s.confidence, 0) / scans.length) 
    : 0;
  
  const latestWaterScore = waterPredictions[0]?.score ?? 0;
  const latestWaterStatus = waterPredictions[0]?.status ?? 'Unknown';

  // Mock data for Recharts area graph (Ocean health over past 7 days)
  const healthHistoryData = [
    { day: 'Mon', waterScore: 78, plasticScans: 12 },
    { day: 'Tue', waterScore: 82, plasticScans: 8 },
    { day: 'Wed', waterScore: 75, plasticScans: 15 },
    { day: 'Thu', waterScore: 68, plasticScans: 22 },
    { day: 'Fri', waterScore: 85, plasticScans: 5 },
    { day: 'Sat', waterScore: 88, plasticScans: 6 },
    { day: 'Sun', waterScore: latestWaterScore || 88, plasticScans: scans.length || 4 },
  ];

  // Helper to format system log events
  const systemLogs = [
    {
      id: 'log-endpoint',
      message: backendOnline === true 
        ? 'Inference service link established' 
        : backendOnline === false 
        ? 'Inference engine unreachable — simulation active'
        : 'Verifying inference engine connectivity...',
      meta: `Host: ${apiEndpoint}`,
      type: backendOnline === true ? 'success' : backendOnline === false ? 'warning' : 'info',
      time: 'Sync'
    },
    ...(scans.length > 0 ? [{
      id: `log-scan-${scans[0].id}`,
      message: `YOLOv8 scan: ${scans[0].detectedCount} refuse items verified`,
      meta: `Location: ${scans[0].location} | Confidence: ${scans[0].confidence}%`,
      type: 'info',
      time: new Date(scans[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }] : []),
    ...(waterPredictions.length > 0 ? [{
      id: `log-wp-${waterPredictions[0].id}`,
      message: `Coastal status update: Index ${waterPredictions[0].score}/100 (${waterPredictions[0].status})`,
      meta: `pH: ${waterPredictions[0].pH} | DO: ${waterPredictions[0].dissolvedOxygen} mg/L | Temp: ${waterPredictions[0].temp}°C`,
      type: waterPredictions[0].status === 'Critical' ? 'error' : waterPredictions[0].status === 'Bad' ? 'warning' : 'success',
      time: new Date(waterPredictions[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }] : []),
    {
      id: 'log-default-1',
      message: 'Spectral HAB telemetry pipeline active',
      meta: 'Muted 10m grid mapping overlay online',
      type: 'info',
      time: '08:00'
    }
  ];

  // Benchmark metrics comparison
  const latestWP = waterPredictions[0] || { temp: 24.5, pH: 8.1, dissolvedOxygen: 7.2, salinity: 35.1, turbidity: 1.2, nitrate: 0.15 };
  const environmentalBenchmarks = [
    { name: 'Water Temperature', ideal: '15.0°C - 28.0°C', actual: `${latestWP.temp}°C`, status: (latestWP.temp >= 15 && latestWP.temp <= 28) ? 'Optimal' : 'Elevated' },
    { name: 'pH Index', ideal: '7.8 - 8.4', actual: `${latestWP.pH}`, status: (latestWP.pH >= 7.8 && latestWP.pH <= 8.4) ? 'Optimal' : 'Sub-Optimal' },
    { name: 'Dissolved Oxygen', ideal: '> 5.0 mg/L', actual: `${latestWP.dissolvedOxygen} mg/L`, status: latestWP.dissolvedOxygen >= 5.0 ? 'Optimal' : 'Critical' },
    { name: 'Salinity levels', ideal: '32.0 - 37.0 PSU', actual: `${latestWP.salinity} PSU`, status: (latestWP.salinity >= 32 && latestWP.salinity <= 37) ? 'Optimal' : 'Sub-Optimal' },
    { name: 'Turbidity score', ideal: '< 5.0 NTU', actual: `${latestWP.turbidity} NTU`, status: latestWP.turbidity < 5.0 ? 'Optimal' : 'High' },
    { name: 'Nitrates concentration', ideal: '< 1.0 mg/L', actual: `${latestWP.nitrate} mg/L`, status: latestWP.nitrate < 1.0 ? 'Optimal' : 'High' }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Marine Dashboard</h2>
          <p className="text-slate-400 text-xs mt-1">Real-time indicators and telemetry streams for marine sensor arrays.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${backendOnline === true ? 'bg-emerald-500 animate-pulse' : backendOnline === false ? 'bg-amber-500' : 'bg-slate-500'}`} />
          <span className="text-slate-400">Inference Engine:</span>
          <span className="text-slate-200 font-mono font-medium">
            {backendOnline === true ? 'ONLINE' : backendOnline === false ? 'SIMULATION FALLBACK' : 'CONNECTING...'}
          </span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Marine Health Score */}
        <GlassCard className="relative overflow-hidden flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Water Quality Index</span>
            <Activity className="text-slate-400" size={16} />
          </div>
          <div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold text-white tracking-tight">{latestWaterScore}%</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                latestWaterStatus === 'Good' ? 'bg-emerald-500/10 text-emerald-400' :
                latestWaterStatus === 'Bad' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {latestWaterStatus}
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
              <div 
                style={{ width: `${latestWaterScore}%` }}
                className="h-full bg-white transition-all duration-1000"
              />
            </div>
          </div>
        </GlassCard>

        {/* YOLOv8 Refuse count */}
        <GlassCard className="relative overflow-hidden flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">YOLOv8 Refuse Scanned</span>
            <Eye className="text-slate-400" size={16} />
          </div>
          <div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold text-white tracking-tight">{totalScannedItems}</span>
              <span className="text-xs font-medium text-slate-400">detected items</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-3 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-slate-400" />
              <span>Avg AI Confidence: {avgConfidence}%</span>
            </div>
          </div>
        </GlassCard>

        {/* HAB Algal Risk Meter */}
        <GlassCard className="relative overflow-hidden flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">HAB Bloom Risk</span>
            <Waves className="text-slate-400" size={16} />
          </div>
          <div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold text-white tracking-tight">{habRiskIndex}%</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                habRiskIndex > 60 ? 'bg-red-500/10 text-red-400' :
                habRiskIndex > 30 ? 'bg-amber-500/10 text-amber-400' :
                'bg-emerald-500/10 text-emerald-400'
              }`}>
                {habRiskIndex > 60 ? 'High Risk' : habRiskIndex > 30 ? 'Elevated' : 'Low Risk'}
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
              <div 
                style={{ width: `${habRiskIndex}%` }}
                className="h-full bg-white transition-all duration-1000"
              />
            </div>
          </div>
        </GlassCard>

        {/* AI Inference System Status */}
        <GlassCard className="relative overflow-hidden flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Inference Telemetry</span>
            <Cpu className="text-slate-400" size={16} />
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Latency</span>
              <span className="text-white font-mono font-medium">{backendOnline === true ? '~120ms' : '~180ms (Local)'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Active Weight</span>
              <span className="text-white font-mono font-medium">yolov8s_best.pt</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Engine Type</span>
              <span className="text-white font-mono font-medium">{backendOnline === true ? 'PyTorch CUDA' : 'JS CPU'}</span>
            </div>
          </div>
        </GlassCard>

      </div>

      {/* RECHARTS & RECENT DETECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Weekly Coastal Condition Matrix */}
        <div className="lg:col-span-8">
          <GlassCard className="h-[380px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-slate-300" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Weekly Coastal Condition Matrix
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                7-Day Trend Comparison
              </span>
            </div>
            <div className="flex-1 w-full relative">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={healthHistoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08}/>
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPlastic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05}/>
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="day" 
                      stroke="#475569" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <ChartTooltip 
                      contentStyle={{ 
                        backgroundColor: '#090d16', 
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontFamily: 'inherit',
                        fontSize: '11px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="waterScore" 
                      name="Water Score Index"
                      stroke="#ffffff" 
                      strokeWidth={1.5}
                      fillOpacity={1} 
                      fill="url(#colorWater)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="plasticScans" 
                      name="Plastic Detections"
                      stroke="rgba(255, 255, 255, 0.4)" 
                      strokeWidth={1.5}
                      fillOpacity={1} 
                      fill="url(#colorPlastic)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                  Loading trend diagnostics...
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Recent Detections List */}
        <div className="lg:col-span-4">
          <GlassCard className="h-[380px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-slate-300" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Recent Detections
                </h3>
              </div>
              <Link href="/detection" className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                Workspace <ArrowUpRight size={12} />
              </Link>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
              {scans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Eye className="text-slate-600 mb-2" size={24} />
                  <span className="text-xs text-slate-500">No recent scans logged</span>
                  <Link href="/detection" className="text-[10px] text-slate-400 underline mt-2 hover:text-white">
                    Scan now
                  </Link>
                </div>
              ) : (
                scans.slice(0, 4).map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <img 
                        src={scan.imageUrl} 
                        alt={scan.location} 
                        className="w-10 h-10 object-cover rounded-md border border-white/10"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                          {scan.location}
                        </span>
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          {mounted ? new Date(scan.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-bold text-white">
                        {scan.detectedCount} {scan.detectedCount === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {scan.confidence}% conf
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

      </div>

      {/* DIAGNOSTICS & SYSTEM BENCHMARKS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* System Diagnostics Feed */}
        <div className="md:col-span-7">
          <GlassCard className="min-h-[300px] flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-slate-300" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Console Diagnostics Feed
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wider">LIVE RECEPTION</span>
            </div>
            
            <div className="flex-1 space-y-3 max-h-[220px] overflow-y-auto pr-2 no-scrollbar">
              {systemLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      log.type === 'success' ? 'bg-emerald-400' : 
                      log.type === 'warning' ? 'bg-amber-400' : 
                      log.type === 'error' ? 'bg-red-500 animate-pulse' : 
                      'bg-slate-400'
                    }`} />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-200">{log.message}</span>
                      <span className="text-slate-500 text-[10px] mt-0.5 truncate font-mono">{log.meta}</span>
                    </div>
                  </div>
                  <span className="text-slate-500 font-mono text-[9px] shrink-0 pt-0.5">{mounted ? log.time : ''}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Environmental Benchmarks */}
        <div className="md:col-span-5">
          <GlassCard className="min-h-[300px] flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-slate-300" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Baseline Environmental Indices
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wider">WQI CORE</span>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="grid grid-cols-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-white/5">
                  <span>Parameter</span>
                  <span className="text-center">Optimal</span>
                  <span className="text-right font-mono">Actual</span>
                </div>
                
                {environmentalBenchmarks.map((bench, idx) => (
                  <div key={idx} className="grid grid-cols-3 items-center py-1 text-xs">
                    <span className="text-slate-400 font-medium truncate pr-2">{bench.name}</span>
                    <span className="text-slate-500 text-center">{bench.ideal}</span>
                    <div className="text-right flex items-center justify-end gap-1.5 font-mono">
                      <span className="text-white font-medium">{bench.actual}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        bench.status === 'Optimal' ? 'bg-emerald-500/80' : 
                        bench.status === 'Critical' ? 'bg-red-500 animate-pulse' : 
                        'bg-amber-500/80'
                      }`} title={`Status: ${bench.status}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
