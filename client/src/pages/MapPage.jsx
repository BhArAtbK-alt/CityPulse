import React,{useState,useEffect,useMemo} from "react";
import {MapContainer,TileLayer,Marker,Popup,useMap,Polygon} from "react-leaflet";
import L from "leaflet";
import * as h3 from "h3-js";
import {reportsApi} from "../services/api.js";
import {useSocket}   from "../context/SocketContext.jsx";
import {CATEGORIES, getCat,timeAgo} from "../utils/constants.js";
import DetailDrawer  from "../components/DetailDrawer.jsx";
import "./MapPage.css";

// Standard Leaflet Icon Fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

function makeIcon(cat){
  const c=getCat(cat);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46"><defs><filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${c.color}" flood-opacity=".45"/></filter></defs><path d="M19 2C11.27 2 5 8.27 5 16c0 10.25 14 28 14 28S33 26.25 33 16C33 8.27 26.73 2 19 2z" fill="${c.color}" filter="url(#ds)" stroke="rgba(255,255,255,.2)" stroke-width="1"/><circle cx="19" cy="16" r="9" fill="rgba(0,0,0,.22)"/><text x="19" y="21" text-anchor="middle" font-size="13">${c.icon}</text></svg>`;
  return L.divIcon({html:svg,className:"custom-marker",iconSize:[38,46],iconAnchor:[19,46],popupAnchor:[0,-46]});
}

function MapController({flyTo, setZoom}){
  const map=useMap();
  useEffect(()=>{
    if(flyTo) map.flyTo(flyTo, 15, {duration: 1.5});
  },[flyTo, map]);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map, setZoom]);

  return null;
}

export default function MapPage(){
  const [pins,setPins]=useState([]);
  const [loading,setLoading]=useState(true);
  const [flyTo,setFlyTo]=useState(null);
  const [zoom, setZoom]=useState(11);
  const [selectedId,setSelectedId]=useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const {socket}=useSocket();

  useEffect(()=>{
    reportsApi.getMap().then(r=>setPins(r.data)).catch(console.error).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    if(!socket)return;
    
    // 1. New reports
    const onNew=r=>{if(r.pinned_to_map)setPins(p=>[r,...p]);};
    socket.on("new_report",onNew);

    // 2. Vote updates (to show/hide pins when they cross threshold)
    const onVote=({reportId, pinned_to_map, report, ...data})=>{
      setPins(prev => {
        const exists = prev.some(p => p.id === reportId);
        if (pinned_to_map) {
          if (exists) {
            return prev.map(p => p.id === reportId ? {...p, ...data, pinned_to_map: true} : p);
          } else if (report) {
            // Add the new pin to the map
            return [...prev, report];
          }
          return prev;
        } else {
          // If unpinned, remove it
          return prev.filter(p => p.id !== reportId);
        }
      });
    };
    socket.on("vote_update", onVote);

    // 3. Status updates (Admin actions)
    const onStatus=({reportId, status, pinned_to_map, report}) => {
      setPins(prev => {
        const exists = prev.some(p => p.id === reportId);
        if (pinned_to_map) {
          if (exists) {
            return prev.map(p => p.id === reportId ? {...p, status} : p);
          } else if (report) {
            return [...prev, report];
          }
          return prev;
        } else {
          return prev.filter(p => p.id !== reportId);
        }
      });
    };
    socket.on("status_update", onStatus);

    return()=>{
      socket.off("new_report",onNew);
      socket.off("vote_update", onVote);
      socket.off("status_update", onStatus);
    };
  },[socket]);

  // Defensive filtering: Only use pins that have valid coordinates
  const validPins = useMemo(() => {
    return pins.filter(p => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude));
  }, [pins]);

  // Filter pins based on selected category
  const filteredPins = useMemo(() => {
    return validPins.filter(p => activeCategory === "all" || p.category === activeCategory);
  }, [validPins, activeCategory]);

  // Generate Hexagons (Uber H3) based on filtered pins
  const hexagons = useMemo(() => {
    const res = 9;
    const hexMap = {};
    filteredPins.forEach(p => {
      const h = h3.latLngToCell(p.latitude, p.longitude, res);
      if (!hexMap[h]) {
        hexMap[h] = { 
          id: h, 
          count: 0, 
          center: h3.cellToLatLng(h),
          boundary: h3.cellToBoundary(h).map(([lat, lng]) => [lat, lng]) 
        };
      }
      hexMap[h].count++;
    });
    return Object.values(hexMap);
  }, [filteredPins]);

  const showPins = zoom > 13;

  return(
    <div className="mp">
      <div className="mp-bar">
        <div className="mp-view-tag">
          {showPins ? "📍 Individual Reports" : "⬢ Neighborhood Clusters"}
        </div>
        <div className="mp-filters">
          <button 
            className={`mp-fchip ${activeCategory === "all" ? "active" : ""}`} 
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button 
              key={c.value} 
              className={`mp-fchip ${activeCategory === c.value ? "active" : ""}`}
              style={{"--cc": c.color}}
              onClick={() => setActiveCategory(c.value)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <span className="mp-count">📍 {filteredPins.length} Issues</span>
      </div>
      
      <div className="mp-wrap">
        {loading&&<div className="mp-loading"><div className="spinner"/><span>Loading Smart Map…</span></div>}
        <MapContainer 
          center={[19.12, 72.88]} 
          zoom={11} 
          minZoom={9}
          maxZoom={19}
          className="mp-leaflet" 
          zoomControl
        >
          {/* Using standard OSM with maxZoom protection */}
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            attribution="&copy; OpenStreetMap"
            maxZoom={19}
          />

          <MapController flyTo={flyTo} setZoom={setZoom} />

          {/* HEXAGON LAYER */}
          {!showPins && hexagons.map(h => (
            <Polygon 
              key={h.id} 
              positions={h.boundary} 
              pathOptions={{
                fillColor: h.count > 10 ? "#ff5a1f" : h.count > 5 ? "#fbbf24" : "#00c9a7",
                fillOpacity: 0.5,
                color: "white",
                weight: 1
              }}
              eventHandlers={{ click: () => { setFlyTo(h.center); } }}
            >
              <Popup>
                <div className="hex-popup">
                  <strong>{h.count} Issues</strong>
                  <p>Zoom in to view details.</p>
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* PIN LAYER - Defensive rendering */}
          {showPins && filteredPins.map(pin=>(
            <Marker 
              key={pin.id} 
              position={[pin.latitude, pin.longitude]} 
              icon={makeIcon(pin.category)} 
              eventHandlers={{click:()=>setSelectedId(pin.id)}}
            >
              <Popup>
                <div className="mp-popup">
                  <div className="mp-popup-cat" style={{color:getCat(pin.category).color}}>{getCat(pin.category).icon} {getCat(pin.category).label}</div>
                  <p className="mp-popup-title">{pin.title}</p>
                  <button className="mp-popup-btn" onClick={()=>setSelectedId(pin.id)}>View Details →</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {selectedId&&<DetailDrawer reportId={selectedId} onClose={()=>setSelectedId(null)}/>}
    </div>
  );
}
