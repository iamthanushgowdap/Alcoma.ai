'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Eye,
  Droplets,
  Waves,
  BarChart3,
  Settings,
  Info,
  ChevronLeft,
  ChevronRight,
  Anchor,
  Globe,
  Layers,
  TrendingUp,
  Wind,
  Sun
} from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Plastic Detection', path: '/detection', icon: Eye },
  { name: 'Phytoplankton Dynamics', path: '/phytoplankton', icon: Layers },
  { name: 'Upwelling Zones', path: '/upwelling', icon: TrendingUp },
  { name: 'Currents Altimetry', path: '/ocean-current', icon: Wind },
  { name: 'Coral Bleaching', path: '/coral-bleaching', icon: Sun },
  { name: 'Water Quality', path: '/water-quality', icon: Droplets },
  { name: 'HAB Monitoring', path: '/hab', icon: Waves },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'About', path: '/about', icon: Info },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Hide sidebar on the landing page
  if (pathname === '/') return null;

  return (
    <motion.div
      animate={{ width: collapsed ? '80px' : '260px' }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="glass-sidebar h-screen sticky top-0 left-0 flex flex-col justify-between py-6 px-4 z-40 shrink-0 select-none bg-slate-950/80"
    >
      {/* Top Section / Logo */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <motion.div
            animate={{ rotate: collapsed ? 360 : 0 }}
            transition={{ duration: 1 }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <Anchor className="text-white" size={18} />
          </motion.div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <span className="font-bold text-sm tracking-wider text-slate-100">
                ALCOMA
              </span>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">
                Marine Intelligence
              </span>
            </motion.div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all duration-250 ${
                    isActive
                      ? 'bg-white/5 border border-white/10 text-white font-medium'
                      : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {/* Minimal vertical bar for active page */}
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-white rounded-r"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  <item.icon
                    size={18}
                    className={`transition-transform duration-200 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'
                    }`}
                  />

                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-medium tracking-wide"
                    >
                      {item.name}
                    </motion.span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-20 bg-slate-900 border border-white/10 text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-lg">
                      {item.name}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-center p-2.5 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight size={16} />
        ) : (
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-wider uppercase">
            <ChevronLeft size={16} /> Minimize
          </div>
        )}
      </button>
    </motion.div>
  );
}
