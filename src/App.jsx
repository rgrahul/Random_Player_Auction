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
import TeamRosterPanel from './components/TeamRosterPanel'
import TeamRosterModal from './components/TeamRosterModal'
import { pickRandom, shuffle } from './utils/random'
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

const getCatKey = (category) => {
  if (category === 'Mens (Age 18+ and above)') return 'mens'
  if (category === 'Womens') return 'womens'
  if (category === 'Kids (Age 10-18 years)') return 'kids10plus'
  if (category === 'Kids (Upto 10 years)') return 'kidsUnder10'
  return null
}

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

const str = (v) => String(v ?? '').trim()

function parseTeams(rows) {
  return rows.map((row, i) => ({
    id: i,
    name: str(row['Team Name'] || row['Team'] || row['Name']),
    mens: parseInt(row['Mens'] || row['Men'] || row['Man'] || 0) || 0,
    womens: parseInt(row['Womens'] || row['Women'] || row['Woman'] || 0) || 0,
    kids10plus: parseInt(row['Kids 10-18'] || row['Kids (10-18)'] || row['Kids Above 10'] || row['Kids10Plus'] || 0) || 0,
    kidsUnder10: parseInt(row['Kids Under 10'] || row['Kids (<10)'] || row['Kids Below 10'] || row['KidsUnder10'] || 0) || 0,
  })).filter(t => t.name)
}

