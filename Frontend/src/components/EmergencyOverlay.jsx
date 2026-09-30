import { useRealtime } from '../context/RealtimeContext'

export default function EmergencyOverlay() {
  const { emergency, dismissEmergency } = useRealtime()

  if (!emergency) return null

  return (
    <div className="emergency-screen-cover">
      <section
        className="emergency-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="emergency-alert-title"
        aria-describedby="emergency-alert-description"
      >
        <span className="emergency-alert-mark" aria-hidden="true">!</span>
        <p className="emergency-alert-kicker">POLAROPS EXPEDITION ALERT</p>
        <h1 id="emergency-alert-title">EMERGENCY</h1>
        <p id="emergency-alert-description" className="emergency-alert-description">
          An SOS request has been activated. Respond immediately.
        </p>
        <dl className="emergency-alert-details">
          <div>
            <dt>Reported location</dt>
            <dd>{emergency.location || 'Location not reported'}</dd>
          </div>
          <div>
            <dt>Station account</dt>
            <dd>{emergency.initiated_by || 'Unknown account'}{emergency.account ? ' · ' + emergency.account : ''}</dd>
          </div>
          <div>
            <dt>Expedition</dt>
            <dd>{emergency.expedition_name || 'Current expedition'}</dd>
          </div>
          {emergency.incident_code ? (
            <div>
              <dt>Incident</dt>
              <dd>{emergency.incident_code}</dd>
            </div>
          ) : null}
          {emergency.occurred_at ? (
            <div>
              <dt>Received</dt>
              <dd>{new Date(emergency.occurred_at).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>
        <button
          type="button"
          className="emergency-alert-acknowledge"
          onClick={dismissEmergency}
          autoFocus
        >
          ACKNOWLEDGE ON THIS DEVICE
        </button>
      </section>
    </div>
  )
}