import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createApp } from '../app.js';
import { createDatabase, setDatabaseForTest } from '../config/database.js';
import { configureRealtime } from '../services/localRealtimeService.js';

async function startFixture() {
  const db=await createDatabase(':memory:');
  db.prepare('INSERT INTO organizations(id,name,country_code,operator_type,created_at) VALUES(99,?,?,?,?)')
    .run('Other Programme','ZZ','Research','2026-09-29T00:00:00Z');
  db.prepare('INSERT INTO expeditions(id,organization_id,name,region,status,created_at) VALUES(99,99,?,?,?,?)')
    .run('Other Expedition','Antarctic Region','Active','2026-09-29T00:00:00Z');
  setDatabaseForTest(db);
  const server=http.createServer(createApp());
  configureRealtime(server);
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  const base='http://127.0.0.1:'+address.port;
  return {db,server,base,port:address.port};
}

async function login(base,email,password){
  const response=await fetch(base+'/api/auth/login',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password}),
  });
  assert.equal(response.status,200);
  return response.json();
}

async function api(base,token,path,options={}){
  return fetch(base+path,{
    ...options,
    headers:{'content-type':'application/json',authorization:'Bearer '+token,...(options.headers||{})},
  });
}

async function connectRealtime(base, port, token, expeditionId) {
  const response = await api(
    base,
    token,
    '/api/realtime/ticket?expedition_id=' + expeditionId,
  );
  assert.equal(response.status, 200);
  const { ticket } = await response.json();
  const socket = new WebSocket(
    'ws://127.0.0.1:' + port + '/ws/expeditions/' + expeditionId +
      '?ticket=' + encodeURIComponent(ticket),
  );

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket auth timeout')), 3000);
    socket.on('open', () =>
      socket.send(JSON.stringify({ type: 'auth', token })),
    );
    socket.on('message', (data) => {
      if (JSON.parse(data.toString()).type === 'auth.ok') {
        clearTimeout(timer);
        resolve();
      }
    });
    socket.on('error', reject);
  });
  return socket;
}

function waitForRealtimeEvent(socket, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(type + ' timeout')), 3000);
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === type) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

