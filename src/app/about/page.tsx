'use client';

import React from 'react';
import { 
  Cpu, 
  Database, 
  Layers, 
  Terminal, 
  ArrowRight,
  Anchor,
  GraduationCap
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';

const TECH_STACK = [
  { name: 'Next.js 15 App Router', role: 'React Core & Routing Architecture' },
  { name: 'TypeScript', role: 'Robust Static Types & Code Safety' },
  { name: 'TailwindCSS', role: 'Sleek Layouts & Variable-Based Styling' },
  { name: 'Framer Motion', role: 'Fluid Page Transitions & Workspace Interactions' },
  { name: 'Zustand', role: 'Client State Persistence & Local Database Sync' },
  { name: 'Recharts', role: 'High Performance Vector Chart Telemetry' },
];

export default function AboutPage() {
  return (
    <div className="p-8 space-y-12 max-w-5xl mx-auto">
      
      {/* Intro section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 text-white mb-2">
          <Anchor size={24} />
        </div>
        <h2 className="text-2xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
          Alcoma.ai Marine Intelligence
        </h2>
        <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-normal">
          Alcoma is a premium marine analysis portal designed to monitor and defend fragile coastal ecosystems. By combining deep object detection networks with hydro-chemical telemetry and spectrographic modeling, Alcoma aggregates actionable insights to combat plastic refuse and anticipate ecological stress.
        </p>
      </div>

      {/* SECTION 5: PLATFORM DEVELOPER PROFILE */}
      <GlassCard className="flex flex-col md:flex-row items-center gap-6 p-8 bg-slate-900/20 border-white/10">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg shadow-white/5">
          <GraduationCap size={28} className="text-slate-200" />
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
            Platform Developer & Creator
          </span>
          <h3 className="text-lg font-bold text-white tracking-tight animate-pulse">
            Thanush Gowda P
          </h3>
          <p className="text-xs font-semibold text-slate-400 font-mono">
            APS College of Engineering
          </p>
          <p className="text-xs text-slate-400 leading-relaxed font-normal pt-1">
            Designed and engineered Alcoma.ai as a high-precision intelligence portal for predictive marine ecology. The platform unifies heavy GPU-accelerated deep learning models (YOLOv8 best.pt) with real-time multi-spectral Copernicus satellite telemetry pipelines (Sentinel-2, Sentinel-3, and Sentinel-6) and hydro-chemical ML classifiers. Built with modern React architecture, Framer Motion, and absolute layout responsiveness to empower marine researchers and coastal conservation groups.
          </p>
        </div>
      </GlassCard>

      {/* SECTION 2: ARCHITECTURE BLOCK DIAGRAM */}
      <GlassCard className="space-y-8">
        
        <div className="border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-300" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              System Architecture & Data Pipelines
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            Sensor stream ingestion to alert console
          </span>
        </div>

        {/* Flowchart grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-center font-mono">
          
          {/* Node 1: Sensor input */}
          <div className="flex flex-col items-center gap-2 p-4 bg-slate-950/40 border border-white/5 rounded-xl">
            <Database className="text-slate-400 mb-1" size={20} />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">01 / Raw Streams</span>
            <span className="text-[9px] text-slate-500 leading-normal">
              Sonde Hydro-sensors, Drone Frame Buffers, Satellite Imagery
            </span>
          </div>

          <div className="hidden md:flex justify-center text-slate-700">
            <ArrowRight size={14} />
          </div>

          {/* Node 2: AI inference */}
          <div className="flex flex-col items-center gap-2 p-4 bg-slate-950/40 border border-white/20 rounded-xl">
            <Cpu className="text-white mb-1" size={20} />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">02 / Processing</span>
            <span className="text-[9px] text-slate-400 leading-normal">
              YOLOv8 Object Detection & ML Water Index Classification
            </span>
          </div>

          <div className="hidden md:flex justify-center text-slate-700">
            <ArrowRight size={14} />
          </div>

          {/* Node 3: Dashboard telemetry */}
          <div className="flex flex-col items-center gap-2 p-4 bg-slate-950/40 border border-white/5 rounded-xl">
            <Terminal className="text-slate-400 mb-1" size={20} />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">03 / UI Dashboard</span>
            <span className="text-[9px] text-slate-500 leading-normal">
              Monochrome Telemetry charts, local database logs, CSV report cards
            </span>
          </div>

        </div>

      </GlassCard>

      {/* SECTION 3: TECHNICAL METHODOLOGIES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <GlassCard className="space-y-4">
          <h4 className="font-semibold text-xs text-white uppercase tracking-wider">YOLOv8 Plastic Scanning</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            The computer vision system processes camera frames using YOLOv8 models. Bounding boxes isolate refuse items like plastic bags, fishing lines, and bottles by evaluating coordinate locations in pixel grids.
          </p>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h4 className="font-semibold text-xs text-white uppercase tracking-wider">ML Sonde Classifier</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            Coastal chemical parameters (pH, salinity, dissolved oxygen, nitrates) feed classification models. The client evaluates indices based on localized stress metrics to flag ecological imbalances.
          </p>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h4 className="font-semibold text-xs text-white uppercase tracking-wider">HAB Spectral Tracking</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            Chlorophyll level and temperature fluctuations monitor marine eutrophication. Changes correlate with increased probability of toxic algal blooms (red tides) to prompt early mitigation efforts.
          </p>
        </GlassCard>

      </div>

      {/* SECTION 4: TECH STACK GRID */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-white tracking-tight">
            Technological Foundation
          </h3>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Optimized for fluid, responsive browser interfaces
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono">
          {TECH_STACK.map((tc, i) => (
            <div key={i} className="p-4 bg-slate-950/20 border border-white/5 rounded-xl flex flex-col justify-between h-20 text-left">
              <span className="text-[11px] font-semibold text-white truncate">{tc.name}</span>
              <span className="text-[9px] text-slate-500 uppercase">{tc.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Impact quote card */}
      <GlassCard className="text-center p-8 bg-slate-950/30">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
          Conservation Impact
        </span>
        <blockquote className="text-xs md:text-sm font-medium text-slate-300 italic max-w-2xl mx-auto leading-relaxed">
          &quot;By arming scientists and conservation groups with real-time telemetry pipelines, Alcoma reduces intervention timelines from weeks to seconds, halting plastic distribution and predicting ecological stress before it escalates.&quot;
        </blockquote>
      </GlassCard>

    </div>
  );
}

