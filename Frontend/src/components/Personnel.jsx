import { useCallback, useEffect, useMemo, useState } from "react";
import { useExpedition } from "../context/ExpeditionContext";
import { useRealtime } from "../context/RealtimeContext";
import api from "../utils/services/api";
import ActionFormModal from "./ActionFormModal";
import Alert from "./Alert";
import DataTable from "./DataTable";
import Loading from "./Loading";

const CHECKIN_STATUSES = [
  "Safe",
  "Moving",
  "Deployed",
  "Check-in due",
  "Overdue",
];
const PERSONNEL_ROLES = [
  "Expedition Lead",
  "Communications",
  "Medical Officer",
  "Scientist",
  "Field Engineer",
  "Geologist",
  "Glaciologist",
  "Logistics Technician",
];
const EMPTY_TEAM_FORM = {
  team: "",
  name: "",
  role: "",
  status: "Safe",
};
const EMPTY_MEMBER_FORM = { name: "", role: "", status: "Safe" };
const normalizeTeam = (team) => String(team || "").trim().toLocaleLowerCase();

export default function Personnel() {
  const { selectedId } = useExpedition();
  const { revision } = useRealtime();
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM_FORM);
  const [teamError, setTeamError] = useState("");
  const [memberAction, setMemberAction] = useState(null);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [memberError, setMemberError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    try {
      setPersonnel(
        await api.get("/api/personnel?expedition_id=" + selectedId),
      );
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
    const grouped = new Map();
    personnel.forEach((member) => {
      const name = String(member.team || "").trim() || "Unassigned";
      const key = normalizeTeam(name) || "unassigned";
      if (!grouped.has(key)) grouped.set(key, { key, name, members: [] });
      grouped.get(key).members.push(member);
    });
    return [...grouped.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [personnel]);

  async function submitTeam(event) {
    event.preventDefault();
    setBusy(true);
    setTeamError("");
    try {
      await api.post("/api/personnel", {
        expedition_id: selectedId,
        ...teamForm,
      });
      setTeamDialogOpen(false);
      setTeamForm(EMPTY_TEAM_FORM);
      await refresh();
    } catch (requestError) {
      setTeamError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function openAddMember(team) {
    setMemberAction({ kind: "add", team });
    setMemberForm(EMPTY_MEMBER_FORM);
    setMemberError("");
  }

  function openUpdateMember(member) {
    setMemberAction({ kind: "update", member });
    setMemberForm({
      name: member.name || "",
      role: member.role || "",
      team: member.team || "",
      status: member.status || "Safe",
    });
    setMemberError("");
  }

  function openCheckin(member) {
    setMemberAction({ kind: "checkin", member });
    setMemberForm({ status: member.status || "Safe" });
    setMemberError("");
  }

  async function submitMemberAction(event) {
    event.preventDefault();
    if (!memberAction) return;
    setBusy(true);
    setMemberError("");
    try {
      if (memberAction.kind === "add") {
        await api.post("/api/personnel", {
          expedition_id: selectedId,
          ...memberForm,
          team: memberAction.team,
        });
      } else if (memberAction.kind === "update") {
        await api.patch(
          "/api/personnel/" + memberAction.member.id,
          memberForm,
        );
      } else {
        await api.post(
          "/api/personnel/" + memberAction.member.id + "/checkin",
          { status: memberForm.status },
        );
      }
      setMemberAction(null);
      await refresh();
    } catch (requestError) {
      setMemberError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const memberFields =
    memberAction?.kind === "checkin"
      ? [
          {
            name: "status",
            label: "Check-in status",
            type: "select",
            options: CHECKIN_STATUSES,
            placeholder: false,
            required: true,
          },
        ]
      : [
          { name: "name", label: "Name", required: true },
          {
            name: "role",
            label: "Role",
            type: "select",
            options: [...new Set([...PERSONNEL_ROLES, memberForm.role].filter(Boolean))],
            required: true,
            placeholder: false,
          },
          ...(memberAction?.kind === "update"
            ? [{ name: "team", label: "Team", required: true }]
            : []),
          {
            name: "status",
            label: "Status",
            type: "select",
            options: CHECKIN_STATUSES,
            placeholder: false,
          },
        ];

  const memberActionTitle =
    memberAction?.kind === "add"
      ? "Add personnel to " + memberAction.team
      : memberAction?.kind === "checkin"
        ? "Personnel check-in"
        : "Update personnel";

  if (loading) return <Loading />;

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPEDITION MODULE</span>
          <h1>Personnel</h1>
          <p>Roster, team roles, status, check-ins and last known operational position.</p>
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="panel personnel-teams-container">
        <div className="panel-title personnel-teams-heading">
          <div>
            <h2>Teams</h2>
            <span>{teams.length} teams · {personnel.length} teammates</span>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setTeamForm(EMPTY_TEAM_FORM);
              setTeamError("");
              setTeamDialogOpen(true);
            }}
          >
            + Add Team
          </button>
        </div>

        {teams.length ? (
          <div className="personnel-team-grid">
            {teams.map((team) => (
              <section className="panel personnel-team-card" key={team.key}>
                <div className="panel-title personnel-team-heading">
                  <div>
                    <h2>{team.name}</h2>
                    <span>{team.members.length} teammates</span>
                  </div>
                  <button
                    className="button small primary"
                    onClick={() => openAddMember(team.name)}
                  >
                    + Add Personnel
                  </button>
                </div>
                <div className="personnel-team-roster">
                  <DataTable
                    rows={team.members}
                    columns={[
                      { key: "name", label: "Name" },
                      { key: "role", label: "Role" },
                      { key: "status", label: "Status", badge: true },
                      { key: "location_name", label: "Location" },
                      { key: "last_checkin", label: "Last check-in" },
                    ]}
                    actions={(member) => (
                      <div className="inline-actions">
                        <button
                          className="button small"
                          onClick={() => openUpdateMember(member)}
                        >
                          Update
                        </button>
                        <button
                          className="button small"
                          onClick={() => openCheckin(member)}
                        >
                          Check in
                        </button>
                      </div>
                    )}
                  />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div>
              <strong>No teams yet</strong>
              <span>Add a team with its first teammate to get started.</span>
            </div>
          </div>
        )}
      </div>

      <ActionFormModal
        open={teamDialogOpen}
        title="Add team and first teammate"
        fields={[
          { name: "team", label: "Team name", required: true },
          { name: "name", label: "First teammate name", required: true },
          {
            name: "role",
            label: "Role",
            type: "select",
            options: PERSONNEL_ROLES,
            required: true,
            placeholder: false,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: CHECKIN_STATUSES,
            placeholder: false,
          },
        ]}
        form={teamForm}
        setForm={setTeamForm}
        onClose={() => setTeamDialogOpen(false)}
        onSubmit={submitTeam}
        submitLabel="Create team"
        busy={busy}
        error={teamError}
      />

      <ActionFormModal
        open={Boolean(memberAction)}
        title={memberActionTitle}
        subtitle={memberAction?.member?.name || ""}
        fields={memberFields}
        form={memberForm}
        setForm={setMemberForm}
        onClose={() => setMemberAction(null)}
        onSubmit={submitMemberAction}
        submitLabel={memberAction?.kind === "checkin" ? "Record check-in" : memberAction?.kind === "add" ? "Add personnel" : "Save changes"}
        busy={busy}
        error={memberError}
      />
    </section>
  );
}
