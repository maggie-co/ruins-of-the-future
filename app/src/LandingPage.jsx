import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

// Register the pmtiles protocol once, guarded against double-registration on hot reload
if (!maplibregl._pmtilesRegistered) {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  maplibregl._pmtilesRegistered = true;
}

function MiniMap({ tilesUrl, sourceLayer, paintLayer, center, zoom }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sourceId = 'buildings_' + tilesUrl.replace(/[^a-z0-9]/gi, '_');

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
          [sourceId]: {
            type: 'vector',
            url: tilesUrl,
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'buildings-layer',
            type: 'fill',
            source: sourceId,
            'source-layer': sourceLayer,
            paint: paintLayer,
          },
        ],
      },
      center,
      zoom,
      interactive: false,
      attributionControl: false,
    });

    map.on('load', () => {
      map.jumpTo({ center, zoom });
  setTimeout(() => map.resize(), 50);
    });

    return () => { map.remove(); };
  }, []);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          setTimeout(() => { if (el) el.style.opacity = '0.45'; }, 800);
        }
      }}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0,
        transition: 'opacity 1.2s ease',
      }}
    />
  );
}

export default function LandingPage() {
  return (
    <div style={{
      height: '100vh',
      background: '#0d0d0b',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      animation: 'pageRise 1s ease-out',
    }}>
      <style>{`
        @keyframes pageRise {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes cardRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(244,234,213,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244,234,213,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        /* Map area — NOT clickable, purely visual */
        .map-visual {
          position: relative;
          display: block;
          overflow: hidden;
          animation: cardRise 0.9s ease-out both;
        }
        .existence-visual { animation-delay: 0.3s; border-right: 1px solid rgba(244,234,213,0.08); }
        .persistence-visual { animation-delay: 0.45s; }
        /* Banner row, one element split in two — the only click targets */
        .banner-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid rgba(244,234,213,0.12);
          background: rgba(13,13,11,0.96);
        }
        .banner-half {
          padding: 26px 36px 30px;
          text-decoration: none;
          display: block;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        .banner-half:first-child { border-right: 1px solid rgba(244,234,213,0.08); }
        .banner-half:hover { background: rgba(244,234,213,0.04); }
        .banner-half:hover .card-arrow { transform: translateX(4px); opacity: 1; }
        .card-arrow {
          opacity: 0;
          transition: transform 0.4s ease, opacity 0.4s ease;
          display: inline-block;
        }
      `}</style>

      <div className="grid-bg" />

      {/* Header */}
      <header style={{
        padding: '52px 64px 40px',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid rgba(244,234,213,0.08)',
      }}>
        <div style={{
          width: 32, height: 1,
          background: '#c97d35',
          marginBottom: 20,
        }} />

        <h1 style={{
          fontSize: 'clamp(36px, 5.5vw, 76px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: '#f0e8d8',
          margin: 0,
          fontVariationSettings: '"opsz" 144',
        }}>
          Existence and Persistence: St. Louis
        </h1>

        <p style={{
          fontSize: 15,
          maxWidth: '100%',
          color: 'rgba(240,232,216,0.5)',
          fontStyle: 'italic',
          fontWeight: 300,
          lineHeight: 1.6,
          margin: '16px 0 0',
        }}>
          This site tracks the past, present, and future of 98,838 buildings in St. Louis. The first map visualizes existing data on buildings' histories. The second speculates on the city's future, compiling construction dates, land bank ownership, condemnation status, and demolition permits into a persistence risk index.
          {' '}Data from the{' '}
          <a href="https://dynamic.stlouis-mo.gov/opendata/downloads.cfm" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            City of St. Louis Open Data Portal
          </a>
          , 2018 to 2026.
        </p>

        <p style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(240,232,216,0.28)',
          margin: '12px 0 0',
        }}>
          — Maggie Coleman
        </p>
      </header>

      {/* Map row — visual only, not clickable */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        position: 'relative',
        zIndex: 2,
        height: '42vh',
      }}>
        {/* Existence map */}
        <div className="map-visual existence-visual">
          <MiniMap
            key="existence-map"
            tilesUrl="pmtiles:///tiles/buildings.pmtiles"
            sourceLayer="buildings"
            paintLayer={{
              'fill-color': [
                'interpolate', ['linear'], ['get', 'yearBuilt'],
                1810, '#fffbda',
                1880, '#ffec9e',
                1920, '#ffbb70',
                1960, '#ed9455',
                2000, '#a85a2a',
                2026, '#4a2818',
              ],
              'fill-opacity': 0.9,
            }}
            center={[-90.22, 38.63]}
            zoom={12}
          />
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(to right, #c97d35, transparent)',
            zIndex: 3,
          }} />
        </div>

        {/* Persistence map */}
        <div className="map-visual persistence-visual">
          <MiniMap
            key="persistence-map"
            tilesUrl="pmtiles:///tiles/persistence.pmtiles"
            sourceLayer="buildings"
            paintLayer={{
              'fill-color': [
                'interpolate', ['linear'], ['to-number', ['get', 'riskScore']],
                0,   '#3a5a82',
                25,  '#4589a8',
                45,  '#52b3a0',
                60,  '#9fc857',
                72,  '#f0cf3f',
                85,  '#ea7e26',
                100, '#d8331f',
              ],
              'fill-opacity': 0.9,
            }}
            center={[-90.22, 38.63]}
            zoom={12}
          />
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(to right, #4a5aaa, transparent)',
            zIndex: 3,
          }} />
        </div>
      </main>

      {/* Banner row — the only two click targets */}
      <div className="banner-row" style={{ position: 'relative', zIndex: 2 }}>
        <Link to="/existence" className="banner-half">
          <h2 style={{
            fontSize: 'clamp(18px, 2vw, 28px)',
            fontWeight: 400, color: '#f0e8d8',
            lineHeight: 1.15, margin: '0 0 8px',
            fontStyle: 'italic',
            letterSpacing: '-0.01em',
          }}>
            I. Existence
          </h2>
          <p style={{
            fontSize: 12, color: 'rgba(240,232,216,0.45)',
            lineHeight: 1.7, margin: '0 0 14px',
            fontStyle: 'italic',
          }}>
            98,838 parcels colored by construction date.
            The oldest buildings glow palest — 1810 to today,
            compressed into a single amber spectrum.
          </p>
          <div style={{
            fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(201,125,53,0.85)',
          }}>
            Enter <span className="card-arrow">→</span>
          </div>
        </Link>

        <Link to="/persistence" className="banner-half">
          <h2 style={{
            fontSize: 'clamp(18px, 2vw, 28px)',
            fontWeight: 400, color: '#f0e8d8',
            lineHeight: 1.15, margin: '0 0 8px',
            fontStyle: 'italic',
            letterSpacing: '-0.01em',
          }}>
            II. Persistence
          </h2>
          <p style={{
            fontSize: 12, color: 'rgba(240,232,216,0.45)',
            lineHeight: 1.7, margin: '0 0 14px',
            fontStyle: 'italic',
          }}>
            A risk index derived from condemnation records,
            land bank ownership, demolition permits, and
            historic district protections.
          </p>
          <div style={{
            fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(106,122,204,0.85)',
          }}>
            Enter <span className="card-arrow">→</span>
          </div>
        </Link>
      </div>
    </div>
  );
}