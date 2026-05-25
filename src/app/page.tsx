'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Anchor } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between z-10 px-6 py-8">
      {/* Header bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Anchor className="text-white" size={15} />
          </div>
          <span className="font-semibold text-sm tracking-wider text-slate-100">
            ALCOMA.AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
            Inference Online
          </span>
        </div>
      </header>

      {/* Main hero section */}
      <main className="max-w-4xl w-full mx-auto my-auto flex flex-col items-center text-center justify-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="inline-flex items-center bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-medium text-slate-300 tracking-wider uppercase">
            Marine Intelligence Suite
          </div>

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white leading-tight">
            ALCOMA.AI
          </h1>

          <p className="text-slate-400 text-sm md:text-lg max-w-xl mx-auto leading-relaxed font-normal">
            A high-precision AI platform for marine ecosystem monitoring. Predict water quality metrics, detect plastic pollution using YOLOv8, and track harmful algal blooms.
          </p>

          <div className="pt-6 flex justify-center">
            <Link href="/detection">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                Launch Platform
                <ArrowRight size={14} />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center text-[10px] text-slate-500 py-4 border-t border-white/5">
        <p>© 2026 Alcoma.ai. Marine environmental models built on YOLOv8 and predictive ecology.</p>
      </footer>
    </div>
  );
}
