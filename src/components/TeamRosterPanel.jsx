import { Trophy, Expand } from 'lucide-react'

const CAT_KEYS = ['mens', 'womens', 'kids10plus', 'kidsUnder10']
const CAT_LABEL = { mens: 'Men', womens: 'Women', kids10plus: 'Kids 10+', kidsUnder10: 'Kids <10' }
const CAT_FULL = {
  mens: 'Mens (Age 18+ and above)',
  womens: 'Womens',
  kids10plus: 'Kids (Age 10-18 years)',
  kidsUnder10: 'Kids (Upto 10 years)',
}

export default function TeamRosterPanel({ teams, teamAssignments, allPlayers, onExpand }) {
  if (!teams || teams.length === 0) return null

  const totalAssigned = Object.keys(teamAssignments).length

  return (
    <div className="rounded-xl border border-slot-border bg-panel-bg/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slot-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-display text-xs tracking-wider uppercase text-neon-cyan">
            Team Rosters
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-gray-500">{totalAssigned} assigned</span>
          <button
            onClick={onExpand}
            className="flex items-center gap-1 px-2 py-1 rounded border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors cursor-pointer font-display text-[10px] tracking-wider"
          >
            <Expand className="w-3 h-3" />
            View
          </button>
        </div>
      </div>

      <div className="max-h-[540px] overflow-y-auto">
        {teams.map(team => {
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
          const isComplete = totalSlots > 0 && assigned.length >= totalSlots

          return (
            <div
              key={team.id}
              className={`border-b border-slot-border/50 px-4 py-3 ${isComplete ? 'bg-neon-green/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-xs font-bold text-white tracking-wide truncate mr-2">
                  {team.name}
                </span>
                <span className={`text-[10px] font-display shrink-0 ${isComplete ? 'text-neon-green' : 'text-gray-500'}`}>
                  {assigned.length}/{totalSlots}
                </span>
              </div>

              {/* Slot bars */}
              <div className="flex gap-1 mb-2">
                {CAT_KEYS.filter(k => (team[k] || 0) > 0).map(key => {
                  const used = usage[key]
                  const max = team[key]
                  const full = used >= max
                  return (
                    <div
                      key={key}
                      className={`flex-1 text-center px-1 py-0.5 rounded text-[9px] font-display leading-tight ${
                        full ? 'bg-neon-green/15 text-neon-green' : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      <div>{CAT_LABEL[key]}</div>
                      <div className={full ? 'font-bold' : ''}>{used}/{max}</div>
                    </div>
                  )
                })}
              </div>

              {/* Player names */}
              {assigned.length > 0 && (
                <div className="space-y-0.5">
                  {assigned.map(p => (
                    <div key={p.id} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-600 shrink-0">
                        {p.category === CAT_FULL.mens ? 'M' :
                          p.category === CAT_FULL.womens ? 'W' :
                          p.category === CAT_FULL.kids10plus ? 'K10+' : 'K<10'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
