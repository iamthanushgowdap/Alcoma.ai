'use client';

import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function ParticlesBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesQty = useSettingsStore((state) => state.particlesQty);
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const theme = useSettingsStore((state) => state.theme);

  // Sync theme class to document element for global CSS overrides
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'midnight') {
        root.classList.add('theme-midnight');
      } else {
        root.classList.remove('theme-midnight');
      }
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      alpha: number;
      pulseSpeed: number;
      pulseVal: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 1.2 + 0.3; // Tiny micro-dots
        this.speedX = Math.random() * 0.1 - 0.05;
        this.speedY = Math.random() * -0.2 - 0.05; // Calmly float upwards
        this.alpha = Math.random() * 0.3 + 0.05; // Faint opacity
        this.pulseSpeed = Math.random() * 0.01 + 0.002;
        this.pulseVal = Math.random() * Math.PI;
      }

      update(w: number, h: number) {
        this.x += this.speedX;
        this.y += this.speedY;
        this.pulseVal += this.pulseSpeed;

        if (this.y < -5) {
          this.y = h + 5;
          this.x = Math.random() * w;
        }
        if (this.x < -5) this.x = w + 5;
        if (this.x > w + 5) this.x = -5;
      }

      draw(c: CanvasRenderingContext2D) {
        const pulseAlpha = this.alpha + Math.sin(this.pulseVal) * 0.05;
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = `rgba(255, 255, 255, ${Math.max(0.01, Math.min(0.4, pulseAlpha))})`;
        c.fill();
      }
    }

    const init = () => {
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      particles = [];
      const count = animationsEnabled ? particlesQty : 0;
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(w, h));
      }
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('resize', handleResize);
    init();

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep ocean or Midnight cosmic radial ambient glow
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        10,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height)
      );
      if (theme === 'midnight') {
        gradient.addColorStop(0, '#10051e');   // Deep midnight purple
        gradient.addColorStop(0.5, '#060212'); // Dark indigo-purple
        gradient.addColorStop(1, '#03010b');   // Deepest cosmic black-purple
      } else {
        gradient.addColorStop(0, '#070f22');   // Deep blue-gray
        gradient.addColorStop(0.5, '#040916'); // Darker slate blue
        gradient.addColorStop(1, '#02050e');   // Deepest black-blue
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (animationsEnabled) {
        for (let i = 0; i < particles.length; i++) {
          particles[i].update(canvas.width, canvas.height);
          particles[i].draw(ctx);
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [particlesQty, animationsEnabled, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-1000 ${
        theme === 'midnight' ? 'bg-[#03010b]' : 'bg-[#02050e]'
      }`}
    />
  );
}
