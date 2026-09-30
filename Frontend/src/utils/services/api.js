import { cacheGet,cacheSet,deleteQueued,enqueueMutation,listQueued,queueCount,updateQueued } from './offline.js';

const DEFAULT_API_BASE = import.meta.env.PROD
  ? 'https://polarops-api.pexxoraa.workers.dev/api'
  : '/api';
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
const TOKEN_KEY='polarops.session';
const normalizePath=(path)=>path.startsWith('/api/')?path.slice(4):(path==='/api'?'':path);

export const storedToken=()=>localStorage.getItem(TOKEN_KEY)||'';
export const setStoredToken=(token)=>localStorage.setItem(TOKEN_KEY,token);
export const clearStoredToken=()=>localStorage.removeItem(TOKEN_KEY);
export const getAuthToken=storedToken;
export function setAuthToken(token){if(token)setStoredToken(token);else clearStoredToken();}

async function parseResponse(response){
  const type=response.headers.get('content-type')||'';
  if(type.includes('application/json'))return response.json();
  return response.text();
}

async function direct(path,{method='GET',body,headers={},signal}={}){
  const token=storedToken();
  const response=await fetch(API_BASE+normalizePath(path),{
    method,
    headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...headers},
    body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),
    signal,
  });
  const payload=await parseResponse(response);
  if(!response.ok){
    const error=new Error(payload?.error||payload?.detail||('HTTP '+response.status));
    error.status=response.status;error.payload=payload;
    if(response.status===401){window.dispatchEvent(new Event('polarops:auth-expired'));window.dispatchEvent(new Event('polarops:unauthorized'));}
    throw error;
  }
  return payload;
}

export async function apiRequest(path,options={}){
  const method=(options.method||'GET').toUpperCase();
  const cacheKey='api:'+path;
  if(method==='GET'){
    try{
      const payload=await direct(path,{...options,method,signal:options.signal||AbortSignal.timeout(12000)});
      if(options.cache!==false)await cacheSet(cacheKey,payload);
      return payload;
    }catch(error){
      if(error.status)throw error;
      const cached=options.cache===false?undefined:await cacheGet(cacheKey);
      if(cached!==undefined)return cached;
      throw error;
    }
  }

  const queueable=options.queue!==false;
  const queuedBody=options.body===undefined?undefined:typeof options.body==='string'?options.body:JSON.stringify(options.body);
  if(queueable&&typeof navigator!=='undefined'&&!navigator.onLine){
    const id=await enqueueMutation({path,method,body:queuedBody,headers:options.headers||{}});
    window.dispatchEvent(new Event('polarops:queue-change'));
    return {queued:true,offline:true,queue_id:id};
  }
  try{
    const payload=await direct(path,{...options,method,signal:options.signal||AbortSignal.timeout(12000)});
    return payload;
  }catch(error){
    if(queueable&&!error.status){
      const id=await enqueueMutation({path,method,body:queuedBody,headers:options.headers||{}});
      window.dispatchEvent(new Event('polarops:queue-change'));
      return {queued:true,offline:true,queue_id:id};
    }
    throw error;
  }
}

export async function flushMutationQueue(){
  const rows=await listQueued();
  for(const item of rows){
    if(item.status==='CONFLICT'||item.status==='FAILED')continue;
    await updateQueued(item.id,{status:'SYNCING',attempts:(item.attempts||0)+1});
    try{
      await direct(item.path,{method:item.method,body:item.body,headers:item.headers});
      await deleteQueued(item.id);
    }catch(error){
      if(error.status===409)await updateQueued(item.id,{status:'CONFLICT',lastError:error.message});
      else if(error.status&&error.status<500)await updateQueued(item.id,{status:'FAILED',lastError:error.message});
      else await updateQueued(item.id,{status:'PENDING',lastError:error.message});
      if(error.status===401)break;
    }
  }
  window.dispatchEvent(new Event('polarops:queue-change'));
  return queueCount();
}

export async function downloadApi(path,filename){
  const token=storedToken();
  const response=await fetch(API_BASE+normalizePath(path),{headers:token?{authorization:'Bearer '+token}:{}});
  if(!response.ok)throw new Error('Download failed');
  const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url);
}

export const api={
  get:(path,options)=>apiRequest(path,{...options,method:'GET'}),
  post:(path,body,options)=>apiRequest(path,{...options,method:'POST',body}),
  patch:(path,body,options)=>apiRequest(path,{...options,method:'PATCH',body}),
  delete:(path,options)=>apiRequest(path,{...options,method:'DELETE'}),
  request:apiRequest,flushQueue:flushMutationQueue,queueCount,download:downloadApi,
};

export default api;