test('HTTP auth, tenant isolation, CRUD, routes and search preserve core behavior', async (t)=>{
  const fixture=await startFixture();
  t.after(async()=>{
    await new Promise((resolve)=>fixture.server.close(resolve));
    fixture.db.close();
  });
  const commander=await login(fixture.base,'commander@polarops.local','PolarOps123!');
  const field=await login(fixture.base,'field@polarops.local','Field123!');

  let response=await api(fixture.base,commander.token,'/api/bootstrap');
  const bootstrap=await response.json();
  assert.equal(response.status,200);
  assert.equal(bootstrap.expeditions.length,2);
  assert.ok(bootstrap.expeditions.some((x)=>x.region.includes('Antarctic')));
  assert.ok(bootstrap.expeditions.some((x)=>x.region.includes('Arctic')));

  response=await api(fixture.base,field.token,'/api/vehicles',{
    method:'POST',body:JSON.stringify({expedition_id:1,code:'DENIED',name:'Denied Vehicle'}),
  });
  assert.equal(response.status,403);

  response=await api(fixture.base,commander.token,'/api/realtime/ticket?expedition_id=99');
  assert.equal(response.status,403);
  response=await api(fixture.base,commander.token,'/api/locations',{
    method:'POST',body:JSON.stringify({expedition_id:1,name:'Integration Test Camp',type:'Camp',latitude:-75.5,longitude:124.5}),
  });
  assert.equal(response.status,201);
  const location=await response.json();

  response=await api(fixture.base,commander.token,'/api/personnel',{
    method:'POST',body:JSON.stringify({expedition_id:1,name:'Integration Tester',role:'Field Engineer',team:'Test',location_id:location.id}),
  });
  assert.equal(response.status,201);
  const person=await response.json();

  response=await api(fixture.base,commander.token,'/api/vehicles',{
    method:'POST',body:JSON.stringify({expedition_id:1,code:'IT-V01',name:'Integration Rover',type:'Ground',location_id:location.id,fuel_percent:90,range_km:250}),
  });
  assert.equal(response.status,201);
  const vehicle=await response.json();

  response=await api(fixture.base,commander.token,'/api/incidents',{
    method:'POST',body:JSON.stringify({expedition_id:1,title:'Integration incident',type:'Weather',severity:'High',description:'Conditions are worsening'}),
  });
  assert.equal(response.status,201);
  const incident=await response.json();

  response=await api(fixture.base,commander.token,'/api/incidents/'+incident.id,{
    method:'PATCH',body:JSON.stringify({type:'Field Emergency',severity:'Critical',note:'Escalated after reassessment'}),
  });
  assert.equal(response.status,200);
  const updatedIncident=await response.json();
  assert.equal(updatedIncident.type,'Field Emergency');
  assert.equal(updatedIncident.severity,'Critical');

  response=await api(fixture.base,commander.token,'/api/incidents/'+incident.id);
  const incidentDetails=await response.json();
  assert.ok(incidentDetails.events.some((event)=>event.note==='Escalated after reassessment'));

  response=await api(fixture.base,commander.token,'/api/vehicles/'+vehicle.id+'/alerts',{
    method:'POST',body:JSON.stringify({issue_type:'Vehicle Breakdown',severity:'Critical',detail:'Engine stopped during traverse'}),
  });
  assert.equal(response.status,201);
  const vehicleAlert=await response.json();
  assert.equal(vehicleAlert.entity_type,'vehicle');
  assert.equal(vehicleAlert.entity_id,vehicle.id);
  assert.equal(vehicleAlert.status,'Open');

  response=await api(fixture.base,commander.token,'/api/vehicles/'+vehicle.id+'/alerts');
  assert.equal(response.status,200);
  assert.equal((await response.json()).items[0].id,vehicleAlert.id);

  response=await api(fixture.base,commander.token,'/api/vehicles?expedition_id=1');
  const vehicleRows=await response.json();
  const vehicleRow=vehicleRows.find((item)=>item.id===vehicle.id);
  assert.equal(vehicleRow.active_alert_count,1);
  assert.equal(vehicleRow.active_alert_cause,'Vehicle Breakdown');

  response=await api(fixture.base,commander.token,'/api/ops/alerts?expedition_id=1');
  const unifiedAlerts=await response.json();
  assert.ok(unifiedAlerts.items.some((item)=>item.id===vehicleAlert.id));

  response=await api(fixture.base,commander.token,'/api/vehicles/'+vehicle.id+'/alerts/'+vehicleAlert.id+'/resolve',{
    method:'PATCH',body:JSON.stringify({}),
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'Resolved');

  response=await api(fixture.base,commander.token,'/api/vehicles/'+vehicle.id+'/alerts');
  assert.equal((await response.json()).items[0].status,'Resolved');
  response=await api(fixture.base,commander.token,'/api/vehicles?expedition_id=1');
  assert.equal((await response.json()).find((item)=>item.id===vehicle.id).active_alert_count,0);

  response=await api(fixture.base,commander.token,'/api/ops/routes',{
    method:'POST',
    body:JSON.stringify({expedition_id:1,name:'Integration Traverse',start_lat:-75.5,start_lon:124.5,end_lat:-75.7,end_lon:125.1,vehicle_id:vehicle.id,personnel_id:person.id}),
  });
  assert.equal(response.status,201);
  const route=await response.json();
  assert.ok(route.distance_km>0);
  assert.ok(route.eta_minutes>0);
  assert.ok(route.fuel_liters>0);
  response=await api(fixture.base,commander.token,'/api/ops/search?expedition_id=1&q=Integration');
  assert.equal(response.status,200);
  const search=await response.json();
  assert.ok(search.items.some((x)=>x.kind==='personnel'&&x.id===person.id));
  assert.ok(search.items.some((x)=>x.kind==='route'&&x.id===route.id));

  response=await api(fixture.base,commander.token,'/api/ops/routes/'+route.id,{
    method:'PATCH',
    body:JSON.stringify({name:'Integration Traverse Updated',start_lat:-75.4,start_lon:124.2,end_lat:-75.8,end_lon:125.4}),
  });
  assert.equal(response.status,200);
  const updatedRoute=await response.json();
  assert.equal(updatedRoute.name,'Integration Traverse Updated');
  assert.equal(updatedRoute.start_lat,-75.4);
  assert.notEqual(updatedRoute.distance_km,route.distance_km);

  response=await api(fixture.base,commander.token,'/api/ops/routes/'+route.id,{
    method:'DELETE',
  });
  assert.equal(response.status,200);
  response=await api(fixture.base,commander.token,'/api/ops/routes?expedition_id=1');
  assert.ok(!(await response.json()).items.some((item)=>item.id===route.id));

  response=await fetch(fixture.base+'/api/public/arctic-research-stations');
  const arctic=await response.json();
  assert.equal(response.status,200);
  assert.equal(arctic.live,false);
  assert.ok(arctic.items.length>20);
  assert.ok(arctic.items.every((x)=>x.verification_status));

  response=await fetch(fixture.base+'/api/public/facilities');
  const antarctic=await response.json();
  assert.equal(response.status,200);
  assert.ok(antarctic.length>50);
  assert.ok(antarctic.every((x)=>x.live===false));
});
test('realtime websocket requires authorized ticket and session token', async (t)=>{
  const fixture=await startFixture();
  t.after(async()=>{
    await new Promise((resolve)=>fixture.server.close(resolve));
    fixture.db.close();
  });
  const commander=await login(fixture.base,'commander@polarops.local','PolarOps123!');
  const response=await api(fixture.base,commander.token,'/api/realtime/ticket?expedition_id=1');
  assert.equal(response.status,200);
  const {ticket}=await response.json();

  const message=await new Promise((resolve,reject)=>{
    const ws=new WebSocket('ws://127.0.0.1:'+fixture.port+'/ws/expeditions/1?ticket='+encodeURIComponent(ticket));
    const timer=setTimeout(()=>reject(new Error('WebSocket timeout')),3000);
    ws.on('open',()=>ws.send(JSON.stringify({type:'auth',token:commander.token})));
    ws.on('message',(data)=>{
      clearTimeout(timer);
      const parsed=JSON.parse(data.toString());
      ws.close();
      resolve(parsed);
    });
    ws.on('error',reject);
  });
  assert.equal(message.type,'auth.ok');
  assert.equal(message.expedition_id,1);
});

test('SOS creates a critical incident and broadcasts to expedition accounts', async (t) => {
  const fixture = await startFixture();
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.terminate());
    await new Promise((resolve) => fixture.server.close(resolve));
    fixture.db.close();
  });
  const commander = await login(
    fixture.base,
    'commander@polarops.local',
    'PolarOps123!',
  );
  const field = await login(
    fixture.base,
    'field@polarops.local',
    'Field123!',
  );
  const commanderSocket = await connectRealtime(
    fixture.base,
    fixture.port,
    commander.token,
    1,
  );
  sockets.push(commanderSocket);
  const fieldSocket = await connectRealtime(
    fixture.base,
    fixture.port,
    field.token,
    1,
  );
  sockets.push(fieldSocket);
  const emergencyEvents = Promise.all([
    waitForRealtimeEvent(commanderSocket, 'emergency.sos'),
    waitForRealtimeEvent(fieldSocket, 'emergency.sos'),
  ]);
  const response = await api(fixture.base, commander.token, '/api/incidents/sos', {
    method: 'POST',
    body: JSON.stringify({
      expedition_id: 1,
      latitude: -75.25,
      longitude: 123.5,
    }),
  });
  assert.equal(response.status, 201);
  const incident = await response.json();
  const [event, fieldEvent] = await emergencyEvents;

  assert.equal(incident.title, 'EMERGENCY');
  assert.equal(incident.severity, 'Critical');
  assert.equal(event.expedition_id, 1);
  assert.equal(event.data.message, 'EMERGENCY');
  assert.equal(event.data.incident_id, incident.id);
  assert.equal(event.data.initiated_by, 'Expedition Commander');
  assert.equal(event.data.latitude, -75.25);
  assert.equal(event.data.longitude, 123.5);
  assert.equal(fieldEvent.data.incident_id, incident.id);
});

