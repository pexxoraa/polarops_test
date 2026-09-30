import { useCallback,useEffect,useState } from 'react';
import { api } from '../services/api.js';
import { useRealtime } from '../../context/RealtimeContext.jsx';

export function useApiData(path,enabled=true){
  const {revision}=useRealtime();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(Boolean(enabled&&path));
  const [error,setError]=useState('');

  const refresh=useCallback(async()=>{
    if(!enabled||!path)return null;
    setLoading(true);setError('');
    try{const result=await api.get(path);setData(result);return result;}
    catch(reason){setError(reason.message||'Request failed');throw reason;}
    finally{setLoading(false);}
  },[path,enabled]);

  useEffect(()=>{refresh().catch(()=>{});},[refresh,revision]);
  return {data,setData,loading,error,refresh};
}
