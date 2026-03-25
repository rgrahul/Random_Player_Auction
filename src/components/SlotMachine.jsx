import { useState, useEffect, useRef, useMemo } from 'react'
import { Zap } from 'lucide-react'
import { shuffle } from '../utils/random'

function SlotMachine({ players, spinning, currentPlayer, activeSkill }) {
  const reelRef = useRef(null)
  const [displayNames, setDisplayNames] = useState([])
  const [reelOffset, setReelOffset] = useState(0)
  const animFrameRef = useRef(null)
  const speedRef = useRef(0)
  const startTimeRef = useRef(0)
  const phaseRef = useRef('idle') // idle, spinning, decelerating, stopped

  // Generate a shuffled list for the reel display
  const reelNames = useMemo(() => {
    if (players.length === 0) return []
    // Create a pool of names, repeated to fill the reel
    const names = []
    const shuffled = shuffle([...players])
    while (names.length < 60) {
      for (const p of shuffled) {
        names.push(p.name)
        if (names.length >= 60) break
      }
    }
    return names
  }, [players, spinning]) // recalculate on spin start

  // Animation loop
  useEffect(() => {
    if (!spinning) {
      phaseRef.current = 'idle'
      return
    }

    phaseRef.current = 'spinning'
    startTimeRef.current = performance.now()
    speedRef.current = 25 // pixels per frame
    let offset = 0
    const ITEM_HEIGHT = 64
    const TOTAL_HEIGHT = reelNames.length * ITEM_HEIGHT

    const animate = (timestamp) => {
      const elapsed = timestamp - startTimeRef.current

      if (elapsed < 1800) {
        // Fast spinning phase
        offset = (offset + speedRef.current) % TOTAL_HEIGHT
      } else if (elapsed < 2800) {
        // Deceleration phase
        phaseRef.current = 'decelerating'
        const decelProgress = (elapsed - 1800) / 1000
        const currentSpeed = 25 * (1 - decelProgress * decelProgress)
        offset = (offset + Math.max(currentSpeed, 0.5)) % TOTAL_HEIGHT
      } else {
        // Stop
        phaseRef.current = 'stopped'
        setReelOffset(0)
        return
      }

      setReelOffset(offset)
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [spinning, reelNames])

  const isLaterRound = activeSkill?.startsWith('Round ')
  const isKids = activeSkill?.startsWith('Kids')
  const skillColor = isLaterRound ? 'text-neon-magenta' :
    isKids ? 'text-neon-yellow' :
    activeSkill === 'Advanced' ? 'text-neon-magenta' :
    activeSkill === 'Intermediate +' ? 'text-neon-cyan' :
    activeSkill === 'Intermediate' ? 'text-neon-green' : 'text-neon-yellow'

  const showWinner = !spinning && currentPlayer
  const showIdle = !spinning && !currentPlayer

  return (
    <div className="relative">
      {/* Skill Label */}
      <div className="text-center mb-3">
        <span className={`font-display text-xs tracking-[3px] uppercase ${skillColor}`}>
          {isLaterRound ? `${activeSkill} — Waitlist Pool` : isKids ? `${activeSkill} — All Skills` : `${activeSkill} Pool`}
        </span>
      </div>

      {/* Slot Machine Frame */}
      <div className="slot-reel-container">
        <div className="slot-center-line" />

        {showIdle && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <Zap className={`w-12 h-12 ${skillColor} mb-3 opacity-50`} />
            <p className="font-display text-sm text-gray-500 tracking-wider uppercase">
              {players.length > 0 ? 'Press Spin to Start' : 'No Players Available'}
            </p>
            {players.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {players.length} player{players.length !== 1 ? 's' : ''} in pool
              </p>
            )}
          </div>
        )}

        {spinning && reelNames.length > 0 && (
          <div
            ref={reelRef}
            className="slot-reel-track"
            style={{ transform: `translateY(-${reelOffset}px)` }}
          >
            {reelNames.map((name, i) => (
              <div key={i} className="slot-name-item">
                {name}
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {reelNames.slice(0, 10).map((name, i) => (
              <div key={`dup-${i}`} className="slot-name-item">
                {name}
              </div>
            ))}
          </div>
        )}

        {showWinner && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="winner-name text-center px-6">
              <p className="text-gray-400 font-display text-[10px] tracking-[4px] uppercase mb-2">
                Selected Player
              </p>
              <h2 className={`font-display text-2xl md:text-3xl font-black tracking-wider ${skillColor}`}
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
      </div>

      {/* Decorative bottom bar */}
      <div className="h-1 mt-2 rounded-full bg-gradient-to-r from-neon-magenta via-neon-cyan to-neon-green opacity-50" />
    </div>
  )
}

export default SlotMachine
