import { useEffect, useMemo, useState } from "react";
import api from "../utils/services/api";
import DataTable from "./DataTable";
import PolarMap from "./PolarMap";
import Loading from "./Loading";

export default function PolarNetwork() {
  const [mode, setMode] = useState("south");
  const [south, setSouth] = useState(null);
  const [north, setNorth] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/public/facilities"),
      api.get("/api/public/arctic-research-stations"),
    ])
      .then(([facilities, stations]) => {
        setSouth(facilities);
        setNorth(stations.items || []);
      })
      .catch(() => {});
  }, []);

  const rows = mode === "south" ? south : north;
  const markers = useMemo(
    () =>
      (rows || []).map((item) => ({
        ...item,
        kind:
          mode === "south" ? "Antarctic facility" : "Arctic research station",
        markerCategory: "research",
        markerDetail:
          mode === "south"
            ? [item.country, item.seasonality].filter(Boolean).join(" · ")
            : item.operating_country || item.location || "Arctic reference",
      })),
    [rows, mode],
  );

  if (!rows) return <Loading />;

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">POLAR RESEARCH NETWORK</span>
          <h1>Polar Network</h1>
          <p>
            Arctic and Antarctic datasets remain separate, sourced and
            explicitly non-live where applicable.
          </p>
        </div>
        <div className="segmented">
          <button
            className={mode === "south" ? "active" : ""}
            onClick={() => setMode("south")}
          >
            Antarctic / South
          </button>
          <button
            className={mode === "north" ? "active" : ""}
            onClick={() => setMode("north")}
          >
            Arctic / North
          </button>
        </div>
      </div>
      <div className="reference-banner">
        {mode === "south"
          ? "COMNAP bundled reference snapshot · November 2024 · reference data, not a live operations feed."
          : "Arctic research-station reference records retain verification/source metadata and are not presented as live operations."}
      </div>
      <PolarMap region={mode} markers={markers} viewKey={mode} />
      <div className="panel">
        <DataTable
          rows={rows}
          columns={
            mode === "south"
              ? [
                  { key: "name", label: "Facility" },
                  { key: "country", label: "Country / operator" },
                  { key: "facility_type", label: "Type" },
                  { key: "seasonality", label: "Seasonality" },
                  { key: "status", label: "Status", badge: true },
                  { key: "source", label: "Source" },
                ]
              : [
                  { key: "name", label: "Station" },
                  { key: "location", label: "Location" },
                  { key: "country", label: "Country" },
                  { key: "status", label: "Status", badge: true },
                  { key: "verification_status", label: "Verification" },
                  { key: "source", label: "Source" },
                ]
          }
        />
      </div>
    </section>
  );
}
