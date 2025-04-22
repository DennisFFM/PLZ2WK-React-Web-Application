import { useRef } from 'react';

export default function useBboxCache() {
  const cacheRef = useRef(new Map());

  const fetchGeoJson = async (key, url) => {
    if (cacheRef.current.has(key)) {
      console.log('📦 [CLIENT CACHE HIT]', key);
      return cacheRef.current.get(key);
    }

    const res = await fetch(url);
    const json = await res.json();
    cacheRef.current.set(key, json);
    console.log('📦 [CLIENT CACHE MISS]', key);
    return json;
  };

  return { fetchGeoJson };
}