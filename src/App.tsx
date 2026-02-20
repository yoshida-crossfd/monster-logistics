import { useState, useEffect, useRef } from 'react'
import { Coins, AlertTriangle, CheckCircle2, Truck, Users, BarChart2, Plus, X, Star } from 'lucide-react'
import './index.css'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type DeliveryStatus = 'idle' | 'delivering' | 'done' | 'raided'
type Tab = 'delivery' | 'squad' | 'status'

interface Monster {
  id: string
  name: string
  level: number
  exp: number
  expToNext: number
  deliveries: number
  capacity: number
  raidChance: number
  reward: number
}

// ────────────────────────────────────────────────────────────
// Constants & helpers
// ────────────────────────────────────────────────────────────
const DELIVERY_DURATION = 5000
const BASE_EXP = 50
const SQUAD_SIZE = 3

function calcExpToNext(level: number): number {
  return level * 100
}

let _uid = 0
function makeMonster(suffix: string): Monster {
  return {
    id: `slime-${++_uid}`,
    name: `スライム${suffix}`,
    level: 1,
    exp: 0,
    expToNext: calcExpToNext(1),
    deliveries: 0,
    capacity: 10,
    raidChance: 0.05,
    reward: 100,
  }
}

const INIT_MONSTERS: Monster[] = [
  makeMonster('Ａ'),
  makeMonster('Ｂ'),
  makeMonster('Ｃ'),
]

// Level up: +2 capacity, +15 reward, -0.4% raidChance per level
function applyExp(
  m: Monster,
  gained: number,
): { monster: Monster; leveled: boolean; newLevel: number } {
  let { exp, expToNext, level, capacity, raidChance, reward } = m
  exp += gained
  let leveled = false
  while (exp >= expToNext) {
    exp -= expToNext
    level++
    expToNext = calcExpToNext(level)
    capacity += 2
    reward += 15
    raidChance = Math.max(0.01, raidChance - 0.004)
    leveled = true
  }
  return {
    monster: { ...m, exp, expToNext, level, capacity, raidChance, reward },
    leveled,
    newLevel: level,
  }
}

function getMembers(squad: (string | null)[], monsters: Monster[]): Monster[] {
  return squad
    .filter((id): id is string => id !== null)
    .flatMap(id => {
      const m = monsters.find(x => x.id === id)
      return m ? [m] : []
    })
}

function calcSquadStats(members: Monster[]) {
  if (members.length === 0) return null
  return {
    capacity: members.reduce((s, m) => s + m.capacity, 0),
    raidChance: members.reduce((s, m) => s + m.raidChance, 0) / members.length,
    reward: members.reduce((s, m) => s + m.reward, 0),
  }
}

function levelFlavor(level: number): string {
  if (level === 1) return '新米の配送員。でも目だけはキラキラしている。'
  if (level === 2) return '少し慣れてきた。荷物の積み方が上手くなった。'
  if (level === 3) return 'ベテランの風格が出てきた。村人からも頼られている。'
  if (level === 4) return '路地裏の近道を熟知している。手際が違う。'
  if (level === 5) return '村中で噂される凄腕の配送員。伝説になりつつある。'
  return '伝説の配送員。その名は世界中に轟いている。'
}

// ────────────────────────────────────────────────────────────
// SVG map components
// ────────────────────────────────────────────────────────────
function GrassTile({ x, y }: { x: number; y: number }) {
  const shade = (x * 7 + y * 13) % 3
  const colors = ['#4a7c59', '#3d6b4a', '#56885e']
  return <rect x={x * 16} y={y * 16} width={16} height={16} fill={colors[shade]} />
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
            return (
              <rect
                key={`w-${col}-${row}`}
                x={col * 16} y={row * 16}
                width={16} height={16}
                fill={row % 2 === 0 ? '#4ab3c8' : '#3aa3b8'}
              />
            )
          }
          return <GrassTile key={`g-${col}-${row}`} x={col} y={row} />
        })
      )}
      {([[1,2],[3,5],[11,1],[13,4],[2,8],[12,7],[4,3]] as [number,number][]).map(([tc, tr], i) => (
        <g key={`tree-${i}`} transform={`translate(${tc * 16}, ${tr * 16})`}>
          <rect x={6} y={8} width={4} height={6} fill="#8B6914" />
          <polygon points="8,0 2,10 14,10" fill="#2d6e2d" />
          <polygon points="8,2 1,12 15,12" fill="#3a8c3a" />
        </g>
      ))}
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
      {[4, 14, 24, 34, 44].map(bx => (
        <rect key={`bc-${bx}`} x={bx} y={12} width={6} height={10} fill="#a08b65" />
      ))}
      <rect x={27} y={0} width={3} height={16} fill="#7a5c32" />
      <polygon points="30,2 42,8 30,14" fill="#e03030" />
      <rect x={3} y={16} width={8} height={10} rx={2} fill="#3d2b1f" />
      <rect x={45} y={16} width={8} height={10} rx={2} fill="#3d2b1f" />
      <text x={28} y={58} textAnchor="middle" fill="#ffe0a0" fontSize={7}
            fontFamily="'Courier New', monospace" fontWeight="bold">
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
      <text x={27} y={54} textAnchor="middle" fill="#ffe0a0" fontSize={7}
            fontFamily="'Courier New', monospace" fontWeight="bold">
        はじまりの村
      </text>
    </g>
  )
}

