import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BASEMAPS = {
  map: {
    label: "Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community",
    attributionUrl:
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  },
};

const MARKER_META = {
  base: { label: "Expedition base / station", short: "B" },
  camp: { label: "Field camp", short: "C" },
  support: { label: "Support / transport", short: "S" },
  gps: { label: "Authorized GPS", short: "G" },
  research: { label: "Reference research station", short: "R" },
  mission: { label: "Other mission point", short: "M" },
};

function markerIcon(category = "mission") {
  const safeCategory = MARKER_META[category] ? category : "mission";
  const meta = MARKER_META[safeCategory];

  return L.divIcon({
    className: "polar-marker-shell",
    html: `<span class="polar-marker polar-marker--${safeCategory}">${meta.short}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function MapViewSync({ center, zoom, viewKey, fullscreen, routeBounds }) {
  const map = useMap();
  const latitude = Number(center[0]);
  const longitude = Number(center[1]);

  useEffect(() => {
    if (routeBounds.length) {
      const bounds = L.latLngBounds(routeBounds);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [48, 48],
          maxZoom: 6,
          animate: false,
        });
        return;
      }
    }
    map.setView([latitude, longitude], zoom, { animate: false });
  }, [map, viewKey, latitude, longitude, zoom, routeBounds]);

  useEffect(() => {
    const container = map.getContainer();
    const refreshSize = () =>
      map.invalidateSize({ animate: false, pan: false });

    refreshSize();
    const firstTimer = window.setTimeout(refreshSize, 80);
    const secondTimer = window.setTimeout(refreshSize, 260);
    const observer = new ResizeObserver(refreshSize);
    observer.observe(container);
    window.addEventListener("resize", refreshSize);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      observer.disconnect();
      window.removeEventListener("resize", refreshSize);
    };
  }, [map, fullscreen]);

  return null;
}

export default function PolarMap({
  region = "south",
  markers = [],
  routes = [],
  geofences = [],
  height = 430,
  viewKey = region,
  square = false,
  legendPlacement = "overlay",
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [basemap, setBasemap] = useState("map");
  const basemapConfig = BASEMAPS[basemap];
  const validMarkers = useMemo(
    () =>
      markers.filter(
        (item) =>
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      ),
    [markers],
  );
  const routeBounds = useMemo(
    () =>
      routes.flatMap((route) => {
        const start = [Number(route.start_lat), Number(route.start_lon)];
        const end = [Number(route.end_lat), Number(route.end_lon)];
        return [...start, ...end].every(Number.isFinite) ? [start, end] : [];
      }),
    [routes],
  );

  const center = useMemo(() => {
    const firstMission =
      validMarkers.find((item) => item.markerCategory !== "research") ||
      validMarkers[0];

    if (firstMission) {
      return [Number(firstMission.latitude), Number(firstMission.longitude)];
    }

    return region === "north" ? [72, 0] : [-75, 0];
  }, [validMarkers, region]);

  const legendCategories = useMemo(
    () =>
      [
        ...new Set(
          validMarkers.map((item) => item.markerCategory || "mission"),
        ),
      ].filter((category) => MARKER_META[category]),
    [validMarkers],
  );

  return (
    <div
      className={
        "polar-map-block" +
        (square ? " polar-map-block--square" : "") +
        (legendPlacement === "footer" ? " polar-map-block--footer-legend" : "")
      }
    >
      <div
        className={fullscreen ? "polar-map fullscreen" : "polar-map"}
        style={{ "--polar-map-height": height + "px" }}
      >
        <div className="map-action-bar">
          <div className="map-basemap-switch" aria-label="Map view">
            {Object.entries(BASEMAPS).map(([key, config]) => (
              <button
                key={key}
                type="button"
                className={basemap === key ? "active" : ""}
                aria-pressed={basemap === key}
                onClick={() => setBasemap(key)}
              >
                {config.label}
              </button>
            ))}
          </div>
          <button
            className="map-fullscreen-button"
            type="button"
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        {legendPlacement === "overlay" && legendCategories.length ? (
          <div className="polar-map-legend" aria-label="Map marker legend">
            {legendCategories.map((category) => (
              <span key={category}>
                <i
                  className={"polar-legend-dot polar-legend-dot--" + category}
                />
                {MARKER_META[category].label}
              </span>
            ))}
          </div>
        ) : null}
        <MapContainer
          center={center}
          zoom={4}
          minZoom={2}
          maxZoom={8}
          maxBounds={[
            [-85, -180],
            [85, 180],
          ]}
          maxBoundsViscosity={1}
          scrollWheelZoom
          worldCopyJump={false}
          attributionControl={false}
          className="leaflet-host"
        >
          <MapViewSync
            center={center}
            zoom={4}
            viewKey={viewKey}
            fullscreen={fullscreen}
            routeBounds={routeBounds}
          />
          <TileLayer
            key={basemap}
            url={basemapConfig.url}
            minZoom={2}
            maxZoom={8}
            noWrap
            keepBuffer={4}
            updateWhenZooming={false}
          />
          {validMarkers.map((item, index) => {
            const category = item.markerCategory || "mission";

            return (
              <Marker
                key={
                  category +
                  "-" +
                  (item.source_key ||
                    item.id ||
                    item.code ||
                    item.name ||
                    index)
                }
                position={[Number(item.latitude), Number(item.longitude)]}
                icon={markerIcon(category)}
                title={item.name || item.title || item.code || "Location"}
              >
                <Popup>
                  <strong>
                    {item.name || item.title || item.code || "Location"}
                  </strong>
                  <br />
                  {item.kind || item.type || item.status || ""}
                  {item.markerDetail ? (
                    <>
                      <br />
                      <small>{item.markerDetail}</small>
                    </>
                  ) : null}
                </Popup>
              </Marker>
            );
          })}
          {routes.map((route, index) => (
            <Polyline
              key={route.id ?? index}
              positions={[
                [Number(route.start_lat), Number(route.start_lon)],
                [Number(route.end_lat), Number(route.end_lon)],
              ]}
            />
          ))}
          {geofences.map((zone, index) => (
            <Circle
              key={zone.id ?? index}
              center={[Number(zone.center_lat), Number(zone.center_lon)]}
              radius={Number(zone.radius_m || 1000)}
            >
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.kind || zone.zone_type}
              </Popup>
            </Circle>
          ))}
          <a
            className="polar-map-attribution"
            href={basemapConfig.attributionUrl}
            target="_blank"
            rel="noreferrer"
          >
            {basemapConfig.attribution}
          </a>
        </MapContainer>
      </div>
      {legendPlacement === "footer" && legendCategories.length ? (
        <div
          className="polar-map-legend polar-map-legend--footer"
          aria-label="Map marker legend"
        >
          {legendCategories.map((category) => (
            <span key={category}>
              <i className={"polar-legend-dot polar-legend-dot--" + category} />
              {MARKER_META[category].label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
