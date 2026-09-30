import { useEffect, useState } from 'react'
import api from '../utils/services/api'
import { useExpedition } from '../context/ExpeditionContext'
import Loading from './Loading'

export default function Environment() {
  const { selectedId } = useExpedition()
  const [data, setData] = useState(null)
  useEffect(() => {
    if (selectedId) api.get('/api/environment/overview?expedition_id=' + selectedId).then(setData).catch(() => {})
  }, [selectedId])
  if (!data) return <Loading />
  const weather = data.data?.weather
  return <section>
    <div className="page-heading"><div><span className="eyebrow">ENVIRONMENTAL CONTEXT</span><h1>Environment</h1><p>Operational weather plus clearly sourced polar reference resources.</p></div><span className="region-pill">{data.pole === 'north' ? 'ARCTIC / NORTH' : 'ANTARCTIC / SOUTH'}</span></div>
    <div className="metric-grid">
      <div className="metric-card"><span>Primary location</span><strong className="metric-text">{data.primary_location?.name || 'Not mapped'}</strong><small>{data.primary_location ? data.primary_location.latitude + ', ' + data.primary_location.longitude : 'Add a mapped base/station'}</small></div>
      <div className="metric-card"><span>Temperature</span><strong>{weather?.current?.temperature_2m ?? '—'}{weather?.units?.temperature_2m || ''}</strong><small>{weather?.source || 'No live weather available'}</small></div>
      <div className="metric-card"><span>Wind</span><strong>{weather?.current?.wind_speed_10m ?? '—'}{weather?.units?.wind_speed_10m || ''}</strong><small>Gust {weather?.current?.wind_gusts_10m ?? '—'}{weather?.units?.wind_gusts_10m || ''}</small></div>
      <div className="metric-card"><span>Freshness</span><strong className="metric-text">{weather?.fetched_at ? new Date(weather.fetched_at).toLocaleTimeString() : 'Cached/reference'}</strong><small>External context is not mission source-of-truth</small></div>
    </div>
    {Object.keys(data.errors || {}).length ? <div className="alert-box warn">Provider errors: {Object.values(data.errors).join(' · ')}</div> : null}
    <div className="panel"><div className="panel-title"><h2>Polar data resources</h2><span>Source references</span></div>
      <div className="resource-cards">{data.resources.map((item) => <a key={item.name} href={item.url} target="_blank" rel="noreferrer"><strong>{item.name}</strong><span>{item.category}</span><p>{item.detail}</p></a>)}</div>
    </div>
  </section>
}
