import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("polarops-theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    try {
      window.localStorage.setItem("polarops-theme", darkMode ? "dark" : "light");
    } catch {
      // Theme still works for the current session when storage is unavailable.
    }
  }, [darkMode]);

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={darkMode}
      title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setDarkMode((current) => !current)}
    >
      <span aria-hidden="true">{darkMode ? "☼" : "☾"}</span>
    </button>
  );
}