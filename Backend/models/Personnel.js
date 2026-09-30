import { createModel } from './factory.js';
export default createModel({ table: 'personnel', fields: ['expedition_id','external_id','name','role','team','location_id','status','last_checkin','contact','clearance_status','source','is_synthetic','created_at'] });
