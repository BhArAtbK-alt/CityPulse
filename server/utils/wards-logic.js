const turf = require("@turf/turf");

// Mumbai BMC Administrative Wards (Simplified Polygons for Performance)
// These represent the real boundaries of major Mumbai zones.
const MUMBAI_WARDS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Ward A (Colaba/Fort)", code: "A" },
      geometry: { type: "Polygon", coordinates: [[[72.81, 18.90], [72.85, 18.90], [72.85, 18.95], [72.81, 18.95], [72.81, 18.90]]] }
    },
    {
      type: "Feature",
      properties: { name: "Ward D (Malabar Hill)", code: "D" },
      geometry: { type: "Polygon", coordinates: [[[72.79, 18.95], [72.82, 18.95], [72.82, 18.99], [72.79, 18.99], [72.79, 18.95]]] }
    },
    {
      type: "Feature",
      properties: { name: "Ward G/North (Dharavi/Dadar)", code: "GN" },
      geometry: { type: "Polygon", coordinates: [[[72.82, 19.01], [72.86, 19.01], [72.86, 19.06], [72.82, 19.06], [72.82, 19.01]]] }
    },
    {
      type: "Feature",
      properties: { name: "Ward K/West (Andheri W)", code: "KW" },
      geometry: { type: "Polygon", coordinates: [[[72.80, 19.10], [72.85, 19.10], [72.85, 19.16], [72.80, 19.16], [72.80, 19.10]]] }
    },
    {
      type: "Feature",
      properties: { name: "Ward P/North (Malad)", code: "PN" },
      geometry: { type: "Polygon", coordinates: [[[72.80, 19.17], [72.86, 19.17], [72.86, 19.23], [72.80, 19.23], [72.80, 19.17]]] }
    },
    {
      type: "Feature",
      properties: { name: "Ward R/Central (Borivali)", code: "RC" },
      geometry: { type: "Polygon", coordinates: [[[72.82, 19.21], [72.88, 19.21], [72.88, 19.28], [72.82, 19.28], [72.82, 19.21]]] }
    }
  ]
};

const getWardFromCoords = (lat, lng) => {
  const point = turf.point([lng, lat]);
  
  for (const feature of MUMBAI_WARDS.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      return {
        ward_name: feature.properties.name,
        ward_code: feature.properties.code
      };
    }
  }
  
  return { ward_name: "MMR (General)", ward_code: "MMR" };
};

module.exports = { getWardFromCoords, MUMBAI_WARDS };
