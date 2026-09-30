import { Link, NavLink } from "react-router-dom";

const items = [
  ["Dashboard", "/dashboard"],
  ["Personnel", "/personnel"],
  ["Cargo", "/cargo"],
  ["Inventory", "/inventory"],
  ["Assets", "/assets"],
  ["Vehicles", "/vehicles"],
  ["Routes & Zones", "/routes"],
  ["Incidents", "/incidents"],
  ["Operations", "/operations"],
  ["Projects", "/science"],
  ["Communications", "/communications"],
  ["Readiness", "/readiness"],
  ["Environment", "/environment"],
  ["Polar Network", "/network"],
  ["Activity", "/activity"],
  ["Settings", "/settings"],
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <Link
        className="brand platform-brand"
        to="/dashboard"
        aria-label="Go to dashboard"
      >
        <span className="platform-logo-plate">
          <img
            className="platform-logo"
            src="/media/polarops-logo.webp"
            alt="PolarOps"
          />
        </span>
        <small>EXPEDITION COMMAND</small>
      </Link>
      <nav>
        {items.map(([label, path]) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <NavLink
          to="/about-us"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          About Us
        </NavLink>
      </div>
    </aside>
  );
}
