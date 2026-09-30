import { all, get, run } from '../config/database.js';
import { env } from '../config/env.js';

const RESOURCES = [
  { name:'SCAR Antarctic Digital Database', category:'topography', regions:['south'], url:'https://add.scar.org/', detail:'Antarctic mapping reference data.' },
  { name:'BAS Ice Logistics Portal', category:'ice operations', regions:['north','south'], url:'https://www.icelogistics.info/', detail:'Polar ice charts and imagery catalogue.' },
  { name:'NASA Worldview', category:'satellite imagery', regions:['north','south'], url:'https://worldview.earthdata.nasa.gov/', detail:'Near-real-time satellite imagery and scientific layers.' },
  { name:'NOAA/NSIDC Sea Ice Index', category:'sea ice', regions:['north','south'], url:'https://nsidc.org/data/seaice_index', detail:'Daily Arctic and Antarctic sea-ice products.' },
  { name:'Antarctic Treaty EIES', category:'operations', regions:['south'], url:'https://www.ats.aq/s/information.html', detail:'Official Antarctic Treaty operational information exchange.' },
  { name:'INTERACT Virtual Access', category:'Arctic observations', regions:['north'], url:'https://dataportal.eu-interact.org/', detail:'Arctic research-station data portal.' },
  { name:'Sustaining Arctic Observing Networks', category:'Arctic observing systems', regions:['north'], url:'https://arcticobserving.org/services', detail:'Arctic observation inventories and registries.' },
];

export function polarRegion(expedition, locations=[]) {
  const region=String(expedition?.region||'').toLowerCase();
  if(region.includes('antarctic')||region.includes('south'))return 'south';
  if(region.includes('arctic')||region.includes('north'))return 'north';
  const mapped=locations.find((x)=>Number.isFinite(Number(x.latitude))&&Math.abs(Number(x.latitude))>=60);
  return mapped&&Number(mapped.latitude)>0?'north':'south';
}

export function primaryLocation(locations=[]) {
  const mapped=locations.filter((x)=>x.latitude!==null&&x.longitude!==null);
  for(const term of ['base','station','hub','camp']){
    const hit=mapped.find((x)=>(String(x.name)+' '+String(x.type)).toLowerCase().includes(term));
    if(hit)return hit;
  }
  return mapped[0]||null;
}

async function fetchWeather(base) {
  if(!base)return null;
  const url=new URL(env.weatherApiUrl);
  url.searchParams.set('latitude',String(base.latitude));
  url.searchParams.set('longitude',String(base.longitude));
  url.searchParams.set('current','temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,snowfall,weather_code');
  url.searchParams.set('timezone','UTC');
  const response=await fetch(url,{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error('Weather provider HTTP '+response.status);
  const payload=await response.json();
  return {location:base.name,latitude:base.latitude,longitude:base.longitude,current:payload.current||null,
    units:payload.current_units||{},source:'Open-Meteo',source_url:'https://open-meteo.com/',fetched_at:new Date().toISOString()};
}

async function cachedWeather(base,force=false) {
  if(!base)return null;
  const key='env:weather:'+Number(base.latitude).toFixed(4)+':'+Number(base.longitude).toFixed(4);
  const cached=await get('SELECT * FROM external_cache WHERE cache_key=?',key);
  if(!force&&cached&&Date.now()-Date.parse(cached.fetched_at)<600000){
    try{return JSON.parse(cached.payload_json);}catch{}
  }
  const payload=await fetchWeather(base);
  await run('INSERT INTO external_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,fetched_at=excluded.fetched_at',
    key,JSON.stringify(payload),new Date().toISOString());
  return payload;
}

export async function environmentOverview(expedition,force=false) {
  const locations=await all('SELECT * FROM locations WHERE expedition_id=? ORDER BY id',expedition.id);
  const pole=polarRegion(expedition,locations),base=primaryLocation(locations);
  const errors={};let weather=null;
  try{weather=await cachedWeather(base,force);}catch(error){errors.weather=error.message;}
  return {expedition,pole,primary_location:base,generated_at:new Date().toISOString(),
    data:{weather,sea_ice:null,space_weather:null,earthquakes:null},
    errors,resources:RESOURCES.filter((x)=>x.regions.includes(pole)),
    note:'Only weather is fetched live in local development. Sea-ice, space-weather and earthquake links remain source references unless separately integrated.'};
}
