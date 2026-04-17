import React,{useState,useEffect} from "react";
import {useParams}   from "react-router-dom";
import {reportsApi}  from "../services/api.js";
import {useAuth}     from "../context/AuthContext.jsx";
import Avatar        from "../components/Avatar.jsx";
import PostCard      from "../components/PostCard.jsx";
import DetailDrawer  from "../components/DetailDrawer.jsx";
import "./ProfilePage.css";
export default function ProfilePage(){
  const {uid}=useParams();
  const {user:me,logout}=useAuth();
  const targetId=uid||me?.id;
  const isOwn=!uid||uid===me?.id;
  const [profile,setProfile]=useState(null);
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selectedId,setSelectedId]=useState(null);
  useEffect(()=>{
    if(!targetId)return;
    setLoading(true);
    reportsApi.getUserReports(targetId).then(r=>{setProfile(r.user);setPosts(r.data);}).catch(console.error).finally(()=>setLoading(false));
  },[targetId]);
  const score=profile?profile.verified_count*10+profile.total_upvotes*2+profile.report_count:0;
  return(
    <div className="pp">
      {loading?<div style={{display:"flex",justifyContent:"center",padding:52}}><div className="spinner"/></div>:profile?(
        <>
          <div className="pp-header">
            <Avatar user={profile} size={76}/>
            <div className="pp-info">
              <div className="pp-name-row"><h2 className="pp-username">@{profile.username}</h2>{profile.badge&&<span className="pp-badge">{profile.badge}</span>}</div>
              <div className="pp-score">{score} pts</div>
              <div className="pp-stats">
                <div className="ppstat"><span>{profile.report_count}</span><label>Reports</label></div>
                <div className="ppstat"><span>{profile.verified_count}</span><label>Verified</label></div>
                <div className="ppstat"><span>{profile.total_upvotes}</span><label>Upvotes</label></div>
              </div>
            </div>
          </div>
          {isOwn&&<div className="pp-actions"><button className="pp-logout" onClick={logout}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign Out</button></div>}
          <div className="pp-posts-hdr"><h3>Posts ({posts.length})</h3></div>
          {posts.length===0?<div className="pp-empty"><div style={{fontSize:44}}>📭</div><p>{isOwn?"Nothing posted yet.":"No reports yet."}</p></div>:posts.map(p=><PostCard key={p.id} report={p} onClick={setSelectedId}/>)}
        </>
      ):<div style={{textAlign:"center",padding:52,color:"var(--text3)"}}>User not found.</div>}
      {selectedId&&<DetailDrawer reportId={selectedId} onClose={()=>setSelectedId(null)}/>}
    </div>
  );
}
