import { createModel } from './factory.js';
export default createModel({ table: 'science_records', fields: ['expedition_id','project','sample_id','record_type','title','latitude','longitude','collected_at','researcher_id','storage_location','notes','created_by','created_at'] });
