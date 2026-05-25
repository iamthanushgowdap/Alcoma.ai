import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CurrentPrediction {
  id: string;
  timestamp: string;
  region: string;
  avgSpeed: number;
  peakSpeed: number;
  direction: number; // in degrees
  driftRisk: 'Negligible' | 'Low' | 'Moderate' | 'High';
  confidence: number;
}

export interface CurrentDataset {
  filename: string;
  uploadedAt: string;
  rowCount: number;
}

interface OceanCurrentState {
  predictions: CurrentPrediction[];
  datasets: CurrentDataset[];
  selectedRegion: string;
  forecastHorizon: number; // in hours (e.g. 24, 48, 72)
  scrubHour: number; // timeline scrubber position
  isPlaying: boolean;
  addPrediction: (pred: CurrentPrediction) => void;
  addDataset: (dataset: CurrentDataset) => void;
  setSelectedRegion: (region: string) => void;
  setForecastHorizon: (val: number) => void;
  setScrubHour: (val: number) => void;
  setIsPlaying: (val: boolean) => void;
  clearHistory: () => void;
}

export const useOceanCurrentStore = create<OceanCurrentState>()(
  persist(
    (set) => ({
      predictions: [],
      datasets: [],
      selectedRegion: 'Roatan Coast, HN',
      forecastHorizon: 24,
      scrubHour: 0,
      isPlaying: false,
      addPrediction: (pred) => set((state) => ({ predictions: [pred, ...state.predictions].slice(0, 20) })),
      addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
      setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
      setForecastHorizon: (forecastHorizon) => set({ forecastHorizon }),
      setScrubHour: (scrubHour) => set({ scrubHour }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      clearHistory: () => set({ predictions: [], datasets: [] }),
    }),
    {
      name: 'alcoma-ocean-current-store',
    }
  )
);