// Single slime sprite (used both on map and in status screen)
function SlimeBody({
  animate,
  scale = 1,
}: {
  animate: boolean
  scale?: number
}) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx={12} cy={27} rx={10} ry={4} fill="rgba(0,0,0,0.25)" />
      <g
        style={
          animate
            ? { animation: 'slimeBounce 0.4s ease-in-out infinite alternate' }
            : {}
        }
      >
        <ellipse cx={12} cy={14} rx={11} ry={13} fill="#5bd3f0" />
        <ellipse cx={12} cy={18} rx={11} ry={9} fill="#7ae8ff" />
        <ellipse cx={8} cy={12} rx={2.5} ry={3} fill="white" />
        <ellipse cx={16} cy={12} rx={2.5} ry={3} fill="white" />
        <circle cx={8.5} cy={13} r={1.5} fill="#1a1a4e" />
        <circle cx={16.5} cy={13} r={1.5} fill="#1a1a4e" />
        <path
          d="M 8 18 Q 12 22 16 18"
          stroke="#1a1a4e"
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
        {/* delivery pack */}
        <rect x={7} y={6} width={10} height={8} rx={2} fill="#c97c20" />
        <rect x={9} y={4} width={6} height={3} rx={1} fill="#a8610a" />
      </g>
    </g>
  )
}

function SlimeOnMap({
  x,
  y,
  animate,
}: {
  x: number
  y: number
  animate: boolean
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <SlimeBody animate={animate} />
    </g>
  )
}

