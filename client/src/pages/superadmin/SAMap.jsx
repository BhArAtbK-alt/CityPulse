import React,{useState,useEffect,useCallback} from "react";
import {MapContainer,TileLayer,Polygon,Marker,Popup,Tooltip} from "react-leaflet";
import L from "leaflet";
import {superAdminApi} from "../../services/api.js";
import {getCat,getStatus,CATEGORIES,STATUSES} from "../../utils/constants.js";
import "./SuperAdmin.css";

const PRIORITY_COLORS={low:"#9a9a9a",normal:"#00c9a7",high:"#fbbf24",critical:"#ef4444"};

function createMarkerIcon(category,priority,status,isOrphaned=false){
  const cat=getCat(category);
  const bg=status==="resolved"?"#34d399":PRIORITY_COLORS[priority]||"#ff5a1f";
  const animation = isOrphaned ? 'animation: sa-pulse 1.5s infinite;' : '';
  const html=`<div style="width:26px;height:26px;border-radius:50%;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.5);${animation}">${cat.icon}</div>`;
  return L.divIcon({html,className:"",iconSize:[26,26],iconAnchor:[13,13]});
}

export default function SAMap(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({category:"all",status:"all",priority:"all",area_id:"all"});
  const [selected,setSelected]=useState(null);
  const [hoveredZone,setHoveredZone]=useState(null);

  const load=useCallback(()=>{
    setLoading(true);
    superAdminApi.getMap(filters).then(r=>setData(r)).catch(console.error).finally(()=>setLoading(false));
  },[filters]);

  useEffect(()=>{load();},[load]);

  const zones=data?.zones||[];
  const reports=data?.reports||[];
  const zoneCounts=data?.zone_report_counts||{};

  // Build color list for zones (cycle if needed)
  const zoneColors=["#ff5a1f","#00c9a7","#fbbf24","#a78bfa","#60a5fa","#f87171","#34d399","#fb923c"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h1 className="sa-page-title" style={{margin:0}}>System Map</h1>
        <span style={{fontSize:12,color:"var(--text3)"}}>{reports.length} reports · {zones.length} zones</span>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <select className="sa-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>
        <select className="sa-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="sa-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))}>
          <option value="all">All Priorities</option>
          {["critical","high","normal","low"].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
        </select>
        <select className="sa-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.area_id} onChange={e=>setFilters(f=>({...f,area_id:e.target.value}))}>
          <option value="all">All Areas</option>
          {zones.filter(z=>z.id).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>

      <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid var(--border)",minHeight:400}}>
        {loading
          ? <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="spinner"/></div>
          : <MapContainer center={[20.5937,78.9629]} zoom={5} style={{height:"100%",width:"100%"}} zoomControl>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" subdomains="abcd" maxZoom={20}/>

              {/* Municipal zone boundaries */}
              {zones.map((z,i)=>{
                if(!z.geofence?.coordinates?.[0]) return null;
                let coords = [];
                try {
                  if (z.geofence.type === "MultiPolygon") {
                    coords = z.geofence.coordinates[0][0].map(([lng,lat])=>[lat,lng]);
                  } else {
                    coords = z.geofence.coordinates[0].map(([lng,lat])=>[lat,lng]);
                  }
                } catch(e) { return null; }
                
                const color=z.color||zoneColors[i%zoneColors.length];
                const isHovered=hoveredZone===i;
                return(
                  <Polygon key={i} positions={coords}
                    pathOptions={{color,fillColor:color,fillOpacity:isHovered?.18:.08,weight:isHovered?2.5:1.8,dashArray:z.status==="active"?"none":"6 4"}}
                    eventHandlers={{
                      mouseover:()=>setHoveredZone(i),
                      mouseout:()=>setHoveredZone(null),
                    }}>
                    <Tooltip sticky>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text1)"}}>{z.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>Code: {z.code}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>Reports: {zoneCounts[z.id]||0}</div>
                    </Tooltip>
                  </Polygon>
                );
              })}

              {/* Report markers */}
              {reports.map(r=>(
                <Marker key={r.id}
                  position={[r.latitude,r.longitude]}
                  icon={createMarkerIcon(r.category,r.priority,r.status, !r.area_id)}
                  eventHandlers={{click:()=>setSelected(r)}}>
                  <Popup>
                    <div style={{minWidth:190,padding:"4px 0"}}>
                      <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:getCat(r.category).color,fontWeight:700}}>{getCat(r.category).icon} {getCat(r.category).label}</span>
                        <span style={{fontSize:10,color:PRIORITY_COLORS[r.priority],fontWeight:700,textTransform:"uppercase"}}>{r.priority}</span>
                        <span style={{fontSize:10,color:getStatus(r.status).color,fontWeight:700}}>{getStatus(r.status).label}</span>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:"var(--text1)"}}>{r.title}</div>
                      {r.author&&<div style={{fontSize:11,color:"var(--text3)"}}>by @{r.author.username}</div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
        }
      </div>

      {/* Zone legend */}
      {zones.length>0&&(
        <div style={{display:"flex",gap:10,flexWrap:"wrap",paddingTop:10}}>
          {zones.slice(0,8).map((z,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:10,height:10,borderRadius:2,background:z.color||zoneColors[i%zoneColors.length]}}/>
              <span style={{fontSize:11,color:"var(--text3)"}}>{z.name} ({zoneCounts[z.id]||0})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
