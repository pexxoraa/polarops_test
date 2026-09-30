import Alert from "./Alert";
import Modal from "./Modal";

function optionValue(option) {
  return typeof option === "object" ? option.value : option;
}

function optionLabel(option) {
  return typeof option === "object" ? option.label : option;
}

export default function ActionFormModal({
  open,
  title,
  subtitle,
  fields,
  form,
  setForm,
  onClose,
  onSubmit,
  submitLabel = "Save",
  busy = false,
  error = "",
}) {
  return (
    <Modal open={open} title={title} subtitle={subtitle} onClose={onClose}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form className="form-grid" onSubmit={onSubmit}>
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? "wide" : ""}>
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select
                value={form[field.name] ?? ""}
                required={field.required}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field.name]: event.target.value,
                  })
                }
              >
                {field.placeholder !== false ? (
                  <option value="">{field.placeholder || "Select…"}</option>
                ) : null}
                {(field.options || []).map((option) => {
                  const value = optionValue(option);
                  return (
                    <option key={value} value={value}>
                      {optionLabel(option)}
                    </option>
                  );
                })}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={form[field.name] ?? ""}
                required={field.required}
                placeholder={field.placeholder || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field.name]: event.target.value,
                  })
                }
              />
            ) : (
              <input
                type={field.type || "text"}
                value={form[field.name] ?? ""}
                required={field.required}
                min={field.min}
                max={field.max}
                minLength={field.minLength}
                step={field.step}
                placeholder={field.placeholder || ""}
                autoComplete={field.autoComplete}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field.name]: event.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
        <div className="form-actions wide">
          <button
            type="button"
            className="button ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
