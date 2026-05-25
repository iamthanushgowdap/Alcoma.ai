import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import ParticlesBg from '@/components/ParticlesBg';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Alcoma.ai - Marine AI Intelligence Platform',
  description:
    'Sleek, high-fidelity marine monitoring powered by YOLOv8 object detection and water telemetry analysis.',
  keywords: [
    'Marine AI',
    'Ocean Intelligence',
    'YOLOv8 Plastic Detection',
    'Water Quality Prediction',
    'SaaS Dashboard',
  ],
  authors: [{ name: 'Alcoma Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-screen bg-[#030712] text-slate-100 flex relative overflow-hidden select-none">
        {/* Subtle background particles */}
        <ParticlesBg />

        {/* Global UI layout structure */}
        <div className="flex w-full min-h-screen relative z-10">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
