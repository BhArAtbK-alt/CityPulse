import React,{useState,useEffect} from "react";
import {superAdminApi} from "../../services/api.js";
import GeofenceMap from "../../components/GeofenceMap.jsx";
import "./SuperAdmin.css";

const AREA_COLORS=["#ff5a1f","#00c9a7","#fbbf24","#a78bfa","#60a5fa","#f87171","#34d399","#fb923c","#e879f9","#2dd4bf"];

export default function SAAreas(){
  const [areas,setAreas]=useState([]);
  const [officials,setOfficials]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const [form,setForm]=useState({name:"",code:"",city:"",state:"",color:"#ff5a1f",admin_id:"",population:"",geofence:null});
  const [saving,setSaving]=useState(false);
  const [isMapValid, setIsMapValid] = useState(true);

  const load=()=>{
    setLoading(true);
    Promise.all([
      superAdminApi.getAreas(),
      superAdminApi.getOfficials(),
    ]).then(([a,o])=>{
      setAreas(a.data||[]);
      setOfficials((o.data||[]).filter(off=>off.role==="admin"||off.role==="super_admin"));
    }).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const openCreate=()=>{
    setForm({name:"",code:"",city:"",state:"",color:"#ff5a1f",admin_id:"",population:"",geofence:null});
    setEditTarget(null);
    setShowCreate(true);
    setIsMapValid(true);
  };
  const openEdit=a=>{
    setForm({name:a.name||"",code:a.code||"",city:a.city||"",state:a.state||"",color:a.color||"#ff5a1f",admin_id:a.admin_id||"",population:a.population||"",geofence:a.geofence});
    setEditTarget(a);
    setShowCreate(true);
    setIsMapValid(true);
  };

  const save=async()=>{
    if(!form.name.trim()||!form.code.trim()) return alert("Name and code are required.");
    if(!isMapValid) return alert("Please resolve territorial conflicts before saving.");
    setSaving(true);
    try{
      const payload={...form,population:form.population?parseInt(form.population):null,admin_id:form.admin_id||null};
      if(editTarget){
        const {data}=await superAdminApi.updateArea(editTarget.id,payload);
        setAreas(p=>p.map(a=>a.id===editTarget.id?{...a,...data}:a));
      }else{
        const {data}=await superAdminApi.createArea(payload);
        setAreas(p=>[data,...p]);
      }
      setShowCreate(false);
    }catch(e){alert(e.message);}finally{setSaving(false);}
  };

  const toggleActive=async(area)=>{
    try{
      await superAdminApi.updateArea(area.id,{is_active:!area.is_active});
      setAreas(p=>p.map(a=>a.id===area.id?{...a,is_active:!a.is_active}:a));
    }catch(e){alert(e.message);}
  };

  const confirmArea = async (areaId) => {
    if(!confirm("Confirm this Official for this area? This will sync their dashboard.")) return;
    try {
      await superAdminApi.confirmArea(areaId);
      load();
    } catch (e) { alert(e.message); }
  };

  const set=k=>v=>setForm(p=>({...p,[k]:v}));

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="sa-page-title" style={{margin:0}}>Municipal Areas</h1>
        <button className="sa-btn" onClick={openCreate} style={{padding:"8px 16px",fontSize:13}}>+ New Area</button>
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : areas.length===0
          ? <div className="sa-card" style={{textAlign:"center",padding:60,color:"var(--text3)"}}>
              No areas configured yet. Click <strong>New Area</strong> to create one.
            </div>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {areas.map(a=>(
              <div key={a.id||a.name} className="sa-card" style={{margin:0,borderLeft:`3px solid ${a.color||"#9a9a9a"}`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800}}>{a.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                      Code: <strong style={{color:"var(--text2)"}}>{a.code}</strong>
                      {a.city&&<> · {a.city}</>}
                      {a.state&&<>, {a.state}</>}
                    </div>
                  </div>
                  <span style={{
                    padding:"3px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                    background:a.is_active?"rgba(0,201,167,.12)":"var(--bg4)",
                    color:a.is_active?"var(--teal)":"var(--text3)"
                  }}>{a.is_active?"Active":"Inactive"}</span>
                </div>

                <div style={{fontSize:12,color:"var(--text2)",marginBottom:8}}>
                  {a.admin
                    ? <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:a.admin.avatar_color||"var(--bg4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>
                          {a.admin.username?.[0]?.toUpperCase()||"?"}
                        </div>
                        <span>@{a.admin.username}</span>
                      </div>
                    : a.requested_by 
                      ? <div style={{background:"rgba(251,191,36,.1)",padding:"8px 12px",borderRadius:10,border:"1px solid rgba(251,191,36,.2)"}}>
                          <div style={{fontSize:10,color:"#fbbf24",fontWeight:900,textTransform:"uppercase",marginBottom:4,letterSpacing:0.5}}>Pending Request</div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span style={{fontSize:11,color:"var(--text3)"}}>Admin ID: {a.requested_by.slice(0,8)}</span>
                            <button onClick={()=>confirmArea(a.id)} style={{background:"#fbbf24",color:"#000",border:"none",padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:800,cursor:"pointer"}}>Confirm Official</button>
                          </div>
                        </div>
                      : <span style={{color:"var(--text3)"}}>⚠️ No admin assigned</span>
                  }
                </div>

                <div style={{fontSize:12,color:"var(--text3)",marginBottom:12}}>
                  📋 {a.report_count||0} reports
                  {a.geofence&&<> · 🗺️ Zone drawn</>}
                  {a.legacy&&<> · <span style={{color:"#fbbf24"}}>Legacy</span></>}
                </div>

                {a.id&&!a.legacy&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>openEdit(a)}
                      style={{flex:1,padding:"7px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)"}}>
                      Edit
                    </button>
                    <button onClick={()=>toggleActive(a)}
                      style={{flex:1,padding:"7px",background:a.is_active?"var(--red-dim)":"rgba(0,201,167,.1)",border:`1px solid ${a.is_active?"rgba(239,68,68,.2)":"rgba(0,201,167,.2)"}`,borderRadius:8,fontSize:12,color:a.is_active?"var(--red)":"var(--teal)"}}>
                      {a.is_active?"Deactivate":"Activate"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
      }

      {/* Create/Edit Modal */}
      {showCreate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:600,maxHeight:"95vh",overflowY:"auto"}}>
            <h3 style={{fontSize:17,fontWeight:800,marginBottom:18}}>{editTarget?"Edit Area":"New Municipal Area"}</h3>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:10}}>
              <div>
                <div className="sa-card-title">Area Name *</div>
                <input className="sa-input" value={form.name} onChange={e=>set("name")(e.target.value)} placeholder="e.g. Nashik Zone A"/>
              </div>
              <div>
                <div className="sa-card-title">Area Code *</div>
                <input className="sa-input" value={form.code} onChange={e=>set("code")(e.target.value.toUpperCase())} placeholder="e.g. NSK-A"/>
              </div>
            </div>

            <div style={{marginBottom:18}}>
              <div className="sa-card-title">Boundary Jurisdiction *</div>
              <p style={{fontSize:11,color:"var(--text3)",marginTop:-8,marginBottom:10}}>Draw the polygon boundary for this municipal area.</p>
              <GeofenceMap 
                initialGeofence={form.geofence} 
                onSave={set("geofence")} 
                neighborZones={areas.filter(a => a.id !== editTarget?.id)} 
                color={form.color}
                height="320px"
                onValidationChange={setIsMapValid}
              />
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:4}}>
              <div>
                <div className="sa-card-title">City</div>
                <input className="sa-input" value={form.city} onChange={e=>set("city")(e.target.value)} placeholder="Nashik"/>
              </div>
              <div>
                <div className="sa-card-title">State</div>
                <input className="sa-input" value={form.state} onChange={e=>set("state")(e.target.value)} placeholder="Maharashtra"/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:4}}>
              <div>
                <div className="sa-card-title">Population</div>
                <input className="sa-input" type="number" value={form.population} onChange={e=>set("population")(e.target.value)} placeholder="Optional"/>
              </div>
              <div>
                <div className="sa-card-title">Assign Admin</div>
                <select className="sa-input" value={form.admin_id} onChange={e=>set("admin_id")(e.target.value)}>
                  <option value="">— Not assigned —</option>
                  {officials.map(o=><option key={o.id} value={o.id}>@{o.username} {o.area_name&&o.area_name!=="No zone"?`(${o.area_name})`:""}</option>)}
                </select>
              </div>
            </div>

            <div className="sa-card-title" style={{marginTop:10}}>Zone Color</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              {AREA_COLORS.map(c=>(
                <div key={c} onClick={()=>set("color")(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:form.color===c?"3px solid #fff":"3px solid transparent",
                    boxSizing:"border-box",flexShrink:0}}/>
              ))}
            </div>

            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button className="sa-btn" onClick={save} disabled={saving || !isMapValid}
                style={{flex:1,justifyContent:"center"}}>
                {saving?"Saving…":editTarget?"Save Changes":"Create Area"}
              </button>
              <button onClick={()=>setShowCreate(false)}
                style={{padding:"9px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,fontSize:13,color:"var(--text2)"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
