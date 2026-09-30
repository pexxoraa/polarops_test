import { useCallback, useEffect, useMemo, useState } from "react";
import ActionFormModal from "./ActionFormModal";
import Alert from "./Alert";
import DataTable from "./DataTable";
import Loading from "./Loading";
import Modal from "./Modal";
import { useExpedition } from "../context/ExpeditionContext";
import { useRealtime } from "../context/RealtimeContext";
import api from "../utils/services/api";

const CHECKLIST_FIELDS = [
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [
      "Personnel",
      "Medical",
      "Communications",
      "Vehicles",
      "Fuel",
      "Food",
      "Emergency",
      "Permits",
      "Weather",
      "Route",
    ],
  },
  { name: "label", label: "Checklist item", required: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: ["Pending", "In Progress", "Complete", "Blocked"],
  },
  { name: "owner", label: "Owner (team or teammate)" },
  { name: "due_at", label: "Due", type: "datetime-local" },
  { name: "notes", label: "Notes", type: "textarea", wide: true },
];

const PERSON_STATUSES = [
  "Safe",
  "Moving",
  "Deployed",
  "Check-in due",
  "Overdue",
  "Unknown",
];

const emptyChecklist = {
  category: "",
  label: "",
  status: "Pending",
  owner: "",
  due_at: "",
  notes: "",
};

const normalize = (value) => String(value || "").trim().toLocaleLowerCase();