function parseRows(rows) {
  return rows.map((row, i) => ({
    id: i,
    name: str(row['Full Name'] || row['Name']),
    skill: str(row['Self-Assessed Skill Rating (Our Society level)']),
    category: str(row['Category']),
    flat: str(row['Flat number']),
    experience: str(row['Years/months of playing experience']),
    strength: str(row['What is your key strength/shot that can turn a match in your favour?']),
    photoUrl: str(row['Profile Photo (will be used for auction)']),
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
  const [teams, setTeams] = useState([])
  const [teamAssignments, setTeamAssignments] = useState({}) // { [playerId]: teamId }
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [autoAssignPhase, setAutoAssignPhase] = useState(null) // null | 'spinning' | 'revealing' | 'assigning'
  const [autoAssignCurrent, setAutoAssignCurrent] = useState(null) // { player, teamId, teamName }
  const [autoAssignProgress, setAutoAssignProgress] = useState({ current: 0, total: 0 })
  const autoAssignStopRef = useRef(false)
  const appliedRef = useRef([])
  const simulateRef = useRef(false)
  const fileInputRef = useRef(null)
  const teamsFileInputRef = useRef(null)

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
      if (saved.teams) setTeams(saved.teams)
      if (saved.teamAssignments) setTeamAssignments(saved.teamAssignments)
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

  // Handle teams file upload
  const handleTeamsUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()

    const loadTeams = (parsed) => {
      if (parsed.length === 0) {
        alert('No valid teams found. Ensure the file has a "Team Name" column plus composition columns: Mens, Womens, Kids 10-18, Kids Under 10.')
        return
      }
      setTeams(parsed)
      setTeamAssignments({})
    }

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true })
        loadTeams(parseTeams(result.data))
      }
      reader.readAsText(file)
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const workbook = XLSX.read(ev.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        loadTeams(parseTeams(rows))
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
      teams,
      teamAssignments,
    })
  }, [allPlayers, selectedIds, waitlists, history, activeSkill, activeCategory, round, auctionComplete, teams, teamAssignments, loaded])

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

  const handleAssignToTeam = useCallback((teamId) => {
    if (!currentPlayer) return
    setHistory(prev => [...prev, { type: 'assign', player: currentPlayer, teamId, round }])
    setSelectedIds(prev => new Set([...prev, currentPlayer.id]))
    setTeamAssignments(prev => ({ ...prev, [currentPlayer.id]: teamId }))
    if (round > 1) {
      setWaitlists(prev => {
        const prevWaitlist = new Set(prev[round - 1] || [])
        prevWaitlist.delete(currentPlayer.id)
        return { ...prev, [round - 1]: prevWaitlist }
      })
    }
    setCurrentPlayer(null)
  }, [currentPlayer, round])

  const handleStopAutoAssign = useCallback(() => {
    autoAssignStopRef.current = true
    if (appliedRef.current.length > 0) {
      setHistory(prev => [...prev, { type: 'auto-assign', assignments: [...appliedRef.current], round }])
    }
    appliedRef.current = []
    setAutoAssignPhase(null)
    setAutoAssignCurrent(null)
    setAutoAssignProgress({ current: 0, total: 0 })
  }, [round])

  const handleAutoAssign = useCallback(() => {
    if (teams.length === 0 || autoAssigning) return

    const CAT_MAP = {
      mens: 'Mens (Age 18+ and above)',
      womens: 'Womens',
      kids10plus: 'Kids (Age 10-18 years)',
      kidsUnder10: 'Kids (Upto 10 years)',
    }

    const snapAssignments = { ...teamAssignments }
    const snapSelected = new Set(selectedIds)
    const queue = []

    for (const [catKey, catFull] of Object.entries(CAT_MAP)) {
      const unassigned = shuffle(allPlayers.filter(p => p.category === catFull && !snapSelected.has(p.id)))
      const slotPool = shuffle(
        teams.flatMap(team => {
          const used = Object.entries(snapAssignments)
            .filter(([, tid]) => tid === team.id)
            .map(([pid]) => allPlayers.find(p => p.id === parseInt(pid)))
            .filter(p => p?.category === catFull).length
          const remaining = (team[catKey] || 0) - used
          return Array(Math.max(0, remaining)).fill(team.id)
        })
      )
      const count = Math.min(unassigned.length, slotPool.length)
      for (let i = 0; i < count; i++) {
        queue.push({
          player: unassigned[i],
          teamId: slotPool[i],
          teamName: teams.find(t => t.id === slotPool[i])?.name || '',
        })
      }
    }

    if (queue.length === 0) {
      alert('No players could be assigned. All slots may be full or no unassigned players remain.')
      return
    }

    // Target 2.5 minutes, per-player timing clamped 1.2s–4s
    const TARGET_MS = 2.5 * 60 * 1000
    const perPlayer = Math.min(Math.max(TARGET_MS / queue.length, 1200), 4000)
    const spinMs   = Math.round(perPlayer * 0.35)
    const revealMs = Math.round(perPlayer * 0.28)
    const assignMs = Math.round(perPlayer * 0.37)

    const capturedRound = round
    autoAssignStopRef.current = false
    appliedRef.current = []
    setCurrentPlayer(null)

    const processNext = (index) => {
      if (autoAssignStopRef.current) return
      if (index >= queue.length) {
        // All done
        setHistory(prev => [...prev, { type: 'auto-assign', assignments: [...appliedRef.current], round: capturedRound }])
        appliedRef.current = []
        setAutoAssignPhase(null)
        setAutoAssignCurrent(null)
        setAutoAssignProgress({ current: 0, total: 0 })
        return
      }

      const item = queue[index]
      setAutoAssignProgress({ current: index + 1, total: queue.length })

      // Phase 1: spin
      setAutoAssignPhase('spinning')
      setAutoAssignCurrent(null)

      setTimeout(() => {
        if (autoAssignStopRef.current) return
        // Phase 2: reveal player
        setAutoAssignPhase('revealing')
        setAutoAssignCurrent(item)

        setTimeout(() => {
          if (autoAssignStopRef.current) return
          // Phase 3: show team assignment + apply
          setAutoAssignPhase('assigning')
          setSelectedIds(prev => new Set([...prev, item.player.id]))
          setTeamAssignments(prev => ({ ...prev, [item.player.id]: item.teamId }))
          appliedRef.current.push(item)

          setTimeout(() => processNext(index + 1), assignMs)
        }, revealMs)
      }, spinMs)
    }

    setAutoAssignPhase('spinning')
    processNext(0)
  }, [teams, teamAssignments, selectedIds, allPlayers, round, autoAssignPhase])

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

    if (lastAction.type === 'auto-assign') {
      const ids = new Set(lastAction.assignments.map(a => a.player.id))
      setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      setTeamAssignments(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n })
      return
    }

    if (lastAction.type === 'select' || lastAction.type === 'assign') {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(lastAction.player.id)
        return next
      })
      if (lastAction.type === 'assign') {
        setTeamAssignments(prev => {
          const next = { ...prev }
          delete next[lastAction.player.id]
          return next
        })
      }
      // If it was a round > 1 select/assign, re-add to previous round's waitlist
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
    setAllPlayers([])
    setTeams([])
    setSelectedIds(new Set())
    setWaitlists({})
    setTeamAssignments({})
    setHistory([])
    setCurrentPlayer(null)
    setRound(1)
    setAuctionComplete(false)
    setSimulating(false)
    simulateRef.current = false
    localStorage.removeItem(STORAGE_KEY)
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
    setTeams([])
    setTeamAssignments({})
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

  const autoAssigning = autoAssignPhase !== null

  // Team usage: how many of each category are assigned to a given team
  const getTeamUsage = (teamId) => {
    const assigned = Object.entries(teamAssignments)
      .filter(([, tid]) => tid === teamId)
      .map(([pid]) => allPlayers.find(p => p.id === parseInt(pid)))
      .filter(Boolean)
    return {
      mens: assigned.filter(p => p.category === 'Mens (Age 18+ and above)').length,
      womens: assigned.filter(p => p.category === 'Womens').length,
      kids10plus: assigned.filter(p => p.category === 'Kids (Age 10-18 years)').length,
      kidsUnder10: assigned.filter(p => p.category === 'Kids (Upto 10 years)').length,
    }
  }

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

  const handleDownloadTeamsTemplate = useCallback(() => {
    const headers = ['Team Name', 'Mens', 'Womens', 'Kids 10-18', 'Kids Under 10']
    const sampleRows = [
      ['Team Alpha', 3, 2, 1, 1],
      ['Team Beta', 3, 2, 1, 1],
      ['Team Gamma', 3, 2, 1, 1],
      ['Team Delta', 3, 2, 1, 1],
    ]
    const csv = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teams_template.csv'
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
                  <code className="text-xs text-gray-200">Full Name</code> <span className="text-gray-600 text-[11px]">or</span> <code className="text-xs text-gray-200">Name</code>
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
              Download Players Template CSV
            </button>
          </div>

          {/* Teams Template */}
          <div className="rounded-xl border border-slot-border bg-panel-bg/60 p-6 text-left">
            <h3 className="font-display text-xs tracking-wider uppercase text-neon-magenta mb-3">
              Teams File Format
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Upload a separate file for your 12 teams with composition slots:
            </p>
            <div className="space-y-2 mb-4">
              {[
                ['Team Name', 'Required', 'Team name'],
                ['Mens', 'Required', 'Number of men slots'],
                ['Womens', 'Required', 'Number of women slots'],
                ['Kids 10-18', 'Required', 'Kids (Age 10–18) slots'],
                ['Kids Under 10', 'Required', 'Kids (Under 10) slots'],
              ].map(([col, badge, desc]) => (
                <div key={col} className="flex items-start gap-2">
                  <span className="text-neon-green text-xs font-mono bg-neon-green/10 px-2 py-0.5 rounded shrink-0">{badge}</span>
                  <div>
                    <code className="text-xs text-gray-200">{col}</code>
                    <p className="text-[11px] text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleDownloadTeamsTemplate}
              className="text-neon-magenta text-xs hover:underline underline-offset-2 font-display tracking-wider"
            >
              Download Teams Template CSV
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
              <input
                ref={teamsFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleTeamsUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neon-orange/30 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 transition-colors cursor-pointer font-display text-xs tracking-wider"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Players</span>
              </button>
              <button
                onClick={() => teamsFileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer font-display text-xs tracking-wider ${
                  teams.length > 0
                    ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20'
                    : 'border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">{teams.length > 0 ? `${teams.length} Teams` : 'Load Teams'}</span>
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
              autoAssignPhase={autoAssignPhase}
              autoAssignCurrent={autoAssignCurrent}
              autoAssignProgress={autoAssignProgress}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                className="btn-neon btn-spin flex items-center justify-center gap-2 col-span-2"
                onClick={handleSpin}
                disabled={spinning || simulating || autoAssigning || availablePlayers.length === 0}
              >
                <Dices className="w-5 h-5" />
                {spinning ? 'Spinning...' : availablePlayers.length === 0 ? 'Pool Empty' : 'Spin'}
              </button>

              {/* No teams loaded: show classic Select button */}
              {teams.length === 0 && (
                <button
                  className="btn-neon btn-select flex items-center justify-center gap-2"
                  onClick={handleSelect}
                  disabled={!currentPlayer || spinning || simulating}
                >
                  <UserCheck className="w-4 h-4" />
                  Select
                </button>
              )}

              <button
                className={`btn-neon btn-skip flex items-center justify-center gap-2 ${teams.length === 0 ? '' : 'col-span-2'}`}
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

              {/* Simulate Round — hidden when teams loaded */}
              {teams.length === 0 && (
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
              )}
            </div>

            {/* Auto Assign / Stop button */}
            {teams.length > 0 && (
              autoAssigning ? (
                <button
                  onClick={handleStopAutoAssign}
                  className="mt-4 w-full flex items-center justify-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-4 py-3 rounded-lg border-2 border-red-500 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all duration-300 cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  Stop Auto Assign ({autoAssignProgress.current}/{autoAssignProgress.total})
                </button>
              ) : (
                <button
                  onClick={handleAutoAssign}
                  disabled={spinning || simulating}
                  className="mt-4 w-full flex items-center justify-center gap-2 font-display font-bold text-sm tracking-widest uppercase px-4 py-3 rounded-lg border-2 border-neon-magenta text-neon-magenta bg-neon-magenta/10 shadow-[0_0_20px_rgba(255,0,255,0.2)] hover:bg-neon-magenta/20 hover:shadow-[0_0_30px_rgba(255,0,255,0.4)] transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Zap className="w-4 h-4" />
                  Auto Assign All Players
                </button>
              )
            )}

            {/* Team Assignment Grid — shown when teams loaded and player revealed */}
            {teams.length > 0 && currentPlayer && !spinning && (
              <div className="mt-4">
                <p className="text-center font-display text-[10px] tracking-[3px] uppercase text-neon-cyan mb-3">
                  Assign to Team
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {teams.map(team => {
                    const catKey = getCatKey(currentPlayer.category)
                    const usage = getTeamUsage(team.id)
                    const slots = catKey ? (team[catKey] || 0) : 0
                    const used = catKey ? (usage[catKey] || 0) : 0
                    const remaining = slots - used
                    const canAssign = remaining > 0
                    return (
                      <button
                        key={team.id}
                        onClick={() => handleAssignToTeam(team.id)}
                        disabled={!canAssign}
                        className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-lg border font-display text-[10px] tracking-wide transition-all duration-200 cursor-pointer ${
                          canAssign
                            ? 'border-neon-cyan/40 bg-neon-cyan/10 text-white hover:bg-neon-cyan/25 hover:border-neon-cyan/70 hover:shadow-[0_0_12px_rgba(0,255,247,0.2)]'
                            : 'border-gray-800 bg-black/20 text-gray-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <span className="font-bold truncate w-full text-center leading-tight mb-1">{team.name}</span>
                        <span className={`text-[9px] ${canAssign ? 'text-neon-cyan' : 'text-gray-700'}`}>
                          {catKey ? `${remaining} left` : '—'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prompt when teams loaded but no player yet */}
            {teams.length > 0 && !currentPlayer && !spinning && availablePlayers.length > 0 && (
              <p className="text-center text-gray-600 text-[10px] font-display tracking-widest uppercase mt-4">
                Spin to reveal a player, then assign to a team
              </p>
            )}

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

          {/* Right Panel - Teams / Selected & Waitlist */}
          <div className="lg:col-span-4 order-3 space-y-6">
            {teams.length > 0
              ? <TeamRosterPanel teams={teams} teamAssignments={teamAssignments} allPlayers={allPlayers} onExpand={() => setShowRosterModal(true)} />
              : <SelectedPanel players={selectedPlayers} />
            }
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

      {/* Full-screen roster modal */}
      {showRosterModal && (
        <TeamRosterModal
          teams={teams}
          teamAssignments={teamAssignments}
          allPlayers={allPlayers}
          onClose={() => setShowRosterModal(false)}
        />
      )}
    </div>
  )
}

export default App
