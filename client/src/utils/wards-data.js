// GeoJSON definitions for the MMR Wards (BMC, MBMC, VVMC)
// Coordinates matched with backend for precision.
export const MMR_WARD_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "BMC (Mumbai City)", code: "BMC", color: "#ff5a1f" },
      geometry: {
        type: "Polygon",
        coordinates: [[[72.77, 18.89], [72.98, 18.89], [72.98, 19.27], [72.77, 19.27], [72.77, 18.89]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "MBMC (Mira-Bhayander)", code: "MBMC", color: "#34d399" },
      geometry: {
        type: "Polygon",
        coordinates: [[[72.81, 19.27], [72.93, 19.27], [72.93, 19.33], [72.81, 19.33], [72.81, 19.27]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "VVMC (Vasai-Virar)", code: "VVMC", color: "#60a5fa" },
      geometry: {
        type: "Polygon",
        coordinates: [[[72.73, 19.33], [72.92, 19.33], [72.92, 19.55], [72.73, 19.55], [72.73, 19.33]]]
      }
    }
  ]
};
