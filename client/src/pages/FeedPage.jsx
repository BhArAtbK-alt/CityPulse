import React,{useState,useEffect,useCallback} from "react";
import {reportsApi} from "../services/api.js";
import {useSocket}   from "../context/SocketContext.jsx";
import {CATEGORIES}  from "../utils/constants.js";
import PostCard      from "../components/PostCard.jsx";
import DetailDrawer  from "../components/DetailDrawer.jsx";
import "./FeedPage.css";
const LIMIT=15;
export default function FeedPage(){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [moreLoading,setMoreLoading]=useState(false);
  const [total,setTotal]=useState(0);
  const [offset,setOffset]=useState(0);
  const [newIds,setNewIds]=useState(new Set());
  const [newCount,setNewCount]=useState(0);
  const [filter,setFilter]=useState({category:"all",sort:"newest"});
  const [selectedId,setSelectedId]=useState(null);
  const [threshold,setThreshold]=useState(5);
  const {socket}=useSocket();

  useEffect(()=>{reportsApi.getSettings().then(r=>setThreshold(r.pin_threshold||5)).catch(()=>{});},[]);

  const load=useCallback(async(reset=false)=>{
    reset?setLoading(true):setMoreLoading(true);
    try{
      const res=await reportsApi.getFeed({...filter,limit:LIMIT,offset:reset?0:offset});
      setPosts(p=>reset?res.data:[...p,...res.data]);
      setTotal(res.total);
      setOffset(reset?LIMIT:offset+LIMIT);
    }catch(e){console.error(e);}
    finally{setLoading(false);setMoreLoading(false);}
  },[filter,offset]);

  useEffect(()=>{setOffset(0);load(true);},[filter]);

  useEffect(()=>{
    if(!socket)return;
    const h=r=>{setPosts(p=>[r,...p]);setNewIds(s=>new Set([...s,r.id]));setNewCount(c=>c+1);setTimeout(()=>setNewIds(s=>{const n=new Set(s);n.delete(r.id);return n;}),6000);};
    socket.on("new_report",h);
    return()=>socket.off("new_report",h);
  },[socket]);

  useEffect(()=>{
    if(!socket)return;
    const h=({reportId,...data})=>setPosts(p=>p.map(r=>r.id===reportId?{...r,...data}:r));
    socket.on("vote_update",h);
    const s=({pin_threshold})=>{if(pin_threshold)setThreshold(pin_threshold);};
    socket.on("settings_update",s);

    const d=id=>setPosts(p=>p.filter(r=>r.id!==id));
    socket.on("report_deleted",d);

    return()=>{
      socket.off("vote_update",h);
      socket.off("settings_update",s);
      socket.off("report_deleted",d);
    };
  },[socket]);

  return(
    <div className="fp">
      <div className="fp-filters">
        <div className="fp-scroll">
          {[{value:"newest",label:"🕐 New"},{value:"popular",label:"🔥 Hot"},{value:"oldest",label:"📅 Old"}].map(s=>(
            <button key={s.value} className={`fchip ${filter.sort===s.value?"active":""}`} onClick={()=>setFilter(p=>({...p,sort:s.value}))}>{s.label}</button>
          ))}
          <div className="fchip-sep"/>
          <button className={`fchip ${filter.category==="all"?"active":""}`} onClick={()=>setFilter(p=>({...p,category:"all"}))}>All</button>
          {CATEGORIES.map(c=>(
            <button key={c.value} className={`fchip ${filter.category===c.value?"active":""}`} style={{"--cc":c.color}} onClick={()=>setFilter(p=>({...p,category:c.value}))}>{c.icon} {c.label}</button>
          ))}
        </div>
      </div>
      {newCount>0&&<button className="fp-new-banner" onClick={()=>{setNewCount(0);window.scrollTo({top:0,behavior:"smooth"});}}><span className="fp-live-dot"/>{newCount} new report{newCount>1?"s":""} — tap to see</button>}
      {loading?(
        <div className="fp-skels">{[...Array(4)].map((_,i)=>(
          <div key={i} className="fp-skel">
            <div style={{display:"flex",gap:10,padding:"12px 14px"}}><div className="skeleton" style={{width:38,height:38,borderRadius:"50%",flexShrink:0}}/><div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}><div className="skeleton" style={{height:13,width:"45%"}}/><div className="skeleton" style={{height:11,width:"30%"}}/></div></div>
            <div className="skeleton" style={{height:220}}/>
            <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}><div className="skeleton" style={{height:15,width:"68%"}}/><div className="skeleton" style={{height:12,width:"88%"}}/></div>
          </div>
        ))}</div>
      ):posts.length===0?(
        <div className="fp-empty"><div style={{fontSize:52}}>📭</div><h3>No reports yet</h3><p>Be the first to report a civic issue!</p></div>
      ):(
        <>
          {posts.map(p=><PostCard key={p.id} report={p} isNew={newIds.has(p.id)} onClick={setSelectedId} threshold={threshold}/>)}
          {posts.length<total&&<button className="fp-more" onClick={()=>load(false)} disabled={moreLoading}>{moreLoading?<span className="spinner" style={{width:20,height:20,borderWidth:2}}/>:`Load more (${total-posts.length} remaining)`}</button>}
        </>
      )}
      {selectedId&&<DetailDrawer reportId={selectedId} onClose={()=>setSelectedId(null)} threshold={threshold}/>}
    </div>
  );
}
