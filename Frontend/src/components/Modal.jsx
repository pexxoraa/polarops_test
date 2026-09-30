export default function Modal({open=true,title,subtitle,children,onClose,wide=false}){
  if(!open)return null;
  return <div className="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&onClose?.()}>
    <div className={'modal '+(wide?'wide':'')}>
      <div className="modal-head"><div><span className="eyebrow">POLAROPS WORKFLOW</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>;
}
