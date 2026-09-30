import { Router } from 'express';
import { env } from '../utils/config/env.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';

const router=Router();
router.use(authRequired);

router.get('/workers/status',requirePermission('operations.read'),(req,res)=>{
  res.json({
    configured:Boolean(env.operationsFeedUrl),
    url:env.operationsFeedUrl||null,
    status:env.operationsFeedUrl?'configured':'not configured',
    note:'Local development never contacts a worker feed unless OPERATIONS_FEED_URL is explicitly set.',
  });
});

router.post('/workers/sync',requirePermission('operations.manage'),(req,res)=>{
  if(!env.operationsFeedUrl){
    res.status(409).json({error:'OPERATIONS_FEED_URL is not configured'});
    return;
  }
  res.status(501).json({
    error:'Automatic worker-feed writes are disabled in the local refactor until the provider schema is explicitly authorized.',
    configured_url:env.operationsFeedUrl,
  });
});

export default router;
