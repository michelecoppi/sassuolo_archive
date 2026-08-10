import { useState } from 'react';
import { api } from '../services/api';

type MatchQuickEditorProps = {
  match: any;
  onClose: () => void;
  onRefresh: () => void;
};

export default function MatchQuickEditor({ match, onClose, onRefresh }: MatchQuickEditorProps) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? '');
  const [awayScore, setAwayScore] = useState(match.away_score ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/manual/matches/${match.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...match,
          home_score: homeScore,
          away_score: awayScore,
        }),
      });
      onRefresh();
      onClose();
    } catch (e) {
      alert(`Errore: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="mb-4 text-xl font-bold">Modifica Risultato</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{match.home_team}</label>
            <input
              type="number"
              className="input w-full"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{match.away_team}</label>
            <input
              type="number"
              className="input w-full"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn-primary" onClick={save} disabled={busy}>Salva</button>
        </div>
      </div>
    </div>
  );
}
