import { createModel } from './factory.js';
export default createModel({ table: 'incidents', fields: ['expedition_id','code','title','type','severity','location_id','status','description','affected_count','assigned_vehicle_id','created_by','created_at','resolved_at'] });
