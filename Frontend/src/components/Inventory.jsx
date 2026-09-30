import { useState } from "react";
import api from "../utils/services/api";
import ActionFormModal from "./ActionFormModal";
import ResourcePage from "./ResourcePage";

export default function Inventory() {
  const [adjustment, setAdjustment] = useState(null);
  const [form, setForm] = useState({
    delta: "1",
    reason: "Operational adjustment",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAdjustment(event) {
    event.preventDefault();
    if (!adjustment) return;

    setBusy(true);
    setError("");
    try {
      await api.post("/api/inventory/" + adjustment.row.id + "/adjust", {
        delta: Number(form.delta),
        reason: form.reason,
      });
      await adjustment.refresh();
      setAdjustment(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ResourcePage
        title="Inventory"
        createLabel="Add Stock item"
        description="Stock levels, minimum safety thresholds, low-stock warnings and adjustments."
        endpoint="/api/inventory"
        enableUpdate
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Item" },
          { key: "quantity", label: "Stock" },
          { key: "min_quantity", label: "Minimum" },
          { key: "unit", label: "Unit" },
          { key: "location_name", label: "Location" },
        ]}
        createFields={[
          { name: "sku", label: "SKU", required: true },
          { name: "name", label: "Name", required: true },
          { name: "quantity", label: "Quantity", type: "number" },
          {
            name: "min_quantity",
            label: "Minimum safety level",
            type: "number",
          },
          { name: "unit", label: "Unit" },
        ]}
        actions={(row, refresh) => (
          <button
            className="button small"
            onClick={() => {
              setAdjustment({ row, refresh });
              setForm({
                delta: "1",
                reason: "Operational adjustment",
              });
              setError("");
            }}
          >
            Adjust
          </button>
        )}
      />
      <ActionFormModal
        open={Boolean(adjustment)}
        title="Adjust inventory"
        subtitle={adjustment?.row?.name || ""}
        fields={[
          {
            name: "delta",
            label: "Adjustment (+ / -)",
            type: "number",
            required: true,
            step: "1",
          },
          {
            name: "reason",
            label: "Reason",
            required: true,
            placeholder: "Why is the stock changing?",
          },
        ]}
        form={form}
        setForm={setForm}
        onClose={() => setAdjustment(null)}
        onSubmit={submitAdjustment}
        submitLabel="Apply adjustment"
        busy={busy}
        error={error}
      />
    </>
  );
}
