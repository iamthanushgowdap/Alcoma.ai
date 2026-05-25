'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Clock, ShieldAlert, Cpu } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';

const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/detection': 'Plastic Pollution Detection',
  '/water-quality': 'Water Quality Prediction',
  '/hab': 'Harmful Algal Bloom Monitor',
  '/analytics': 'Analytics & Reporting',
  '/settings': 'System Settings',
  '/about': 'Architecture & Platform Info',
};

export default function Navbar() {
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [isApiOnline, setIsApiOnline] = useState<boolean | null>(null);
  const apiEndpoint = useSettingsStore((state) => state.apiEndpoint);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ping FastAPI health check endpoint every 5 seconds
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        let baseUrl = 'http://127.0.0.1:8000';
        if (apiEndpoint) {
          try {
            const parsed = new URL(apiEndpoint);
            baseUrl = `${parsed.protocol}//${parsed.host}`;
          } catch (e) {
            baseUrl = apiEndpoint.replace(/\/predict$/, '').replace(/\/$/, '');
          }
        }
        const targetUrl = `${baseUrl}/health`;
        const res = await fetch(targetUrl, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setIsApiOnline(true);
        } else {
          setIsApiOnline(false);
        }
      } catch (err) {
        setIsApiOnline(false);
      }
    };

    checkApiHealth();
    const healthInterval = setInterval(checkApiHealth, 5000);
    return () => clearInterval(healthInterval);
  }, [apiEndpoint]);

  // Hide navbar on landing page
  if (pathname === '/') return null;

  const pageTitle = PATH_TITLES[pathname] || 'Marine Core Platform';

  return (
    <header className="glass-navbar sticky top-0 right-0 left-0 h-20 px-8 flex items-center justify-between z-30 select-none bg-slate-950/20 backdrop-blur-md">
      {/* Title & Path */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
          <span>Platform</span>
          <span>/</span>
          <span className="text-slate-300">{pageTitle}</span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-white mt-0.5">
          {pageTitle}
        </h1>
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center gap-4">
        {/* API Endpoint status indicator */}
        <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-slate-400">
          <Cpu size={12} className="text-slate-400" />
          <span>Inference Engine:</span>
          {isApiOnline === null ? (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
              <span className="font-semibold uppercase tracking-wide text-[10px]">Pinging...</span>
            </div>
          ) : isApiOnline ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shadow-[0_0_8px_#34d399]" />
              <span className="font-bold uppercase tracking-wide text-[10px]">API Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
              <span className="font-bold uppercase tracking-wide text-[10px]">API Offline</span>
            </div>
          )}
        </div>

        {/* Real-time Clock */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 font-mono font-medium">
          <Clock size={12} className="text-slate-400" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
}
