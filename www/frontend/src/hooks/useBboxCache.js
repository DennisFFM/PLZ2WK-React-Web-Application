import { useRef } from 'react';

export default function useBboxCache() {
  const cacheRef = useRef(new Map());

  const fetchGeoJson = async (key, url) => {
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key);
    }

    const res = await fetch(url);
    const json = await res.json();
    cacheRef.current.set(key, json);
    return json;
  };

  return { fetchGeoJson };
}