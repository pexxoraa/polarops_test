export default function Alert({ tone = 'info', children }) {
  return <div className={'alert-box ' + tone}>{children}</div>
}
