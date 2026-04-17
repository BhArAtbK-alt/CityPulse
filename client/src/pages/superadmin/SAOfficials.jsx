import React,{useState,useEffect} from "react";
import {superAdminApi} from "../../services/api.js";
import {timeAgo} from "../../utils/constants.js";
import "./SuperAdmin.css";

export default function SAOfficials(){
  const [officials,setOfficials]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [confirmRole,setConfirmRole]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    superAdminApi.getOfficials().then(r=>setOfficials(r.data||[])).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const changeRole=async(id,role)=>{
    setSaving(true);
    try{
      await superAdminApi.updateUserRole(id,role);
      setOfficials(p=>p.map(o=>o.id===id?{...o,role}:o));
      setConfirmRole(null);
    }catch(e){alert(e.message);}finally{setSaving(false);}
  };

  const filtered=officials.filter(o=>
    !search||o.username?.toLowerCase().includes(search.toLowerCase())||o.area_name?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_STYLES={
    super_admin:{color:"var(--teal)",bg:"rgba(0,201,167,.12)",label:"Super Admin"},
    admin:      {color:"var(--orange)",bg:"rgba(255,90,31,.12)",label:"Municipal Admin"},
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="sa-page-title" style={{margin:0}}>Municipal Officials</h1>
        <span style={{fontSize:12,color:"var(--text3)"}}>{officials.length} officials</span>
      </div>

      <div style={{marginBottom:16}}>
        <input className="sa-input" style={{maxWidth:320,marginBottom:0}}
          placeholder="Search by name or area…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : filtered.length===0
          ? <div style={{textAlign:"center",padding:60,color:"var(--text3)"}}>No officials found.</div>
          : <div className="sa-card" style={{padding:0,overflow:"hidden"}}>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Official</th>
                  <th>Area</th>
                  <th>Role</th>
                  <th style={{textAlign:"right"}}>Reports in Zone</th>
                  <th style={{textAlign:"right"}}>Resolved</th>
                  <th style={{textAlign:"right"}}>Rate</th>
                  <th>SLA</th>
                  <th>Joined</th>
                  <th/>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o=>{
                  const rs=ROLE_STYLES[o.role]||{color:"var(--text3)",bg:"var(--bg3)",label:o.role};
                  return(
                    <tr key={o.id}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <div className="sa-avatar" style={{background:o.avatar_color||"var(--bg4)",color:"#fff"}}>
                            {o.username?.[0]?.toUpperCase()||"?"}
                          </div>
                          <div>
                            <div style={{fontWeight:700,fontSize:13}}>@{o.username}</div>
                            <div style={{fontSize:11,color:"var(--text3)"}}>{o.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{fontSize:13,fontWeight:600}}>
                          {o.area_name||<span style={{color:"var(--text3)"}}>No zone</span>}
                        </div>
                        {o.area_code&&<div style={{fontSize:10,color:"var(--text3)"}}>{o.area_code}</div>}
                      </td>
                      <td>
                        <span className="sa-badge" style={{background:rs.bg,color:rs.color}}>{rs.label}</span>
                      </td>
                      <td style={{textAlign:"right",fontWeight:700}}>{o.total_reports_in_zone}</td>
                      <td style={{textAlign:"right",fontWeight:700,color:"var(--teal)"}}>{o.resolved_reports_in_zone}</td>
                      <td style={{textAlign:"right"}}>
                        <span style={{
                          fontWeight:800,fontSize:13,
                          color:o.resolution_rate>=70?"var(--teal)":o.resolution_rate>=40?"#fbbf24":"var(--red)"
                        }}>{o.resolution_rate}%</span>
                      </td>
                      <td style={{fontSize:12,color:"var(--text3)"}}>{o.sla_hours}h</td>
                      <td style={{fontSize:11,color:"var(--text3)"}}>{timeAgo(o.created_at)}</td>
                      <td>
                        <button onClick={()=>setConfirmRole(o)}
                          style={{padding:"5px 10px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:7,fontSize:11,color:"var(--text2)"}}>
                          ⋯
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      }

      {/* Role change modal */}
      {confirmRole&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:20,padding:24,width:"100%",maxWidth:380}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:4}}>Manage @{confirmRole.username}</h3>
            <p style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>Area: {confirmRole.area_name||"No zone"}</p>
            <div className="sa-card-title" style={{marginBottom:8}}>Change Role</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {["user","admin","super_admin"].map(role=>(
                <button key={role}
                  disabled={confirmRole.role===role||saving}
                  onClick={()=>changeRole(confirmRole.id,role)}
                  style={{
                    padding:"10px 16px",textAlign:"left",
                    background:confirmRole.role===role?"var(--bg4)":"var(--bg3)",
                    border:`1px solid ${confirmRole.role===role?"var(--teal)":"var(--border)"}`,
                    borderRadius:10,fontSize:13,fontWeight:600,
                    color:confirmRole.role===role?"var(--teal)":"var(--text1)",
                    opacity:confirmRole.role===role?.7:1,
                  }}>
                  {role==="super_admin"?"⚡ Super Admin":role==="admin"?"🏛️ Municipal Admin":"👤 Citizen"}
                  {confirmRole.role===role&&" (current)"}
                </button>
              ))}
            </div>
            <button onClick={()=>setConfirmRole(null)}
              style={{marginTop:16,padding:"9px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,fontSize:13,color:"var(--text2)",width:"100%"}}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
