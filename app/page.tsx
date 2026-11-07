'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, emailFor } from '../lib/supabase';
import { questionsFor, matchdayNo, weekOf, tierFor, PER, SECS, MAXY, Question } from '../lib/scoring';
import { resolvePlayer, resolveTeam } from '../lib/match';
import { sfx, sfxInit, setSfx, flyShot, drawMap, drawCard } from '../lib/fx';

type Shot = { q: string; given: string | null; yds: number; kg: boolean; top: string; misses: string[]; count: number; ladder: { name: string; yds: number }[] };
type Me = {
  username: string | null; matchday: number;
  playedToday: { total: number; keepers: number; grid: string } | null;
  week: { username: string; total: number; rounds: number; keepers: number }[];
  pending: { id: number; username: string; matchday: number; total: number }[];
};
const PRIZES = ['Vice captain', 'Fireball', 'Pick your position'];

export default function Page() {
  const sb = useRef(supabase()).current;
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [screen, setScreen] = useState<'load' | 'auth' | 'claim' | 'start' | 'play' | 'reveal' | 'done' | 'board'>('load');
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [user, setUser] = useState(''); const [pass, setPass] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);

  const [set, setSet] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Shot[]>([]);
  const [left, setLeft] = useState(SECS);
  const [ans, setAns] = useState(''); const [nudge, setNudge] = useState(''); const [bad, setBad] = useState(false);
  const [tries, setTries] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const timer = useRef<any>(null); const locked = useRef(false); const inputRef = useRef<HTMLInputElement>(null);

  const md = matchdayNo();
  const refresh = useCallback(async (t: string) => {
    const r = await fetch('/api/me', { headers: { authorization: 'Bearer ' + t } });
    if (!r.ok) return null;
    const d: Me = await r.json(); setMe(d); return d;
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      if (!t) { setScreen('auth'); return; }
      const d = await refresh(t);
      setScreen(d && d.pending.length && !d.playedToday ? 'claim' : 'start');
    });
  }, [sb, refresh]);

  async function doAuth(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const name = user.trim();
    if (name.length < 2) { setErr('Give us a name, at least two letters.'); setBusy(false); return; }
    if (pass.length < 6) { setErr('Password needs six characters or more.'); setBusy(false); return; }
    try {
      const email = emailFor(name);
      if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email, password: pass });
        if (error) throw error;
        const uid = data.user?.id;
        if (uid) {
          const { error: pe } = await sb.from('players').insert({ id: uid, username: name });
          if (pe && pe.code === '23505') throw new Error('That name is taken. Try another.');
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw new Error('No account with that name and password.');
      }
      const { data: s } = await sb.auth.getSession();
      const t = s.session?.access_token ?? null; setToken(t);
      if (t) { const d = await refresh(t); setScreen(d && d.pending.length && !d.playedToday ? 'claim' : 'start'); }
    } catch (e: any) {
      setErr(e?.message?.includes('already registered') ? 'That name is taken. Try signing in.' : (e?.message || 'That did not work.'));
    }
    setBusy(false);
  }

  async function claim(id: number | null) {
    if (id && token) {
      await fetch('/api/claim', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ id }) });
      await refresh(token);
    }
    setScreen('start');
  }

  function startRound() {
    sfx('whistle');
    setSet(questionsFor(md)); setI(0); setResults([]); setScreen('play');
  }

  useEffect(() => {
    if (screen !== 'play') return;
    locked.current = false; setLeft(SECS); setAns(''); setNudge(''); setBad(false); setTries([]);
    setTimeout(() => inputRef.current?.focus(), 60);
    clearInterval(timer.current);
    let n = SECS;
    timer.current = setInterval(() => {
      n -= 1; setLeft(n);
      if (n <= 4 && n > 0) sfx('tick');
      if (n <= 0) { clearInterval(timer.current); sfx('whistle'); finishShot(null, 'timeout'); }
    }, 1000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, i]);

  function finishShot(hit: { name: string; yds: number } | null, how: string) {
    if (locked.current) return;
    locked.current = true; clearInterval(timer.current);
    const q = set[i];
    if (hit) sfx('kick'); else if (how !== 'timeout') sfx('over');
    const shot: Shot = {
      q: q.prompt, given: hit ? hit.name : null, yds: hit ? hit.yds : 0,
      kg: !!(hit && hit.yds === 100), top: q.answers[0].name,
      misses: tries.slice(), count: q.answers.length, ladder: q.answers,
    };
    setResults(r => [...r.slice(0, i), shot]);
    setScreen('reveal');
  }

  function attempt() {
    if (locked.current) return;
    const q = set[i]; const raw = ans.trim();
    if (!raw) { setNudge('Put a name in first.'); setBad(false); return; }
    const res = q.kind === 'team' ? resolveTeam(raw, q) : resolvePlayer(raw);
    if (res.status === 'short') { setNudge('A bit more to go on.'); setBad(false); return; }
    if (res.status === 'ambiguous') { setNudge('Which one — ' + res.options.join(', ') + '?'); setBad(false); return; }
    if (res.status === 'unknown') {
      setNudge('“' + raw + '” isn’t on the books. Try again.'); setBad(true);
      setShake(true); setTimeout(() => setShake(false), 360); sfx('block'); return;
    }
    const hit = q.answers.find(a => a.name === res.name);
    if (!hit) {
      if (!tries.includes(res.name)) setTries(t => [...t, res.name]);
      setNudge('Blocked — ' + res.name + ' doesn’t fit. Keep going.'); setBad(true);
      setShake(true); setTimeout(() => setShake(false), 360); sfx('block'); setAns('');
      inputRef.current?.focus(); return;
    }
    finishShot(hit, 'ok');
  }

  // reveal animation
  useEffect(() => {
    if (screen !== 'reveal') return;
    const r = results[i]; if (!r) return;
    flyShot(r.yds, r.yds === 0);
    if (r.kg) setTimeout(() => sfx('cheer'), 620);
  }, [screen, i, results]);

  // save the round, draw the map and the card
  useEffect(() => {
    if (screen !== 'done') return;
    sfx('fulltime');
    drawMap(results);
    const total = results.reduce((a, r) => a + r.yds, 0);
    const got = results.filter(r => r.kg).length;
    drawCard(results, total, tierFor(total)[1], me?.username || 'Anon', md, got);
    (async () => {
      if (!token) return;
      setSaveMsg('Saving…');
      const r = await fetch('/api/submit', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ answers: results.map(x => x.given) }),
      });
      const d = await r.json().catch(() => ({}));
      setSaveMsg(r.ok ? 'Saved to the table.' : (d.error || 'Could not save that.'));
      await refresh(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const total = results.reduce((a, r) => a + r.yds, 0);
  const got = results.filter(r => r.kg).length;
  const tier = tierFor(total);
  const share = `HAME & AWAY\n${(me?.username || 'ANON').toUpperCase()} — ${total}/700 · MD${md} · ${results.map(r => r.yds === 0 ? '⬛' : r.yds === 100 ? '🧤' : r.yds >= 80 ? '🟩' : r.yds >= 60 ? '🟨' : r.yds >= 40 ? '🟧' : '🟥').join('')}\n${tier[1]}${got ? ` · ${got} keeper's goal${got > 1 ? 's' : ''}` : ''}\n${typeof location !== 'undefined' ? location.origin : ''}`;

  const Bar = () => (
    <div className="topbar">
      <div className="badge"><div className="crest" aria-hidden="true">H&amp;A</div>
        <div className="wordmark">HAME &amp; AWAY<small>Matchday #{md}</small></div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono">{PER} &times; {SECS}s</span>
        <button className="sfxbtn" aria-pressed={sound} title="Sound"
          onClick={() => { const n = !sound; setSound(n); setSfx(n); if (n) { sfxInit(); sfx('tick'); } }}>
          <span>{sound ? '♪' : '✕'}</span>
        </button>
      </div>
    </div>
  );

  if (screen === 'load') return <div className="wrap"><Bar /><p className="spin">Getting the teamsheet…</p></div>;

  return (
    <div className="wrap" onClick={() => sfxInit()}>
      <Bar />

      {screen === 'auth' && (
        <section className="screen">
          <div className="hero-num">700<span>YDS</span></div>
          <p className="lede"><em>The daily quiz</em> for the Hame Bakery Premiership. Pick a name, pick a password, that&rsquo;s it.</p>
          <form className="auth" onSubmit={doAuth}>
            <input value={user} onChange={e => setUser(e.target.value)} maxLength={16} placeholder="Your name" autoComplete="username" />
            <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
            <p className="err">{err}</p>
            <button className="btn" disabled={busy} type="submit">{busy ? 'Hang on…' : (mode === 'up' ? 'Sign up and play' : 'Sign in')}</button>
          </form>
          <button className="swap" onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(''); }}>
            {mode === 'up' ? 'Already signed up? Sign in' : 'New here? Sign up'}
          </button>
        </section>
      )}

      {screen === 'claim' && me && (
        <section className="screen">
          <div className="hero-num">{me.pending.length}<span>UNCLAIMED</span></div>
          <p className="lede">Scores posted in the group chat before sign-ups opened. <em>Is one of these yours?</em></p>
          <div className="panel"><h3>Unclaimed rounds</h3>
            <ul className="claim">
              {me.pending.map(p => (
                <li key={p.id}>
                  <span className="cn">{p.username}</span>
                  <span className="cs">{p.total} yds</span>
                  <button onClick={() => claim(p.id)}>That&rsquo;s me</button>
                </li>
              ))}
            </ul>
            <p className="more">Claiming one puts it on your account and into the table. Joe can see who claimed what.</p>
          </div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => claim(null)}>None of these are mine</button>
        </section>
      )}

      {screen === 'start' && me && (
        <section className="screen">
          <div className="hero-num">700<span>YDS</span></div>
          <p className="lede">Afternoon, <em>{me.username}</em>. Seven questions, 25 seconds each.</p>
          <ul className="rules">
            <li><b>1</b><span>Name any player who fits. <i>Keep guessing</i> until the whistle.</span></li>
            <li><b>2</b><span>The <i>more obvious</i> the name, the closer in you shoot.</span></li>
            <li><b className="k">3</b><span>Every question hides one <i>keeper&rsquo;s goal</i> &mdash; the rarest answer, worth 100.</span></li>
          </ul>
          <div className="start-actions">
            {me.playedToday
              ? <button className="btn" disabled>Played &mdash; back tomorrow</button>
              : <button className="btn" onClick={startRound}>Kick off</button>}
            <button className="btn ghost" onClick={() => setScreen('board')}>This week&rsquo;s table</button>
          </div>
          {me.playedToday && <p className="locked">Your round is in: <b>{me.playedToday.total} yds</b>. One go each, same seven questions for everyone.</p>}
        </section>
      )}

      {screen === 'play' && set[i] && (
        <section className="screen">
          <div className="pips">{set.map((_, n) => <div key={n} className={'pip ' + (n < i ? (results[n]?.kg ? 'kg' : 'done') : n === i ? 'live' : '')} />)}</div>
          <div className="clockrow"><span className="mono">Shot {i + 1} of {PER}</span>
            <span className={'clock' + (left <= 5 ? ' panic' : left <= 10 ? ' warn' : '')}>{left}</span></div>
          <div className="track"><div className="fill" style={{ width: (left / SECS) * 100 + '%', transition: 'width 1s linear' }} /></div>
          <h1 className="q">{set[i].prompt}</h1>
          <p className="qhint">{set[i].hint}</p>
          <div className="answerbox">
            <label className="mono" htmlFor="ans">Your answer</label>
            <input id="ans" ref={inputRef} className={shake ? 'blocked' : ''} value={ans}
              onChange={e => setAns(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); attempt(); } }}
              autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false}
              placeholder={set[i].kind === 'team' ? 'Type a team name…' : 'Type a name…'} />
            <p className={'nudge' + (bad ? ' bad' : '')}>{nudge || ' '}</p>
            <button className="btn" onClick={attempt}>Shoot</button>
            <div className="tried">{tries.map(t => <span className="chip" key={t}>{t}</span>)}</div>
          </div>
        </section>
      )}

      {screen === 'reveal' && results[i] && (() => {
        const r = results[i];
        const head = r.yds === 0 ? 'Tackled.' : r.kg ? "Keeper's goal!" : r.yds >= 90 ? 'From the halfway line.' : r.yds >= 75 ? 'A proper screamer.' : r.yds >= 55 ? 'Outside the box.' : r.yds >= 35 ? 'Inside the box.' : 'A tap-in.';
        const tail = r.yds === 0 ? (r.given ? '' : 'The whistle beat you.') : r.kg ? 'The rarest answer on the board.' : r.yds >= 75 ? 'Well off the obvious list.' : r.yds >= 55 ? 'Decent shout, that.' : 'Fairly obvious one.';
        const top = r.ladder.slice(0, 4);
        const rows = top.some(a => a.name === r.given) ? top : [...top.slice(0, 3), ...r.ladder.filter(a => a.name === r.given)];
        return (
          <section className="screen">
            <p className="mono">Shot {i + 1} of {PER}</p>
            <div className="stage"><svg id="r-stage" viewBox="0 0 340 128" role="img" aria-label="Your shot" />
              {r.kg && <div className="flash on">KEEPER&rsquo;S GOAL</div>}</div>
            <div className={'verdict' + (r.yds === 0 ? ' zero' : r.kg ? ' kg' : '')}>{r.yds}<span>YDS</span></div>
            <p className={'vline' + (r.kg ? ' kg' : '')}><em>{head}</em> {tail}{r.misses.length ? ` Got there after ${r.misses.length} block${r.misses.length > 1 ? 's' : ''}.` : ''}</p>
            <div className="panel"><h3>{r.yds > 0 ? 'Longest-range answers' : 'What you could have had'}</h3>
              <ul className="ladder">
                {rows.filter(Boolean).map(a => (
                  <li key={a.name} className={[a.yds === 100 ? 'kg' : '', a.name === r.given ? 'you' : ''].filter(Boolean).join(' ')}>
                    <span className="yd">{a.yds}</span>
                    <span className="bar"><i style={{ width: a.yds + '%' }} /></span>
                    <span className="nm">{a.name}</span>
                    {a.yds === 100 && <span className="tag">KEEPER</span>}
                  </li>
                ))}
              </ul>
              <p className="more">{r.count} answers would have counted.</p>
            </div>
            <button className="btn" style={{ marginTop: 20 }}
              onClick={() => { if (i === PER - 1) setScreen('done'); else { setI(i + 1); setScreen('play'); } }}>
              {i === PER - 1 ? 'Full time' : 'Next shot'}
            </button>
          </section>
        );
      })()}

      {screen === 'done' && (
        <section className="screen">
          <span className="tier">Full time &middot; Matchday #{md}</span>
          <div className="hero-num">{total}<span>YDS</span></div>
          <p className="lede"><em>{tier[1]}.</em> {tier[2]}</p>
          <div className="scorebar"><i style={{ width: Math.max(1, (total / MAXY) * 100) + '%' }} /></div>
          <p className="mono">{total} of {MAXY} possible yards &middot; {saveMsg}</p>

          <div className="panel"><h3>How far out every shot was</h3>
            <ul className="chart">
              {results.map((r, n) => (
                <li key={n} className={r.yds === 0 ? 'miss' : r.kg ? 'kg' : ''}>
                  <span className="n">{n + 1}</span>
                  <span className="who">{r.given || 'no answer'}</span>
                  <span className="tr"><i style={{ width: (r.yds || 3) + '%' }} /></span>
                  <span className="v">{r.yds}</span>
                </li>
              ))}
            </ul>
            <div className="axis"><span>0</span><span>50</span><span>100 yds</span></div>
            <p className="more">{got ? `${got} keeper's goal${got > 1 ? 's' : ''} found.` : 'No keeper’s goals today.'}</p>
          </div>

          <div className="panel"><h3>Shot map &middot; yards from goal</h3>
            <svg className="map" id="d-map" viewBox="0 0 340 200" role="img" aria-label="Shot map" />
            <p className="more" id="d-maplegend" /></div>

          <div className="panel"><h3>Match report</h3>
            <ul className="rowlist">
              {results.map((r, n) => (
                <li key={n}>
                  <span className="n">{n + 1}</span>
                  <div>
                    <span className={'aa' + (r.yds ? (r.kg ? ' kgw' : '') : ' miss')}>{r.given || 'No answer'}</span>
                    <span className="qq">{r.q}</span>
                    {r.kg ? <span className="kgn">You found the 100</span> : <span className="kgm">The 100 was {r.top}</span>}
                  </div>
                  <span className={'sc' + (r.yds ? (r.kg ? ' kgw' : '') : ' zero')}>{r.yds}<small>{r.yds ? 'yds' : 'tackled'}</small></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel"><h3>Share it</h3>
            <canvas id="card" className="card" aria-label="Your score card" />
            <p className="more">Press and hold the card to save it or send it on.</p>
            <a className="btn walink" href={'https://wa.me/?text=' + encodeURIComponent(share)} target="_blank" rel="noopener noreferrer">Send to the group</a>
            <button className="btn ghost" style={{ marginTop: 10 }}
              onClick={() => navigator.clipboard?.writeText(share)}>Copy it instead</button>
          </div>

          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setScreen('board')}>This week&rsquo;s table</button>
        </section>
      )}

      {screen === 'board' && me && (
        <section className="screen">
          <div className="hero-num">W{weekOf(md)}<span>TABLE</span></div>
          <p className="lede">Every round this week added up. Updates the moment anyone finishes.</p>
          <div className="panel"><h3>Week {weekOf(md)} &middot; matchdays {(weekOf(md) - 1) * 7 + 1} to {weekOf(md) * 7}</h3>
            <ul className="lbt">
              {me.week.map((row, n) => (
                <li key={row.username} className={[n < 3 ? 'p' + (n + 1) : '', row.username === me.username ? 'me' : ''].filter(Boolean).join(' ')}>
                  <span className="pos">{n + 1}</span>
                  <span>
                    <span className="nm2">{row.username}</span>
                    <span className="sub">{row.rounds} round{row.rounds > 1 ? 's' : ''}{row.keepers ? ` · ${row.keepers} keeper${row.keepers > 1 ? 's' : ''}` : ''}</span>
                    {n < 3 && <span className="prz">{PRIZES[n]}</span>}
                  </span>
                  <span className="tot">{row.total}<small>yds</small></span>
                </li>
              ))}
            </ul>
            {!me.week.length && <p className="empty">Nobody has played yet this week.</p>}
          </div>
          <div className="panel"><h3>Week {weekOf(md)} prizes</h3>
            <div className="prize g"><b>1st</b><span>Vice captain<i>Provisional, for a month. Reviewed at the end of it.</i></span></div>
            <div className="prize s"><b>2nd</b><span>A fireball<i>To be served at the earliest opportunity.</i></span></div>
            <div className="prize br"><b>3rd</b><span>Pick your position in Pro Clubs<i>Anywhere you like, for a week.</i></span></div>
          </div>
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setScreen('start')}>Back</button>
          <button className="btn ghost" style={{ marginTop: 10 }}
            onClick={async () => { await sb.auth.signOut(); location.reload(); }}>Sign out</button>
          <p className="foot">Hame Bakery Premiership, Seasons 1 to 3.<br />Same seven questions for everyone, every day.</p>
        </section>
      )}
    </div>
  );
}
