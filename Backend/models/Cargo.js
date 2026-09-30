import { createModel } from './factory.js';
export default createModel({ table: 'cargo', fields: ['expedition_id','code','name','priority','origin_location_id','destination_location_id','current_location_id','status','quantity','unit','assigned_to','created_at'] });