test('cargo IDs, QR lookup and custody history remain linked', async (t) => {
  const fixture = await startFixture()
  t.after(async () => {
    await new Promise((resolve) => fixture.server.close(resolve))
    fixture.db.close()
  })

  const commander = await login(
    fixture.base,
    'commander@polarops.local',
    'PolarOps123!',
  )

  let response = await api(fixture.base, commander.token, '/api/locations', {
    method: 'POST',
    body: JSON.stringify({
      expedition_id: 1,
      name: 'Cargo QR Test Depot',
      type: 'Depot',
      latitude: -75.1,
      longitude: 123.2,
    }),
  })
  assert.equal(response.status, 201)
  const location = await response.json()

  response = await api(fixture.base, commander.token, '/api/cargo', {
    method: 'POST',
    body: JSON.stringify({
      expedition_id: 1,
      code: 'QR-IT-001',
      name: 'QR integration cargo',
      current_location_id: location.id,
      assigned_to: 'Depot Team',
    }),
  })
  assert.equal(response.status, 201)
  const cargo = await response.json()
  assert.equal(cargo.code, 'QR-IT-001')
  assert.equal(cargo.qr_value, 'POLAROPS:CARGO:1:QR-IT-001')

  response = await api(
    fixture.base,
    commander.token,
    '/api/cargo/lookup?expedition_id=1&value=' +
      encodeURIComponent(cargo.qr_value),
  )
  assert.equal(response.status, 200)
  const scanned = await response.json()
  assert.equal(scanned.id, cargo.id)

  response = await api(
    fixture.base,
    commander.token,
    '/api/cargo/' + cargo.id + '/custody',
    {
      method: 'POST',
      body: JSON.stringify({
        to_custodian: 'Field Team Bravo',
        location_id: location.id,
        status: 'In Transit',
        note: 'Transferred for field delivery',
      }),
    },
  )
  assert.equal(response.status, 200)
  const transferred = await response.json()
  assert.equal(transferred.assigned_to, 'Field Team Bravo')
  assert.equal(transferred.status, 'In Transit')

  response = await api(
    fixture.base,
    commander.token,
    '/api/cargo/' + cargo.id + '/events',
  )
  assert.equal(response.status, 200)
  const events = await response.json()
  const handoff = events.find((item) => item.custody_action === 'Handoff')
  assert.ok(handoff)
  assert.equal(handoff.from_custodian, 'Depot Team')
  assert.equal(handoff.to_custodian, 'Field Team Bravo')
  assert.equal(handoff.location_name, 'Cargo QR Test Depot')
})
