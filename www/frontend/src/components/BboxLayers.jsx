import { useEffect, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import * as turf from '@turf/turf';
import MouseTracker from './MouseTracker';
import useBboxCache from '../hooks/useBboxCache';

// Hilfsfunktion: generiert rudimentären Feature-Fingerprint
function featureKey(f) {
  return JSON.stringify(f.geometry) + JSON.stringify(f.properties);
}

export default function BboxLayers({ showPlz, showWahl, wahlPath, setHoverInfo, setClickedFeatures }) {
  const map = useMap();
  const { fetchGeoJson } = useBboxCache();

  const [plzFeatures, setPlzFeatures] = useState([]);
  const [wahlFeatures, setWahlFeatures] = useState([]);

  const plzSeen = useRef(new Set());
  const wahlSeen = useRef(new Set());

  // 🧹 Lösche vorherige Wahlkreis-Daten beim Wechsel
  useEffect(() => {
    wahlSeen.current.clear();
    setWahlFeatures([]);
  }, [wahlPath]);

  const showPlzRef = useRef(showPlz);
  const showWahlRef = useRef(showWahl);

  useEffect(() => {
    showPlzRef.current = showPlz;
    showWahlRef.current = showWahl;
  }, [showPlz, showWahl]);

  const fetchByBbox = () => {
    const b = map.getBounds();
    const bboxArr = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const rounded = bboxArr.map(n => Math.round(n));
    const bbox = rounded.join(',');

    if (showPlzRef.current) {
      const key = `plz|${bbox}`;
      fetchGeoJson(key, `/api/plz_bbox?bbox=${bbox}`).then((geojson) => {
        const newFeatures = geojson.features.filter(f => {
          const hash = featureKey(f);
          if (plzSeen.current.has(hash)) return false;
          plzSeen.current.add(hash);
          return true;
        });
        setPlzFeatures(prev => [...prev, ...newFeatures]);
      });
    }

    if (showWahlRef.current) {
      const key = `wahl|${wahlPath}|${bbox}`;
      fetchGeoJson(key, `/api/wahl_bbox?path=${wahlPath}&bbox=${bbox}`).then((geojson) => {
        const newFeatures = geojson.features.filter(f => {
          const hash = featureKey(f);
          if (wahlSeen.current.has(hash)) return false;
          wahlSeen.current.add(hash);
          return true;
        });
        setWahlFeatures(prev => [...prev, ...newFeatures]);
      });
    }
  };

  useEffect(() => {
    if (!map) return;
    fetchByBbox(); // initial
    map.on('moveend', fetchByBbox);
    return () => map.off('moveend', fetchByBbox);
  }, [map, wahlPath]);

  useEffect(() => {
    if (!map) return;
    fetchByBbox(); // bei Checkbox-Wechsel
  }, [showPlz, showWahl]);

  return (
    <>
      {showPlz && plzFeatures.length > 0 && (
        <GeoJSON
          key={`plz-${plzFeatures.length}`}
          data={{ type: 'FeatureCollection', features: plzFeatures }}
          style={{ color: 'red', weight: 0.5, fillOpacity: 0.05 }}
        />
      )}
      {showWahl && wahlFeatures.length > 0 && (
        <GeoJSON
          key={`wahl-${wahlFeatures.length}`}
          data={{ type: 'FeatureCollection', features: wahlFeatures }}
          style={{ color: 'blue', weight: 1, fillOpacity: 0.2 }}
        />
      )}

      <MouseTracker
        plzFeatures={plzFeatures}
        wahlFeatures={wahlFeatures}
        setHoverInfo={setHoverInfo}
        setClickedFeatures={setClickedFeatures}
      />
    </>
  );
}
