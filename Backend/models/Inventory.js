import { createModel } from './factory.js';
export default createModel({ table: 'inventory_items', fields: ['expedition_id','sku','name','location_id','quantity','min_quantity','unit','expiry_date','created_at'] });
