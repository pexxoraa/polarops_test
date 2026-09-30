import { useEffect, useState } from "react";
import api from "../utils/services/api";
import { useAuth } from "../context/AuthContext";
import ActionFormModal from "./ActionFormModal";
import Alert from "./Alert";
import DataTable from "./DataTable";

export default function Settings() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState([]);
  const [users, setUsers] = useState([]);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setOrganization(await api.get("/api/organizations"));
    if (user?.role === "commander") {
      setUsers(await api.get("/api/users"));
    }
  };

  useEffect(() => {
    refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  function openAddUser() {
    setAction("user");
    setForm({
      name: "",
      email: "",
      role: "field",
      password: "",
    });
    setError("");
    setMessage("");
  }

  function openPassword() {
    setAction("password");
    setForm({
      current_password: "",
      new_password: "",
    });
    setError("");
    setMessage("");
  }

  async function submitAction(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (action === "user") {
        await api.post("/api/users", form);
        await refresh();
        setMessage("User created.");
      } else {
        await api.post("/api/me/password", form, { queue: false });
        setMessage("Password updated.");
      }
      setAction(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fields =
    action === "user"
      ? [
          { name: "name", label: "Name", required: true },
          {
            name: "email",
            label: "Email",
            type: "email",
            required: true,
          },
          {
            name: "role",
            label: "Role",
            type: "select",
            options: ["commander", "logistics", "field"],
            placeholder: false,
            required: true,
          },
          {
            name: "password",
            label: "Temporary password",
            type: "password",
            required: true,
            minLength: 8,
            autoComplete: "new-password",
          },
        ]
      : [
          {
            name: "current_password",
            label: "Current password",
            type: "password",
            required: true,
            autoComplete: "current-password",
          },
          {
            name: "new_password",
            label: "New password",
            type: "password",
            required: true,
            minLength: 8,
            autoComplete: "new-password",
          },
        ];

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOCAL CONFIGURATION</span>
          <h1>Settings</h1>
          <p>Organization, user roles and local account controls.</p>
        </div>
        <button className="button" onClick={openPassword}>
          Change password
        </button>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="panel">
        <div className="panel-title">
          <h2>Organization</h2>
        </div>
        <DataTable
          rows={organization}
          columns={[
            { key: "name", label: "Name" },
            { key: "country_code", label: "Country code" },
            { key: "operator_type", label: "Operator type" },
          ]}
        />
      </div>

      {user?.role === "commander" ? (
        <div className="panel">
          <div className="panel-title">
            <h2>Users</h2>
            <button className="button small primary" onClick={openAddUser}>
              + User
            </button>
          </div>
          <DataTable
            rows={users}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role", badge: true },
              { key: "active", label: "Active" },
            ]}
          />
        </div>
      ) : null}

      <ActionFormModal
        open={Boolean(action)}
        title={action === "user" ? "Add user" : "Change password"}
        fields={fields}
        form={form}
        setForm={setForm}
        onClose={() => setAction(null)}
        onSubmit={submitAction}
        submitLabel={action === "user" ? "Create user" : "Update password"}
        busy={busy}
        error={error}
      />
    </section>
  );
}
