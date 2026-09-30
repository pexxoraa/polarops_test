import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useExpedition } from "../context/ExpeditionContext";
import { useRealtime } from "../context/RealtimeContext";
import api from "../utils/services/api";
import { getPolarRegionLabel } from "../utils/polarRegion";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { expeditions, selectedId, selectedExpedition, selectExpedition } =
    useExpedition();
  const { connected } = useRealtime();
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [activeResult, setActiveResult] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const markOnline = () => setNetworkOnline(true);
    const markOffline = () => setNetworkOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    if (!selectedId || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get(
          "/api/ops/search?expedition_id=" +
            selectedId +
            "&q=" +
            encodeURIComponent(query.trim()),
        );
        if (!cancelled) setResults(data.items || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, selectedId]);

  function openResult(item) {
    const destinations = {
      personnel: "/personnel",
      cargo: "/cargo",
      inventory: "/inventory",
      vehicle: "/vehicles",
      asset: "/assets",
      incident: "/incidents",
      task: "/operations",
      route: "/routes",
      science: "/science",
      facility: "/routes",
      arctic_station: "/routes",
    };
    const destination = destinations[item.kind];
    if (!destination) return;

    navigate(
      destination +
        "?focus=" +
        encodeURIComponent(item.id) +
        "&kind=" +
        encodeURIComponent(item.kind),
    );
    setQuery("");
    setResults([]);
    setSearchOpen(false);
    setActiveResult(0);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openResult(results[activeResult] || results[0]);
    }
  }

  const pole = getPolarRegionLabel(selectedExpedition?.region);
  const connectionStatus = !networkOnline
    ? "OFFLINE"
    : connected
      ? "LIVE"
      : "DEAD";
  const connectionMessage = !networkOnline
    ? "The system is offline right now. New data will be restored when it is online."
    : connected
      ? "The system is online and live updates are connected."
      : "The system is online, but live updates are reconnecting.";

  return (
    <header className="navbar">
      <div className="expedition-picker">
        <label>Expedition</label>
        <select
          value={selectedId || ""}
          onChange={(e) => selectExpedition(e.target.value)}
        >
          {expeditions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="region-pill">{pole}</span>
      </div>
      <div className="global-search">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults([]);
            setActiveResult(0);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          onKeyDown={handleSearchKeyDown}
          role="combobox"
          aria-label="Search expedition records"
          aria-expanded={searchOpen && query.trim().length >= 2}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          placeholder="Search personnel, cargo, incidents…"
        />
        {searchOpen && query.trim().length >= 2 ? (
          <div className="search-results" id="global-search-results" role="listbox">
            {results.slice(0, 8).map((item, index) => (
              <button
                key={item.kind + "-" + (item.id ?? index)}
                type="button"
                role="option"
                aria-selected={activeResult === index}
                className={activeResult === index ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveResult(index)}
                onClick={() => openResult(item)}
              >
                <strong>{item.title}</strong>
                <span>
                  {item.kind} · {item.detail || ""}
                </span>
              </button>
            ))}
            {!results.length ? (
              <div className="search-empty">
                {searching ? "Searching…" : "No matching records"}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="user-tools">
        <ThemeToggle />
        <span className="live-status-wrap">
          <button
            type="button"
            className={
              "live-dot " +
              (connectionStatus === "LIVE"
                ? "connected"
                : connectionStatus === "OFFLINE"
                  ? "offline"
                  : "dead")
            }
            aria-label={"Connection status: " + connectionStatus}
            aria-describedby="connection-status-tooltip"
          >
            {connectionStatus}
          </button>
          <span
            id="connection-status-tooltip"
            className="live-tooltip"
            role="tooltip"
          >
            {connectionMessage}
          </span>
        </span>
        <div className="user-copy">
          <strong>{user?.name}</strong>
          <span>{user?.role}</span>
        </div>
        <button className="button ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
