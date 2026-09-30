import { useCallback,useEffect,useState } from 'react';
import { api } from '../services/api.js';

export function useQueueStatus(){
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [count,setCount]=useState(0);
  const refresh=useCallback(()=>api.queueCount().then(setCount).catch(()=>{}),[]);

  useEffect(()=>{
    const onOnline=()=>{setOnline(true);api.flushQueue().then(setCount).catch(()=>refresh());};
    const onOffline=()=>setOnline(false);
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    window.addEventListener('polarops:queue-change',refresh);
    refresh();
    return()=>{
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
      window.removeEventListener('polarops:queue-change',refresh);
    };
  },[refresh]);

  return {online,count,flush:()=>api.flushQueue().then(setCount)};
}
