import { useEffect, useMemo, useState } from 'react'
import api from '../utils/services/api'
import { useExpedition } from '../context/ExpeditionContext'
import { useRealtime } from '../context/RealtimeContext'
import DataTable from './DataTable'
import Loading from './Loading'
import Modal from './Modal'
import PolarMap from './PolarMap'
import StatusBadge from './StatusBadge'
import { getPolarRegion, getPolarRegionLabel } from '../utils/polarRegion'

const Metric = ({ label, value, detail }) => <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>

function getDeviceCoordinates() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }

    const timer = window.setTimeout(() => resolve(null), 1200)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        window.clearTimeout(timer)
        resolve({ latitude: coords.latitude, longitude: coords.longitude })
      },
      () => {
        window.clearTimeout(timer)
        resolve(null)
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 1200 },
    )
  })
}

export default function Dashboard() {
  const { selectedId, selectedExpedition } = useExpedition()
  const { revision, showEmergency } = useRealtime()
  const [data, setData] = useState(null)
  const [sitrep, setSitrep] = useState(null)
  const [mapData, setMapData] = useState({ routes: [], geofences: [], markers: [] })
  const [referenceSites, setReferenceSites] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [incidents, setIncidents] = useState([])
  const [selectedIncidentId, setSelectedIncidentId] = useState('')
  const [operationAlerts, setOperationAlerts] = useState([])
  const [selectedOperationAlertId, setSelectedOperationAlertId] = useState('')
  const [operationAlertDetail, setOperationAlertDetail] = useState(null)
  const [operationAlertOpen, setOperationAlertOpen] = useState(false)
  const [incidentDetail, setIncidentDetail] = useState(null)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [incidentLoading, setIncidentLoading] = useState(false)
  const [incidentError, setIncidentError] = useState('')
  const [vehicleAlerts, setVehicleAlerts] = useState([])
  const [vehicleAlertsOpen, setVehicleAlertsOpen] = useState(false)
  const [vehicleAlertsLoading, setVehicleAlertsLoading] = useState(false)
  const [vehicleAlertsError, setVehicleAlertsError] = useState('')
  const [sosSending, setSosSending] = useState(false)
  const [sosError, setSosError] = useState('')
  const polarRegion = getPolarRegion(selectedExpedition?.region)

  useEffect(() => {
    if (!selectedId) return
    Promise.all([
      api.get('/api/dashboard?expedition_id=' + selectedId),
      api.get('/api/ops/sitrep?expedition_id=' + selectedId),
    ]).then(([dashboard, report]) => { setData(dashboard); setSitrep(report) }).catch(() => {})
  }, [selectedId, revision])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    Promise.all([
      api.get('/api/vehicles?expedition_id=' + selectedId),
      api.get('/api/incidents?expedition_id=' + selectedId),
      api.get('/api/ops/alerts?expedition_id=' + selectedId),
    ]).then(([items, incidentItems, alertData]) => {
      if (cancelled) return
      const manualAlerts = (alertData.items || []).filter(
        (alert) => alert.source === 'Manual' && !alert.entity_type,
      )
      setVehicles(items)
      setIncidents(incidentItems)
      setOperationAlerts(manualAlerts)
      setSelectedVehicleId((current) =>
        items.some((vehicle) => String(vehicle.id) === current)
          ? current
          : String(items[0]?.id || ''),
      )
      setSelectedIncidentId((current) =>
        incidentItems.some((incident) => String(incident.id) === current)
          ? current
          : String(incidentItems[0]?.id || ''),
      )
      setSelectedOperationAlertId((current) =>
        manualAlerts.some((alert) => String(alert.id) === current)
          ? current
          : String(manualAlerts[0]?.id || ''),
      )
    }).catch(() => {
      if (!cancelled) {
        setVehicles([])
        setSelectedVehicleId('')
        setIncidents([])
        setSelectedIncidentId('')
        setOperationAlerts([])
        setSelectedOperationAlertId('')
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedId, revision])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    Promise.all([
      api.get('/api/ops/routes?expedition_id=' + selectedId),
      api.get('/api/locations?expedition_id=' + selectedId),
      api.get('/api/telemetry/latest?expedition_id=' + selectedId),
    ]).then(([routeData, locations, telemetry]) => {
      if (cancelled) return
      const markers = [
        ...locations.map((item) => {
          const type = String(item.type || '').toLowerCase()
          const category =
            type.includes('station') || type.includes('base')
              ? 'base'
              : type.includes('camp')
                ? 'camp'
                : type.includes('transport') || type.includes('air')
                  ? 'support'
                  : 'mission'

          return {
            ...item,
            kind: item.type || 'Mission location',
            markerCategory: category,
            markerDetail: 'Selected expedition',
          }
        }),
        ...telemetry.map((item) => ({
          ...item,
          name: item.entity_type + ' #' + item.entity_id,
          kind: 'Authorized GPS',
          markerCategory: 'gps',
          markerDetail: 'Latest expedition telemetry',
        })),
      ]

      setMapData({
        routes: routeData.items || [],
        geofences: routeData.geofences || [],
        markers,
      })
    }).catch(() => {
      if (!cancelled) setMapData({ routes: [], geofences: [], markers: [] })
    })

    return () => {
      cancelled = true
    }
  }, [selectedId, revision])

  useEffect(() => {
    let cancelled = false
    const path = polarRegion === 'north'
      ? '/api/public/arctic-research-stations'
      : '/api/public/facilities'

    api.get(path).then((response) => {
      if (cancelled) return
      setReferenceSites(polarRegion === 'north' ? response.items || [] : response || [])
    }).catch(() => {
      if (!cancelled) setReferenceSites([])
    })

    return () => {
      cancelled = true
    }
  }, [polarRegion])

  const markers = useMemo(() => [
    ...mapData.markers,
    ...referenceSites
      .filter((item) =>
        Number.isFinite(Number(item.latitude)) &&
        Number.isFinite(Number(item.longitude)),
      )
      .map((item) => ({
        ...item,
        kind: polarRegion === 'north'
          ? 'Reference research station'
          : item.facility_type || 'Reference facility',
        markerCategory: 'research',
        markerDetail: polarRegion === 'north'
          ? item.operating_country || item.location || 'Arctic reference'
          : [item.country, item.seasonality].filter(Boolean).join(' · '),
      })),
  ], [mapData.markers, referenceSites, polarRegion])

  async function showVehicleAlerts() {
    if (!selectedVehicleId) return
    setVehicleAlertsOpen(true)
    setVehicleAlertsLoading(true)
    setVehicleAlertsError('')
    try {
      const response = await api.get(
        '/api/vehicles/' + selectedVehicleId + '/alerts',
      )
      setVehicleAlerts(response.items || [])
    } catch (error) {
      setVehicleAlertsError(error.message)
      setVehicleAlerts([])
    } finally {
      setVehicleAlertsLoading(false)
    }
  }

  async function showIncident() {
    if (!selectedIncidentId) return
    setIncidentOpen(true)
    setIncidentLoading(true)
    setIncidentError('')
    setIncidentDetail(null)
    try {
      setIncidentDetail(
        await api.get('/api/incidents/' + selectedIncidentId),
      )
    } catch (error) {
      setIncidentError(error.message)
    } finally {
      setIncidentLoading(false)
    }
  }

  function showOperationAlert() {
    const alert = operationAlerts.find(
      (item) => String(item.id) === selectedOperationAlertId,
    )
    if (!alert) return
    setOperationAlertDetail(alert)
    setOperationAlertOpen(true)
  }

  async function activateSOS() {
    if (!selectedId || sosSending) return
    setSosSending(true)
    setSosError('')
    try {
      const coordinates = await getDeviceCoordinates()
      const result = await api.post(
        '/api/incidents/sos',
        { expedition_id: selectedId, ...(coordinates || {}) },
        { queue: false },
      )
      const event = result.emergency_event
      if (event) {
        showEmergency({
          ...event.data,
          event_id: event.event_id,
          expedition_id: event.expedition_id,
          occurred_at: event.occurred_at,
        })
      }
    } catch (error) {
      setSosError(error.message || 'Unable to send the emergency alert.')
    } finally {
      setSosSending(false)
    }
  }

  if (!data) return <Loading />

  return <section className="dashboard-page">
    <div className="page-heading dashboard-page-heading"><div><span className="eyebrow">COMMAND OVERVIEW</span><h1>{selectedExpedition?.name || 'Dashboard'}</h1><p>Personnel, logistics, fuel, incidents, readiness and operational risk in one view.</p></div><div className="dashboard-heading-actions"><StatusBadge value={selectedExpedition?.status} /><button className="dashboard-sos-button" onClick={activateSOS} disabled={!selectedId || sosSending} aria-label="Send an emergency SOS" aria-busy={sosSending}>SOS <span>{sosSending ? 'SENDING ALERT...' : 'REPORT EMERGENCY'}</span></button></div></div>
    {sosError ? <p className="emergency-send-error" role="alert">{sosError}</p> : null}
    <div className="metric-grid dashboard-metrics">
      <Metric label="Personnel" value={data.personnel.total} detail={data.personnel.safe + ' safe · ' + data.personnel.attention + ' attention'} />
      <Metric label="Cargo" value={data.cargo.total} detail={data.cargo.in_transit + ' in transit'} />
      <Metric label="Inventory warnings" value={data.inventory_warnings} detail="Below minimum safety level" />
      <Metric label="Vehicles" value={data.vehicles.operational + '/' + data.vehicles.total} detail={data.vehicles.average_fuel + '% average fuel'} />
      <Metric label="Active incidents" value={data.active_incidents} detail="Open operational incidents" />
      <Metric label="Readiness" value={(sitrep?.readiness?.complete || 0) + '/' + (sitrep?.readiness?.total || 0)} detail="Checklist complete" />
    </div>
    <div className="panel dashboard-alerts-panel">
      <div className="panel-title">
        <h2>⚠️ Alerts</h2>
        <span>
          {vehicles.length} vehicles · {incidents.length} incidents · {operationAlerts.length} operation alerts
        </span>
      </div>
      <div className="dashboard-alert-controls">
        <div className="dashboard-alert-control">
          <label htmlFor="dashboard-vehicle-select">
            <span>Vehicle</span>
            <select
              id="dashboard-vehicle-select"
              value={selectedVehicleId}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.code} · {vehicle.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={!selectedVehicleId}
            onClick={showVehicleAlerts}
          >
            Show Alerts
          </button>
        </div>
        <div className="dashboard-alert-control">
          <label htmlFor="dashboard-incident-select">
            <span>Incident</span>
            <select
              id="dashboard-incident-select"
              value={selectedIncidentId}
              onChange={(event) => setSelectedIncidentId(event.target.value)}
            >
              <option value="">Select an incident</option>
              {incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  {incident.code} · {incident.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={!selectedIncidentId}
            onClick={showIncident}
          >
            Show Incident
          </button>
        </div>
        <div className="dashboard-alert-control">
          <label htmlFor="dashboard-operations-alert-select">
            <span>Operations alert</span>
            <select
              id="dashboard-operations-alert-select"
              value={selectedOperationAlertId}
              onChange={(event) => setSelectedOperationAlertId(event.target.value)}
            >
              <option value="">Select an operations alert</option>
              {operationAlerts.map((alert) => (
                <option key={alert.id} value={alert.id}>
                  {alert.title} · {alert.status}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={!selectedOperationAlertId}
            onClick={showOperationAlert}
          >
            Show Operations Alert
          </button>
        </div>
      </div>
    </div>
    <div className="panel dashboard-map-panel">
      <div className="panel-title">
        <div>
          <h2>Operational map</h2>
          <span>{getPolarRegionLabel(polarRegion)} · {markers.length} mapped points · {mapData.routes.length} routes · {mapData.geofences.length} zones</span>
        </div>
      </div>
      <PolarMap
        region={polarRegion}
        markers={markers}
        routes={mapData.routes}
        geofences={mapData.geofences}
        viewKey={selectedId + '-' + polarRegion}
        height={460}
        legendPlacement="footer"
      />
    </div>
    <div className="dashboard-grid">
      <div className="panel"><div className="panel-title"><h2>Operational risks</h2><span>{data.operational_risks.length} active</span></div><DataTable rows={data.operational_risks} columns={[{key:'severity',label:'Severity',badge:true},{key:'title',label:'Alert'},{key:'source',label:'Source'},{key:'status',label:'Status',badge:true}]} /></div>
      <div className="panel"><div className="panel-title"><h2>Commander SITREP</h2><span>{sitrep?.generated_at ? new Date(sitrep.generated_at).toLocaleString() : ''}</span></div>
        <div className="sitrep-grid"><div><strong>{sitrep?.personnel?.deployed || 0}</strong><span>Deployed</span></div><div><strong>{sitrep?.personnel?.overdue || 0}</strong><span>Overdue</span></div><div><strong>{sitrep?.cargo_in_transit || 0}</strong><span>Cargo moving</span></div><div><strong>{sitrep?.active_incidents || 0}</strong><span>Incidents</span></div></div>
      </div>
    </div>
    <div className="panel"><div className="panel-title"><h2>Recent activity</h2></div><DataTable rows={data.recent_activity} columns={[{key:'created_at',label:'Time'},{key:'category',label:'Category'},{key:'message',label:'Activity'},{key:'user_name',label:'User'}]} /></div>
    <Modal
      open={vehicleAlertsOpen}
      title="Vehicle alerts"
      subtitle={vehicles.find((vehicle) => String(vehicle.id) === selectedVehicleId)?.code || ''}
      onClose={() => setVehicleAlertsOpen(false)}
      wide
    >
      {vehicleAlertsError ? <div className="alert-box danger">{vehicleAlertsError}</div> : null}
      {vehicleAlertsLoading ? (
        <Loading label="Loading vehicle alert history…" />
      ) : (
        <DataTable
          rows={vehicleAlerts}
          empty="No alerts have been reported for this vehicle."
          columns={[
            { key: 'title', label: 'Situation' },
            { key: 'detail', label: 'Cause or details' },
            { key: 'severity', label: 'Severity', badge: true },
            {
              key: 'status',
              label: 'Status',
              render: (alert) => <span>{alert.status}</span>,
            },
            { key: 'created_at', label: 'Reported' },
          ]}
        />
      )}
    </Modal>
    <Modal
      open={incidentOpen}
      title="Incident details"
      subtitle={incidentDetail?.code || incidents.find((incident) => String(incident.id) === selectedIncidentId)?.code || ''}
      onClose={() => setIncidentOpen(false)}
      wide
    >
      {incidentError ? <div className="alert-box danger">{incidentError}</div> : null}
      {incidentLoading ? (
        <Loading label="Loading incident details…" />
      ) : incidentDetail ? (
        <>
          <dl className="record-details">
            {[
              ['Title', incidentDetail.title],
              ['Type', incidentDetail.type],
              ['Severity', incidentDetail.severity],
              ['Status', incidentDetail.status],
              ['Location', incidentDetail.location_name],
              ['Description', incidentDetail.description],
              ['Affected people', incidentDetail.affected_count],
              ['Reported', incidentDetail.created_at],
            ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>
            ))}
          </dl>
          <div className="panel-title"><h2>Incident timeline</h2></div>
          <DataTable
            rows={incidentDetail.events || []}
            empty="No timeline updates recorded."
            columns={[
              { key: 'created_at', label: 'Time' },
              { key: 'event_type', label: 'Event' },
              { key: 'note', label: 'Details' },
              { key: 'user_name', label: 'Recorded by' },
            ]}
          />
        </>
      ) : null}
    </Modal>
    <Modal
      open={operationAlertOpen}
      title="Operations alert"
      subtitle={operationAlertDetail?.title || ''}
      onClose={() => setOperationAlertOpen(false)}
    >
      {operationAlertDetail ? (
        <dl className="record-details">
          {[
            ['Title', operationAlertDetail.title],
            ['Severity', operationAlertDetail.severity],
            ['Status', operationAlertDetail.status],
            ['Details', operationAlertDetail.detail],
            ['Assigned to', operationAlertDetail.assigned_to],
            ['Created', operationAlertDetail.created_at],
          ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>
          ))}
        </dl>
      ) : null}
    </Modal>
  </section>
}
