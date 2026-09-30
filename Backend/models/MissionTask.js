import { createModel } from './factory.js';
export default createModel({ table: 'mission_tasks', fields: ['expedition_id','title','category','status','priority','start_at','due_at','assigned_to','location_id','notes','created_by','created_at','updated_at'] });
