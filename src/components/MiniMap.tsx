import React, { useMemo } from 'react';
import { VERTICAL_AVENUES_X, HORIZONTAL_AVENUES_Z } from '../game/cityEnvironment';
import { CITY_SHELTERS } from '../game/shelters';

interface MiniMapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  targetX?: number;
  targetZ?: number;
  isPickup?: boolean;
  showShelters?: boolean;
}

const MAP_SIZE = 120;
const MIN_X = -180;
const MAX_X = 460;
const MIN_Z = -210;
const MAX_Z = 210;
const clampMap = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
const toMapX = (x: number) =>
  ((clampMap(x, MIN_X, MAX_X) - MIN_X) / (MAX_X - MIN_X)) * MAP_SIZE;
const toMapZ = (z: number) =>
  ((clampMap(z, MIN_Z, MAX_Z) - MIN_Z) / (MAX_Z - MIN_Z)) * MAP_SIZE;

export const MiniMap: React.FC<MiniMapProps> = React.memo(({
  playerX,
  playerZ,
  playerHeading,
  targetX,
  targetZ,
  isPickup,
  showShelters,
}) => {
  const staticGrid = useMemo(() => {
    const coreVert = VERTICAL_AVENUES_X.filter(x => x >= -150 && x <= 440);
    const coreHoriz = HORIZONTAL_AVENUES_Z.filter(z => z >= -180 && z <= 180);

    return (
      <>
        <svg className="absolute inset-0 w-full h-full opacity-90">
          {/* Ocean Channel separating Main City and Nova Metrópole */}
          <rect
            x={toMapX(95)}
            y={0}
            width={toMapX(255) - toMapX(95)}
            height={MAP_SIZE}
            fill="#0369a1"
            opacity="0.65"
          />

          {/* Horizontal Avenues (split across the Ocean except the Z = -15 Bridge!) */}
          {coreHoriz.map((z, i) =>
            z === -15 ? (
              <g key={`h-bridge-${i}`}>
                <line
                  x1={0}
                  y1={toMapZ(z)}
                  x2={MAP_SIZE}
                  y2={toMapZ(z)}
                  stroke="#64748b"
                  strokeWidth="2"
                />
                {/* Highlighted Cable-Stayed Bridge Span */}
                <line
                  x1={toMapX(90)}
                  y1={toMapZ(z)}
                  x2={toMapX(260)}
                  y2={toMapZ(z)}
                  stroke="#00f3ff"
                  strokeWidth="3.5"
                />
              </g>
            ) : (
              <g key={`h-${i}`}>
                <line
                  x1={0}
                  y1={toMapZ(z)}
                  x2={toMapX(92)}
                  y2={toMapZ(z)}
                  stroke="#64748b"
                  strokeWidth="1.5"
                />
                <line
                  x1={toMapX(258)}
                  y1={toMapZ(z)}
                  x2={MAP_SIZE}
                  y2={toMapZ(z)}
                  stroke="#64748b"
                  strokeWidth="1.5"
                />
              </g>
            )
          )}

          {/* Vertical Avenues in Main City & Nova Metrópole */}
          {coreVert.map((x, i) => (
            <line
              key={`v-${i}`}
              x1={toMapX(x)}
              y1={0}
              x2={toMapX(x)}
              y2={MAP_SIZE}
              stroke={x >= 280 ? '#38bdf8' : '#64748b'}
              strokeWidth="1.6"
            />
          ))}

          {/* 3D Soccer Stadiums (Estádio Maracanã 3D & Arena Ilha de Cristal) */}
          <rect
            x={toMapX(-62)}
            y={toMapZ(150)}
            width={toMapX(-18) - toMapX(-62)}
            height={toMapZ(186) - toMapZ(150)}
            rx="3"
            fill="#16a34a"
            stroke="#fbbf24"
            strokeWidth="1.2"
          />
          <rect
            x={toMapX(328)}
            y={toMapZ(-186)}
            width={toMapX(372) - toMapX(328)}
            height={toMapZ(-150) - toMapZ(-186)}
            rx="3"
            fill="#16a34a"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
        </svg>
      </>
    );
  }, []);

  return (
    <div className="relative w-[120px] h-[120px] bg-slate-900/30 border border-slate-700/20 rounded-2xl overflow-hidden shadow-xl">
      <div className="absolute inset-0 bg-slate-950/40" />
      {staticGrid}

      {/* Target Marker */}
      {targetX !== undefined && targetZ !== undefined && (
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg z-10"
          style={{
            left: toMapX(targetX) - 6,
            top: toMapZ(targetZ) - 6,
            backgroundColor: isPickup ? '#f59e0b' : '#10b981',
          }}
        />
      )}

      {/* Severe Storm: Shelters Overlay */}
      {showShelters &&
        CITY_SHELTERS.map(s => (
          <div
            key={s.id}
            title={s.name}
            className="absolute w-2 h-2 rounded-sm bg-emerald-400 border border-white z-10 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse"
            style={{
              left: toMapX(s.x) - 4,
              top: toMapZ(s.z) - 4,
            }}
          />
        ))}

      {/* Player Marker */}
      <div
        className="absolute z-20"
        style={{
          left: toMapX(playerX),
          top: toMapZ(playerZ),
          transform: `translate(-50%, -50%) rotate(${(-playerHeading * 180) / Math.PI + 180}deg)`,
        }}
      >
        <div
          className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[10px] border-b-sky-400"
        />
      </div>
    </div>
  );
});

