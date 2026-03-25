import { useState, useEffect, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  Dices, UserCheck, SkipForward, Undo2, RotateCcw,
  Users, Trophy, Clock, Upload, Zap, Star, Shield, Target, Play, Square, FastForward,
  CheckCircle2, RefreshCw, Home
} from 'lucide-react'
import SlotMachine from './components/SlotMachine'
import PlayerTable from './components/PlayerTable'
import SelectedPanel from './components/SelectedPanel'
import WaitlistPanel from './components/WaitlistPanel'
import { pickRandom } from './utils/random'
import './index.css'

const SKILL_LEVELS = ['Advanced', 'Intermediate +', 'Intermediate', 'Beginner']
const CATEGORIES = ['All', 'Mens (Age 18+ and above)', 'Womens', 'Kids (Age 10-18 years)', 'Kids (Upto 10 years)']
const CATEGORY_SHORT = {
  'All': 'All',
  'Mens (Age 18+ and above)': 'Mens',
  'Womens': 'Womens',
  'Kids (Age 10-18 years)': 'Kids 10-18',
  'Kids (Upto 10 years)': 'Kids <10',
}

const ADULT_CATEGORIES = ['Mens (Age 18+ and above)', 'Womens']
const isKidsCategory = (cat) => cat === 'Kids (Age 10-18 years)' || cat === 'Kids (Upto 10 years)'

const STORAGE_KEY = 'abl26-auction-state'

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function parseRows(rows) {
  return rows.map((row, i) => ({
    id: i,
    name: (row['Full Name'] || '').trim(),
    skill: (row['Self-Assessed Skill Rating (Our Society level)'] || '').trim(),
    category: (row['Category'] || '').trim(),
    flat: (row['Flat number'] || '').trim(),
    experience: (row['Years/months of playing experience'] || '').trim(),
    strength: (row['What is your key strength/shot that can turn a match in your favour?'] || '').trim(),
    photoUrl: (row['Profile Photo (will be used for auction)'] || '').trim(),
  })).filter(p => p.name && p.skill)
}

