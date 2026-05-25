import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface PlasticScan {
  id: string;
  imageUrl: string;
  originalImage?: string; // used for before/after comparison
  timestamp: string;
  detectedCount: number;
  confidence: number;
  labels: string[];
  boundingBoxes: BoundingBox[];
  location: string;
  sizeClassification: 'Micro' | 'Macro' | 'Mixed';
  modelUsed?: string;
  modelPath?: string;
  inferenceTimeMs?: number;
}

export interface WaterPrediction {
  id: string;
  timestamp: string;
  temp: number;
  pH: number;
  dissolvedOxygen: number;
  salinity: number;
  turbidity: number;
  chlorophyll: number;
  nitrate: number;
  score: number;
  status: 'Good' | 'Bad' | 'Critical';
  explanation: string;
  recommendations: string[];
}

interface PredictionState {
  scans: PlasticScan[];
  waterPredictions: WaterPrediction[];
  habRiskIndex: number; // 0 to 100
  habHeatmapSeed: number;
  addScan: (scan: PlasticScan) => void;
  deleteScan: (id: string) => void;
  clearScans: () => void;
  addWaterPrediction: (prediction: WaterPrediction) => void;
  clearWaterPredictions: () => void;
  setHabRiskIndex: (index: number) => void;
  resetAllData: () => void;
}

const mockScans: PlasticScan[] = [
  {
    id: 'scan-1',
    imageUrl: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80',
    originalImage: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80',
    timestamp: '2026-05-21T14:30:00Z',
    detectedCount: 14,
    confidence: 94.2,
    labels: ['plastic bottle', 'nylon bag', 'fishing net'],
    boundingBoxes: [
      { x: 10, y: 15, width: 20, height: 18, label: 'plastic bottle', confidence: 0.96 },
      { x: 35, y: 40, width: 25, height: 30, label: 'nylon bag', confidence: 0.91 },
      { x: 60, y: 20, width: 30, height: 45, label: 'fishing net', confidence: 0.95 },
    ],
    location: 'Pacific Garbage Patch - Zone A',
    sizeClassification: 'Macro',
  },
  {
    id: 'scan-2',
    imageUrl: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
    originalImage: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
    timestamp: '2026-05-20T09:15:00Z',
    detectedCount: 6,
    confidence: 88.5,
    labels: ['microplastics', 'plastic cap'],
    boundingBoxes: [
      { x: 15, y: 30, width: 5, height: 5, label: 'microplastics', confidence: 0.89 },
      { x: 50, y: 60, width: 12, height: 10, label: 'plastic cap', confidence: 0.92 },
    ],
    location: 'Biscayne Bay, Miami',
    sizeClassification: 'Micro',
  },
  {
    id: 'scan-3',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    originalImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    timestamp: '2026-05-18T18:45:00Z',
    detectedCount: 0,
    confidence: 99.1,
    labels: [],
    boundingBoxes: [],
    location: 'Hanalei Bay, Kauai',
    sizeClassification: 'Mixed',
  }
];

