import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PhytoplanktonPrediction {
  id: string;
  timestamp: string;
  region: string;
  chlorophyllConcentration: number;
  temperature: number;
  bloomRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
  productivityIndex: number;
  impactSummary: string;
}

export interface PhytoplanktonDataset {
  filename: string;
  uploadedAt: string;
  rowCount: number;
}

interface PhytoplanktonState {
  predictions: PhytoplanktonPrediction[];
  datasets: PhytoplanktonDataset[];
  selectedRegion: string;
  chlorophyllSlider: number;
  temperatureSlider: number;
  addPrediction: (pred: PhytoplanktonPrediction) => void;
  addDataset: (dataset: PhytoplanktonDataset) => void;
  setSelectedRegion: (region: string) => void;
  setChlorophyllSlider: (val: number) => void;
  setTemperatureSlider: (val: number) => void;
  clearHistory: () => void;
}

export const usePhytoplanktonStore = create<PhytoplanktonState>()(
  persist(
    (set) => ({
      predictions: [],
      datasets: [],
      selectedRegion: 'Manila Bay, PH',
      chlorophyllSlider: 1.2,
      temperatureSlider: 28.5,
      addPrediction: (pred) => set((state) => ({ predictions: [pred, ...state.predictions].slice(0, 20) })),
      addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
      setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
      setChlorophyllSlider: (chlorophyllSlider) => set({ chlorophyllSlider }),
      setTemperatureSlider: (temperatureSlider) => set({ temperatureSlider }),
      clearHistory: () => set({ predictions: [], datasets: [] }),
    }),
    {
      name: 'alcoma-phytoplankton-store',
    }
  )
);
