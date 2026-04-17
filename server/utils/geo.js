const turf = require("@turf/turf");

/**
 * Checks if a coordinate point [lng, lat] is inside a GeoJSON polygon.
 */
function isPointInPolygon(point, polygon) {
  try {
    const pt = turf.point(point);
    const poly = turf.polygon([polygon]);
    return turf.booleanPointInPolygon(pt, poly);
  } catch (e) {
    console.error("[Geo Utility] Error checking point in polygon:", e.message);
    return false;
  }
}

/**
 * Ensures a GeoJSON object is a MultiPolygon.
 * Frontend might send a Polygon; PostGIS GEOMETRY(MultiPolygon) requires MultiPolygon.
 */
function ensureMultiPolygon(geojson) {
  if (!geojson) return null;
  if (geojson.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [geojson.coordinates]
    };
  }
  return geojson;
}

module.exports = { isPointInPolygon, ensureMultiPolygon };
