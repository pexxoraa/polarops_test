import ResourcePage from './ResourcePage'
import api from '../utils/services/api'

export default function Communications() {
  return <ResourcePage
    title="Communications"
    createLabel="Schedule Check-in"
    description="VHF, HF, satellite and Iridium check-ins with overdue status tracking."
    endpoint="/api/ops/comms"
    columns={[
      {key:'team_name',label:'Team'}, {key:'channel',label:'Channel'}, {key:'expected_at',label:'Expected'},
      {key:'actual_at',label:'Actual'}, {key:'status',label:'Status',badge:true}, {key:'notes',label:'Notes'},
    ]}
    createFields={[
      {name:'team_name',label:'Team name',required:true},
      {name:'channel',label:'Channel',type:'select',options:['VHF','HF','Satellite','Iridium']},
      {name:'expected_at',label:'Expected check-in',type:'datetime-local',required:true},
      {name:'notes',label:'Notes',type:'textarea',wide:true},
    ]}
    actions={(row, refresh) => <button className="button small" onClick={async () => {
      await api.patch('/api/ops/comms/' + row.id, { status: 'Completed' })
      refresh()
    }}>Complete</button>}
  />
}
