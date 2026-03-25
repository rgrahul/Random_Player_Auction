import { UserCheck } from 'lucide-react'

const SKILL_ORDER = { 'Advanced': 0, 'Intermediate +': 1, 'Intermediate': 2, 'Beginner': 3 }

function SelectedPanel({ players }) {
  const grouped = players.reduce((acc, p) => {
    if (!acc[p.skill]) acc[p.skill] = []
    acc[p.skill].push(p)
    return acc
  }, {})

  const sortedSkills = Object.keys(grouped).sort((a, b) => (SKILL_ORDER[a] ?? 99) - (SKILL_ORDER[b] ?? 99))

  return (
    <div className="rounded-xl border border-slot-border bg-panel-bg/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slot-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-display text-xs tracking-wider uppercase text-neon-cyan">
            Selected Players
          </h3>
        </div>
        <span className="text-[10px] font-display text-gray-500">{players.length} total</span>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-center text-gray-600 py-6 text-sm">No players selected yet</p>
        ) : (
          <div className="divide-y divide-slot-border/50">
            {sortedSkills.map(skill => (
              <div key={skill}>
                <div className="px-4 py-1.5 bg-white/[0.02]">
                  <span className="text-[10px] font-display tracking-wider uppercase text-gray-500">
                    {skill} ({grouped[skill].length})
                  </span>
                </div>
                {grouped[skill].map((player, i) => (
                  <div key={player.id} className="px-4 py-1.5 flex items-center gap-2 hover:bg-white/[0.02]">
                    <span className="text-neon-cyan text-xs w-5">{i + 1}.</span>
                    <span className="text-gray-200 text-xs font-medium flex-1">{player.name}</span>
                    <span className="text-gray-600 text-[10px]">{player.flat}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SelectedPanel
