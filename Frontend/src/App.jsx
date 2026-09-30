import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ExpeditionProvider } from "./context/ExpeditionContext.jsx";
import { RealtimeProvider } from "./context/RealtimeContext.jsx";
import Layout from "./components/Layout.jsx";
import Loading from "./components/Loading.jsx";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Personnel from "./components/Personnel.jsx";
import Cargo from "./components/Cargo.jsx";
import Inventory from "./components/Inventory.jsx";
import Vehicles from "./components/Vehicles.jsx";
import Assets from "./components/Assets.jsx";
import RoutesPage from "./components/Routes.jsx";
import Incidents from "./components/Incidents.jsx";
import Operations from "./components/Operations.jsx";
import Science from "./components/Science.jsx";
import Communications from "./components/Communications.jsx";
import Readiness from "./components/Readiness.jsx";
import Environment from "./components/Environment.jsx";
import PolarNetwork from "./components/PolarNetwork.jsx";
import Activity from "./components/Activity.jsx";
import Settings from "./components/Settings.jsx";
import AboutUs from "./components/AboutUs.jsx";

function Protected() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Loading local PolarOps session…" />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ExpeditionProvider>
      <RealtimeProvider>
        <Outlet />
      </RealtimeProvider>
    </ExpeditionProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/personnel" element={<Personnel />} />
              <Route path="/cargo" element={<Cargo />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/science" element={<Science />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/readiness" element={<Readiness />} />
              <Route path="/environment" element={<Environment />} />
              <Route path="/network" element={<PolarNetwork />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about-us" element={<AboutUs />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}