import { createModel } from './factory.js';
export default createModel({ table: 'vehicles', fields: ['expedition_id','code','name','type','location_id','status','fuel_percent','range_km','created_at'] });
