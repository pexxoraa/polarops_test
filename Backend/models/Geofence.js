import { createModel } from './factory.js';
export default createModel({ table: 'geofences', fields: ['expedition_id','name','kind','center_lat','center_lon','radius_m','severity','active','notes','created_by','created_at','updated_at'] });
