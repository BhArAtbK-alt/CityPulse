import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, Polygon } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function DrawControl({ onSave, onConflict, initialGeofence, neighborZones = [], color = "#ff5a1f" }) {
  const map = useMap();
  const drawnRef = useRef(null);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnRef.current = drawnItems;

    const checkConflicts = (newGeo) => {
      if (!newGeo || !neighborZones || neighborZones.length === 0) {
        onConflict(null);
        return;
      }

      let conflictPoly = null;
      try {
        // Ensure we are working with a clean geometry object
        const poly1 = newGeo.type === "Feature" ? newGeo.geometry : newGeo;
        
        neighborZones.forEach(z => {
          if (!z.geofence) return;
          const poly2 = z.geofence.type === "Feature" ? z.geofence.geometry : z.geofence;
          
          try {
            const intersection = turf.intersect(turf.featureCollection([
              turf.feature(poly1),
              turf.feature(poly2)
            ]));

            if (intersection) {
              if (!conflictPoly) {
                conflictPoly = intersection;
              } else {
                conflictPoly = turf.union(turf.featureCollection([conflictPoly, intersection]));
              }
            }
          } catch (err) {
            console.warn("Intersection calculation failed for a zone:", err);
          }
        });
      } catch (e) { 
        console.error("Conflict check error:", e); 
      }
      
      onConflict(conflictPoly ? conflictPoly.geometry : null);
    };

    // Render initial geofence if it exists
    if (initialGeofence?.coordinates?.[0]) {
      try {
        let coords;
        if (initialGeofence.type === "MultiPolygon") {
          coords = initialGeofence.coordinates[0][0].map(([lng, lat]) => L.latLng(lat, lng));
        } else {
          coords = initialGeofence.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng));
        }
        const poly = L.polygon(coords, { color, fillColor: color, fillOpacity: 0.15, weight: 2.5 });
        drawnItems.addLayer(poly);
        map.fitBounds(poly.getBounds(), { padding: [40, 40] });
        checkConflicts(initialGeofence);
      } catch (e) {
        console.error("Error rendering initial geofence:", e);
      }
    }

    // Render neighbor zones as non-editable reference
    neighborZones.forEach((z) => {
      if (!z.geofence?.coordinates?.[0]) return;
      try {
        let coords;
        if (z.geofence.type === "MultiPolygon") {
          coords = z.geofence.coordinates[0][0].map(([lng, lat]) => L.latLng(lat, lng));
        } else {
          coords = z.geofence.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng));
        }
        const poly = L.polygon(coords, {
          color: "#9a9a9a",
          fillColor: "#9a9a9a",
          fillOpacity: 0.05,
          weight: 1.5,
          dashArray: "5 5",
          interactive: true,
        });
        const tooltip = L.tooltip({ permanent: false, direction: "center", className: "geofence-tooltip" })
          .setContent(`<div style="font-size:11px;font-weight:700;color:#fff;background:rgba(20,20,20,.9);padding:4px 10px;border-radius:8px;border:1px solid #444;">
            <strong>${z.area_name || z.name || "Neighbor"}</strong><br/>
            <span style="font-size:9px;opacity:0.8;">Admin: @${z.admin?.username || 'Unassigned'}</span>
          </div>`);
        poly.bindTooltip(tooltip);
        map.addLayer(poly);
      } catch (e) {
        console.error("Error rendering neighbor zone:", e);
      }
    });

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { shapeOptions: { color, fillColor: color, fillOpacity: 0.15, weight: 2.5 } },
        rectangle: { shapeOptions: { color, fillColor: color, fillOpacity: 0.15, weight: 2.5 } },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      const geo = e.layer.toGeoJSON().geometry;
      onSave(geo);
      checkConflicts(geo);
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      e.layers.eachLayer((layer) => {
        const geo = layer.toGeoJSON().geometry;
        onSave(geo);
        checkConflicts(geo);
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      onSave(null);
      onConflict(null);
    });

    return () => {
      map.removeLayer(drawnItems);
      map.removeControl(drawControl);
      map.off(L.Draw.Event.CREATED);
      map.off(L.Draw.Event.EDITED);
      map.off(L.Draw.Event.DELETED);
    };
  }, [map, initialGeofence, neighborZones, color, onSave, onConflict]);

  return null;
}

export default function GeofenceMap({ initialGeofence, onSave, neighborZones = [], color = "#ff5a1f", height = "400px", onValidationChange }) {
  const [conflictGeo, setConflictGeo] = useState(null);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!conflictGeo);
    }
  }, [conflictGeo, onValidationChange]);

  return (
    <div style={{ height, width: "100%", borderRadius: "12px", overflow: "hidden", border: "1.5px solid var(--border)", marginBottom: "16px", position: "relative" }}>
      <MapContainer center={[19.076, 72.8777]} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <DrawControl
          onSave={onSave}
          onConflict={setConflictGeo}
          initialGeofence={initialGeofence}
          neighborZones={neighborZones}
          color={color}
        />
        {conflictGeo && (
          <Polygon 
            positions={
              conflictGeo.type === "MultiPolygon" 
              ? conflictGeo.coordinates.map(poly => poly[0].map(([lng, lat]) => [lat, lng]))
              : conflictGeo.coordinates.map(([lng, lat]) => [lat, lng])
            }
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.5, weight: 3 }}
          />
        )}
      </MapContainer>
      
      {conflictGeo && (
        <div style={{
          position: "absolute", bottom: 12, left: 12, right: 12, zIndex: 1000,
          background: "rgba(239, 68, 68, 0.95)", color: "#fff", padding: "8px 12px",
          borderRadius: "8px", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)"
        }}>
          <span>🚫</span> TERRITORIAL CONFLICT: Boundary overlaps with an existing zone. Please adjust the red areas.
        </div>
      )}
    </div>
  );
}
