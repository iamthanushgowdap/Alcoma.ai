import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UpwellingPrediction {
  id: string;
  timestamp: string;
  region: string;
  sst: number;
  chlorophyll: number;
  upwellingIndex: number;
  richnessLevel: 'Low' | 'Moderate' | 'High' | 'Extremely High';
  yieldIndicator: string;
}

export interface UpwellingDataset {
  filename: string;
  uploadedAt: string;
  rowCount: number;
}

interface UpwellingState {
  predictions: UpwellingPrediction[];
  datasets: UpwellingDataset[];
  selectedRegion: string;
  sstSlider: number;
  chlorophyllSlider: number;
  addPrediction: (pred: UpwellingPrediction) => void;
  addDataset: (dataset: UpwellingDataset) => void;
  setSelectedRegion: (region: string) => void;
  setSstSlider: (val: number) => void;
  setChlorophyllSlider: (val: number) => void;
  clearHistory: () => void;
}

export const useUpwellingStore = create<UpwellingState>()(
  persist(
    (set) => ({
      predictions: [],
      datasets: [],
      selectedRegion: 'GPatch Area Alpha',
      sstSlider: 16.5,
      chlorophyllSlider: 3.5,
      addPrediction: (pred) => set((state) => ({ predictions: [pred, ...state.predictions].slice(0, 20) })),
      addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
      setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
      setSstSlider: (sstSlider) => set({ sstSlider }),
      setChlorophyllSlider: (chlorophyllSlider) => set({ chlorophyllSlider }),
      clearHistory: () => set({ predictions: [], datasets: [] }),
    }),
    {
      name: 'alcoma-upwelling-store',
    }
  )
);
