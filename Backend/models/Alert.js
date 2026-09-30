import { createModel } from './factory.js';
export default createModel({ table: 'ops_alerts', fields: ['expedition_id','severity','source','title','detail','status','assigned_to','entity_type','entity_id','created_by','created_at','acknowledged_at','resolved_at'] });
