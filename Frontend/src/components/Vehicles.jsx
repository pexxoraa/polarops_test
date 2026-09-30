import { useState } from "react";
import ActionFormModal from "./ActionFormModal";
import Alert from "./Alert";
import DataTable from "./DataTable";
import Modal from "./Modal";
import ResourcePage from "./ResourcePage";
import api from "../utils/services/api";

const ISSUE_TYPES = [
  "Vehicle Breakdown",
  "Out of Fuel",
  "Technical Issue",
  "Mechanical Issue",
  "Natural Disaster",
  "Other",
];

const emptyForm = { issue_type: ISSUE_TYPES[0], severity: "Warning", detail: "" };

export default function Vehicles() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [pageError, setPageError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function loadHistory(row, refresh) {
    setHistory({ row, refresh });
    setAlerts([]);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const response = await api.get("/api/vehicles/" + row.id + "/alerts");
      setAlerts(response.items || []);
    } catch (error) {
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!report) return;
    setBusy(true);
    setPageError("");
    try {
      await api.post("/api/vehicles/" + report.row.id + "/alerts", form);
      await report.refresh();
      setReport(null);
      setForm(emptyForm);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveAlert(vehicle, alert, refresh) {
    try {
      await api.patch(
        "/api/vehicles/" + vehicle.id + "/alerts/" + alert.id + "/resolve",
        {},
      );
      await refresh();
      if (history?.row.id === vehicle.id) await loadHistory(vehicle, refresh);
    } catch (error) {
      setHistoryError(error.message);
      setPageError(error.message);
    }
  }

  async function resolveLatest(row, refresh) {
    setPageError("");
    try {
      const response = await api.get("/api/vehicles/" + row.id + "/alerts");
      const active = (response.items || []).find(
        (alert) => alert.status !== "Resolved",
      );
      if (active) await resolveAlert(row, active, refresh);
      else await refresh();
    } catch (error) {
      setPageError(error.message);
    }
  }

  return (
    <>
      {pageError ? <Alert tone="danger">{pageError}</Alert> : null}
      <ResourcePage
        title="Vehicles"
        createLabel="Add Vehicle"
        description="Operational state, fuel, range and current expedition location."
        endpoint="/api/vehicles"
        enableUpdate
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Vehicle" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status", badge: true },
          { key: "fuel_percent", label: "Fuel %" },
          { key: "location_name", label: "Location" },
          {
            key: "active_alert_cause",
            label: "Alerts",
            render: (row) =>
              row.active_alert_count
                ? row.active_alert_count + " active · " + row.active_alert_cause
                : "No active alerts",
          },
        ]}
        createFields={[
          { name: "code", label: "Code", required: true },
          { name: "name", label: "Name", required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: ["Ground", "Aircraft", "Marine"],
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: ["Operational", "Maintenance", "Unavailable"],
          },
          { name: "fuel_percent", label: "Fuel %", type: "number" },
          { name: "range_km", label: "Range km", type: "number" },
        ]}
        actions={(row, refresh) => (
          <>
            <button
              className="button small"
              onClick={() => {
                setReport({ row, refresh });
                setForm(emptyForm);
                setPageError("");
              }}
            >
              Report situation
            </button>
            {row.active_alert_count ? (
              <button
                className="button small danger"
                onClick={() => resolveLatest(row, refresh)}
              >
                Resolved
              </button>
            ) : null}
            <button
              className="button small ghost"
              onClick={() => loadHistory(row, refresh)}
            >
              History
            </button>
          </>
        )}
      />
      <ActionFormModal
        open={Boolean(report)}
        title="Report vehicle situation"
        subtitle={report ? report.row.code + " · " + report.row.name : ""}
        fields={[
          {
            name: "issue_type",
            label: "Situation",
            type: "select",
            options: ISSUE_TYPES,
            required: true,
            placeholder: false,
          },
          {
            name: "severity",
            label: "Severity",
            type: "select",
            options: ["Critical", "High", "Warning", "Advisory"],
            required: true,
            placeholder: false,
          },
          {
            name: "detail",
            label: "Cause or details",
            type: "textarea",
            wide: true,
          },
        ]}
        form={form}
        setForm={setForm}
        onClose={() => setReport(null)}
        onSubmit={submitReport}
        submitLabel="Add alert"
        busy={busy}
        error={pageError}
      />
      <Modal
        open={Boolean(history)}
        title="Vehicle alert history"
        subtitle={history ? history.row.code + " · " + history.row.name : ""}
        onClose={() => setHistory(null)}
        wide
      >
        {historyError ? <Alert tone="danger">{historyError}</Alert> : null}
        {historyLoading ? (
          <div className="empty">Loading vehicle alert history…</div>
        ) : (
          <DataTable
            rows={alerts}
            columns={[
              { key: "title", label: "Situation" },
              { key: "detail", label: "Cause or details" },
              { key: "severity", label: "Severity", badge: true },
              { key: "status", label: "Status", badge: true },
              { key: "created_at", label: "Reported" },
            ]}
            actions={(alert) =>
              alert.status !== "Resolved" ? (
                <button
                  className="button small danger"
                  onClick={() =>
                    resolveAlert(history.row, alert, history.refresh)
                  }
                >
                  Resolved
                </button>
              ) : null
            }
          />
        )}
      </Modal>
    </>
  );
}
