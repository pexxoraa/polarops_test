import { createModel } from './factory.js';
export default createModel({ table: 'planned_routes', fields: ['expedition_id','name','start_lat','start_lon','end_lat','end_lon','waypoints_json','distance_km','eta_minutes','fuel_liters','vehicle_id','personnel_id','status','risk_summary','created_by','created_at','updated_at'] });
