import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

function MiniMap({ tilesUrl, sourceLayer, paintLayer, center, zoom }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

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
          buildings: {
            type: 'vector',
            url: tilesUrl,
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'buildings-layer',
            type: 'fill',
            source: 'buildings',
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

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0,
        transition: 'opacity 1.2s ease',
      }}
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          setTimeout(() => { if (el) el.style.opacity = '0.35'; }, 800);
        }
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
        .map-card {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 40px 48px;
          text-decoration: none;
          overflow: hidden;
          animation: cardRise 0.9s ease-out both;
        }
        .map-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(13,13,11,0.92) 0%, rgba(13,13,11,0.5) 45%, rgba(13,13,11,0.1) 100%);
          pointer-events: none;
        }
        .map-card-content { position: relative; zIndex: 2; }
        .card-arrow {
          opacity: 0;
          transition: transform 0.4s ease, opacity 0.4s ease;
          display: inline-block;
        }
        .map-card:hover .card-arrow { transform: translateX(4px); opacity: 1; }
        .existence-card { animation-delay: 0.3s; border-right: 1px solid rgba(244,234,213,0.08); }
        .persistence-card { animation-delay: 0.45s; }
      `}</style>

      <div className="grid-bg" />

      {/* Coordinates */}
      <div style={{
        position: 'absolute',
        bottom: 24, left: 24,
        fontSize: 10,
        letterSpacing: '0.12em',
        color: 'rgba(244,234,213,0.18)',
        fontFamily: 'monospace',
        zIndex: 10,
        lineHeight: 1.8,
      }}>
        38.6270° N<br />90.1994° W<br />ST. LOUIS, MO
      </div>

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
          St. Louis and Time
        </h1>

        <p style={{
          fontSize: 15,
          maxWidth: 560,
          color: 'rgba(240,232,216,0.5)',
          fontStyle: 'italic',
          fontWeight: 300,
          lineHeight: 1.6,
          margin: '16px 0 0',
        }}>
          98,838 buildings. Two ways of seeing them —
          as accumulated history, and as projected futures.
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

      {/* Cards */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        position: 'relative',
        zIndex: 2,
      }}>

        {/* Existence */}
        <Link to="/existence" className="map-card existence-card">
          {/* Live mini-map */}
          <MiniMap
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
            zoom={11}
          />

          {/* Gradient overlay so text reads over map */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(to right, #c97d35, transparent)',
            zIndex: 3,
          }} />

          <div className="map-card-content" style={{ position: 'relative', zIndex: 3 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#c97d35', marginBottom: 14,
            }}>I. Existence</div>
            <h2 style={{
              fontSize: 'clamp(20px, 2.4vw, 34px)',
              fontWeight: 400, color: '#f0e8d8',
              lineHeight: 1.15, margin: '0 0 12px',
              letterSpacing: '-0.01em',
            }}>
              When was every building<br />in St. Louis built?
            </h2>
            <p style={{
              fontSize: 12, color: 'rgba(240,232,216,0.45)',
              lineHeight: 1.7, margin: '0 0 18px',
              maxWidth: 320, fontStyle: 'italic',
            }}>
              98,838 parcels colored by construction date.
              The oldest buildings glow palest — 1810 to today,
              compressed into a single amber spectrum.
            </p>
            <div style={{
              fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(201,125,53,0.7)',
            }}>
              Enter <span className="card-arrow">→</span>
            </div>
          </div>
        </Link>

        {/* Persistence */}
        <Link to="/persistence" className="map-card persistence-card">
          <MiniMap
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
            zoom={11}
          />

          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(to right, #4a5aaa, transparent)',
            zIndex: 3,
          }} />

          <div className="map-card-content" style={{ position: 'relative', zIndex: 3 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#6a7acc', marginBottom: 14,
            }}>II. Persistence</div>
            <h2 style={{
              fontSize: 'clamp(20px, 2.4vw, 34px)',
              fontWeight: 400, color: '#f0e8d8',
              lineHeight: 1.15, margin: '0 0 12px',
              letterSpacing: '-0.01em',
            }}>
              Which buildings are most<br />likely to disappear?
            </h2>
            <p style={{
              fontSize: 12, color: 'rgba(240,232,216,0.45)',
              lineHeight: 1.7, margin: '0 0 18px',
              maxWidth: 320, fontStyle: 'italic',
            }}>
              A risk index derived from condemnation records,
              land bank ownership, demolition permits, and
              historic district protections.
            </p>
            <div style={{
              fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(106,122,204,0.7)',
            }}>
              Enter <span className="card-arrow">→</span>
            </div>
          </div>
        </Link>
      </main>
    </div>
  );
}
