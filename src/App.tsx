import { useState, useEffect, useRef } from 'react'
import { Coins, Package, AlertTriangle, CheckCircle2, Truck } from 'lucide-react'
import './index.css'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type DeliveryStatus = 'idle' | 'delivering' | 'done' | 'raided'

interface Courier {
  id: string
  name: string
  capacity: number
  speed: number      // delivery duration in ms
  raidChance: number // 0–1
  emoji: string
  reward: number
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const COURIERS: Courier[] = [
  {
    id: 'slime',
    name: 'スライム配送員',
    capacity: 10,
    speed: 5000,
    raidChance: 0.05,
    emoji: '🟢',
    reward: 100,
  },
]

const DELIVERY_DURATION = 5000 // ms

// ────────────────────────────────────────────────────────────
// Pixel-art tile helpers
// ────────────────────────────────────────────────────────────
function GrassTile({ x, y }: { x: number; y: number }) {
  const shade = ((x * 7 + y * 13) % 3)
  const colors = ['#4a7c59', '#3d6b4a', '#56885e']
  return (
    <rect
      x={x * 16}
      y={y * 16}
      width={16}
      height={16}
      fill={colors[shade]}
    />
  )
}

function MapBackground({ width, height }: { width: number; height: number }) {
  const cols = Math.ceil(width / 16)
  const rows = Math.ceil(height / 16)
  const riverCols = new Set([7, 8])

  return (
    <g>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          if (riverCols.has(col)) {
            const wShade = (row % 2 === 0) ? '#4ab3c8' : '#3aa3b8'
            return <rect key={`w-${col}-${row}`} x={col * 16} y={row * 16} width={16} height={16} fill={wShade} />
          }
          return <GrassTile key={`g-${col}-${row}`} x={col} y={row} />
        })
      )}
      {/* Scattered trees */}
      {[[1,2],[3,5],[11,1],[13,4],[2,8],[12,7],[4,3]].map(([tc, tr], i) => (
        <g key={`tree-${i}`} transform={`translate(${tc! * 16}, ${tr! * 16})`}>
          <rect x={6} y={8} width={4} height={6} fill="#8B6914" />
          <polygon points="8,0 2,10 14,10" fill="#2d6e2d" />
          <polygon points="8,2 1,12 15,12" fill="#3a8c3a" />
        </g>
      ))}
    </g>
  )
}

// ────────────────────────────────────────────────────────────
// Sprite components
// ────────────────────────────────────────────────────────────
function SlimeSprite({ x, y, animate }: { x: number; y: number; animate: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={12} cy={27} rx={10} ry={4} fill="rgba(0,0,0,0.25)" />
      <g style={animate ? { animation: 'slimeBounce 0.4s ease-in-out infinite alternate' } : {}}>
        <ellipse cx={12} cy={14} rx={11} ry={13} fill="#5bd3f0" />
        <ellipse cx={12} cy={18} rx={11} ry={9} fill="#7ae8ff" />
        <ellipse cx={8} cy={12} rx={2.5} ry={3} fill="white" />
        <ellipse cx={16} cy={12} rx={2.5} ry={3} fill="white" />
        <circle cx={8.5} cy={13} r={1.5} fill="#1a1a4e" />
        <circle cx={16.5} cy={13} r={1.5} fill="#1a1a4e" />
        <path d="M 8 18 Q 12 22 16 18" stroke="#1a1a4e" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        <rect x={7} y={6} width={10} height={8} rx={2} fill="#c97c20" />
        <rect x={9} y={4} width={6} height={3} rx={1} fill="#a8610a" />
      </g>
    </g>
  )
}

