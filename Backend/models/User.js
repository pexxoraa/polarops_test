import { createModel } from './factory.js';
export default createModel({ table: 'users', fields: ['organization_id','email','name','role','password_hash','active','created_at'] });
