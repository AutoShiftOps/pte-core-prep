import { useMemo, useState } from 'react';
import { canon } from '../lib/score.js';
import { Chip } from './common.jsx';

/** Collocation list: filled automatically from missed gaps, plus your own additions. */
export default function WordPairs({ pairs, savePair }) {
  const [phrase, setPhrase] = useState('');
  const [showMastered, setShowMastered] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const list = useMemo(() => pairs.filter((p) => showMastered || !p.mastered).sort((a, b) => b.misses - a.misses || (b.updated_at || '').localeCompare(a.updated_at || '')), [pairs, showMastered]);
  const open = pairs.filter((p) => !p.mastered);

  function startQuiz() {
    const qs = open.slice(0, 10).map((p) => {
      const ans = p.answer || p.phrase.split(' ')[1] || p.phrase;
      return { p, ans, prompt: p.phrase.replace(new RegExp(`\\b${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), '_____') };
    });
    setQuiz({ qs, i: 0, val: '', verdict: null, right: 0 });
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="cardhead"><h2>Word pairs</h2><span className="muted small">{open.length} to learn · {pairs.length - open.length} mastered</span></div>
        <p className="small">Every gap you miss in a fill-in-the-blank task adds its word pair here automatically ("rely on", "pave the way"). Learn them as pairs, never as single words. Mark a pair mastered after you get it right in the quiz twice.</p>
        <form className="btnrow" onSubmit={(e) => { e.preventDefault(); if (phrase.trim()) { savePair({ phrase: phrase.trim().toLowerCase(), answer: '', source: 'added by you', misses: 1 }); setPhrase(''); } }}>
          <input type="text" id="newPair" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Add a pair, e.g. heavily dependent on" />
          <button className="primary">Add</button>
          <button type="button" onClick={startQuiz} disabled={!open.length}>Quiz me (10)</button>
        </form>
        {quiz && (
          quiz.i >= quiz.qs.length
            ? <div className="focusbox"><b>Quiz done: {quiz.right}/{quiz.qs.length}.</b> <button className="linkish" onClick={() => setQuiz(null)}>Close</button></div>
            : (
              <div className="focusbox">
                <div className="eyebrow">Fill the gap · {quiz.i + 1} of {quiz.qs.length}</div>
                <p className="mono">{quiz.qs[quiz.i].prompt}</p>
                <div className="btnrow">
                  <input type="text" id="quizIn" value={quiz.val} autoComplete="off" spellCheck={false} onChange={(e) => setQuiz({ ...quiz, val: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (quiz.verdict) setQuiz({ ...quiz, i: quiz.i + 1, val: '', verdict: null }); else { const ok = canon(quiz.val) === canon(quiz.qs[quiz.i].ans); setQuiz({ ...quiz, verdict: ok ? 'ok' : 'no', right: quiz.right + (ok ? 1 : 0) }); } } }} />
                  {quiz.verdict && <Chip tone={quiz.verdict === 'ok' ? 'good' : 'bad'}>{quiz.verdict === 'ok' ? 'Correct' : 'Answer: ' + quiz.qs[quiz.i].ans}</Chip>}
                </div>
                <p className="small muted">Enter to check, Enter again for the next one.</p>
              </div>
            )
        )}
        <label className="small"><input type="checkbox" checked={showMastered} onChange={(e) => setShowMastered(e.target.checked)} /> Show mastered</label>
        {list.length === 0 ? <p className="muted">No pairs yet. Do some R&W or Reading Fill in the Blanks; misses appear here.</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Word pair</th><th>Missed</th><th>From</th><th></th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.phrase} className={p.mastered ? 'muted' : ''}>
                    <td className="mono">{p.phrase}</td><td className="num">{p.misses}</td><td className="small">{p.source}</td>
                    <td><button onClick={() => savePair({ ...p, mastered: !p.mastered })}>{p.mastered ? 'Unmark' : 'Mastered'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
