export default function Loading({ label = 'Loading PolarOps…' }) {
  return <div className="loading"><span className="spinner" />{label}</div>
}