const mockWaterPredictions: WaterPrediction[] = [
  {
    id: 'wp-1',
    timestamp: '2026-05-22T10:00:00Z',
    temp: 24.5,
    pH: 8.1,
    dissolvedOxygen: 7.2,
    salinity: 35.1,
    turbidity: 1.2,
    chlorophyll: 0.8,
    nitrate: 0.15,
    score: 88,
    status: 'Good',
    explanation: 'Water metrics reflect a healthy coastal marine ecosystem. Dissolved oxygen is high and turbidity is low, supporting robust marine life.',
    recommendations: [
      'Maintain existing conservation zone protections.',
      'Schedule routine weekly monitoring.',
      'No immediate biological mitigation required.'
    ],
  },
  {
    id: 'wp-2',
    timestamp: '2026-05-21T16:20:00Z',
    temp: 26.8,
    pH: 7.4,
    dissolvedOxygen: 4.1,
    salinity: 32.4,
    turbidity: 5.8,
    chlorophyll: 4.2,
    nitrate: 1.8,
    score: 42,
    status: 'Bad',
    explanation: 'Low dissolved oxygen combined with high nitrate and turbidity indicates potential run-off pollution and risk of eutrophication.',
    recommendations: [
      'Investigate upstream agricultural or municipal run-off channels.',
      'Deploy aerators to boost dissolved oxygen values locally.',
      'Monitor for subsequent algal bloom indications.'
    ],
  },
  {
    id: 'wp-3',
    timestamp: '2026-05-19T11:05:00Z',
    temp: 28.2,
    pH: 6.9,
    dissolvedOxygen: 2.8,
    salinity: 28.9,
    turbidity: 12.4,
    chlorophyll: 18.5,
    nitrate: 4.1,
    score: 18,
    status: 'Critical',
    explanation: 'Extremely high chlorophyll and nitrate concentrations matching low dissolved oxygen and low pH. Severe ecological stress event detected.',
    recommendations: [
      'Issue immediate water contact warning for public safety.',
      'Execute localized microalgae filtering/skimming.',
      'Alert county environmental emergency response teams.'
    ],
  }
];

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set) => ({
      scans: [],
      waterPredictions: mockWaterPredictions,
      habRiskIndex: 45,
      habHeatmapSeed: 4,
      addScan: (scan) => {
        try {
          set((state) => {
            const cleanScans = state.scans.map((s) => ({
              ...s,
              originalImage: undefined,
            }));
            return { scans: [scan, ...cleanScans].slice(0, 15) };
          });
        } catch (error: any) {
          if (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
          ) {
            console.warn('Quota exceeded when adding scan. Retrying with fewer scans...');
            try {
              set((state) => {
                const cleanScans = state.scans.map((s) => ({
                  ...s,
                  originalImage: undefined,
                }));
                return { scans: [scan, ...cleanScans].slice(0, 5) };
              });
            } catch (innerError) {
              console.error('Failed to save even with 5 scans. Retrying with only the new scan...');
              try {
                set({ scans: [scan] });
              } catch (lastError) {
                console.error('Failed to save even with 1 scan. Clearing all scans from store...');
                set({ scans: [] });
              }
            }
          } else {
            throw error;
          }
        }
      },
      deleteScan: (id) => set((state) => ({ scans: state.scans.filter((s) => s.id !== id) })),
      clearScans: () => set({ scans: [] }),
      addWaterPrediction: (prediction) =>
        set((state) => ({ waterPredictions: [prediction, ...state.waterPredictions] })),
      clearWaterPredictions: () => set({ waterPredictions: [] }),
      setHabRiskIndex: (habRiskIndex) => set({ habRiskIndex }),
      resetAllData: () =>
        set({
          scans: [],
          waterPredictions: mockWaterPredictions,
          habRiskIndex: 45,
        }),
    }),
    {
      name: 'alcoma-prediction-store',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error during hydration:', error);
          return;
        }
        if (state) {
          let hasLargeScan = false;
          let hasOriginalImage = false;
          const cleanedScans = state.scans.map((scan) => {
            let changed = false;
            let imageUrl = scan.imageUrl;
            
            if (scan.originalImage) {
              hasOriginalImage = true;
              changed = true;
            }
            if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 200000) {
              hasLargeScan = true;
            }
            
            if (changed) {
              const { originalImage, ...rest } = scan;
              return rest;
            }
            return scan;
          });
          
          if (hasLargeScan || hasOriginalImage) {
            console.log('Cleaning up bloated scans from rehydrated storage...');
            const finalScans = cleanedScans
              .filter((s) => !(s.imageUrl && s.imageUrl.startsWith('data:') && s.imageUrl.length > 200000))
              .slice(0, 10);
            
            state.scans = finalScans;
            setTimeout(() => {
              try {
                usePredictionStore.setState({ scans: finalScans });
              } catch (e) {
                console.error('Failed to save cleaned scans to storage:', e);
              }
            }, 0);
          }
        }
      },
    }
  )
);
