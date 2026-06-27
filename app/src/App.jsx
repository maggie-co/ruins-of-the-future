import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

export default function App() {
  const mapContainer = useRef(null);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'OpenStreetMap, CARTO',
          },
          buildings: {
            type: 'vector',
            url: 'pmtiles:///tiles/buildings.pmtiles',
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'buildings-existence',
            type: 'fill',
            source: 'buildings',
            'source-layer': 'buildings',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'yearBuilt'],
                1810, '#f4d35e',
                1880, '#ee964b',
                1920, '#e76f51',
                1960, '#9e4770',
                2000, '#3d348b',
                2026, '#1a1a40',
              ],
              'fill-opacity': 0.75,
            },
          },
        ],
      },
      center: [-90.22, 38.63],
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  return <div ref={mapContainer} style={{ position: 'fixed', inset: 0 }} />;
}
