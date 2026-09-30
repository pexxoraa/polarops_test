import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/services/api";
import { useExpedition } from "../context/ExpeditionContext";
import { useRealtime } from "../context/RealtimeContext";
import Alert from "./Alert";
import DataTable from "./DataTable";
import Loading from "./Loading";
import Modal from "./Modal";

export default function ResourcePage({
  title,
  description,
  endpoint,
  columns,
  createFields = [],
  createLabel = "Add " + title,
  enableUpdate = false,
  actions,
  mapData,
  headerActions,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedId } = useExpedition();
  const { revision } = useRealtime();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [form, setForm] = useState({});
  const [focusedRecord, setFocusedRecord] = useState(null);
  const focusId = searchParams.get("focus");

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const data = await api.get(
        endpoint + separator + "expedition_id=" + selectedId,
      );
      setRows(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh, revision]);

  useEffect(() => {
    if (!focusId || !rows.length) return;
    const record = rows.find((row) => String(row.id) === focusId);
    if (record) setFocusedRecord(record);
  }, [focusId, rows]);

  function closeFocusedRecord() {
    setFocusedRecord(null);
    setSearchParams(
      (current) => {
        current.delete("focus");
        current.delete("kind");
        return current;
      },
      { replace: true },
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const body = { expedition_id: selectedId };
    createFields.forEach((field) => {
      const value = form[field.name];
      if (value === "" || value === undefined) return;
      body[field.name] = field.type === "number" ? Number(value) : value;
    });
    try {
      await api.post(endpoint, body);
      setOpen(false);
      setForm({});
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  function beginUpdate(row) {
    setEditing(row);
    setForm(
      Object.fromEntries(
        createFields.map((field) => [field.name, row[field.name] ?? ""]),
      ),
    );
    setEditError("");
    setError("");
  }

  async function submitUpdate(event) {
    event.preventDefault();
    if (!editing) return;

    setEditBusy(true);
    setEditError("");
    const body = Object.fromEntries(
      createFields.map((field) => {
        const value = form[field.name];
        return [
          field.name,
          value === ""
            ? field.type === "number"
              ? editing[field.name] ?? null
              : null
            : field.type === "number"
              ? Number(value)
              : value,
        ];
      }),
    );
    try {
      await api.patch(endpoint + "/" + editing.id, body);
      setEditing(null);
      setForm({});
      await refresh();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  function renderFields(fields) {
    return fields.map((field) => (
      <label key={field.name} className={field.wide ? "wide" : ""}>
        <span>{field.label}</span>
        {field.type === "select" ? (
          <select
            value={form[field.name] ?? ""}
            required={field.required}
            onChange={(event) =>
              setForm({ ...form, [field.name]: event.target.value })
            }
          >
            <option value="">Select…</option>
            {[...new Set([form[field.name], ...field.options].filter(Boolean))].map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ),
            )}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            value={form[field.name] ?? ""}
            required={field.required}
            onChange={(event) =>
              setForm({ ...form, [field.name]: event.target.value })
            }
          />
        ) : (
          <input
            type={field.type || "text"}
            step={field.step}
            value={form[field.name] ?? ""}
            required={field.required}
            onChange={(event) =>
              setForm({ ...form, [field.name]: event.target.value })
            }
          />
        )}
      </label>
    ));
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPEDITION MODULE</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="button-row">
          {headerActions}
          {createFields.length ? (
            <button
              className="button primary"
              onClick={() => {
                setForm({});
                setOpen(true);
              }}
            >
              + {createLabel}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {mapData ? mapData(rows) : null}
      <div className="panel">
        {loading ? (
          <Loading />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            actions={enableUpdate || actions ? (row) => (
              <div className="inline-actions">
                {enableUpdate ? (
                  <button
                    className="button small"
                    onClick={() => beginUpdate(row)}
                  >
                    Update
                  </button>
                ) : null}
                {actions ? actions(row, refresh) : null}
              </div>
            ) : null}
          />
        )}
      </div>
      <Modal open={open} title={"Add " + title} onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit}>
          {renderFields(createFields)}
          <div className="form-actions wide">
            <button
              type="button"
              className="button ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button className="button primary">Save</button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(editing)}
        title={"Update " + title}
        subtitle={editing?.name || editing?.title || editing?.code || ""}
        onClose={() => {
          setEditing(null);
          setForm({});
          setEditError("");
        }}
      >
        <form className="form-grid" onSubmit={submitUpdate}>
          {editError ? <Alert tone="danger">{editError}</Alert> : null}
          {renderFields(createFields)}
          <div className="form-actions wide">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setEditing(null);
                setForm({});
                setEditError("");
              }}
              disabled={editBusy}
            >
              Cancel
            </button>
            <button className="button primary" disabled={editBusy}>
              {editBusy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(focusedRecord)}
        title={title + " details"}
        subtitle={focusedRecord?.name || focusedRecord?.title || focusedRecord?.code || ""}
        onClose={closeFocusedRecord}
        wide
      >
        <dl className="record-details">
          {Object.entries(focusedRecord || {})
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
