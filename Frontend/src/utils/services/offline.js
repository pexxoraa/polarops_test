const DB_NAME='polarops-react-offline';
const DB_VERSION=1;

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('cache'))db.createObjectStore('cache',{keyPath:'key'});
      if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id',autoIncrement:true});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function withStore(name,mode,work){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode),store=tx.objectStore(name);
    let result;
    try{result=work(store);}catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error);
  });
}

function requestValue(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function cacheSet(key,value){
  return withStore('cache','readwrite',(store)=>store.put({key,value,updatedAt:Date.now()}));
}

export async function cacheGet(key){
  const db=await openDb();
  const tx=db.transaction('cache','readonly');
  const row=await requestValue(tx.objectStore('cache').get(key));
  return row?.value;
}

export async function enqueueMutation(item){
  const db=await openDb();
  const tx=db.transaction('queue','readwrite');
  return requestValue(tx.objectStore('queue').add({
    ...item,status:'PENDING',attempts:0,createdAt:Date.now(),updatedAt:Date.now(),
  }));
}

export async function listQueued(){
  const db=await openDb();
  const tx=db.transaction('queue','readonly');
  return (await requestValue(tx.objectStore('queue').getAll())).sort((a,b)=>a.createdAt-b.createdAt);
}

export async function updateQueued(id,patch){
  const db=await openDb(),tx=db.transaction('queue','readwrite'),store=tx.objectStore('queue');
  const row=await requestValue(store.get(id));
  if(!row)return;
  await requestValue(store.put({...row,...patch,updatedAt:Date.now()}));
}

export async function deleteQueued(id){
  const db=await openDb();
  const tx=db.transaction('queue','readwrite');
  await requestValue(tx.objectStore('queue').delete(id));
}

export async function queueCount(){
  const db=await openDb();
  const tx=db.transaction('queue','readonly');
  return requestValue(tx.objectStore('queue').count());
}
