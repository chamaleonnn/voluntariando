"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";

import type { Opportunity } from "@/lib/types";

type OpportunityMapProps = {
  opportunities: Opportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function OpportunityMap({ opportunities, selectedId, onSelect }: OpportunityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        center: [-64.1888, -31.4167],
        zoom: 12.5,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      map.on("load", () => setMapReady(true));
      mapRef.current = map;

    }

    void createMap();
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    let disposed = false;

    async function updateMarkers() {
      const maplibregl = await import("maplibre-gl");
      if (disposed || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = opportunities.map((opportunity, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `real-map-marker ${selectedId === opportunity.id ? "is-selected" : ""}`;
        const label = document.createElement("span");
        label.textContent = String(index + 1);
        element.appendChild(label);
        element.setAttribute("aria-label", `${opportunity.title}, ${opportunity.neighborhood}`);
        element.addEventListener("click", () => onSelect(opportunity.id));
        return new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([opportunity.longitude, opportunity.latitude])
          .addTo(mapRef.current!);
      });
    }

    void updateMarkers();
    return () => {
      disposed = true;
    };
  }, [mapReady, onSelect, opportunities, selectedId]);

  useEffect(() => {
    const opportunity = opportunities.find((item) => item.id === selectedId);
    if (!opportunity || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [opportunity.longitude, opportunity.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      duration: 450,
    });
  }, [opportunities, selectedId]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationMessage("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setLocationMessage("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 14,
          duration: 900,
        });
        setLocationMessage("Mapa centrado en tu ubicación.");
      },
      () => setLocationMessage("No pudimos acceder a tu ubicación."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="map-pane">
      <div ref={containerRef} className="map-canvas" aria-label="Mapa interactivo de oportunidades en Córdoba" />
      {!mapReady && <div className="map-loading">Cargando mapa…</div>}
      <button className="locate-control" type="button" onClick={locateUser}>
        <LocateFixed size={20} />
        <span>Mi ubicación</span>
      </button>
      <div className="map-privacy"><span /> Las ubicaciones pueden ser aproximadas</div>
      <p className="sr-only" role="status">{locationMessage}</p>
    </div>
  );
}
