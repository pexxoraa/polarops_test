import { createModel } from './factory.js';
export default createModel({ table: 'shift_handovers', fields: ['expedition_id','shift_name','author_user_id','summary','unresolved_alerts','deployed_teams','vehicle_issues','weather_notes','cargo_priorities','science_ops','next_tasks','created_at'] });
