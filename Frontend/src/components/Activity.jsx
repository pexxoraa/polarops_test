import ResourcePage from './ResourcePage'

export default function Activity() {
  return <ResourcePage
    title="Activity & Audit"
    description="Mission activity and accountability trail for expedition actions."
    endpoint="/api/activity"
    columns={[
      {key:'created_at',label:'Time'}, {key:'category',label:'Category'}, {key:'message',label:'Activity'}, {key:'user_name',label:'User'},
    ]}
  />
}
