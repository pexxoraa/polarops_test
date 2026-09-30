import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "./Alert";

const ANTARCTIC_SCENES = [
  {
    name: "Brash Ice Zodiac",
    detail: "Antarctic Peninsula · expedition boat through broken sea ice",
    credit: "Srishti Sethi · Wikimedia Commons",
    source:
      "https://commons.wikimedia.org/wiki/File:Zodiac_navigating_through_brash_ice_in_Antarctic_Peninsula.png",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Zodiac_navigating_through_brash_ice_in_Antarctic_Peninsula.png?width=1600",
  },
  {
    name: "Elephant Island Landing",
    detail: "Point Wild · expedition cruisers approaching the Antarctic shore",
    credit: "David Stanley · Wikimedia Commons",
    source:
      "https://commons.wikimedia.org/wiki/File:Expedition_Cruisers_at_Elephant_Island.jpg",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Expedition_Cruisers_at_Elephant_Island.jpg?width=1600",
  },
  {
    name: "Errera Channel",
    detail: "Antarctic Peninsula · expedition vessel among glaciers",
    credit: "Gordon Leggett · Wikimedia Commons",
    source:
      "https://commons.wikimedia.org/wiki/File:2019-03-05_RCGS_RESOLUTE_-_IMO_9000168.jpg",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/2019-03-05_RCGS_RESOLUTE_-_IMO_9000168.jpg?width=1600",
  },
  {
    name: "Penguins on Ice",
    detail: "Antarctica · penguins perched above the polar seascape",
    credit: "Parikshit Sharma Photography · Wikimedia Commons",
    source:
      "https://commons.wikimedia.org/wiki/File:Penguins_on_iceberg_Antarctica.png",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Penguins_on_iceberg_Antarctica.png?width=1600",
  },
  {
    name: "Antarctic Sunset",
    detail: "Southern Ocean · iceberg under late polar light",
    credit: "amanderson2 · Wikimedia Commons",
    source:
      "https://commons.wikimedia.org/wiki/File:Iceberg_near_sunset_Coral_Princess_Antarctica.jpg",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Iceberg_near_sunset_Coral_Princess_Antarctica.jpg?width=1600",
  },
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("commander@polarops.local");
  const [password, setPassword] = useState("PolarOps123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScene((current) => (current + 1) % ANTARCTIC_SCENES.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-live-bg" aria-hidden="true">
        {ANTARCTIC_SCENES.map((item, index) => (
          <img
            key={item.name}
            className={index === scene ? "active" : ""}
            src={item.image}
            alt=""
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      <section className="login-visual" aria-label="PolarOps platform overview">
        <div className="login-brand">
          <div className="login-logo-plate">
            <img
              className="login-platform-logo"
              src="/media/polarops-logo.webp"
              alt="PolarOps"
            />
            <span>Expedition command platform</span>
          </div>
        </div>
        <div className="login-scene-chip">
          <div>
            <span>{ANTARCTIC_SCENES[scene].name}</span>
            <small>{ANTARCTIC_SCENES[scene].detail}</small>
            <a
              href={ANTARCTIC_SCENES[scene].source}
              target="_blank"
              rel="noreferrer"
            >
              {ANTARCTIC_SCENES[scene].credit}
            </a>
          </div>
          <div
            className="login-scene-dots"
            aria-label="Antarctic background scenes"
          >
            {ANTARCTIC_SCENES.map((item, index) => (
              <button
                key={item.name}
                type="button"
                className={index === scene ? "active" : ""}
                onClick={() => setScene(index)}
                aria-label={"Show " + item.name}
              />
            ))}
          </div>
        </div>
        <div className="login-copy">
          <div className="eyebrow">
            ANTARCTICA AND ARCTIC . OPERATIONS COMMAND
          </div>
          <h1>
            Polar logistics, readiness, and field operations in one console.
          </h1>
          <p>
            Coordinate expedition personnel, cargo, vehicles, routes, incidents,
            science activity, and operational readiness from a single local
            command workspace.
          </p>
          <div className="capability-strip" aria-label="Platform capabilities">
            <span>Logistics</span>
            <span>Field operations</span>
            <span>Incident response</span>
            <span>Offline ready</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="eyebrow">Secure local access</div>
          <h2>Command console</h2>
          <p>Sign in with a seeded local demo account to continue.</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="button primary block" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to command console"}
            </button>
          </form>
          <div className="login-help">
            <strong>Local demo access</strong>
            <p className="security-note">
              Commander, logistics, and field accounts are seeded locally. Data
              marked demo remains synthetic.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
