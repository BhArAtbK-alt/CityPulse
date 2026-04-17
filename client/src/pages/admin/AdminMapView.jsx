import React,{useState,useEffect,useCallback} from "react";
import {MapContainer,TileLayer,Polygon,Marker,Popup,useMap} from "react-leaflet";
import L from "leaflet";
import {adminApi} from "../../services/api.js";
import {getCat,getStatus,CATEGORIES,STATUSES} from "../../utils/constants.js";
import "./AdminDashboard.css";

const PRIORITY_COLORS={low:"#9a9a9a",normal:"#00c9a7",high:"#fbbf24",critical:"#ef4444"};

function createMarkerIcon(category,priority,status){
  const cat=getCat(category);
  const bg=status==="resolved"?"#34d399":PRIORITY_COLORS[priority]||"#ff5a1f";
  const html=`<div style="
    width:30px;height:30px;border-radius:50%;
    background:${bg};border:2.5px solid #fff;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.5);
  ">${cat.icon}</div>`;
  return L.divIcon({html,className:"",iconSize:[30,30],iconAnchor:[15,15]});
}

function FitBounds({geofence}){
  const map=useMap();
  useEffect(()=>{
    if(!geofence?.coordinates?.[0]) return;
    const latlngs=geofence.coordinates[0].map(([lng,lat])=>L.latLng(lat,lng));
    try{map.fitBounds(L.latLngBounds(latlngs),{padding:[40,40]});}catch{}
  },[geofence,map]);
  return null;
}

export default function AdminMapView(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({category:"all",status:"all",priority:"all"});
  const [selected,setSelected]=useState(null);
  const [showNeighbors,setShowNeighbors]=useState(true);
  const [updatingId,setUpdatingId]=useState(null);

  const load=useCallback(()=>{
    setLoading(true);
    adminApi.getMap(filters).then(r=>setData(r)).catch(console.error).finally(()=>setLoading(false));
  },[filters]);

  useEffect(()=>{load();},[load]);

  const updateStatus=async(id,status)=>{
    setUpdatingId(id);
    try{
      await adminApi.updateStatus(id, status);
      setData(d=>({...d,reports:d.reports.map(r=>r.id===id?{...r,status}:r)}));
      if(selected?.id===id) setSelected(s=>({...s,status}));
    }catch(e){alert(e.message);}
    finally{setUpdatingId(null);}
  };

  const myZoneCoords=data?.my_zone?.geofence?.coordinates?.[0]?.map(([lng,lat])=>[lat,lng]);

  const filteredReports=(data?.reports||[]).filter(r=>{
    if(filters.category!=="all"&&r.category!==filters.category) return false;
    if(filters.status!=="all"&&r.status!==filters.status) return false;
    if(filters.priority!=="all"&&r.priority!==filters.priority) return false;
    return true;
  });

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)",gap:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h1 className="adm-page-title" style={{margin:0}}>Zone Map</h1>
        <span style={{fontSize:12,color:"var(--text3)"}}>{filteredReports.length} report{filteredReports.length!==1?"s":""}</span>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <select className="adm-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>
        <select className="adm-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="adm-input" style={{width:"auto",marginBottom:0,padding:"6px 10px",fontSize:12}}
          value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))}>
          <option value="all">All Priorities</option>
          {["critical","high","normal","low"].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
        </select>
        <button
          onClick={()=>setShowNeighbors(v=>!v)}
          style={{padding:"6px 12px",background:showNeighbors?"var(--orange-dim)":"var(--bg3)",border:`1px solid ${showNeighbors?"rgba(255,90,31,.4)":"var(--border)"}`,borderRadius:8,fontSize:12,color:showNeighbors?"var(--orange)":"var(--text2)"}}>
          {showNeighbors?"Hide":"Show"} Neighbors
        </button>
      </div>

      <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid var(--border)",minHeight:400}}>
        {loading
          ? <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="spinner"/></div>
          : <MapContainer center={[20.5937,78.9629]} zoom={5} style={{height:"100%",width:"100%"}} zoomControl>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" subdomains="abcd" maxZoom={20}/>

              {/* My zone boundary */}
              {myZoneCoords && (
                <>
                  <FitBounds geofence={data.my_zone.geofence}/>
                  <Polygon
                    positions={myZoneCoords}
                    pathOptions={{color:"#ff5a1f",fillColor:"#ff5a1f",fillOpacity:.08,weight:2.5,dashArray:"8 4"}}
                  />
                </>
              )}

              {/* Neighboring zones */}
              {showNeighbors && (data?.neighboring_zones||[]).map((z,i)=>{
                const coords=z.geofence?.coordinates?.[0]?.map(([lng,lat])=>[lat,lng]);
                if(!coords) return null;
                return(
                  <Polygon key={i} positions={coords}
                    pathOptions={{color:"#9a9a9a",fillColor:"#9a9a9a",fillOpacity:.04,weight:1.5,dashArray:"4 4"}}
                  >
                    <Popup><div style={{color:"var(--text1)",fontSize:13,fontWeight:700}}>{z.area_name||"Neighboring Zone"}</div></Popup>
                  </Polygon>
                );
              })}

              {/* Report markers */}
              {filteredReports.map(r=>(
                <Marker key={r.id}
                  position={[r.latitude,r.longitude]}
                  icon={createMarkerIcon(r.category,r.priority,r.status)}
                  eventHandlers={{click:()=>setSelected(r)}}>
                  <Popup>
                    <div style={{minWidth:200,padding:"4px 0"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:12,color:getCat(r.category).color,fontWeight:700}}>{getCat(r.category).icon} {getCat(r.category).label}</span>
                        <span style={{marginLeft:"auto",fontSize:11,color:PRIORITY_COLORS[r.priority],fontWeight:700}}>{r.priority?.toUpperCase()}</span>
                      </div>
                      <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:"var(--text1)"}}>{r.title}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>by @{r.author?.username}</div>
                      <select
                        disabled={updatingId===r.id}
                        value={r.status}
                        onChange={e=>updateStatus(r.id,e.target.value)}
                        style={{width:"100%",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:6,padding:"5px 8px",color:getStatus(r.status).color,fontSize:12,fontWeight:700}}>
                        {["pending","verified","in_progress","resolved"].map(s=>(
                          <option key={s} value={s}>{getStatus(s).label}</option>
                        ))}
                      </select>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
        }
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:16,flexWrap:"wrap",paddingTop:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:14,height:3,background:"#ff5a1f",borderRadius:2}}/>
          <span style={{fontSize:11,color:"var(--text3)"}}>My Zone</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:14,height:3,background:"#9a9a9a",borderRadius:2}}/>
          <span style={{fontSize:11,color:"var(--text3)"}}>Neighbors</span>
        </div>
        {Object.entries(PRIORITY_COLORS).map(([k,v])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:v}}/>
            <span style={{fontSize:11,color:"var(--text3)",textTransform:"capitalize"}}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
