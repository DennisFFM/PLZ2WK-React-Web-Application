import { useMapEvent } from 'react-leaflet';
import * as turf from '@turf/turf';

export default function MouseTracker({ plzFeatures, wahlFeatures, setHoverInfo, setClickedFeatures }) {
  useMapEvent('mousemove', (e) => {
    const point = turf.point([e.latlng.lng, e.latlng.lat]);
    const match = {};

    const hitWahl = wahlFeatures.find(f => turf.booleanPointInPolygon(point, f));
    if (hitWahl) match.wahl = hitWahl.properties;

    const hitPlz = plzFeatures.find(f => turf.booleanPointInPolygon(point, f));
    if (hitPlz) match.plz = hitPlz.properties;

    setHoverInfo(Object.keys(match).length > 0 ? match : null);
  });

  useMapEvent('click', (e) => {
    const point = turf.point([e.latlng.lng, e.latlng.lat]);
    const found = [];

    wahlFeatures.forEach(f => {
      if (turf.booleanPointInPolygon(point, f)) {
        found.push({ layer: 'Wahlkreis', properties: f.properties });
      }
    });

    plzFeatures.forEach(f => {
      if (turf.booleanPointInPolygon(point, f)) {
        found.push({ layer: 'PLZ', properties: f.properties });
      }
    });

    setClickedFeatures(found);
  });

  return null;
}