// ────────────────────────────────────────────────────────────
// Main App
// ────────────────────────────────────────────────────────────
export default function App() {
  const [gold, setGold] = useState(0)
  const [monsters, setMonsters] = useState<Monster[]>(INIT_MONSTERS)
  const [squad, setSquad] = useState<(string | null)[]>([
    INIT_MONSTERS[0].id,
    null,
    null,
  ])
  const [status, setStatus] = useState<DeliveryStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [slimeT, setSlimeT] = useState(0) // 0→1 travel fraction
  const [log, setLog] = useState<string[]>(['商会の扉が開いた。さあ、配送を始めよう！'])
  const [tab, setTab] = useState<Tab>('delivery')
  const [statusId, setStatusId] = useState<string>(INIT_MONSTERS[0].id)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const MAP_W = 640
  const MAP_H = 280
  const CASTLE_X = 40
  const CASTLE_Y = MAP_H / 2 - 50
  const VILLAGE_X = MAP_W - 130
  const VILLAGE_Y = MAP_H / 2 - 50
  const PATH_START_X = CASTLE_X + 66
  const PATH_END_X = VILLAGE_X - 28
  const ROAD_Y = MAP_H / 2 + 10
  const SLIME_Y = MAP_H / 2 - 10

  const isDelivering = status === 'delivering'
  const members = getMembers(squad, monsters)
  const squadStats = calcSquadStats(members)
  const statusMonster = monsters.find(m => m.id === statusId) ?? monsters[0]

  function addLog(msg: string) {
    setLog(prev => [msg, ...prev].slice(0, 8))
  }

  function startDelivery() {
    if (isDelivering || members.length === 0) return
    setStatus('delivering')
    setProgress(0)
    setSlimeT(0)
    addLog(`分隊（${members.map(m => m.name).join('・')}）が出発した！`)

    const tick = 100
    let elapsed = 0
    intervalRef.current = setInterval(() => {
      elapsed += tick
      const pct = Math.min((elapsed / DELIVERY_DURATION) * 100, 100)
      setProgress(pct)
      setSlimeT(pct / 100)

      if (elapsed >= DELIVERY_DURATION) {
        clearInterval(intervalRef.current!)
        const raided = Math.random() < (squadStats?.raidChance ?? 0.05)
        if (raided) {
          setStatus('raided')
          addLog('⚠ 魔物の奇襲！荷物が奪われた…')
        } else {
          const earned = squadStats!.reward
          setGold(g => g + earned)
          addLog(`✓ 配送完了！ ${earned}G 獲得！`)
          // EXP for every member
          setMonsters(prev => {
            const next = [...prev]
            members.forEach(member => {
              const idx = next.findIndex(x => x.id === member.id)
              if (idx < 0) return
              const base = { ...next[idx], deliveries: next[idx].deliveries + 1 }
              const { monster: updated, leveled, newLevel } = applyExp(base, BASE_EXP)
              next[idx] = updated
              if (leveled) {
                addLog(`★ ${updated.name} が Lv.${newLevel} にレベルアップ！`)
              }
            })
            return next
          })
        }
        setTimeout(() => {
          setStatus('idle')
          setProgress(0)
          setSlimeT(0)
        }, 2500)
      }
    }, tick)
  }

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    },
    [],
  )

  // Squad mutation helpers
  function toggleSquad(monsterId: string) {
    setSquad(prev => {
      if (prev.includes(monsterId)) {
        return prev.map(id => (id === monsterId ? null : id))
      }
      const empty = prev.findIndex(id => id === null)
      if (empty < 0) return prev
      const next = [...prev]
      next[empty] = monsterId
      return next
    })
  }

  function removeSlot(i: number) {
    setSquad(prev => {
      const next = [...prev]
      next[i] = null
      return next
    })
  }

  function navigateStatus(dir: 1 | -1) {
    const idx = monsters.findIndex(m => m.id === statusId)
    setStatusId(monsters[(idx + dir + monsters.length) % monsters.length].id)
  }

  // Map slime positions (spread out a bit for squad)
  const baseX = PATH_START_X + slimeT * (PATH_END_X - PATH_START_X) - 12
  const squadOffsets = [-22, 0, 22] // horizontal offsets per slot

  // ── Render ──────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#1a0a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 16px',
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* Title */}
      <h1
        style={{
          color: '#fde047',
          fontSize: '1.4rem',
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          marginBottom: '2px',
          textShadow: '2px 2px #7c3aed, 4px 4px #4c1d95',
        }}
      >
        ◆ モンスター商会 ◆
      </h1>
      <p
        style={{
          color: '#c084fc',
          fontSize: '0.72rem',
          marginBottom: '14px',
          letterSpacing: '0.1em',
        }}
      >
        物流大作戦
      </p>

      {/* HUD */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          backgroundColor: '#0d0020',
          border: '2px solid #eab308',
          borderRadius: '6px',
          padding: '8px 20px',
          marginBottom: '14px',
          width: '100%',
          maxWidth: '660px',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fde047',
            fontWeight: 'bold',
            fontSize: '1.1rem',
          }}
        >
          <Coins size={18} color="#facc15" />
          所持金：{gold.toLocaleString()}G
        </span>

        {/* Squad quick-view badges */}
        <span style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {squad.map((id, i) => {
            const m = id ? monsters.find(x => x.id === id) : null
            return (
              <span
                key={i}
                style={{
                  fontSize: '0.72rem',
                  color: m ? '#a5f3fc' : '#374151',
                  background: '#0d0020',
                  border: `1px solid ${m ? '#7e22ce' : '#374151'}`,
                  borderRadius: '4px',
                  padding: '2px 8px',
                }}
              >
                {m ? `🟢 Lv.${m.level}` : '── 空き'}
              </span>
            )
          })}
        </span>

        {isDelivering && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#f87171',
              fontSize: '0.8rem',
              animation: 'pulse 1s infinite',
            }}
          >
            <AlertTriangle size={14} />
            リスク:{squadStats ? (squadStats.raidChance * 100).toFixed(1) : 0}%
          </span>
        )}
        {status === 'done' && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#4ade80',
              fontSize: '0.8rem',
            }}
          >
            <CheckCircle2 size={14} />完了！
          </span>
        )}
        {status === 'raided' && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            <AlertTriangle size={14} />襲撃！
          </span>
        )}
      </div>

      {/* World Map */}
      <div
        style={{
          border: '4px solid #ca8a04',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '14px',
          boxShadow: '0 0 24px #7c3aed55',
        }}
      >
        <svg width={MAP_W} height={MAP_H} style={{ display: 'block' }}>
          <MapBackground width={MAP_W} height={MAP_H} />
          <line
            x1={CASTLE_X + 60}
            y1={ROAD_Y}
            x2={VILLAGE_X}
            y2={ROAD_Y}
            stroke="#c8a04a"
            strokeWidth={3}
            strokeDasharray="10,7"
            opacity={0.85}
          />
          <CastleSprite x={CASTLE_X} y={CASTLE_Y} />
          <VillageSprite x={VILLAGE_X} y={VILLAGE_Y} />

          {/* Squad on map — one slime per member, slightly offset */}
          {(isDelivering || status === 'done' || status === 'raided') &&
            members.map((m, i) => (
              <SlimeOnMap
                key={m.id}
                x={baseX + (squadOffsets[i] ?? 0)}
                y={SLIME_Y - i * 6}
                animate={isDelivering}
              />
            ))}

          <text
            x={MAP_W / 2}
            y={18}
            textAnchor="middle"
            fill="#ffe0a0"
            fontSize={11}
            fontFamily="'Courier New', monospace"
            opacity={0.7}
          >
            ─── ワールドマップ ───
          </text>
        </svg>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: '660px',
          borderBottom: '2px solid #7e22ce',
        }}
      >
        {(
          [
            ['delivery', <Truck size={14} />, '配送'],
            ['squad', <Users size={14} />, '分隊編成'],
            ['status', <BarChart2 size={14} />, 'ステータス'],
          ] as [Tab, React.ReactNode, string][]
        ).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '9px 4px',
              background: tab === t ? '#3b0764' : '#0d0020',
              border: 'none',
              borderTop: tab === t ? '2px solid #a855f7' : '2px solid transparent',
              color: tab === t ? '#e9d5ff' : '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontFamily: "'Courier New', monospace",
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        style={{
          width: '100%',
          maxWidth: '660px',
          backgroundColor: '#0d0020',
          border: '2px solid #7e22ce',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '16px',
          marginBottom: '14px',
        }}
      >
        {/* ── DELIVERY TAB ── */}
        {tab === 'delivery' && (
          <div>
            {/* Squad summary */}
            <div
              style={{
                marginBottom: '14px',
                padding: '12px',
                background: '#1a0a2e',
                borderRadius: '6px',
                border: '1px solid #4c1d95',
              }}
            >
              <p style={{ color: '#c084fc', fontSize: '0.7rem', marginBottom: '10px' }}>
                ◆ 出撃分隊
              </p>
              {members.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  分隊が編成されていません。「分隊編成」タブでモンスターを選んでください。
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {members.map(m => (
                      <span
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 12px',
                          background: '#3b0764',
                          borderRadius: '4px',
                          border: '1px solid #7e22ce',
                          color: '#e9d5ff',
                          fontSize: '0.82rem',
                        }}
                      >
                        🟢 <strong>{m.name}</strong>
                        <span style={{ color: '#a78bfa', marginLeft: '4px' }}>Lv.{m.level}</span>
                      </span>
                    ))}
                  </div>
                  {squadStats && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '20px',
                        fontSize: '0.75rem',
                        color: '#a78bfa',
                      }}
                    >
                      <span>
                        積載量：<strong style={{ color: '#e9d5ff' }}>{squadStats.capacity}</strong>
                      </span>
                      <span>
                        合計報酬：<strong style={{ color: '#fde047' }}>{squadStats.reward}G</strong>
                      </span>
                      <span>
                        襲撃リスク：
                        <strong style={{ color: '#f87171' }}>
                          {(squadStats.raidChance * 100).toFixed(1)}%
                        </strong>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#c084fc',
                  fontSize: '0.72rem',
                  marginBottom: '4px',
                }}
              >
                <span>配送進捗</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div
                style={{
                  height: '22px',
                  backgroundColor: '#050010',
                  border: '2px solid #7e22ce',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
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
                  }}
                >
                  {progress > 15 && (
                    <span style={{ color: 'white', fontSize: '0.72rem' }}>
                      {isDelivering ? '輸送中…' : status === 'done' ? '✓ 完了' : '✗ 失敗'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Deliver button */}
            <button
              onClick={startDelivery}
              disabled={isDelivering || members.length === 0}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border:
                  isDelivering || members.length === 0
                    ? '2px solid #4b5563'
                    : '2px solid #eab308',
                backgroundColor:
                  isDelivering || members.length === 0 ? '#1f2937' : '#92400e',
                color:
                  isDelivering || members.length === 0 ? '#6b7280' : '#fef3c7',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                letterSpacing: '0.15em',
                cursor:
                  isDelivering || members.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontFamily: "'Courier New', monospace",
                boxShadow:
                  isDelivering || members.length === 0
                    ? 'none'
                    : '0 0 14px #ca8a04aa',
                transition: 'all 0.15s',
              }}
            >
              <Truck size={22} />
              {isDelivering
                ? '配送中…'
                : members.length === 0
                ? '分隊を編成してください'
                : '配送開始'}
            </button>
          </div>
        )}

        {/* ── SQUAD TAB ── */}
        {tab === 'squad' && (
          <div>
            {/* Slot row */}
            <p style={{ color: '#c084fc', fontSize: '0.7rem', marginBottom: '10px' }}>
              ◆ 分隊スロット（最大{SQUAD_SIZE}体）
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              {squad.map((id, i) => {
                const m = id ? monsters.find(x => x.id === id) : null
                return (
                  <div
                    key={i}
                    onClick={() => m && !isDelivering && removeSlot(i)}
                    style={{
                      flex: 1,
                      border: `2px solid ${m ? '#7e22ce' : '#374151'}`,
                      borderRadius: '8px',
                      padding: '12px 8px',
                      textAlign: 'center',
                      background: m ? '#1a0a2e' : '#0a0018',
                      cursor: m && !isDelivering ? 'pointer' : 'default',
                      minHeight: '90px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    {m ? (
                      <>
                        <svg width={32} height={32} style={{ overflow: 'visible' }}>
                          <SlimeBody animate={false} scale={1.1} />
                        </svg>
                        <span style={{ color: '#e9d5ff', fontSize: '0.72rem', fontWeight: 'bold' }}>
                          {m.name}
                        </span>
                        <span style={{ color: '#a78bfa', fontSize: '0.68rem' }}>Lv.{m.level}</span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            color: '#ef4444',
                            fontSize: '0.62rem',
                            marginTop: '2px',
                          }}
                        >
                          <X size={10} />外す
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus size={22} color="#374151" />
                        <span style={{ color: '#4b5563', fontSize: '0.68rem' }}>空きスロット</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Roster */}
            <p style={{ color: '#c084fc', fontSize: '0.7rem', marginBottom: '10px' }}>
              ◆ 所持モンスター（タップで編成・解除）
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {monsters.map(m => {
                const inSquad = squad.includes(m.id)
                const squadFull = squad.filter(id => id !== null).length >= SQUAD_SIZE
                const disabled = isDelivering || (!inSquad && squadFull)
                return (
                  <div
                    key={m.id}
                    onClick={() => !disabled && toggleSquad(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      border: `2px solid ${inSquad ? '#a855f7' : '#374151'}`,
                      borderRadius: '8px',
                      background: inSquad ? '#1e1038' : '#0d0020',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {/* Mini sprite */}
                    <svg width={28} height={30} style={{ overflow: 'visible', flexShrink: 0 }}>
                      <SlimeBody animate={false} scale={0.95} />
                    </svg>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            color: '#e9d5ff',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                          }}
                        >
                          {m.name}
                        </span>
                        <span
                          style={{
                            background: '#7c3aed',
                            color: '#e9d5ff',
                            fontSize: '0.62rem',
                            padding: '1px 6px',
                            borderRadius: '3px',
                          }}
                        >
                          Lv.{m.level}
                        </span>
                        {inSquad && (
                          <span
                            style={{
                              background: '#065f46',
                              color: '#6ee7b7',
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: '3px',
                            }}
                          >
                            出撃中
                          </span>
                        )}
                      </div>

                      {/* EXP bar */}
                      <div
                        style={{
                          height: '5px',
                          background: '#1f2937',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '5px',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(m.exp / m.expToNext) * 100}%`,
                            background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                            transition: 'width 0.4s',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          fontSize: '0.68rem',
                          color: '#6b7280',
                        }}
                      >
                        <span>
                          積載<span style={{ color: '#a5f3fc' }}>{m.capacity}</span>
                        </span>
                        <span>
                          報酬<span style={{ color: '#fde047' }}>{m.reward}G</span>
                        </span>
                        <span>
                          配送<span style={{ color: '#c084fc' }}>{m.deliveries}回</span>
                        </span>
                        <span style={{ color: '#374151' }}>
                          EXP {m.exp}/{m.expToNext}
                        </span>
                      </div>
                    </div>

                    {/* Detail shortcut */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setStatusId(m.id)
                        setTab('status')
                      }}
                      style={{
                        background: '#1f2937',
                        border: '1px solid #4b5563',
                        color: '#9ca3af',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.68rem',
                        fontFamily: "'Courier New', monospace",
                        flexShrink: 0,
                      }}
                    >
                      詳細
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {tab === 'status' && (
          <div>
            {/* Monster navigator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              <button
                onClick={() => navigateStatus(-1)}
                style={{
                  background: '#1a0a2e',
                  border: '1px solid #7e22ce',
                  color: '#c084fc',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '1rem',
                }}
              >
                ◀
              </button>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: '#e9d5ff',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                {statusMonster.name}
              </span>
              <button
                onClick={() => navigateStatus(1)}
                style={{
                  background: '#1a0a2e',
                  border: '1px solid #7e22ce',
                  color: '#c084fc',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '1rem',
                }}
              >
                ▶
              </button>
            </div>

            {/* Big sprite */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              <svg
                width={120}
                height={100}
                style={{ overflow: 'visible' }}
              >
                <g transform="translate(20, 5) scale(2.8)">
                  <SlimeBody animate={false} />
                </g>
              </svg>
            </div>

            {/* Level badge */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span
                style={{
                  background: '#7c3aed',
                  color: '#fef3c7',
                  padding: '4px 24px',
                  borderRadius: '20px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  letterSpacing: '0.08em',
                }}
              >
                Lv. {statusMonster.level}
              </span>
            </div>

            {/* Star rating */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={20}
                  fill={i < Math.min(statusMonster.level, 5) ? '#facc15' : 'none'}
                  color={i < Math.min(statusMonster.level, 5) ? '#facc15' : '#374151'}
                />
              ))}
            </div>

            {/* EXP bar */}
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#a78bfa',
                  fontSize: '0.72rem',
                  marginBottom: '5px',
                }}
              >
                <span>経験値 (EXP)</span>
                <span>
                  {statusMonster.exp} / {statusMonster.expToNext}
                </span>
              </div>
              <div
                style={{
                  height: '12px',
                  background: '#1f2937',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid #4c1d95',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(statusMonster.exp / statusMonster.expToNext) * 100}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)',
                    transition: 'width 0.4s',
                    boxShadow: '0 0 6px #a855f7',
                  }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {(
                [
                  ['🎒 積載量', statusMonster.capacity],
                  ['💰 配送報酬', `${statusMonster.reward}G`],
                  [
                    '🛡 襲撃防御',
                    `${((1 - statusMonster.raidChance) * 100).toFixed(1)}%`,
                  ],
                  ['📦 配送回数', `${statusMonster.deliveries}回`],
                ] as [string, string | number][]
              ).map(([label, val]) => (
                <div
                  key={String(label)}
                  style={{
                    background: '#1a0a2e',
                    border: '1px solid #4c1d95',
                    borderRadius: '6px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ color: '#6b7280', fontSize: '0.68rem', marginBottom: '6px' }}>
                    {label}
                  </div>
                  <div
                    style={{ color: '#e9d5ff', fontWeight: 'bold', fontSize: '1.05rem' }}
                  >
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {/* Flavor text */}
            <div
              style={{
                background: '#050010',
                border: '1px solid #3b0764',
                borderRadius: '6px',
                padding: '14px',
                textAlign: 'center',
              }}
            >
              <p style={{ color: '#a78bfa', fontSize: '0.82rem', lineHeight: '1.7', margin: 0 }}>
                「{levelFlavor(statusMonster.level)}」
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      <div
        style={{
          width: '100%',
          maxWidth: '660px',
          backgroundColor: '#050010',
          border: '2px solid #3b0764',
          borderRadius: '6px',
          padding: '12px',
        }}
      >
        <p style={{ color: '#6b21a8', fontSize: '0.72rem', marginBottom: '8px' }}>◆ ログ</p>
        {log.map((entry, i) => (
          <p
            key={i}
            style={{
              color: i === 0 ? '#e2e8f0' : '#6b7280',
              fontSize: i === 0 ? '0.84rem' : '0.74rem',
              lineHeight: '1.6',
              margin: '0 0 2px 0',
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
