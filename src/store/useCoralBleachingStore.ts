import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BleachingPrediction {
  id: string;
  timestamp: string;
  region: string;
  dhw: number; // Degree Heating Weeks
  par: number; // Photosynthetically Active Radiation
  severityScore: number; // 0 to 100
  bleachingLevel: 'Normal (Safe)' | 'Watch' | 'Alert Level 1' | 'Alert Level 2 (Bleaching)';
  survivalProbability: number;
}

export interface CoralDataset {
  filename: string;
  uploadedAt: string;
  rowCount: number;
}

interface CoralBleachingState {
  predictions: BleachingPrediction[];
  datasets: CoralDataset[];
  selectedRegion: string;
  dhwSlider: number;
  parSlider: number;
  addPrediction: (pred: BleachingPrediction) => void;
  addDataset: (dataset: CoralDataset) => void;
  setSelectedRegion: (region: string) => void;
  setDhwSlider: (val: number) => void;
  setParSlider: (val: number) => void;
  clearHistory: () => void;
}

export const useCoralBleachingStore = create<CoralBleachingState>()(
  persist(
    (set) => ({
      predictions: [],
      datasets: [],
      selectedRegion: 'Great Barrier Reef',
      dhwSlider: 2.5,
      parSlider: 350,
      addPrediction: (pred) => set((state) => ({ predictions: [pred, ...state.predictions].slice(0, 20) })),
      addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
      setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
      setDhwSlider: (dhwSlider) => set({ dhwSlider }),
      setParSlider: (parSlider) => set({ parSlider }),
      clearHistory: () => set({ predictions: [], datasets: [] }),
    }),
    {
      name: 'alcoma-coral-bleaching-store',
    }
  )
);
