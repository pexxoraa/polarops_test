import { createModel } from './factory.js';
export default createModel({ table: 'comms_checkins', fields: ['expedition_id','team_name','channel','expected_at','actual_at','status','notes','created_by','created_at','updated_at'] });
