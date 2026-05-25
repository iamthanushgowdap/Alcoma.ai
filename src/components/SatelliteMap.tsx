'use client';

import React, { useEffect, useRef } from 'react';

interface Preset {
  name: string;
  lat: number;
  lng: number;
}

interface SatelliteMapProps {
  mapTilerKey: string;
  selectedCoords: { lat: number; lng: number } | null;
  onCenterSelect: (lat: number, lng: number) => void;
  presetCoords: Preset[];
  mapId?: string;
}

export default function SatelliteMap({
  mapTilerKey,
  selectedCoords,
  onCenterSelect,
  presetCoords,
  mapId = 'leaflet-map',
}: SatelliteMapProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mapInstance: any;

    // Load Leaflet and initialize map on the client side
    import('leaflet').then((L) => {
      // Avoid double initialization in development React StrictMode
      const mapContainer = document.getElementById(mapId);
      if (!mapContainer || mapContainer.classList.contains('leaflet-container')) {
        return;
      }

      // Configure default icons correctly to prevent Next.js relative assets path issues
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      const initialLat = selectedCoords?.lat ?? 14.5995;
      const initialLng = selectedCoords?.lng ?? 120.9842;
      const initialZoom = 12;

      mapInstance = L.map(mapId, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

      // Choose tile layer: MapTiler Hybrid if key is set, ESRI Satellite otherwise
      const tileUrl = mapTilerKey
        ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${mapTilerKey}`
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

      const attribution = mapTilerKey
        ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        : 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

      L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 18,
      }).addTo(mapInstance);

      // Add preset hotspot circles to show target zones
      presetCoords.forEach((preset) => {
        L.circle([preset.lat, preset.lng], {
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.15,
          radius: 4000, // 4km target circle
        })
          .addTo(mapInstance)
          .bindPopup(`<b>${preset.name}</b><br>Detected Plastic Hotspot`);
      });

      // Selection Marker
      let marker: any;
      if (selectedCoords) {
        marker = L.marker([selectedCoords.lat, selectedCoords.lng])
          .addTo(mapInstance)
          .bindPopup('Active Target Center')
          .openPopup();
        markerRef.current = marker;
      }

      // Map Click Handler to set new target coordinate location
      mapInstance.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        onCenterSelect(lat, lng);

        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng);
        } else {
          marker = L.marker(e.latlng)
             .addTo(mapInstance)
             .bindPopup('Active Target Center')
             .openPopup();
          markerRef.current = marker;
        }
      });

      mapRef.current = mapInstance;
      initializedRef.current = true;
    });

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
      initializedRef.current = false;
    };
  }, [mapTilerKey, mapId]); // Re-initialize when MapTiler key or mapId changes

  // Update center position externally (when selectedCoords updates from parent, like presets click)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCoords || !initializedRef.current) return;

    const currentCenter = map.getCenter();
    const isDifferent =
      Math.abs(currentCenter.lat - selectedCoords.lat) > 0.0001 ||
      Math.abs(currentCenter.lng - selectedCoords.lng) > 0.0001;

    if (isDifferent) {
      map.setView([selectedCoords.lat, selectedCoords.lng], 13);
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([selectedCoords.lat, selectedCoords.lng]);
    } else {
      import('leaflet').then((L) => {
        if (!mapRef.current) return;
        const marker = L.marker([selectedCoords.lat, selectedCoords.lng])
          .addTo(mapRef.current)
          .bindPopup('Active Target Center')
          .openPopup();
        markerRef.current = marker;
      });
    }
  }, [selectedCoords]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-[300px]">
      <div
        id={mapId}
        className="w-full h-full min-h-[300px] flex-1 rounded-2xl border border-white/10 overflow-hidden"
      />
    </div>
  );
}
