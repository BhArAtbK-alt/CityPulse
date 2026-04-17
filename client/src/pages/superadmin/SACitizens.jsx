import React,{useState,useEffect,useCallback} from "react";
import {superAdminApi} from "../../services/api.js";
import {timeAgo} from "../../utils/constants.js";
import "./SuperAdmin.css";

const BADGE_EMOJIS={pioneer:"🚀",champion:"🏆",hero:"🦸",guardian:"🛡️"};

export default function SACitizens(){
  const [citizens,setCitizens]=useState([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [params,setParams]=useState({search:"",sort:"newest",limit:40,offset:0});

  const load=useCallback(()=>{
    setLoading(true);
    superAdminApi.getCitizens(params).then(r=>{
      setCitizens(r.data||[]);
      setTotal(r.total||0);
    }).catch(console.error).finally(()=>setLoading(false));
  },[params]);

  useEffect(()=>{load();},[load]);

  const set=k=>v=>setParams(p=>({...p,[k]:v,offset:0}));

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h1 className="sa-page-title" style={{margin:0}}>Citizens</h1>
        <span style={{fontSize:12,color:"var(--text3)"}}>{total.toLocaleString()} registered</span>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <input className="sa-input" style={{width:220,marginBottom:0,padding:"7px 12px",fontSize:12}}
          placeholder="Search username…" value={params.search}
          onChange={e=>set("search")(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&load()}/>
        <select className="sa-input" style={{width:"auto",marginBottom:0,padding:"7px 10px",fontSize:12}}
          value={params.sort} onChange={e=>set("sort")(e.target.value)}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="reports">Most Reports</option>
          <option value="upvotes">Most Upvotes</option>
        </select>
      </div>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
        : citizens.length===0
          ? <div style={{textAlign:"center",padding:60,color:"var(--text3)"}}>No citizens found.</div>
          : <div className="sa-card" style={{padding:0,overflow:"auto"}}>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Citizen</th>
                  <th style={{textAlign:"right"}}>Reports</th>
                  <th style={{textAlign:"right"}}>Verified</th>
                  <th style={{textAlign:"right"}}>Upvotes</th>
                  <th>Badge</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {citizens.map(c=>(
                  <tr key={c.id}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div className="sa-avatar" style={{background:c.avatar_color||"var(--bg4)",color:"#fff"}}>
                          {c.username?.[0]?.toUpperCase()||"?"}
                        </div>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>@{c.username}</div>
                          <div style={{fontSize:11,color:"var(--text3)"}}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{textAlign:"right",fontWeight:700,color:"var(--orange)"}}>{c.report_count||0}</td>
                    <td style={{textAlign:"right",fontWeight:700,color:"var(--teal)"}}>{c.verified_count||0}</td>
                    <td style={{textAlign:"right",fontWeight:700,color:"var(--purple)"}}>{c.total_upvotes||0}</td>
                    <td>
                      {c.badge
                        ? <span style={{fontSize:16}} title={c.badge}>{BADGE_EMOJIS[c.badge]||"🏅"}</span>
                        : <span style={{color:"var(--text3)",fontSize:12}}>—</span>
                      }
                    </td>
                    <td style={{fontSize:11,color:"var(--text3)"}}>{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }

      {/* Pagination */}
      {total>params.limit&&(
        <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:16}}>
          <button
            disabled={params.offset===0}
            onClick={()=>setParams(p=>({...p,offset:Math.max(0,p.offset-p.limit)}))}
            className="sa-btn sa-btn-ghost" style={{padding:"7px 16px",fontSize:12}}>
            ← Previous
          </button>
          <span style={{fontSize:12,color:"var(--text3)",alignSelf:"center"}}>
            {params.offset+1}–{Math.min(params.offset+params.limit,total)} of {total}
          </span>
          <button
            disabled={params.offset+params.limit>=total}
            onClick={()=>setParams(p=>({...p,offset:p.offset+p.limit}))}
            className="sa-btn sa-btn-ghost" style={{padding:"7px 16px",fontSize:12}}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
