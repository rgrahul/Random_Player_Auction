import { Clock, RotateCcw } from 'lucide-react'

function WaitlistPanel({ roundNumber, players, onRestore }) {
  return (
    <div className="rounded-xl border border-slot-border bg-panel-bg/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slot-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-yellow" />
          <h3 className="font-display text-xs tracking-wider uppercase text-neon-yellow">
            Round {roundNumber} Waitlist
          </h3>
        </div>
        <span className="text-[10px] font-display text-gray-500">{players.length} total</span>
      </div>

      <div className="max-h-[200px] overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-center text-gray-600 py-6 text-sm">No players in waitlist</p>
        ) : (
          <div className="divide-y divide-slot-border/50">
            {players.map((player, i) => (
              <div key={player.id} className="px-4 py-1.5 flex items-center gap-2 hover:bg-white/[0.02] group">
                <span className="text-neon-yellow text-xs w-5">{i + 1}.</span>
                <span className="text-gray-300 text-xs font-medium flex-1">{player.name}</span>
                <span className="text-gray-600 text-[10px] mr-2">{player.skill}</span>
                <button
                  onClick={() => onRestore(player.id, roundNumber)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-neon-green hover:text-neon-green/80"
                  title="Return to pool"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WaitlistPanel
