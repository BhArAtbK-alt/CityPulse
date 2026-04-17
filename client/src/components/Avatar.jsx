import React from "react";
export default function Avatar({user,size=36}){
  const l=(user?.username||"?")[0].toUpperCase();
  const c=user?.avatar_color||"#ff5a1f";
  return <div style={{width:size,height:size,borderRadius:"50%",background:`${c}1e`,border:`2px solid ${c}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*.38),fontWeight:800,color:c,flexShrink:0,userSelect:"none"}}>{l}</div>;
}