export default function Readiness() {
  const { selectedId } = useExpedition();
  const { revision } = useRealtime();
  const [personnel, setPersonnel] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingForTeam, setCreatingForTeam] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState(emptyChecklist);
  const [editingPerson, setEditingPerson] = useState(null);
  const [personForm, setPersonForm] = useState({});
  const [personBusy, setPersonBusy] = useState(false);
  const [personError, setPersonError] = useState("");

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    try {
      const [readinessData, personnelData] = await Promise.all([
        api.get("/api/ops/readiness?expedition_id=" + selectedId),
        api.get("/api/personnel?expedition_id=" + selectedId),
      ]);
      setItems(readinessData.items || []);
      setPersonnel(personnelData || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh, revision]);

  const teams = useMemo(() => {
    const groups = new Map();
    const getGroup = (name) => {
      const label = String(name || "").trim() || "Unassigned";
      const key = normalize(label);
      if (!groups.has(key)) {
        groups.set(key, { key, name: label, members: [], items: [] });
      }
      return groups.get(key);
    };

    personnel.forEach((member) => {
      getGroup(member.team).members.push(member);
    });

    items.forEach((item) => {
      const owner = normalize(item.owner);
      const teamMatch = owner ? groups.get(owner) : null;
      const namedPerson = owner
        ? personnel.find((member) => normalize(member.name) === owner)
        : null;
      const roleMatches = owner
        ? personnel.filter((member) => normalize(member.role) === owner)
        : [];
      const ownerRolePrefixMatches = owner && roleMatches.length === 0
        ? personnel.filter((member) => normalize(member.role).includes(owner))
        : [];
      const matchingRoles = roleMatches.length ? roleMatches : ownerRolePrefixMatches;
      const roleTeams = new Set(matchingRoles.map((member) => normalize(member.team)));
      const assignedPerson = namedPerson || (matchingRoles.length === 1 ? matchingRoles[0] : null);
      const matchingTeam = teamMatch || (roleTeams.size === 1 && matchingRoles.length
        ? getGroup(matchingRoles[0].team)
        : null);
      const group = matchingTeam || (namedPerson ? getGroup(namedPerson.team) : null) || getGroup("Unassigned");

      group.items.push({ ...item, assigned_personnel_id: assignedPerson?.id || null });
    });

    return [...groups.values()].sort((left, right) => {
      if (left.key === "unassigned") return 1;
      if (right.key === "unassigned") return -1;
      return left.name.localeCompare(right.name);
    });
  }, [items, personnel]);
  const assignedTeams = teams.filter((team) => team.key !== "unassigned");

  async function createChecklistItem(event) {
    event.preventDefault();
    setCreateBusy(true);
    setError("");
    try {
      await api.post("/api/ops/readiness", {
        expedition_id: selectedId,
        ...createForm,
      });
      setCreating(false);
      setCreatingForTeam("");
      setCreateForm(emptyChecklist);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleChecklistItem(item) {
    setError("");
    try {
      await api.patch("/api/ops/readiness/" + item.id, {
        status: item.status === "Complete" ? "Pending" : "Complete",
      });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function startPersonUpdate(member) {
    setEditingPerson(member);
    setPersonForm({
      name: member.name || "",
      role: member.role || "",
      team: member.team || "",
      status: member.status || "Safe",
    });
    setPersonError("");
  }

  async function updatePerson(event) {
    event.preventDefault();
    if (!editingPerson) return;
    setPersonBusy(true);
    setPersonError("");
    try {
      await api.patch("/api/personnel/" + editingPerson.id, personForm);
      setEditingPerson(null);
      await refresh();
    } catch (requestError) {
      setPersonError(requestError.message);
    } finally {
      setPersonBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPEDITION MODULE</span>
          <h1>Expedition Readiness</h1>
          <p>
            Team members and their assigned personnel, medical, communications,
            vehicle, fuel, food, emergency, permit, weather and route readiness.
          </p>
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {assignedTeams.length ? assignedTeams.map((team) => (
        <section className="panel readiness-team" key={team.key}>
          <div className="panel-title">
            <h2>{team.name} Team</h2>
            <div className="button-row">
              <span>
                {team.members.length} teammates · {team.items.length} readiness items
              </span>
              <button
                className="button small primary"
                onClick={() => {
                  setCreatingForTeam(team.name);
                  setCreateForm({ ...emptyChecklist, owner: team.name });
                  setCreating(true);
                }}
              >
                + Add Checklist Item
              </button>
            </div>
          </div>

          <h3>Teammates</h3>
          <DataTable
            rows={team.members}
            empty="No teammates assigned to this team."
            columns={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "status", label: "Personnel status", badge: true },
              {
                key: "readiness_work",
                label: "Readiness work",
                render: (member) => {
                  const assigned = team.items.filter(
                    (item) => item.assigned_personnel_id === member.id,
                  );
                  return assigned.length
                    ? assigned.map((item) => item.label).join(" · ")
                    : "No individually assigned items";
                },
              },
            ]}
            actions={(member) => (
              <button
                className="button small"
                onClick={() => startPersonUpdate(member)}
              >
                Update
              </button>
            )}
          />

          <h3>Team readiness work</h3>
          <DataTable
            rows={team.items}
            empty="No readiness work assigned to this team."
            columns={[
              { key: "category", label: "Category" },
              { key: "label", label: "Checklist item" },
              { key: "status", label: "Status", badge: true },
              { key: "owner", label: "Owner" },
              { key: "due_at", label: "Due" },
              { key: "notes", label: "Notes" },
            ]}
            actions={(item) => (
              <button
                className="button small"
                onClick={() => toggleChecklistItem(item)}
              >
                {item.status === "Complete" ? "Reopen" : "Complete"}
              </button>
            )}
          />
        </section>
      )) : (
        <div className="panel">
          <DataTable rows={[]} columns={[]} empty="No assigned teams found." />
        </div>
      )}

      <ActionFormModal
        open={creating}
        title={creatingForTeam ? "Add checklist item to " + creatingForTeam : "Add checklist item"}
        fields={CHECKLIST_FIELDS}
        form={createForm}
        setForm={setCreateForm}
        onClose={() => {
          setCreating(false);
          setCreatingForTeam("");
        }}
        onSubmit={createChecklistItem}
        submitLabel="Add item"
        busy={createBusy}
        error={error}
      />

      <Modal
        open={Boolean(editingPerson)}
        title="Update teammate"
        subtitle={editingPerson?.name || ""}
        onClose={() => setEditingPerson(null)}
      >
        <form className="form-grid" onSubmit={updatePerson}>
          {personError ? <div className="wide"><Alert tone="danger">{personError}</Alert></div> : null}
          <label>
            <span>Name</span>
            <input
              required
              value={personForm.name || ""}
              onChange={(event) => setPersonForm({ ...personForm, name: event.target.value })}
            />
          </label>
          <label>
            <span>Role</span>
            <input
              required
              value={personForm.role || ""}
              onChange={(event) => setPersonForm({ ...personForm, role: event.target.value })}
            />
          </label>
          <label>
            <span>Team</span>
            <input
              value={personForm.team || ""}
              onChange={(event) => setPersonForm({ ...personForm, team: event.target.value })}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={personForm.status || "Safe"}
              onChange={(event) => setPersonForm({ ...personForm, status: event.target.value })}
            >
              {[...new Set([personForm.status, ...PERSON_STATUSES].filter(Boolean))].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="form-actions wide">
            <button
              type="button"
              className="button ghost"
              onClick={() => setEditingPerson(null)}
              disabled={personBusy}
            >
              Cancel
            </button>
            <button className="button primary" disabled={personBusy}>
              {personBusy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}