function CastleSprite({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={2} y={24} width={52} height={28} fill="#8c7a5a" />
      <rect x={18} y={32} width={20} height={20} rx={3} fill="#3d2b1f" />
      <ellipse cx={28} cy={32} rx={10} ry={6} fill="#3d2b1f" />
      <rect x={0} y={8} width={16} height={44} fill="#a08b65" />
      <rect x={40} y={8} width={16} height={44} fill="#a08b65" />
      {[0, 5, 10].map(bx => <rect key={bx} x={bx} y={0} width={4} height={10} fill="#a08b65" />)}
      {[40, 45, 50].map(bx => <rect key={bx} x={bx} y={0} width={4} height={10} fill="#a08b65" />)}
      <rect x={2} y={20} width={52} height={8} fill="#a08b65" />
      {[4, 14, 24, 34, 44].map(bx => <rect key={`bc-${bx}`} x={bx} y={12} width={6} height={10} fill="#a08b65" />)}
      <rect x={27} y={0} width={3} height={16} fill="#7a5c32" />
      <polygon points="30,2 42,8 30,14" fill="#e03030" />
      <rect x={3} y={16} width={8} height={10} rx={2} fill="#3d2b1f" />
      <rect x={45} y={16} width={8} height={10} rx={2} fill="#3d2b1f" />
      <text x={28} y={58} textAnchor="middle" fill="#ffe0a0" fontSize={7} fontFamily="'Courier New', monospace" fontWeight="bold">
        モンスター商会
      </text>
    </g>
  )
}

function VillageSprite({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={20} width={28} height={22} fill="#d4a96a" />
      <polygon points="0,20 14,4 28,20" fill="#c0392b" />
      <rect x={10} y={28} width={8} height={14} fill="#5c3317" />
      <rect x={2} y={24} width={8} height={8} fill="#a0d8ef" />
      <rect x={18} y={24} width={8} height={8} fill="#a0d8ef" />
      <rect x={32} y={26} width={22} height={16} fill="#e8c98a" />
      <polygon points="32,26 43,14 54,26" fill="#8e44ad" />
      <rect x={39} y={32} width={7} height={10} fill="#5c3317" />
      <rect x={14} y={38} width={3} height={10} fill="#8B6914" />
      <rect x={10} y={34} width={11} height={6} fill="#c8a04a" />
      <text x={15.5} y={39} textAnchor="middle" fill="#3d2b1f" fontSize={4} fontFamily="'Courier New', monospace">村</text>
      <text x={27} y={54} textAnchor="middle" fill="#ffe0a0" fontSize={7} fontFamily="'Courier New', monospace" fontWeight="bold">
        はじまりの村
      </text>
    </g>
  )
}

