function statusKind(value=''){
  const text=String(value??'').toLowerCase();
  if(/safe|delivered|operational|available|cleared|resolved|complete|verified_current|ok|active true/.test(text))return'good';
  if(/critical|low|overdue|maintenance|high|failed|conflict/.test(text))return'danger';
  if(/transit|moving|response|deployed|medium|syncing|active/.test(text))return'info';
  return'warn';
}
export default function StatusBadge({children,value,kind}){
  const text=value??children??'—';
  return <span className={'status-badge '+(kind||statusKind(text))}>{String(text)}</span>;
}
