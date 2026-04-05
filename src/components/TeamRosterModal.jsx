import { X, Download, Trophy } from 'lucide-react'

const CAT_KEYS = ['mens', 'womens', 'kids10plus', 'kidsUnder10']
const CAT_LABEL = { mens: 'Men', womens: 'Women', kids10plus: 'Kids 10+', kidsUnder10: 'Kids <10' }
const CAT_FULL = {
  mens: 'Mens (Age 18+ and above)',
  womens: 'Womens',
  kids10plus: 'Kids (Age 10-18 years)',
  kidsUnder10: 'Kids (Upto 10 years)',
}
const CAT_SHORT = {
  'Mens (Age 18+ and above)': 'Men',
  'Womens': 'Women',
  'Kids (Age 10-18 years)': 'Kids 10+',
  'Kids (Upto 10 years)': 'Kids <10',
}

export default function TeamRosterModal({ teams, teamAssignments, allPlayers, onClose }) {
  const totalAssigned = Object.keys(teamAssignments).length

  const getTeamData = (team) => {
    const assigned = Object.entries(teamAssignments)
      .filter(([, tid]) => tid === team.id)
      .map(([pid]) => allPlayers.find(p => p.id === parseInt(pid)))
      .filter(Boolean)
    const usage = {
      mens: assigned.filter(p => p.category === CAT_FULL.mens).length,
      womens: assigned.filter(p => p.category === CAT_FULL.womens).length,
      kids10plus: assigned.filter(p => p.category === CAT_FULL.kids10plus).length,
      kidsUnder10: assigned.filter(p => p.category === CAT_FULL.kidsUnder10).length,
    }
    const totalSlots = CAT_KEYS.reduce((s, k) => s + (team[k] || 0), 0)
    return { assigned, usage, totalSlots }
  }

  const handleExport = () => {
    const rows = [['Team', 'Player Name', 'Category', 'Skill', 'Flat']]
    for (const team of teams) {
      const { assigned } = getTeamData(team)
      if (assigned.length === 0) {
        rows.push([team.name, '—', '—', '—', '—'])
      } else {
        for (const p of assigned) {
          rows.push([
            team.name,
            p.name,
            CAT_SHORT[p.category] || p.category,
            p.skill,
            p.flat || '',
          ])
        }
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team_rosters.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slot-bg">
      {/* Header */}
      <div className="border-b border-slot-border bg-panel-bg/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-neon-cyan" />
          <h2 className="font-display text-xl font-bold tracking-wider text-white">
            Team <span className="text-neon-cyan">Rosters</span>
          </h2>
          <span className="text-gray-500 font-display text-xs tracking-wider">
            {teams.length} teams · {totalAssigned} players assigned
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors cursor-pointer font-display text-xs tracking-wider font-bold"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-white/5 text-gray-400 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {teams.map(team => {
            const { assigned, usage, totalSlots } = getTeamData(team)
            const isComplete = totalSlots > 0 && assigned.length >= totalSlots

            return (
              <div
                key={team.id}
                className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  isComplete
                    ? 'border-neon-green/30 bg-neon-green/5'
                    : 'border-slot-border bg-panel-bg/60'
                }`}
              >
                {/* Team header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-white tracking-wide truncate mr-2">
                    {team.name}
                  </h3>
                  <span className={`text-xs font-display font-bold shrink-0 ${isComplete ? 'text-neon-green' : 'text-gray-500'}`}>
                    {assigned.length}/{totalSlots}
                  </span>
                </div>

                {/* Slot progress */}
                <div className="flex gap-1.5">
                  {CAT_KEYS.filter(k => (team[k] || 0) > 0).map(key => {
                    const used = usage[key]
                    const max = team[key]
                    const full = used >= max
                    return (
                      <div
                        key={key}
                        className={`flex-1 rounded text-center py-1 text-[9px] font-display leading-tight ${
                          full ? 'bg-neon-green/20 text-neon-green' : 'bg-white/5 text-gray-500'
                        }`}
                      >
                        <div>{CAT_LABEL[key]}</div>
                        <div className={full ? 'font-bold' : ''}>{used}/{max}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Player list grouped by category */}
                <div className="flex-1 space-y-2">
                  {CAT_KEYS.map(key => {
                    const catPlayers = assigned.filter(p => p.category === CAT_FULL[key])
                    if (catPlayers.length === 0) return null
                    return (
                      <div key={key}>
                        <p className="text-[9px] font-display tracking-wider uppercase text-gray-600 mb-1">
                          {CAT_LABEL[key]}
                        </p>
                        {catPlayers.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 py-0.5">
                            <span className="text-gray-600 text-xs w-4 shrink-0">{i + 1}.</span>
                            <span className="text-gray-200 text-xs font-medium flex-1 truncate">{p.name}</span>
                            <span className="text-gray-600 text-[9px] shrink-0">{p.skill?.replace('Intermediate +', 'Int+').replace('Intermediate', 'Int').replace('Advanced', 'Adv').replace('Beginner', 'Beg')}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {assigned.length === 0 && (
                    <p className="text-gray-700 text-xs text-center py-2">No players assigned</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
