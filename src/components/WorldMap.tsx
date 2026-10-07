"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { coarsenCoordinates } from "@/lib/location";
import { PublicRunner } from "@/lib/map-types";
import { Vendor } from "@/lib/catalog";
import { brand } from "@/lib/brand";
export default function WorldMap({
  runners,
  vendors,
  highlight,
  onSelect,
}: {
  runners: PublicRunner[];
  vendors: Vendor[];
  highlight: string[];
  onSelect: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marks = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [error, setError] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const customerMarker = useRef<maplibregl.Marker | null>(null);
  function locate() {
    if (!navigator.geolocation) {
      setLocationStatus("Location is unavailable on this device.");
      return;
    }
    setLocationStatus("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const area = coarsenCoordinates(
          pos.coords.longitude,
          pos.coords.latitude,
        );
        customerMarker.current?.remove();
        const el = document.createElement("div");
        el.className = "map-pin customer-pin";
        el.textContent = "●";
        el.setAttribute("aria-label", "Your approximate area");
        if (map.current) {
          customerMarker.current = new maplibregl.Marker({ element: el })
            .setLngLat(area)
            .addTo(map.current);
          map.current.flyTo({ center: area, zoom: 13 });
        }
        setLocationStatus(
          "Your approximate area is shown only in this browser. Exact GPS is never sent to our server.",
        );
      },
      () =>
        setLocationStatus("Location permission was declined or unavailable."),
      { maximumAge: 60000, timeout: 10000, enableHighAccuracy: false },
    );
  }
  useEffect(() => {
    if (!root.current) return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    const markerElements = marks.current;
    const m = new maplibregl.Map({
      container: root.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["/tiles/{z}/{x}/{y}"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "base",
            type: "raster",
            source: "osm",
            paint: { "raster-saturation": -0.85, "raster-opacity": 0.75 },
          },
        ],
      },
      center: brand.center,
      zoom: 13.4,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "bottom-right");
    m.on("error", () => setError(true));
    vendors.forEach((v) => {
      const el = document.createElement("button");
      el.className = "map-pin";
      el.textContent =
        v.category === "Food"
          ? "🍴"
          : v.category === "Gifts"
            ? "✿"
            : v.category === "Services"
              ? "⚒"
              : "⌂";
      el.setAttribute("aria-label", v.name + (v.demo ? " (demo)" : ""));
      el.onclick = () => onSelect(v.id);
      marks.current.set(v.id, el);
      new maplibregl.Marker({ element: el }).setLngLat(v.coordinates).addTo(m);
    });
    runners.forEach((r) => {
      const el = document.createElement("button");
      el.className = "map-pin runner-pin";
      el.textContent = "↗";
      el.setAttribute("aria-label", `${r.name} · approximate location`);
      el.onclick = () => {
        if (r.destinationVendorId) onSelect(r.destinationVendorId);
      };
      new maplibregl.Marker({ element: el }).setLngLat(r.area).addTo(m);
    });
    m.on("load", () => {
      const features = runners.flatMap((r) => {
        const vendor = vendors.find((v) => v.id === r.destinationVendorId);
        return vendor
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: [r.area, vendor.coordinates],
                },
              },
            ]
          : [];
      });
      m.addSource("intentions", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      m.addLayer({
        id: "trip-intentions",
        type: "line",
        source: "intentions",
        paint: {
          "line-color": "#b88a52",
          "line-width": 2,
          "line-dasharray": [2, 3],
        },
      });
    });
    return () => {
      m.remove();
      map.current = null;
      customerMarker.current = null;
      markerElements.clear();
    };
  }, [onSelect, vendors, runners]);
  useEffect(() => {
    marks.current.forEach((el, id) =>
      el.classList.toggle("highlight", highlight.includes(id)),
    );
  }, [highlight]);
  return (
    <div className="map-shell">
      <div ref={root} className="world-map" />
      <button className="locate-button" onClick={locate}>
        Show my approximate area
      </button>
      {locationStatus && (
        <p role="status" className="location-status">
          {locationStatus}
        </p>
      )}
      {error && (
        <div className="map-error">
          Map tiles unavailable. Browse all vendors in the list below.
        </div>
      )}
      <div className="map-label">
        <span className="pulse" /> LOUISIANA, MO{" "}
        <small>Approximate locations · dashed lines show trip intentions</small>
      </div>
    </div>
  );
}
