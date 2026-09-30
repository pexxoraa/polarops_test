import StatusBadge from './StatusBadge.jsx';

export default function DataTable({columns,rows,empty='No records found.',rowKey='id',actions}){
  if(!rows?.length)return <div className="empty"><div><strong>{empty}</strong><span>Records will appear here when available.</span></div></div>;
  const renderCell=(column,row)=>{
    if(column.render)return column.render(row);
    const value=row[column.key];
    if(column.badge)return <StatusBadge value={value}/>;
    if(column.key?.includes('_at')&&value){const date=new Date(value);if(!Number.isNaN(date.getTime()))return date.toLocaleString();}
    return value??'—';
  };
  return <div className="table-wrap"><table><thead><tr>{columns.map((column)=><th key={column.key||column.label}>{column.label}</th>)}{actions&&<th>Actions</th>}</tr></thead>
    <tbody>{rows.map((row,index)=><tr key={row[rowKey]??index}>{columns.map((column)=><td key={column.key||column.label}>{renderCell(column,row)}</td>)}{actions&&<td>{actions(row)}</td>}</tr>)}</tbody>
  </table></div>;
}
