import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'deep-ocean' | 'midnight';
  apiEndpoint: string;
  particlesQty: number;
  animationsEnabled: boolean;
  mapTilerKey: string;
  sentinelClientId: string;
  sentinelClientSecret: string;
  setTheme: (theme: 'deep-ocean' | 'midnight') => void;
  setApiEndpoint: (url: string) => void;
  setParticlesQty: (qty: number) => void;
  toggleAnimations: () => void;
  setMapTilerKey: (key: string) => void;
  setSentinelClientId: (id: string) => void;
  setSentinelClientSecret: (secret: string) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'deep-ocean',
      apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://127.0.0.1:8000/predict',
      particlesQty: 60,
      animationsEnabled: true,
      mapTilerKey: '',
      sentinelClientId: '',
      sentinelClientSecret: '',
      setTheme: (theme) => set({ theme }),
      setApiEndpoint: (apiEndpoint) => set({ apiEndpoint }),
      setParticlesQty: (particlesQty) => set({ particlesQty }),
      toggleAnimations: () => set((state) => ({ animationsEnabled: !state.animationsEnabled })),
      setMapTilerKey: (mapTilerKey) => set({ mapTilerKey }),
      setSentinelClientId: (sentinelClientId) => set({ sentinelClientId }),
      setSentinelClientSecret: (sentinelClientSecret) => set({ sentinelClientSecret }),
      resetSettings: () =>
          set({
            theme: 'deep-ocean',
            apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://127.0.0.1:8000/predict',
          particlesQty: 60,
          animationsEnabled: true,
          mapTilerKey: '',
          sentinelClientId: '',
          sentinelClientSecret: '',
        }),
    }),
    {
      name: 'alcoma-settings-store',
    }
  )
);
