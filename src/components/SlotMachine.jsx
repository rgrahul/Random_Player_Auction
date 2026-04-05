import { useState, useEffect, useRef, useMemo } from 'react'
import { Zap } from 'lucide-react'
import { shuffle } from '../utils/random'

const CAT_COLOR = {
  'Mens (Age 18+ and above)': '#00fff7',
  'Womens': '#ff00ff',
  'Kids (Age 10-18 years)': '#ffe600',
  'Kids (Upto 10 years)': '#39ff14',
}
const CAT_SHORT = {
  'Mens (Age 18+ and above)': 'MENS',
  'Womens': 'WOMENS',
  'Kids (Age 10-18 years)': 'KIDS 10+',
  'Kids (Upto 10 years)': 'KIDS <10',
}

function SlotMachine({ players, spinning, currentPlayer, activeSkill, autoAssignPhase, autoAssignCurrent, autoAssignProgress }) {
  const reelRef = useRef(null)
  const [reelOffset, setReelOffset] = useState(0)
  const animFrameRef = useRef(null)
  const phaseRef = useRef('idle')

  const autoAssigning = autoAssignPhase !== null

  const reelNames = useMemo(() => {
    const src = players.length > 0 ? players : []
    if (src.length === 0) return []
    const names = []
    const shuffled = shuffle([...src])
    while (names.length < 60) {
      for (const p of shuffled) {
        names.push(p.name)
        if (names.length >= 60) break
      }
    }
    return names
  }, [players, spinning, autoAssignPhase])

  // Normal spin animation
  useEffect(() => {
    if (!spinning) {
      phaseRef.current = 'idle'
      return
    }
    phaseRef.current = 'spinning'
    const startTime = performance.now()
    let offset = 0
    const ITEM_HEIGHT = 64
    const TOTAL_HEIGHT = reelNames.length * ITEM_HEIGHT

    const animate = (timestamp) => {
      const elapsed = timestamp - startTime
      if (elapsed < 1800) {
        offset = (offset + 25) % TOTAL_HEIGHT
      } else if (elapsed < 2800) {
        const p = (elapsed - 1800) / 1000
        const speed = 25 * (1 - p * p)
        offset = (offset + Math.max(speed, 0.5)) % TOTAL_HEIGHT
      } else {
        setReelOffset(0)
        return
      }
      setReelOffset(offset)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [spinning, reelNames])

  // Auto-assign spin animation (only during 'spinning' phase)
  useEffect(() => {
    if (autoAssignPhase !== 'spinning') return
    let offset = 0
    const ITEM_HEIGHT = 64
    const TOTAL_HEIGHT = Math.max(reelNames.length, 1) * ITEM_HEIGHT

    const animate = () => {
      offset = (offset + 45) % TOTAL_HEIGHT
      setReelOffset(offset)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [autoAssignPhase, reelNames])

  const isLaterRound = activeSkill?.startsWith('Round ')
  const isKids = activeSkill?.startsWith('Kids')
  const skillColor =
    isLaterRound ? 'text-neon-magenta' :
    isKids ? 'text-neon-yellow' :
    activeSkill === 'Advanced' ? 'text-neon-magenta' :
    activeSkill === 'Intermediate +' ? 'text-neon-cyan' :
    activeSkill === 'Intermediate' ? 'text-neon-green' : 'text-neon-yellow'

  const showWinner = !spinning && !autoAssigning && currentPlayer
  const showIdle   = !spinning && !autoAssigning && !currentPlayer

  // Category-derived colors for auto-assign
  const catColor  = autoAssignCurrent ? (CAT_COLOR[autoAssignCurrent.player.category]  || '#00fff7') : '#00fff7'
  const catLabel  = autoAssignCurrent ? (CAT_SHORT[autoAssignCurrent.player.category]  || '')        : ''
  const progressPct = autoAssignProgress.total > 0
    ? (autoAssignProgress.current / autoAssignProgress.total) * 100
    : 0

  // Border glow class
  const containerClass = [
    'slot-reel-container',
    autoAssignPhase === 'spinning'  ? 'auto-spin-glow'   : '',
    autoAssignPhase === 'revealing' ? 'auto-reveal-glow' : '',
    autoAssignPhase === 'assigning' ? 'auto-assign-glow' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="relative">
      {/* Label row */}
      <div className="text-center mb-3 h-5">
        {autoAssigning ? (
          <span className="font-display text-xs tracking-[3px] uppercase text-neon-magenta">
            Auto Assign —&nbsp;
            <span className="text-white">{autoAssignProgress.current}</span>
            <span className="text-gray-500">/{autoAssignProgress.total}</span>
          </span>
        ) : (
          <span className={`font-display text-xs tracking-[3px] uppercase ${skillColor}`}>
            {isLaterRound ? `${activeSkill} — Waitlist Pool` : isKids ? `${activeSkill} — All Skills` : `${activeSkill} Pool`}
          </span>
        )}
      </div>

      {/* Slot Machine Frame */}
      <div className={containerClass}>
        <div className="slot-center-line" />

        {/* Reel strip — shown while spinning (normal or auto) */}
        {(spinning || autoAssignPhase === 'spinning') && reelNames.length > 0 && (
          <div
            ref={reelRef}
            className="slot-reel-track"
            style={{ transform: `translateY(-${reelOffset}px)`, opacity: autoAssigning ? 0.35 : 1 }}
          >
            {reelNames.map((name, i) => (
              <div key={i} className="slot-name-item">{name}</div>
            ))}
            {reelNames.slice(0, 10).map((name, i) => (
              <div key={`d-${i}`} className="slot-name-item">{name}</div>
            ))}
          </div>
        )}

        {/* ── Normal idle ── */}
        {showIdle && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <Zap className={`w-12 h-12 ${skillColor} mb-3 opacity-50`} />
            <p className="font-display text-sm text-gray-500 tracking-wider uppercase">
              {players.length > 0 ? 'Press Spin to Start' : 'No Players Available'}
            </p>
            {players.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">{players.length} player{players.length !== 1 ? 's' : ''} in pool</p>
            )}
          </div>
        )}

        {/* ── Normal winner ── */}
        {showWinner && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="winner-name text-center px-6">
              <p className="text-gray-400 font-display text-[10px] tracking-[4px] uppercase mb-2">Selected Player</p>
              <h2
                className={`font-display text-2xl md:text-3xl font-black tracking-wider ${skillColor}`}
                style={{
                  textShadow: (isLaterRound || activeSkill === 'Advanced') ? '0 0 30px rgba(255,0,255,0.5)' :
                    isKids ? '0 0 30px rgba(255,230,0,0.5)' :
                    activeSkill === 'Intermediate +' ? '0 0 30px rgba(0,255,247,0.5)' :
                    activeSkill === 'Intermediate' ? '0 0 30px rgba(57,255,20,0.5)' :
                    '0 0 30px rgba(255,230,0,0.5)'
                }}
              >
                {currentPlayer.name}
              </h2>
            </div>
          </div>
        )}

        {/* ── Auto-assign: spinning overlay ── */}
        {autoAssignPhase === 'spinning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
            <Zap
              className="w-8 h-8 mb-2"
              style={{ color: '#ff00ff', filter: 'drop-shadow(0 0 10px #ff00ff)', animation: 'spin-pulse 0.3s ease-in-out infinite alternate' }}
            />
            <p className="font-display text-xs tracking-[4px] uppercase text-neon-magenta" style={{ animation: 'spin-pulse 0.4s ease-in-out infinite alternate' }}>
              Picking next player...
            </p>
          </div>
        )}

        {/* ── Auto-assign: revealing player ── */}
        {autoAssignPhase === 'revealing' && autoAssignCurrent && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-30 px-6"
            style={{ animation: 'burst-reveal 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <span
              className="font-display text-[10px] tracking-[5px] uppercase mb-3 px-3 py-1 rounded-full border"
              style={{ color: catColor, borderColor: catColor, background: `${catColor}18`, boxShadow: `0 0 12px ${catColor}55` }}
            >
              {catLabel}
            </span>
            <h2
              className="font-display text-3xl md:text-4xl font-black tracking-wider text-center leading-tight"
              style={{ color: catColor, textShadow: `0 0 40px ${catColor}, 0 0 80px ${catColor}55` }}
            >
              {autoAssignCurrent.player.name}
            </h2>
            <p className="text-gray-500 font-display text-xs mt-2">{autoAssignCurrent.player.skill}</p>
          </div>
        )}

        {/* ── Auto-assign: showing team assignment ── */}
        {autoAssignPhase === 'assigning' && autoAssignCurrent && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 px-6">
            {/* Player name stays */}
            <h2
              className="font-display text-2xl font-black tracking-wider text-center mb-4"
              style={{ color: catColor, textShadow: `0 0 20px ${catColor}88` }}
            >
              {autoAssignCurrent.player.name}
            </h2>
            {/* Arrow + Team name stamps in */}
            <div
              className="flex items-center gap-3"
              style={{ animation: 'team-stamp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
            >
              <span className="text-gray-400 font-display text-lg">→</span>
              <span
                className="font-display text-xl font-black tracking-widest uppercase px-4 py-1.5 rounded-lg border-2"
                style={{
                  color: '#00fff7',
                  borderColor: '#00fff7',
                  background: 'rgba(0,255,247,0.12)',
                  boxShadow: '0 0 24px rgba(0,255,247,0.5), inset 0 0 12px rgba(0,255,247,0.08)',
                }}
              >
                {autoAssignCurrent.teamName}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar (auto-assign) / decorative bar (normal) */}
      {autoAssigning ? (
        <div className="h-1.5 mt-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, #ff00ff, #00fff7)`,
              boxShadow: '0 0 8px rgba(0,255,247,0.6)',
            }}
          />
        </div>
      ) : (
        <div className="h-1 mt-2 rounded-full bg-gradient-to-r from-neon-magenta via-neon-cyan to-neon-green opacity-50" />
      )}
    </div>
  )
}

export default SlotMachine