// ────────────────────────────────────────────────────────────
// Main App
// ────────────────────────────────────────────────────────────
export default function App() {
  const [gold, setGold] = useState(0)
  const [selectedCourier, setSelectedCourier] = useState<Courier>(COURIERS[0])
  const [status, setStatus] = useState<DeliveryStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>(['商会の扉が開いた。さあ、配送を始めよう！'])
  const [slimeX, setSlimeX] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const MAP_W = 640
  const MAP_H = 280

  const CASTLE_X = 40
  const CASTLE_Y = MAP_H / 2 - 50
  const VILLAGE_X = MAP_W - 130
  const VILLAGE_Y = MAP_H / 2 - 50

  const PATH_START_X = CASTLE_X + 56 + 10
  const PATH_END_X = VILLAGE_X - 30

  function addLog(msg: string) {
    setLog(prev => [msg, ...prev].slice(0, 6))
  }

  function startDelivery() {
    if (status === 'delivering') return
    setStatus('delivering')
    setProgress(0)
    setSlimeX(0)
    addLog(`${selectedCourier.name}が出発した！`)

    const tick = 100
    let elapsed = 0

    intervalRef.current = setInterval(() => {
      elapsed += tick
      const pct = Math.min((elapsed / DELIVERY_DURATION) * 100, 100)
      setProgress(pct)
      setSlimeX(pct / 100)

      if (elapsed >= DELIVERY_DURATION) {
        clearInterval(intervalRef.current!)
        const raided = Math.random() < selectedCourier.raidChance
        if (raided) {
          setStatus('raided')
          addLog('⚠ 魔物に襲われた！荷物が奪われた…')
        } else {
          setStatus('done')
          setGold(g => g + selectedCourier.reward)
          addLog(`✓ 配送完了！ ${selectedCourier.reward}G を獲得した！`)
        }
        setTimeout(() => {
          setStatus('idle')
          setProgress(0)
          setSlimeX(0)
        }, 2500)
      }
    }, tick)
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const isDelivering = status === 'delivering'
  const slimeSvgX = PATH_START_X + slimeX * (PATH_END_X - PATH_START_X) - 12
  const slimeSvgY = MAP_H / 2 - 10
  const roadY = MAP_H / 2 + 10

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a0a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>

      {/* ── Title ── */}
      <h1 style={{ color: '#fde047', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: '4px', textShadow: '2px 2px #7c3aed, 4px 4px #4c1d95', fontFamily: "'Courier New', monospace" }}>
        ◆ モンスター商会 ◆
      </h1>
      <p style={{ color: '#c084fc', fontSize: '0.75rem', marginBottom: '16px', letterSpacing: '0.1em', fontFamily: "'Courier New', monospace" }}>物流大作戦</p>

      {/* ── HUD Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: '#0d0020', border: '2px solid #eab308', borderRadius: '6px', padding: '8px 24px', marginBottom: '16px', width: '100%', maxWidth: '660px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fde047', fontWeight: 'bold', fontSize: '1.125rem', fontFamily: "'Courier New', monospace" }}>
          <Coins size={20} color="#facc15" />
          所持金：{gold.toLocaleString()}G
        </span>
        {isDelivering && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.875rem', marginLeft: 'auto', fontFamily: "'Courier New', monospace", animation: 'pulse 1s infinite' }}>
            <AlertTriangle size={16} />
            襲撃リスク：{(selectedCourier.raidChance * 100).toFixed(0)}%
          </span>
        )}
        {status === 'done' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontSize: '0.875rem', marginLeft: 'auto', fontFamily: "'Courier New', monospace" }}>
            <CheckCircle2 size={16} />配送完了！
          </span>
        )}
        {status === 'raided' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.875rem', marginLeft: 'auto', fontFamily: "'Courier New', monospace" }}>
            <AlertTriangle size={16} />襲撃された！
          </span>
        )}
      </div>

      {/* ── World Map ── */}
      <div style={{ border: '4px solid #ca8a04', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 0 24px #7c3aed66' }}>
        <svg width={MAP_W} height={MAP_H} style={{ display: 'block' }}>
          <MapBackground width={MAP_W} height={MAP_H} />

          {/* Dotted road */}
          <line
            x1={CASTLE_X + 60} y1={roadY}
            x2={VILLAGE_X} y2={roadY}
            stroke="#c8a04a"
            strokeWidth={3}
            strokeDasharray="10,7"
            opacity={0.85}
          />

          <CastleSprite x={CASTLE_X} y={CASTLE_Y} />
          <VillageSprite x={VILLAGE_X} y={VILLAGE_Y} />

          {/* Slime courier */}
          {(isDelivering || status === 'done' || status === 'raided') && (
            <SlimeSprite x={slimeSvgX} y={slimeSvgY} animate={isDelivering} />
          )}

          <text x={MAP_W / 2} y={18} textAnchor="middle"
                fill="#ffe0a0" fontSize={11} fontFamily="'Courier New', monospace" opacity={0.7}>
            ─── ワールドマップ ───
          </text>
        </svg>
      </div>

      {/* ── Progress Bar ── */}
      <div style={{ width: '100%', maxWidth: '660px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc', fontSize: '0.75rem', marginBottom: '4px', fontFamily: "'Courier New', monospace" }}>
          <span>配送進捗</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: '22px', backgroundColor: '#0d0020', border: '2px solid #7e22ce', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            transition: 'width 0.1s linear',
            background: isDelivering
              ? 'linear-gradient(90deg, #5b21b6, #7c3aed, #a78bfa)'
              : status === 'done'
              ? 'linear-gradient(90deg, #065f46, #059669)'
              : status === 'raided'
              ? 'linear-gradient(90deg, #7f1d1d, #ef4444)'
              : '#5b21b6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '8px',
          }}>
            {progress > 15 && (
              <span style={{ color: 'white', fontSize: '0.75rem', fontFamily: "'Courier New', monospace" }}>
                {isDelivering ? '輸送中…' : status === 'done' ? '✓ 完了' : '✗'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Control Panel ── */}
      <div style={{ width: '100%', maxWidth: '660px', backgroundColor: '#0d0020', border: '2px solid #7e22ce', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <p style={{ color: '#c084fc', fontSize: '0.75rem', marginBottom: '12px', letterSpacing: '0.1em', fontFamily: "'Courier New', monospace" }}>◆ 配送員を選択</p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {COURIERS.map(c => (
            <button
              key={c.id}
              onClick={() => !isDelivering && setSelectedCourier(c)}
              disabled={isDelivering}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: selectedCourier.id === c.id ? '2px solid #facc15' : '2px solid #7e22ce',
                backgroundColor: selectedCourier.id === c.id ? '#713f12' : '#1a0a2e',
                color: selectedCourier.id === c.id ? '#fef08a' : '#e9d5ff',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                cursor: isDelivering ? 'not-allowed' : 'pointer',
                opacity: isDelivering ? 0.5 : 1,
                fontFamily: "'Courier New', monospace",
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{c.emoji}</span>
              <span>{c.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#c084fc', marginLeft: '4px' }}>
                <Package size={12} />積載量{c.capacity}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#c084fc', marginBottom: '16px', paddingLeft: '4px', fontFamily: "'Courier New', monospace" }}>
          <span>報酬: <span style={{ color: '#fde047', fontWeight: 'bold' }}>{selectedCourier.reward}G</span></span>
          <span>所要時間: <span style={{ color: 'white' }}>{selectedCourier.speed / 1000}秒</span></span>
          <span>襲撃リスク: <span style={{ color: '#f87171' }}>{(selectedCourier.raidChance * 100).toFixed(0)}%</span></span>
        </div>

        <button
          onClick={startDelivery}
          disabled={isDelivering}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '6px',
            border: isDelivering ? '2px solid #4b5563' : '2px solid #eab308',
            backgroundColor: isDelivering ? '#1f2937' : '#92400e',
            color: isDelivering ? '#6b7280' : '#fef3c7',
            fontWeight: 'bold',
            fontSize: '1.125rem',
            letterSpacing: '0.15em',
            cursor: isDelivering ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontFamily: "'Courier New', monospace",
            boxShadow: isDelivering ? 'none' : '0 0 14px #ca8a04aa',
            transition: 'all 0.15s',
          }}
        >
          <Truck size={22} />
          {isDelivering ? '配送中…' : '配送開始'}
        </button>
      </div>

      {/* ── Log ── */}
      <div style={{ width: '100%', maxWidth: '660px', backgroundColor: '#050010', border: '2px solid #3b0764', borderRadius: '6px', padding: '12px' }}>
        <p style={{ color: '#6b21a8', fontSize: '0.75rem', marginBottom: '8px', fontFamily: "'Courier New', monospace" }}>◆ ログ</p>
        {log.map((entry, i) => (
          <p
            key={i}
            style={{
              fontFamily: "'Courier New', monospace",
              color: i === 0 ? '#e2e8f0' : '#6b7280',
              fontSize: i === 0 ? '0.85rem' : '0.75rem',
              lineHeight: '1.6',
            }}
          >
            {entry}
          </p>
        ))}
      </div>

      <style>{`
        @keyframes slimeBounce {
          from { transform: scaleY(1) scaleX(1); }
          to   { transform: scaleY(0.85) scaleX(1.12); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
