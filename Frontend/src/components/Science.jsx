import ResourcePage from './ResourcePage'

export default function Science() {
  return <ResourcePage
    title="Projects"
    createLabel="Add Project Record"
    description="Projects, samples, observations, coordinates, researchers, collection times and storage."
    endpoint="/api/ops/science"
    columns={[
      {key:'project',label:'Project'}, {key:'title',label:'Record'}, {key:'record_type',label:'Type'},
      {key:'sample_id',label:'Sample'}, {key:'researcher_name',label:'Researcher'}, {key:'collected_at',label:'Collected'},
      {key:'storage_location',label:'Storage'},
    ]}
    createFields={[
      {name:'project',label:'Project',required:true}, {name:'title',label:'Title',required:true},
      {name:'record_type',label:'Type',type:'select',options:['Observation','Sample','Measurement']},
      {name:'sample_id',label:'Sample ID'}, {name:'latitude',label:'Latitude',type:'number'},
      {name:'longitude',label:'Longitude',type:'number'}, {name:'storage_location',label:'Storage location'},
      {name:'notes',label:'Notes',type:'textarea',wide:true},
    ]}
  />
}