function App() {
  const [allPlayers, setAllPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  // waitlists: { 1: Set of ids skipped in round 1 (pool for round 2), 2: Set skipped in round 2 (pool for round 3), ... }
  const [waitlists, setWaitlists] = useState({})
  const [activeSkill, setActiveSkill] = useState('Advanced')
  const [activeCategory, setActiveCategory] = useState('All')
  const [spinning, setSpinning] = useState(false)
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [round, setRound] = useState(1)
  const [auctionComplete, setAuctionComplete] = useState(false)
  const simulateRef = useRef(false)
  const fileInputRef = useRef(null)

  // Helper to get all waitlisted IDs across all rounds
  const allWaitlistIds = new Set(Object.values(waitlists).flatMap(s => [...s]))
  // Get waitlist Set for a specific round (IDs skipped in that round)
  const getWaitlist = (r) => waitlists[r] || new Set()

  // Restore saved state on mount
  useEffect(() => {
    const saved = loadState()
    if (saved) {
      if (saved.players?.length > 0) setAllPlayers(saved.players)
      setSelectedIds(new Set(saved.selectedIds || []))
      // Migrate old single waitlistIds to new waitlists format
      if (saved.waitlists) {
        const restored = {}
        for (const [k, v] of Object.entries(saved.waitlists)) {
          restored[k] = new Set(v)
        }
        setWaitlists(restored)
      } else if (saved.waitlistIds) {
        setWaitlists({ 1: new Set(saved.waitlistIds) })
      }
      setHistory(saved.history || [])
      if (saved.activeSkill) setActiveSkill(saved.activeSkill)
      if (saved.activeCategory) setActiveCategory(saved.activeCategory)
      if (saved.round) setRound(saved.round)
      if (saved.auctionComplete) setAuctionComplete(true)
    }
    setLoaded(true)
  }, [])

  // Handle file upload (CSV or Excel)
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()

    const loadPlayers = (players) => {
      if (players.length === 0) {
        alert('No valid players found. Ensure the file has the required columns: "Full Name" and "Self-Assessed Skill Rating (Our Society level)".')
        return
      }
      setAllPlayers(players)
      setSelectedIds(new Set())
      setWaitlists({})
      setHistory([])
      setCurrentPlayer(null)
      setRound(1)
    }

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true })
        loadPlayers(parseRows(result.data))
      }
      reader.readAsText(file)
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const workbook = XLSX.read(ev.target.result, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        loadPlayers(parseRows(rows))
      }
      reader.readAsArrayBuffer(file)
    } else {
      alert('Please upload a .csv, .xlsx, or .xls file.')
    }

    e.target.value = ''
  }, [])

  // Save to localStorage on state changes
  useEffect(() => {
    if (!loaded) return
    const serializedWaitlists = {}
    for (const [k, v] of Object.entries(waitlists)) {
      serializedWaitlists[k] = [...v]
    }
    saveState({
      players: allPlayers,
      selectedIds: [...selectedIds],
      waitlists: serializedWaitlists,
      history,
      activeSkill,
      activeCategory,
      round,
      auctionComplete,
    })
  }, [allPlayers, selectedIds, waitlists, history, activeSkill, activeCategory, round, auctionComplete, loaded])

  // Get available players based on round
  const getAvailablePlayers = useCallback(() => {
    if (round > 1) {
      // Round N (N>1): pool is waitlist from previous round, minus selected, minus skipped this round
      const prevWaitlist = getWaitlist(round - 1)
      const currentSkipped = getWaitlist(round)
      return allPlayers.filter(p =>
        prevWaitlist.has(p.id) && !selectedIds.has(p.id) && !currentSkipped.has(p.id)
      )
    }
    // Round 1
    const round1Waitlist = getWaitlist(1)
    if (isKidsCategory(activeCategory)) {
      // Kids: all skill levels, filter by category only
      return allPlayers.filter(p =>
        p.category === activeCategory &&
        !selectedIds.has(p.id) &&
        !round1Waitlist.has(p.id)
      )
    }
    // Adults: filter by skill + category
    return allPlayers.filter(p =>
      p.skill === activeSkill &&
      (activeCategory === 'All' ? ADULT_CATEGORIES.includes(p.category) : p.category === activeCategory) &&
      !selectedIds.has(p.id) &&
      !round1Waitlist.has(p.id)
    )
  }, [allPlayers, activeSkill, activeCategory, selectedIds, waitlists, round])

  const availablePlayers = getAvailablePlayers()

  // Get players for the table view
  const getPoolPlayers = useCallback(() => {
    if (round > 1) {
      const prevWaitlist = getWaitlist(round - 1)
      return allPlayers.filter(p => prevWaitlist.has(p.id))
    }
    if (isKidsCategory(activeCategory)) {
      return allPlayers.filter(p => p.category === activeCategory)
    }
    return allPlayers.filter(p =>
      p.skill === activeSkill &&
      (activeCategory === 'All' ? ADULT_CATEGORIES.includes(p.category) : p.category === activeCategory)
    )
  }, [allPlayers, activeSkill, activeCategory, waitlists, round])

  const handleSpin = useCallback(() => {
    if (spinning || availablePlayers.length === 0) return
    setSpinning(true)
    setCurrentPlayer(null)

    const winner = pickRandom(availablePlayers)

    setTimeout(() => {
      setCurrentPlayer(winner)
      setSpinning(false)
    }, 3000)
  }, [spinning, availablePlayers])

  const handleSelect = useCallback(() => {
    if (!currentPlayer) return
    setHistory(prev => [...prev, { type: 'select', player: currentPlayer, round }])
    setSelectedIds(prev => new Set([...prev, currentPlayer.id]))
    // In Round N>1, remove from the previous round's waitlist
    if (round > 1) {
      setWaitlists(prev => {
        const prevWaitlist = new Set(prev[round - 1] || [])
        prevWaitlist.delete(currentPlayer.id)
        return { ...prev, [round - 1]: prevWaitlist }
      })
    }
    setCurrentPlayer(null)
  }, [currentPlayer, round])

  const handleSkip = useCallback(() => {
    if (!currentPlayer) return
    // Skip in any round: move player to current round's waitlist (pool for next round)
    setHistory(prev => [...prev, { type: 'skip', player: currentPlayer, round }])
    setWaitlists(prev => {
      const currentWaitlist = new Set(prev[round] || [])
      currentWaitlist.add(currentPlayer.id)
      const next = { ...prev, [round]: currentWaitlist }
      // In round > 1, also remove from previous round's waitlist
      if (round > 1) {
        const prevWaitlist = new Set(prev[round - 1] || [])
        prevWaitlist.delete(currentPlayer.id)
        next[round - 1] = prevWaitlist
      }
      return next
    })
    setCurrentPlayer(null)
  }, [currentPlayer, round])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const lastAction = history[history.length - 1]
    setHistory(prev => prev.slice(0, -1))

    if (lastAction.type === 'select') {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(lastAction.player.id)
        return next
      })
      // If it was a round > 1 select, re-add to previous round's waitlist
      if (lastAction.round > 1) {
        setWaitlists(prev => {
          const prevWaitlist = new Set(prev[lastAction.round - 1] || [])
          prevWaitlist.add(lastAction.player.id)
          return { ...prev, [lastAction.round - 1]: prevWaitlist }
        })
      }
    } else if (lastAction.type === 'skip') {
      // Remove from current round's waitlist
      setWaitlists(prev => {
        const skipRound = lastAction.round
        const currentWaitlist = new Set(prev[skipRound] || [])
        currentWaitlist.delete(lastAction.player.id)
        const next = { ...prev, [skipRound]: currentWaitlist }
        // If skipped in round > 1, restore to previous round's waitlist
        if (skipRound > 1) {
          const prevWaitlist = new Set(prev[skipRound - 1] || [])
          prevWaitlist.add(lastAction.player.id)
          next[skipRound - 1] = prevWaitlist
        }
        return next
      })
    }
    setCurrentPlayer(null)
  }, [history])

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset all selections and waitlist? This cannot be undone.')) return
    setSelectedIds(new Set())
    setWaitlists({})
    setHistory([])
    setCurrentPlayer(null)
    setRound(1)
  }, [])

  // Start next round (uses current round's waitlist as pool)
  const handleStartNextRound = useCallback(() => {
    const currentWaitlist = getWaitlist(round)
    if (currentWaitlist.size === 0) return
    setRound(prev => prev + 1)
    setCurrentPlayer(null)
    setSimulating(false)
    simulateRef.current = false
  }, [waitlists, round])

  // Go back one round
  const handleBackRound = useCallback(() => {
    if (round <= 1) return
    setRound(prev => prev - 1)
    setCurrentPlayer(null)
    setSimulating(false)
    simulateRef.current = false
  }, [round])

  // Complete Auction
  const handleCompleteAuction = useCallback(() => {
    if (!window.confirm('Mark the auction as complete? You can start a new auction afterwards.')) return
    setAuctionComplete(true)
    setCurrentPlayer(null)
    setSimulating(false)
    simulateRef.current = false
  }, [])

  // New Auction — full reset back to upload screen
  const handleNewAuction = useCallback(() => {
    if (!window.confirm('Start a fresh auction? All current data will be cleared.')) return
    setAllPlayers([])
    setSelectedIds(new Set())
    setWaitlists({})
    setHistory([])
    setCurrentPlayer(null)
    setRound(1)
    setAuctionComplete(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Simulation
  const stopSimulation = useCallback(() => {
    simulateRef.current = false
    setSimulating(false)
  }, [])

  const startSimulation = useCallback(() => {
    if (spinning || simulating) return
    simulateRef.current = true
    setSimulating(true)
  }, [spinning, simulating])

  useEffect(() => {
    if (!simulating || spinning) return

    if (currentPlayer) {
      const timer = setTimeout(() => {
        if (!simulateRef.current) return
        // Auto-select
        setHistory(prev => [...prev, { type: 'select', player: currentPlayer, round }])
        setSelectedIds(prev => new Set([...prev, currentPlayer.id]))
        if (round > 1) {
          setWaitlists(prev => {
            const prevWaitlist = new Set(prev[round - 1] || [])
            prevWaitlist.delete(currentPlayer.id)
            return { ...prev, [round - 1]: prevWaitlist }
          })
        }
        setCurrentPlayer(null)
      }, 1500)
      return () => clearTimeout(timer)
    }

    // Compute fresh pool
    let pool
    if (round > 1) {
      const prevWaitlist = getWaitlist(round - 1)
      const currentSkipped = getWaitlist(round)
      pool = allPlayers.filter(p =>
        prevWaitlist.has(p.id) && !selectedIds.has(p.id) && !currentSkipped.has(p.id)
      )
    } else {
      const round1Waitlist = getWaitlist(1)
      if (isKidsCategory(activeCategory)) {
        pool = allPlayers.filter(p =>
          p.category === activeCategory &&
          !selectedIds.has(p.id) &&
          !round1Waitlist.has(p.id)
        )
      } else {
        pool = allPlayers.filter(p =>
          p.skill === activeSkill &&
          (activeCategory === 'All' ? ADULT_CATEGORIES.includes(p.category) : p.category === activeCategory) &&
          !selectedIds.has(p.id) &&
          !round1Waitlist.has(p.id)
        )
      }
    }

    if (pool.length === 0) {
      stopSimulation()
      return
    }

    const timer = setTimeout(() => {
      if (!simulateRef.current) return
      const winner = pickRandom(pool)
      setSpinning(true)
      setTimeout(() => {
        setCurrentPlayer(winner)
        setSpinning(false)
      }, 2000)
    }, 500)
    return () => clearTimeout(timer)
  }, [simulating, spinning, currentPlayer, allPlayers, activeSkill, activeCategory, selectedIds, waitlists, round, stopSimulation])

  const selectedPlayers = allPlayers.filter(p => selectedIds.has(p.id))
  // Current round's waitlist (players skipped this round, pool for next round)
  const currentRoundWaitlistPlayers = allPlayers.filter(p => getWaitlist(round).has(p.id))
  // Total waitlisted across all rounds (for header display)
  const totalWaitlistCount = allWaitlistIds.size

  const handleRestoreFromWaitlist = useCallback((playerId, fromRound) => {
    setWaitlists(prev => {
      const wl = new Set(prev[fromRound] || [])
      wl.delete(playerId)
      // If restoring from round > 1 waitlist, put back into previous round's waitlist
      const next = { ...prev, [fromRound]: wl }
      if (fromRound > 1) {
        const prevWl = new Set(prev[fromRound - 1] || [])
        prevWl.add(playerId)
        next[fromRound - 1] = prevWl
      }
      return next
    })
    setHistory(prev => [...prev, { type: 'restore', player: allPlayers.find(p => p.id === playerId), round: fromRound }])
  }, [allPlayers])

  // Stats
  const kidsMode = isKidsCategory(activeCategory)
  const matchesPool = (p) => {
    if (kidsMode) return p.category === activeCategory
    return p.skill === activeSkill && (activeCategory === 'All' ? ADULT_CATEGORIES.includes(p.category) : p.category === activeCategory)
  }
  const totalForPool = round > 1
    ? allPlayers.filter(p => getWaitlist(round - 1).has(p.id)).length
    : allPlayers.filter(matchesPool).length
  const selectedForPool = round > 1
    ? 0
    : allPlayers.filter(p => matchesPool(p) && selectedIds.has(p.id)).length

  // Download template CSV
  const handleDownloadTemplate = useCallback(() => {
    const headers = [
      'Full Name',
      'Category',
      'Self-Assessed Skill Rating (Our Society level)',
    ]
    const sampleRows = [
      ['John Doe', 'Mens (Age 18+ and above)', 'Advanced'],
      ['Jane Smith', 'Womens', 'Intermediate +'],
      ['Alex Kumar', 'Mens (Age 18+ and above)', 'Intermediate'],
      ['Sam Wilson', 'Kids (Age 10-18 years)', 'Beginner'],
    ]
    const csv = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'player_auction_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neon-cyan font-display text-2xl animate-pulse">Loading...</div>
      </div>
    )
  }

  // Empty state — no players loaded
  if (allPlayers.length === 0) {
    return (
      <div className="min-h-screen bg-slot-bg flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          {/* Hero Banner */}
          <div className="relative mb-6 rounded-2xl overflow-hidden border border-slot-border shadow-[0_0_40px_rgba(0,100,255,0.15)]">
            <img
              src={`${import.meta.env.BASE_URL}abl-banner.jpg`}
              alt="ABL 2026 - Assetz Badminton League"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slot-bg via-transparent to-transparent" />
          </div>

          <h1 className="font-display text-3xl font-bold tracking-wider text-white mb-1">
            Player <span className="text-neon-cyan">Auction</span>
          </h1>
          <p className="text-gray-500 font-display text-[10px] tracking-[4px] uppercase mb-8">Assetz Badminton League 2026</p>

          <div className="rounded-xl border-2 border-dashed border-gray-700 bg-panel-bg/60 p-8 mb-6">
            <Upload className="w-10 h-10 text-neon-cyan mx-auto mb-4 opacity-60" />
            <p className="text-gray-300 text-sm mb-1">Upload your player list to get started</p>
            <p className="text-gray-600 text-xs mb-6">Supports .csv, .xlsx, .xls files</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-neon btn-spin inline-flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              Choose File
            </button>
          </div>

          {/* Template Info */}
          <div className="rounded-xl border border-slot-border bg-panel-bg/60 p-6 text-left">
            <h3 className="font-display text-xs tracking-wider uppercase text-neon-cyan mb-3">
              Required File Format
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Your file must have these column headers (exact names):
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-neon-green text-xs font-mono bg-neon-green/10 px-2 py-0.5 rounded shrink-0">Required</span>
                <div>
                  <code className="text-xs text-gray-200">Full Name</code>
                  <p className="text-[11px] text-gray-600">Player's full name</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neon-green text-xs font-mono bg-neon-green/10 px-2 py-0.5 rounded shrink-0">Required</span>
                <div>
                  <code className="text-xs text-gray-200">Self-Assessed Skill Rating (Our Society level)</code>
                  <p className="text-[11px] text-gray-600">One of: Advanced, Intermediate +, Intermediate, Beginner</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-neon-yellow text-xs font-mono bg-neon-yellow/10 px-2 py-0.5 rounded shrink-0">Optional</span>
                <div>
                  <code className="text-xs text-gray-200">Category</code>
                  <p className="text-[11px] text-gray-600">e.g. Mens (Age 18+ and above), Womens, Kids (Age 10-18 years), Kids (Upto 10 years)</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="text-neon-cyan text-xs hover:underline underline-offset-2 font-display tracking-wider"
            >
              Download Template CSV
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Auction Complete screen
  if (auctionComplete) {
    const selectedBySkill = {}
    selectedPlayers.forEach(p => {
      if (!selectedBySkill[p.skill]) selectedBySkill[p.skill] = []
      selectedBySkill[p.skill].push(p)
    })

    return (
      <div className="min-h-screen bg-slot-bg flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center py-12">
          {/* Hero Banner */}
          <div className="relative mb-6 rounded-2xl overflow-hidden border border-slot-border shadow-[0_0_40px_rgba(0,100,255,0.15)] max-w-md mx-auto">
            <img
              src={`${import.meta.env.BASE_URL}abl-banner.jpg`}
              alt="ABL 2026 - Assetz Badminton League"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slot-bg via-transparent to-transparent" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <CheckCircle2 className="w-10 h-10 text-neon-green drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]" />
            </div>
          </div>

          <h1 className="font-display text-4xl font-black tracking-wider text-white mb-2"
            style={{ textShadow: '0 0 40px rgba(0, 255, 247, 0.3)' }}
          >
            Auction Complete
          </h1>
          <p className="text-gray-500 font-display text-[10px] tracking-[4px] uppercase mb-8">
            Assetz Badminton League 2026
          </p>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
              <p className="font-display text-3xl font-black text-neon-green">{selectedIds.size}</p>
              <p className="font-display text-[10px] tracking-wider uppercase text-gray-500 mt-1">Selected</p>
            </div>
            <div className="rounded-xl border border-neon-yellow/20 bg-neon-yellow/5 p-4">
              <p className="font-display text-3xl font-black text-neon-yellow">{totalWaitlistCount}</p>
              <p className="font-display text-[10px] tracking-wider uppercase text-gray-500 mt-1">Waitlist</p>
            </div>
            <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-4">
              <p className="font-display text-3xl font-black text-neon-cyan">{allPlayers.length}</p>
              <p className="font-display text-[10px] tracking-wider uppercase text-gray-500 mt-1">Total</p>
            </div>
          </div>

          {/* Selected Players by Skill */}
          <div className="rounded-xl border border-slot-border bg-panel-bg/60 p-6 text-left mb-8 max-h-[400px] overflow-y-auto">
            <h3 className="font-display text-xs tracking-wider uppercase text-neon-cyan mb-4">
              Selected Players
            </h3>
            {['Advanced', 'Intermediate +', 'Intermediate', 'Beginner'].map(skill => {
              const players = selectedBySkill[skill]
              if (!players || players.length === 0) return null
              const badgeClass = skill === 'Advanced' ? 'badge-advanced' :
                skill === 'Intermediate +' ? 'badge-intermediate-plus' :
                skill === 'Intermediate' ? 'badge-intermediate' : 'badge-beginner'
              return (
                <div key={skill} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${badgeClass}`}>
                      {skill}
                    </span>
                    <span className="text-gray-600 text-[10px]">{players.length} players</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {players.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs w-5">{i + 1}.</span>
                        <span className="text-gray-200 text-xs">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setAuctionComplete(false)}
              className="btn-neon btn-undo flex items-center gap-2 text-sm"
            >
              <Undo2 className="w-4 h-4" />
              Back to Auction
            </button>
            <button
              onClick={handleNewAuction}
              className="flex items-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-6 py-3 rounded-lg border-2 border-neon-green text-neon-green bg-neon-green/10 shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:bg-neon-green/20 hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] transition-all duration-300 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              New Auction
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slot-bg">
      {/* Header */}
      <header className="border-b border-slot-border bg-panel-bg/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}abl-banner.jpg`}
                alt="ABL 2026"
                className="h-10 w-auto rounded-md border border-slot-border object-cover object-center"
                style={{ aspectRatio: '3/1' }}
              />
              <div>
                <h1 className="font-display text-xl md:text-2xl font-bold tracking-wider text-white">
                  ABL <span className="text-neon-cyan">26</span>
                </h1>
                <p className="text-xs text-gray-500 tracking-widest font-display uppercase">Player Auction</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {/* Round Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                round > 1
                  ? 'bg-neon-magenta/10 border-neon-magenta/30'
                  : 'bg-white/5 border-gray-700'
              }`}>
                <span className={`font-display text-xs font-bold tracking-wider ${
                  round > 1 ? 'text-neon-magenta' : 'text-gray-400'
                }`}>
                  Round {round}
                </span>
              </div>
              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neon-orange/30 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 transition-colors cursor-pointer font-display text-xs tracking-wider"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Load File</span>
              </button>
              <button
                onClick={handleNewAuction}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer font-display text-xs tracking-wider"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-green/10 border border-neon-green/20">
                <Users className="w-4 h-4 text-neon-green" />
                <span className="text-neon-green font-display text-xs">{allPlayers.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
                <UserCheck className="w-4 h-4 text-neon-cyan" />
                <span className="text-neon-cyan font-display text-xs">{selectedIds.size}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-yellow/10 border border-neon-yellow/20">
                <Clock className="w-4 h-4 text-neon-yellow" />
                <span className="text-neon-yellow font-display text-xs">{totalWaitlistCount}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {round <= 1 ? (
          <>
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => { setActiveCategory(cat); setCurrentPlayer(null) }}
                >
                  {CATEGORY_SHORT[cat]}
                </button>
              ))}
            </div>

            {/* Skill Level Tabs — hidden for Kids categories */}
            {!kidsMode && <div className="flex flex-wrap gap-3 mb-6 justify-center">
              {SKILL_LEVELS.map(skill => {
                const catFilter = (p) => activeCategory === 'All' ? ADULT_CATEGORIES.includes(p.category) : p.category === activeCategory
                const count = allPlayers.filter(p => p.skill === skill && catFilter(p)).length
                const selCount = allPlayers.filter(p => p.skill === skill && catFilter(p) && selectedIds.has(p.id)).length
                const badgeClass = skill === 'Advanced' ? 'badge-advanced' :
                  skill === 'Intermediate +' ? 'badge-intermediate-plus' :
                  skill === 'Intermediate' ? 'badge-intermediate' : 'badge-beginner'
                const icon = skill === 'Advanced' ? <Star className="w-3.5 h-3.5" /> :
                  skill === 'Intermediate +' ? <Zap className="w-3.5 h-3.5" /> :
                  skill === 'Intermediate' ? <Shield className="w-3.5 h-3.5" /> :
                  <Target className="w-3.5 h-3.5" />
                return (
                  <button
                    key={skill}
                    onClick={() => { setActiveSkill(skill); setCurrentPlayer(null) }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-display text-xs font-semibold tracking-wider uppercase transition-all duration-300 border ${
                      activeSkill === skill
                        ? `${badgeClass} shadow-lg`
                        : 'border-gray-800 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    {icon}
                    {skill}
                    <span className="text-[10px] opacity-70">({selCount}/{count})</span>
                  </button>
                )
              })}
            </div>}

            {/* Kids category header */}
            {kidsMode && (
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-neon-yellow/40 bg-neon-yellow/10">
                  <Target className="w-5 h-5 text-neon-yellow" />
                  <span className="font-display text-sm font-bold tracking-[3px] uppercase text-neon-yellow">
                    {CATEGORY_SHORT[activeCategory]} — All Skills
                  </span>
                  <span className="text-xs text-neon-yellow/60 font-display">
                    ({availablePlayers.length} players)
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Round N Header */
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-neon-magenta/40 bg-neon-magenta/10">
              <FastForward className="w-5 h-5 text-neon-magenta" />
              <span className="font-display text-sm font-bold tracking-[3px] uppercase text-neon-magenta">
                Round {round} — Round {round - 1} Waitlist Pool
              </span>
              <span className="text-xs text-neon-magenta/60 font-display">
                ({availablePlayers.length} players)
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              All skill levels combined — selecting from Round {round - 1} waitlisted players
            </p>
            <button
              onClick={handleBackRound}
              className="mt-2 text-xs text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
            >
              Back to Round {round - 1}
            </button>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Player Pool */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <PlayerTable
              players={getPoolPlayers()}
              selectedIds={selectedIds}
              waitlistIds={getWaitlist(round)}
              currentPlayerId={currentPlayer?.id}
              spinning={spinning}
              activeSkill={(round > 1 || kidsMode) ? null : activeSkill}
              round={round}
              kidsMode={round <= 1 && kidsMode}
            />
          </div>

          {/* Center - Slot Machine */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <SlotMachine
              players={availablePlayers}
              spinning={spinning}
              currentPlayer={currentPlayer}
              activeSkill={round > 1 ? `Round ${round}` : kidsMode ? CATEGORY_SHORT[activeCategory] : activeSkill}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                className="btn-neon btn-spin flex items-center justify-center gap-2 col-span-2"
                onClick={handleSpin}
                disabled={spinning || simulating || availablePlayers.length === 0}
              >
                <Dices className="w-5 h-5" />
                {spinning ? 'Spinning...' : availablePlayers.length === 0 ? 'Pool Empty' : 'Spin'}
              </button>
              <button
                className="btn-neon btn-select flex items-center justify-center gap-2"
                onClick={handleSelect}
                disabled={!currentPlayer || spinning || simulating}
              >
                <UserCheck className="w-4 h-4" />
                Select
              </button>
              <button
                className="btn-neon btn-skip flex items-center justify-center gap-2"
                onClick={handleSkip}
                disabled={!currentPlayer || spinning || simulating}
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
              <button
                className="btn-neon btn-undo flex items-center justify-center gap-2"
                onClick={handleUndo}
                disabled={history.length === 0 || spinning || simulating}
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </button>
              <button
                className="btn-neon btn-reset flex items-center justify-center gap-2"
                onClick={handleReset}
                disabled={spinning || simulating}
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              {/* Simulate Round */}
              <button
                className={`col-span-2 flex items-center justify-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-4 py-3 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                  simulating
                    ? 'border-red-500 text-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(255,50,50,0.3)] hover:bg-red-500/20'
                    : 'border-neon-green text-neon-green bg-neon-green/10 shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:bg-neon-green/20 hover:shadow-[0_0_30px_rgba(57,255,20,0.4)]'
                }`}
                onClick={simulating ? stopSimulation : startSimulation}
                disabled={!simulating && (spinning || availablePlayers.length === 0)}
              >
                {simulating ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {simulating ? 'Stop Simulation' : `Simulate Round ${round}`}
              </button>
            </div>

            {/* Pool Stats */}
            <div className="mt-4 text-center">
              <p className="text-gray-500 text-xs font-display tracking-wider">
                Pool: <span className="text-neon-cyan">{availablePlayers.length}</span> remaining
                {round <= 1 && (
                  <>
                    &nbsp;|&nbsp;
                    Selected: <span className="text-neon-green">{selectedForPool}</span>/{totalForPool}
                  </>
                )}
              </p>
            </div>

            {/* Start Next Round Button (visible when current round's waitlist has players) */}
            {getWaitlist(round).size > 0 && (
              <button
                onClick={handleStartNextRound}
                disabled={spinning || simulating}
                className="mt-4 w-full flex items-center justify-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-4 py-3 rounded-lg border-2 border-neon-magenta text-neon-magenta bg-neon-magenta/10 shadow-[0_0_20px_rgba(255,0,255,0.2)] hover:bg-neon-magenta/20 hover:shadow-[0_0_30px_rgba(255,0,255,0.4)] transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FastForward className="w-4 h-4" />
                Start Round {round + 1} ({getWaitlist(round).size} in waitlist)
              </button>
            )}

            {/* Complete Auction Button */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleCompleteAuction}
                disabled={spinning || simulating}
                className="mt-3 w-full flex items-center justify-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-4 py-3 rounded-lg border-2 border-neon-yellow text-neon-yellow bg-neon-yellow/10 shadow-[0_0_20px_rgba(255,230,0,0.2)] hover:bg-neon-yellow/20 hover:shadow-[0_0_30px_rgba(255,230,0,0.4)] transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Auction
              </button>
            )}
          </div>

          {/* Right Panel - Selected & Waitlist */}
          <div className="lg:col-span-4 order-3 space-y-6">
            <SelectedPanel players={selectedPlayers} />
            {Object.entries(waitlists)
              .filter(([, ids]) => ids.size > 0)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([r, ids]) => {
                const players = allPlayers.filter(p => ids.has(p.id))
                return (
                  <WaitlistPanel
                    key={r}
                    roundNumber={Number(r)}
                    players={players}
                    onRestore={handleRestoreFromWaitlist}
                  />
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
