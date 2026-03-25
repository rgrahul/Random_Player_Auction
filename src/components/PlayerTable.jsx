import { Users } from 'lucide-react'

function PlayerTable({ players, selectedIds, waitlistIds, currentPlayerId, spinning, activeSkill, round }) {
  const isLaterRound = round > 1

  const badgeClass = activeSkill === 'Advanced' ? 'badge-advanced' :
    activeSkill === 'Intermediate +' ? 'badge-intermediate-plus' :
    activeSkill === 'Intermediate' ? 'badge-intermediate' :
    activeSkill === 'Beginner' ? 'badge-beginner' : ''

  const skillBadgeFor = (skill) => {
    return skill === 'Advanced' ? 'badge-advanced' :
      skill === 'Intermediate +' ? 'badge-intermediate-plus' :
      skill === 'Intermediate' ? 'badge-intermediate' : 'badge-beginner'
  }

  return (
    <div className="rounded-xl border border-slot-border bg-panel-bg/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slot-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h3 className="font-display text-xs tracking-wider uppercase text-gray-300">
            {isLaterRound ? `Round ${round} Pool` : 'Player Pool'}
          </h3>
        </div>
        {isLaterRound ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-display tracking-wider bg-neon-magenta/15 text-neon-magenta border border-neon-magenta/30">
            All Skills
          </span>
        ) : activeSkill && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${badgeClass}`}>
            {activeSkill}
          </span>
        )}
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-center text-gray-600 py-8 text-sm">No players in this pool</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-bg border-b border-slot-border">
              <tr className="text-[10px] font-display tracking-wider uppercase text-gray-500">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Name</th>
                {isLaterRound ? (
                  <th className="px-4 py-2">Skill</th>
                ) : (
                  <th className="px-4 py-2">Category</th>
                )}
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => {
                const isSelected = selectedIds.has(player.id)
                const isWaitlisted = waitlistIds.has(player.id)
                const isCurrent = currentPlayerId === player.id
                const isAvailable = isLaterRound
                  ? isWaitlisted && !isSelected
                  : !isSelected && !isWaitlisted

                let rowClass = 'border-b border-slot-border/50 transition-all duration-200'
                if (isCurrent && spinning) rowClass += ' player-row-spinning'
                else if (isSelected) rowClass += ' player-row-selected'
                else if (!isLaterRound && isWaitlisted) rowClass += ' player-row-waitlisted'
                else rowClass += ' hover:bg-white/[0.02]'

                const catShort = player.category.includes('Mens') ? 'M' :
                  player.category.includes('Womens') ? 'W' :
                  player.category.includes('10-18') ? 'K18' : 'K10'

                return (
                  <tr key={player.id} className={rowClass}>
                    <td className="px-4 py-2 text-gray-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-200 text-xs">
                      {player.name}
                    </td>
                    {isLaterRound ? (
                      <td className="px-4 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-display ${skillBadgeFor(player.skill)}`}>
                          {player.skill === 'Intermediate +' ? 'Int+' : player.skill.slice(0, 3).toUpperCase()}
                        </span>
                      </td>
                    ) : (
                      <td className="px-4 py-2 text-gray-500 text-xs">{catShort}</td>
                    )}
                    <td className="px-4 py-2">
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan font-display">
                          PICKED
                        </span>
                      )}
                      {!isSelected && isLaterRound && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green font-display">
                          POOL
                        </span>
                      )}
                      {!isLaterRound && isWaitlisted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-yellow/10 text-neon-yellow font-display">
                          WAIT
                        </span>
                      )}
                      {!isLaterRound && isAvailable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green font-display">
                          POOL
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default PlayerTable
