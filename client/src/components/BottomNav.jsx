import React from "react";
import {NavLink} from "react-router-dom";
import "./BottomNav.css";
const HomeIco  =({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill={a?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const MapIco   =({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const TrophyIco=({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill={a?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 4H17l-1 7a5 5 0 01-10 0L7 4z"/><path d="M5 9H3a2 2 0 000 4h2"/><path d="M19 9h2a2 2 0 010 4h-2"/></svg>;
const UserIco  =({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill={a?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
export default function BottomNav({onCreateClick}){
  return(
    <nav className="bnav">
      <NavLink to="/" end className={({isActive})=>`bnav-item ${isActive?"active":""}`}>{({isActive})=><><HomeIco a={isActive}/><span>Feed</span></>}</NavLink>
      <NavLink to="/map" className={({isActive})=>`bnav-item ${isActive?"active":""}`}>{({isActive})=><><MapIco a={isActive}/><span>Map</span></>}</NavLink>
      <button className="bnav-create" onClick={onCreateClick}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
      <NavLink to="/leaderboard" className={({isActive})=>`bnav-item ${isActive?"active":""}`}>{({isActive})=><><TrophyIco a={isActive}/><span>Ranks</span></>}</NavLink>
      <NavLink to="/profile" className={({isActive})=>`bnav-item ${isActive?"active":""}`}>{({isActive})=><><UserIco a={isActive}/><span>Me</span></>}</NavLink>
    </nav>
  );
}
