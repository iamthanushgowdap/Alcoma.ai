'use client';

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GlassCard({ children, className = '', onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-panel p-6 ${className} ${
        onClick ? 'cursor-pointer select-none active:scale-[0.99] transition-all' : ''
      }`}
    >
      {children}
    </div>
  );
}
