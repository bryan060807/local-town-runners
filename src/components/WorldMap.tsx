"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { ArrowUpRight } from "lucide-react";
import { coarsenCoordinates } from "@/lib/location";
import { PublicRunner } from "@/lib/map-types";
import { Vendor } from "@/lib/catalog";
import { brand } from "@/lib/brand";
import styles from "./WorldMap.module.css";
export default function WorldMap({
  runners,
  vendors,
  highlight,
  onSelect,
  matchedRunnerId,
}: {
  runners: PublicRunner[];
  vendors: Vendor[];
  highlight: string[];
  onSelect: (id: string) => void;
  matchedRunnerId?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marks = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const runnerMarks = useRef<Map<string, HTMLButtonElement>>(new Map());
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
    const markerElements = marks.current;
    const runnerElements = runnerMarks.current;
    let disposed = false;
    let instance: maplibregl.Map | undefined;
    function clearMap() {
      const previous = instance;
      instance = undefined;
      map.current = null;
      customerMarker.current = null;
      markerElements.clear();
      runnerElements.clear();
      try {
        previous?.remove();
      } catch {
        // A failed graphics context must not prevent the rest of Explore
        // from rendering, including while partial setup is being removed.
      }
    }
    function reportUnavailable() {
      if (disposed) return;
      clearMap();
      // Initialization can fail synchronously. Publish its external status
      // after setup, and ignore a superseded Strict Mode effect.
      queueMicrotask(() => {
        if (!disposed) setUnavailable(true);
      });
    }
    try {
      maplibregl.setWorkerUrl("/maplibre-worker.mjs");
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
      instance = m;
      map.current = m;
      m.addControl(new maplibregl.NavigationControl(), "bottom-right");
      m.on("error", () => {
        if (!disposed) setError(true);
      });
      m.on("webglcontextlost", reportUnavailable);
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
        new maplibregl.Marker({ element: el })
          .setLngLat(v.coordinates)
          .addTo(m);
      });
      runners.forEach((r) => {
        const el = document.createElement("button");
        el.className = "map-pin runner-pin";
        el.textContent = "↗";
        el.setAttribute("aria-label", `${r.name} · approximate location`);
        el.onclick = () => {
          if (r.destinationVendorId) onSelect(r.destinationVendorId);
        };
        runnerMarks.current.set(r.id, el);
        new maplibregl.Marker({ element: el }).setLngLat(r.area).addTo(m);
      });
      m.on("load", () => {
        if (disposed || map.current !== m) return;
        try {
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
        } catch {
          reportUnavailable();
        }
      });
    } catch {
      reportUnavailable();
    }
    return () => {
      disposed = true;
      clearMap();
    };
  }, [onSelect, vendors, runners]);
  useEffect(() => {
    marks.current.forEach((el, id) =>
      el.classList.toggle("highlight", highlight.includes(id)),
    );
    runnerMarks.current.forEach((el, id) =>
      el.classList.toggle("highlight", id === matchedRunnerId),
    );
    const v =
      highlight.length === 1
        ? vendors.find((v) => v.id === highlight[0])
        : undefined;
    if (v) map.current?.easeTo({ center: v.coordinates, duration: 500 });
  }, [highlight, matchedRunnerId, vendors]);
  if (unavailable)
    return (
      <div className={`map-shell ${styles.fallback}`} role="status">
        <div className={styles.neighborhood} aria-hidden="true">
          <span>⌂</span>
          <span className={styles.path} />
          <span>✿</span>
          <span className={styles.path} />
          <span>⌂</span>
        </div>
        <span className={styles.eyebrow}>A NEIGHBORHOOD OF POSSIBILITIES</span>
        <h3>Good finds are still close by.</h3>
        <p>
          The map isn’t available in this browser. Meet local vendors and
          explore their finds below.
        </p>
        <a
          href="#vendor-directory-heading"
          onClick={() => {
            const heading = document.getElementById("vendor-directory-heading");
            heading?.setAttribute("tabindex", "-1");
            heading?.focus();
          }}
        >
          Browse local vendors <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    );
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
