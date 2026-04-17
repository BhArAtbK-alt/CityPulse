import React,{createContext,useContext,useEffect,useState} from "react";
import {io} from "socket.io-client";
const Ctx=createContext(null);
export function SocketProvider({children}){
  const [socket,setSocket]=useState(null);
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    // Empty string or nothing means "same origin"
    // Starting with polling is much more stable in Firefox
    const s=io({
      transports:["polling","websocket"],
      upgrade: true,
      reconnectionAttempts: 5
    });
    s.on("connect",()=>setConnected(true));
    s.on("disconnect",()=>setConnected(false));
    setSocket(s);
    return ()=>s.disconnect();
  },[]);
  return <Ctx.Provider value={{socket,connected}}>{children}</Ctx.Provider>;
}
export const useSocket=()=>useContext(Ctx);
