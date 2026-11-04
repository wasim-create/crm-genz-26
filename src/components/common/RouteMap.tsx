import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Dealership, User } from '../../types/crm';

interface RouteMapProps {
  stops: Dealership[];
  currentUser: User;
  onSelectDealership?: (dealership: Dealership) => void;
  showRadius?: boolean;
  height?: string;
  zoom?: number;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  stops,
  currentUser,
  onSelectDealership,
  showRadius = true,
  height = '380px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix default Leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] = [
        currentUser.homeCoords.lat || 39.8283,
        currentUser.homeCoords.lng || -98.5795
      ];

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(initialCenter, 9);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing layers other than the base tile layer
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    const latLngs: [number, number][] = [];

    // 1. Home Base Marker & 60-mile territory circle
    const homeIcon = L.divIcon({
      className: 'custom-home-pin',
      html: `
        <div style="background-color: #2563eb; color: white; border-radius: 9999px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
          🏠
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([currentUser.homeCoords.lat, currentUser.homeCoords.lng], { icon: homeIcon })
      .addTo(map)
      .bindPopup(`<strong>Home Base (${currentUser.firstName} ${currentUser.lastName})</strong><br/>ZIP: ${currentUser.homeZipCode}`);

    latLngs.push([currentUser.homeCoords.lat, currentUser.homeCoords.lng]);

    if (showRadius) {
      // 60 miles in meters = 60 * 1609.34 = 96,560.4 meters
      L.circle([currentUser.homeCoords.lat, currentUser.homeCoords.lng], {
        radius: 60 * 1609.34,
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);
    }

    // 2. Stops markers
    stops.forEach((dealership, idx) => {
      const isHot = dealership.heatLevel === 'Hot';
      const bgColor = isHot ? '#dc2626' : '#4f46e5';

      const stopIcon = L.divIcon({
        className: `custom-stop-pin-${idx}`,
        html: `
          <div style="background-color: ${bgColor}; color: white; border-radius: 9999px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; border: 2px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
            ${idx + 1}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([dealership.coordinates.lat, dealership.coordinates.lng], { icon: stopIcon })
        .addTo(map);

      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${dealership.address}, ${dealership.city}, ${dealership.state} ${dealership.zipCode}`
      )}`;

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; min-width: 180px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">
            Stop ${idx + 1}: ${dealership.dealershipName}
          </div>
          <div style="color: #64748b; margin-bottom: 6px;">
            ${dealership.address}, ${dealership.city}
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
            <span>Inv: <strong>${dealership.usedCarsOnLot} cars</strong></span>
            <span>Stage: <strong>${dealership.stage}</strong></span>
          </div>
          <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: white; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px;">
            🚀 Navigate in Google Maps
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml);

      if (onSelectDealership) {
        marker.on('click', () => onSelectDealership(dealership));
      }

      latLngs.push([dealership.coordinates.lat, dealership.coordinates.lng]);
    });

    // 3. Connect route polyline
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#2563eb',
        weight: 3,
        opacity: 0.7,
        dashArray: '6, 6'
      }).addTo(map);

      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
    }
  }, [stops, currentUser, showRadius]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch {
          // ignore unmount race in Leaflet
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      <div className="absolute bottom-2 left-2 z-1000 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-slate-600 font-mono border border-slate-200">
        📍 Blue Circle = 60-mi Territory Limit
      </div>
    </div>
  );
};
