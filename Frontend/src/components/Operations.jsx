import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/services/api";
import { useExpedition } from "../context/ExpeditionContext";
import { useRealtime } from "../context/RealtimeContext";
import ActionFormModal from "./ActionFormModal";
import DataTable from "./DataTable";
import Modal from "./Modal";

export default function Operations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedId } = useExpedition();
  const { revision } = useRealtime();
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusedTask, setFocusedTask] = useState(null);
  const focusId = searchParams.get("kind") === "task" ? searchParams.get("focus") : null;

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    const [taskData, alertData, handoverData] = await Promise.all([
      api.get("/api/ops/tasks?expedition_id=" + selectedId),
      api.get("/api/ops/alerts?expedition_id=" + selectedId),
      api.get("/api/ops/handovers?expedition_id=" + selectedId),
    ]);
    setTasks(taskData.items || []);
    setAlerts(alertData.items || []);
    setHandovers(handoverData.items || []);
  }, [selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh, revision]);

  useEffect(() => {
    if (!focusId || !tasks.length) return;
    const task = tasks.find((item) => String(item.id) === focusId);
    if (task) setFocusedTask(task);
  }, [focusId, tasks]);

  function closeFocusedTask() {
    setFocusedTask(null);
    setSearchParams(
      (current) => {
        current.delete("focus");
        current.delete("kind");
        return current;
      },
      { replace: true },
    );
  }

  function openAction(kind) {
    setAction(kind);
    setError("");

    if (kind === "task") {
      setForm({ title: "", priority: "Medium" });
    } else if (kind === "alert") {
      setForm({ title: "", severity: "Advisory" });
    } else {
      setForm({ shift_name: "", summary: "" });
    }
  }

  async function submitAction(event) {
    event.preventDefault();
    if (!action || !selectedId) return;

    setBusy(true);
    setError("");
    try {
      if (action === "task") {
        await api.post("/api/ops/tasks", {
          expedition_id: selectedId,
          title: form.title,
          priority: form.priority,
        });
      } else if (action === "alert") {
        await api.post("/api/ops/alerts", {
          expedition_id: selectedId,
          title: form.title,
          severity: form.severity,
          source: "Manual",
        });
      } else {
        await api.post("/api/ops/handovers", {
          expedition_id: selectedId,
          shift_name: form.shift_name,
          summary: form.summary,
        });
      }

      await refresh();
      setAction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const actionFields =
    action === "task"
      ? [
          {
            name: "title",
            label: "Mission task",
            required: true,
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            required: true,
            placeholder: false,
            options: ["Critical", "High", "Medium", "Low"],
          },
        ]
      : action === "alert"
        ? [
            {
              name: "title",
              label: "Manual alert",
              required: true,
            },
            {
              name: "severity",
              label: "Severity",
              type: "select",
              required: true,
              placeholder: false,
              options: ["Critical", "High", "Warning", "Advisory"],
            },
          ]
        : [
            {
              name: "shift_name",
              label: "Shift name",
              required: true,
            },
            {
              name: "summary",
              label: "Handover summary",
              type: "textarea",
              required: true,
              wide: true,
            },
          ];

  const actionTitle =
    action === "task"
      ? "Add mission task"
      : action === "alert"
        ? "Create manual alert"
        : "Create shift handover";

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DAILY OPERATIONS BOARD</span>
          <h1>Operations</h1>
          <p>Mission tasks, priorities, unified alerts and shift handovers.</p>
        </div>
        <div className="button-row">
          <button className="button" onClick={() => openAction("task")}>
            + Task
          </button>
          <button className="button" onClick={() => openAction("alert")}>
            + Alert
          </button>
          <button
            className="button primary"
            onClick={() => openAction("handover")}
          >
            Shift Handover
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Mission tasks</h2>
          <span>{tasks.length} tasks</span>
        </div>
        <DataTable
          rows={tasks}
          columns={[
            { key: "title", label: "Task" },
            { key: "priority", label: "Priority", badge: true },
            { key: "status", label: "Status", badge: true },
            { key: "assigned_to", label: "Assignment" },
            { key: "due_at", label: "Deadline" },
            { key: "location_name", label: "Location" },
          ]}
          actions={(row) => (
            <button
              className="button small"
              onClick={async () => {
                await api.patch("/api/ops/tasks/" + row.id, {
                  status: row.status === "Complete" ? "Open" : "Complete",
                });
                refresh();
              }}
            >
              {row.status === "Complete" ? "Reopen" : "Complete"}
            </button>
          )}
        />
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Unified Alert Center</h2>
          <span>
            {alerts.filter((item) => item.status !== "Resolved").length}{" "}
            unresolved
          </span>
        </div>
        <DataTable
          rows={alerts}
          columns={[
            { key: "severity", label: "Severity", badge: true },
            { key: "title", label: "Alert" },
            { key: "source", label: "Source" },
            { key: "status", label: "Status", badge: true },
            { key: "detail", label: "Detail" },
          ]}
          actions={(row) =>
            row.status !== "Resolved" ? (
              <button
                className="button small"
                onClick={async () => {
                  await api.patch("/api/ops/alerts/" + row.id, {
                    status: "Resolved",
                  });
                  refresh();
                }}
              >
                Resolve
              </button>
            ) : null
          }
        />
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Shift handovers</h2>
        </div>
        <DataTable
          rows={handovers}
          columns={[
            { key: "shift_name", label: "Shift" },
            { key: "author_name", label: "Author" },
            { key: "summary", label: "Summary" },
            { key: "created_at", label: "Created" },
          ]}
        />
      </div>

      <ActionFormModal
        open={Boolean(action)}
        title={actionTitle}
        fields={actionFields}
        form={form}
        setForm={setForm}
        onClose={() => setAction(null)}
        onSubmit={submitAction}
        submitLabel={action === "handover" ? "Save handover" : "Create"}
        busy={busy}
        error={error}
      />
      <Modal
        open={Boolean(focusedTask)}
        title="Mission task details"
        subtitle={focusedTask?.title || ""}
        onClose={closeFocusedTask}
        wide
      >
        <dl className="record-details">
          {Object.entries(focusedTask || {})
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
        </dl>
      </Modal>
    </section>
  );
}
