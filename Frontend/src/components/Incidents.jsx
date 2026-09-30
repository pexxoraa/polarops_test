import { useState } from "react";
import api from "../utils/services/api";
import ActionFormModal from "./ActionFormModal";
import ResourcePage from "./ResourcePage";

const INCIDENT_TYPES = [
  "Field Emergency",
  "Medical",
  "Vehicle",
  "Weather",
  "Communications",
  "Safety",
  "Environmental",
];
const INCIDENT_SEVERITIES = ["Critical", "High", "Medium", "Low"];

export default function Incidents() {
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAction(event) {
    event.preventDefault();
    if (!action) return;

    setBusy(true);
    setError("");
    try {
      if (action.kind === "update") {
        await api.patch("/api/incidents/" + action.row.id, {
          type: form.type,
          severity: form.severity,
          note: form.note,
        });
      } else {
        await api.post("/api/incidents/" + action.row.id + "/resolve", {
          note: form.note || "Incident resolved",
        });
      }

      await action.refresh();
      setAction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const actionFields =
    action?.kind === "update"
      ? [
          {
            name: "type",
            label: "Incident type",
            type: "select",
            options: INCIDENT_TYPES,
            placeholder: false,
            required: true,
          },
          {
            name: "severity",
            label: "Severity",
            type: "select",
            options: INCIDENT_SEVERITIES,
            placeholder: false,
            required: true,
          },
          {
            name: "note",
            label: "Update note",
            type: "textarea",
            wide: true,
          },
        ]
      : [
          {
            name: "note",
            label: "Resolution note",
            type: "textarea",
            required: true,
            wide: true,
          },
        ];

  return (
    <>
      <ResourcePage
        title="Incidents"
        createLabel="Report Incident"
        description="SOS, incident command, timeline events, response actions, assignment and completion."
        endpoint="/api/incidents"
        columns={[
          { key: "code", label: "Code" },
          { key: "title", label: "Incident" },
          { key: "type", label: "Type" },
          { key: "severity", label: "Severity", badge: true },
          { key: "status", label: "Status", badge: true },
          { key: "location_name", label: "Location" },
          { key: "vehicle_code", label: "Vehicle" },
        ]}
        createFields={[
          { name: "title", label: "Title", required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: INCIDENT_TYPES,
          },
          {
            name: "severity",
            label: "Severity",
            type: "select",
            options: ["Critical", "High", "Medium", "Low"],
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            wide: true,
          },
        ]}
        actions={(row, refresh) => (
          <div className="button-row">
            <button
              className="button small"
              onClick={() => {
                setAction({ kind: "update", row, refresh });
                setForm({ type: row.type, severity: row.severity, note: "" });
                setError("");
              }}
            >
              Update
            </button>
            {row.status !== "Resolved" ? (
              <button
                className="button small danger"
                onClick={() => {
                  setAction({ kind: "resolve", row, refresh });
                  setForm({ note: "Incident resolved" });
                  setError("");
                }}
              >
                Resolve
              </button>
            ) : null}
          </div>
        )}
      />
      <ActionFormModal
        open={Boolean(action)}
        title={
          action?.kind === "resolve"
            ? "Resolve incident"
            : "Update incident"
        }
        subtitle={action?.row ? action.row.code + " · " + action.row.title : ""}
        fields={actionFields}
        form={form}
        setForm={setForm}
        onClose={() => setAction(null)}
        onSubmit={submitAction}
        submitLabel={
          action?.kind === "resolve" ? "Resolve incident" : "Save update"
        }
        busy={busy}
        error={error}
      />
    </>
  );
}
