export const CATEGORIES = [
  { value:"pothole",     label:"Pothole",     icon:"🕳️", color:"#f87171" },
  { value:"garbage",     label:"Garbage",     icon:"🗑️", color:"#a78bfa" },
  { value:"lighting",    label:"Lighting",    icon:"💡", color:"#fbbf24" },
  { value:"electricity", label:"Electricity", icon:"⚡", color:"#facc15" },
  { value:"water",       label:"Water",       icon:"💧", color:"#60a5fa" },
  { value:"sewage",      label:"Sewage",      icon:"🚰", color:"#34d399" },
  { value:"vandalism",   label:"Vandalism",   icon:"🎨", color:"#fb923c" },
  { value:"other",       label:"Other",       icon:"📌", color:"#94a3b8" },
];
export const STATUSES = [
  { value:"open",        label:"Open",        color:"#9a9a9a" },
  { value:"pending",     label:"Pending",     color:"#9a9a9a" },
  { value:"verified",    label:"Verified ✓",  color:"#00c9a7" },
  { value:"in_progress", label:"In Progress", color:"#fbbf24" },
  { value:"resolved",    label:"Resolved",    color:"#34d399" },
];
export const getCat    = v => CATEGORIES.find(c => c.value===v) || CATEGORIES.at(-1);
export const getStatus = v => STATUSES.find(s => s.value===v)   || STATUSES[0];
export const timeAgo   = d => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
};
