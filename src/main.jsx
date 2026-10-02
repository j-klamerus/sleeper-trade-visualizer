import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeftRight, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Clipboard, GripVertical, LoaderCircle, Search, Shield, Sparkles, Trash2, Users, X } from 'lucide-react';
import './styles.css';

const API = 'https://api.sleeper.app/v1';
const YEAR = new Date().getFullYear();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sleeper API returned ${response.status}. Please try again.`);
  return response.json();
}
function getOwner(roster, users) { return users.find(user => user.user_id === roster.owner_id); }
function teamName(roster, users) {
  const owner = getOwner(roster, users);
  return owner?.metadata?.team_name || owner?.display_name || owner?.username || `Team ${roster.roster_id}`;
}
function avatarUrl(id, thumb = false) { return id ? `https://sleepercdn.com/avatars/${thumb ? "thumbs/" : ""}${id}` : null; }
function playerImageUrl(id) { return `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`; }
function ImageFallback({ src, className, children, alt = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : <span className={`${className} image-fallback`}>{children}</span>;
}
function App() {
  const [username, setUsername] = useState('');
  const [season, setSeason] = useState(String(YEAR));
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState(null);
  const [rosters, setRosters] = useState([]);
  const [users, setUsers] = useState([]);
  const [players, setPlayers] = useState({});
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [error, setError] = useState('');
  const [leagueError, setLeagueError] = useState('');
  const [dragging, setDragging] = useState(null);
  const [showTeams, setShowTeams] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState('trade');

  useEffect(() => {
    let active = true;
    setPlayerLoading(true);
    getJson(`${API}/players/nfl`).then(data => { if (active) setPlayers(data || {}); })
      .catch(() => { if (active) setPlayers({}); })
      .finally(() => { if (active) setPlayerLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadLeagues(event) {
    event.preventDefault();
    const handle = username.trim();
    if (!handle) return;
    setLoading(true); setError(''); setLeagueError(''); setUser(null); setLeagues([]); setLeague(null); setRosters([]); setUsers([]); setAssignments({});
    try {
      const found = await getJson(`${API}/user/${encodeURIComponent(handle)}`);
      if (!found?.user_id) throw new Error('We couldn’t find that Sleeper user. Check the username and try again.');
      setUser(found);
      const options = await getJson(`${API}/user/${found.user_id}/leagues/nfl/${season}`);
      setLeagues(options || []);
      if (!options?.length) setError(`No NFL leagues found for ${handle} in ${season}. Try a different season.`);
    } catch (err) { setError(err.message || 'Could not load Sleeper leagues. Please try again.'); }
    finally { setLoading(false); }
  }

  async function selectLeague(item) {
    setLeague(item); setLeagueError(''); setRosters([]); setUsers([]); setAssignments({}); setSelectedTeams([]); setLoading(true);
    try {
      const [rosterData, userData] = await Promise.all([
        getJson(`${API}/league/${item.league_id}/rosters`),
        getJson(`${API}/league/${item.league_id}/users`),
      ]);
      setRosters(rosterData || []); setUsers(userData || []);
      setSelectedTeams((rosterData || []).slice(0, Math.min(2, rosterData?.length || 0)).map(r => r.roster_id));
      if (!rosterData?.length) setLeagueError('This league doesn’t have any rosters yet.');
    } catch (err) { setLeagueError(err.message || 'Could not load league rosters. Please select the league again.'); }
    finally { setLoading(false); }
  }

  const teams = useMemo(() => rosters.map(roster => { const owner = getOwner(roster, users); return { ...roster, name: teamName(roster, users), avatar: owner?.avatar }; }), [rosters, users]);
  const chosen = teams.filter(team => selectedTeams.includes(team.roster_id));
  const tradeCount = Object.keys(assignments).length;

  function toggleTeam(id) {
    setSelectedTeams(current => {
      if (current.includes(id)) {
        setAssignments(prev => Object.fromEntries(Object.entries(prev).filter(([, item]) => item.from !== id && item.to !== id)));
        return current.filter(value => value !== id);
      }
      return [...current, id];
    });
  }
  function assignPlayer(playerId, fromId, toId) {
    if (!selectedTeams.includes(fromId) || !selectedTeams.includes(toId) || fromId === toId) return;
    const key = `${fromId}:${playerId}`;
    setAssignments(prev => ({ ...prev, [key]: { playerId, from: fromId, to: toId } }));
  }
  function returnPlayer(key) { setAssignments(prev => { const next = { ...prev }; delete next[key]; return next; }); }
  function playerName(id) {
    const player = players[id];
    if (!player) return `Player ${id}`;
    return player.full_name || [player.first_name, player.last_name].filter(Boolean).join(' ') || player.search_full_name || `Player ${id}`;
  }
  function initials(name) { return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
  function displayRoster(team) {
    return [...(team.players || [])].sort((a, b) => playerName(a).localeCompare(playerName(b)));
  }
  function sendTo(key, toId) {
    const entry = assignments[key];
    if (entry) assignPlayer(entry.playerId, entry.from, toId);
  }
  function tradeSummary() {
    return chosen.map(team => {
      const picks = Object.entries(assignments).filter(([, v]) => v.to === team.roster_id).map(([key, v]) => `  + ${playerName(v.playerId)} (from ${teams.find(t => t.roster_id === v.from)?.name || 'team'})`);
      return `${team.name} receives:\n${picks.length ? picks.join('\n') : '  (no players)'}`;
    }).join('\n\n');
  }
  async function copySummary() {
    try { await navigator.clipboard.writeText(tradeSummary()); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  }
  function resetTrade() { setAssignments({}); }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Huddle home"><span className="brand-mark"><ArrowLeftRight size={19} strokeWidth={2.4} /></span><span>Sleeper Trades</span></a>
      <div className="topbar-right"><span className="api-status"><i /> Public Sleeper data</span></div>
    </header>

    <div className="page-wrap" id="top">
      <section className="tool-heading"><div><h1>Sleeper Trade Builder</h1><p>Look up a league, choose teams, and map out a trade.</p></div><span className="local-tag"><Shield size={14}/> LOCAL TOOL</span></section>

      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> THE TRADE ROOM</div><h1>Make your next move.<br /><span>See every side of it.</span></h1><p>Build a trade with your league’s actual rosters. Move players, balance the deal, and see who gets what — all in one place.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-ball"><ArrowLeftRight size={36}/></div><div className="art-chip chip-one"><span>RB</span><b>↗</b></div><div className="art-chip chip-two"><span>WR</span><b>↙</b></div><div className="art-spark">✳</div></div>
      </section>

      <section className="setup-card">
        <div className="setup-heading"><span className="step-num">01</span><div><h2>Find your league</h2><p>Pull your public Sleeper league roster into the room.</p></div><span className="powered"><Shield size={14}/> NO LOGIN REQUIRED</span></div>
        <form className="search-form" onSubmit={loadLeagues}>
          <label className="field username-field"><span>YOUR SLEEPER USERNAME</span><div className="input-wrap"><Search size={18}/><input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. gridiron_guru" autoComplete="username" /></div></label>
          <label className="field season-field"><span>SEASON</span><div className="select-wrap"><select value={season} onChange={e => setSeason(e.target.value)}>{Array.from({ length: 6 }, (_, i) => YEAR - i).map(year => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={16}/></div></label>
          <button className="primary-btn find-btn" disabled={loading || !username.trim()}>{loading && !league ? <LoaderCircle size={17} className="spin"/> : <><span>Find my leagues</span><ArrowRight size={17}/></>}</button>
        </form>
        {error && <div className="notice error-notice"><CircleHelp size={17}/><span>{error}</span></div>}
        {leagues.length > 0 && <div className="league-picker"><div className="league-picker-head"><div><b>Hey, {user?.display_name || user?.username}.</b><span> Choose a league to load its rosters.</span></div><span className="league-count">{leagues.length} LEAGUE{leagues.length === 1 ? '' : 'S'}</span></div><div className="league-list">{leagues.map(item => <button key={item.league_id} className={`league-option ${league?.league_id === item.league_id ? 'active' : ''}`} onClick={() => selectLeague(item)}><span className="league-icon"><ImageFallback src={avatarUrl(item.avatar, true)} className="league-avatar"><Users size={17}/></ImageFallback></span><span className="league-info"><b>{item.name}</b><small>{item.total_rosters || '—'} teams <i>·</i> {item.settings?.type === 2 ? 'Keeper' : item.settings?.type === 1 ? 'Dynasty' : 'Redraft'}</small></span><span className="league-season">{item.season}</span><ChevronRight size={17}/></button>)}</div></div>}
      </section>

      {league && <>
        <div className="league-banner"><div className="league-badge"><ImageFallback src={avatarUrl(league.avatar)} className="league-avatar large-league-avatar"><Users size={18}/></ImageFallback></div><div className="league-banner-text"><span>YOUR ACTIVE LEAGUE</span><h2>{league.name}</h2></div><div className="league-meta"><span>{league.total_rosters} teams</span><i>·</i><span>{league.season} season</span><i>·</i><span>{league.scoring_settings ? 'Scoring league' : 'Sleeper league'}</span></div><button className="change-league" onClick={() => { setLeague(null); setRosters([]); setAssignments({}); }}>Change league <ChevronDown size={15}/></button></div>
        {leagueError && <div className="notice error-notice"><CircleHelp size={17}/><span>{leagueError}</span></div>}
        {loading && <div className="loading-panel"><LoaderCircle className="spin" size={22}/><span>Loading league rosters…</span></div>}
        {!loading && rosters.length > 0 && <>
          <section className="trade-toolbar"><div className="trade-title"><span className="step-num">02</span><div><h2>Build the trade</h2><p>Select teams, then send players to their new home.</p></div></div><div className="toolbar-actions"><button className="team-select-btn" onClick={() => setShowTeams(v => !v)}><Users size={16}/>{selectedTeams.length} teams in trade<ChevronDown size={15}/></button>{showTeams && <div className="team-popover"><b>Teams in this trade</b><small>Choose at least two teams.</small>{teams.map(team => <label key={team.roster_id} className="team-check"><input type="checkbox" checked={selectedTeams.includes(team.roster_id)} onChange={() => toggleTeam(team.roster_id)}/><span>{team.name}</span><em>{team.players?.length || 0}</em></label>)}</div>}{tradeCount > 0 && <button className="text-btn" onClick={resetTrade}><Trash2 size={15}/> Clear trade</button>}</div></section>
          {chosen.length < 2 && <div className="notice hint-notice"><CircleHelp size={17}/><span>Select at least two teams to build a trade.</span><button onClick={() => setShowTeams(true)}>Choose teams <ArrowRight size={14}/></button></div>}
          {chosen.length >= 2 && <div className="workspace-grid">
            <section className="roster-section"><div className="section-label"><span>TEAM ROSTERS</span><small>Drag or use the arrow to trade</small></div><div className="roster-grid">{chosen.map(team => <article key={team.roster_id} className="roster-card"><div className="roster-head"><div className="team-avatar"><ImageFallback src={avatarUrl(team.avatar, true)} className="team-avatar-img">{initials(team.name)}</ImageFallback></div><div className="roster-team-name"><b>{team.name}</b><small>{team.players?.length || 0} players <i>·</i> roster {team.roster_id}</small></div><span className="roster-pill">ROSTER</span></div><div className="player-list">{displayRoster(team).map(id => {
              const key = `${team.roster_id}:${id}`; const assigned = assignments[key]; const inTrade = !!assigned;
              return <div key={id} className={`player-row ${inTrade ? 'in-trade' : ''}`} draggable={!inTrade} onDragStart={e => { if (inTrade) return e.preventDefault(); setDragging({ playerId:id, fromId:team.roster_id }); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', JSON.stringify({playerId:id,fromId:team.roster_id})); }} onDragEnd={() => setDragging(null)}><GripVertical className="grip" size={15}/><ImageFallback src={playerImageUrl(id)} className="player-photo">{initials(playerName(id))}</ImageFallback><span className={`position position-${players[id]?.position || 'FA'}`}>{players[id]?.position || 'FA'}</span><span className="player-info"><b>{playerName(id)}</b><small>{players[id]?.team || 'NFL'}{players[id]?.years_exp != null ? ` · ${players[id].years_exp} yr${players[id].years_exp === 1 ? '' : 's'}` : ''}</small></span>{inTrade ? <div className="sent-label"><ArrowRight size={13}/> To {teams.find(t => t.roster_id === assigned.to)?.name}</div> : <div className="quick-send"><select aria-label={`Send ${playerName(id)} to`} value="" onChange={e => assignPlayer(id, team.roster_id, Number(e.target.value))}><option value="">Send to…</option>{chosen.filter(t => t.roster_id !== team.roster_id).map(t => <option key={t.roster_id} value={t.roster_id}>{t.name}</option>)}</select><ChevronDown size={13}/></div>}</div>;
            })}{(!team.players || team.players.length === 0) && <div className="empty-roster">This roster has no players.</div>}</div></article>)}</div></section>
            <section className="trade-section"><div className="trade-section-heading"><div><span className="section-label-text">TRADE PREVIEW</span><h3>The deal, laid out.</h3></div><span className="trade-count">{tradeCount} PLAYER{tradeCount === 1 ? '' : 'S'}</span></div><p className="drop-hint"><ArrowDown size={14}/> Drop players here or send them from a roster.</p><div className="trade-columns">{chosen.map(team => {
              const outgoing = Object.entries(assignments).filter(([,v]) => v.from === team.roster_id);
              const incoming = Object.entries(assignments).filter(([,v]) => v.to === team.roster_id);
              return <div className="trade-team" key={team.roster_id} onDragOver={e => { if (dragging && dragging.fromId !== team.roster_id) e.preventDefault(); }} onDrop={e => { e.preventDefault(); let payload=dragging; try { payload=JSON.parse(e.dataTransfer.getData('text/plain')) || payload; } catch {} if (payload) assignPlayer(payload.playerId, payload.fromId, team.roster_id); setDragging(null); }}><div className="trade-team-head"><div className="team-avatar small-avatar"><ImageFallback src={avatarUrl(team.avatar, true)} className="team-avatar-img">{initials(team.name)}</ImageFallback></div><b>{team.name}</b></div><div className="receives-box"><div className="flow-label"><span>RECEIVES</span><i/></div>{incoming.length ? incoming.map(([key,item]) => <div className="trade-player" key={key}><ImageFallback src={playerImageUrl(item.playerId)} className="player-photo trade-photo">{initials(playerName(item.playerId))}</ImageFallback><span className={`position position-${players[item.playerId]?.position || 'FA'}`}>{players[item.playerId]?.position || 'FA'}</span><span><b>{playerName(item.playerId)}</b><small>from {teams.find(t => t.roster_id === item.from)?.name}</small></span><button title="Remove player" onClick={() => returnPlayer(key)}><X size={15}/></button></div>) : <div className="drop-zone"><ArrowDown size={16}/><span>Drop players here</span></div>}</div><div className="sends-row"><span>SENDS</span><b>{outgoing.length ? outgoing.map(([,item]) => playerName(item.playerId)).join(', ') : '—'}</b></div></div>;
            })}</div><div className="trade-footer"><span><Sparkles size={15}/> Trade is a visualizer only. Nothing is submitted to Sleeper.</span><button className="copy-btn" disabled={tradeCount === 0} onClick={copySummary}>{copied ? <Check size={15}/> : <Clipboard size={15}/>} {copied ? 'Copied!' : 'Copy summary'}</button></div></section>
          </div>}
        </>}
      </>}
      {!league && !leagues.length && <section className="empty-workspace"><div className="empty-illustration"><div className="empty-circle"><ArrowLeftRight size={27}/></div><div className="float-card fc-a">WR <ArrowRight size={13}/></div><div className="float-card fc-b">RB <ArrowRight size={13}/></div></div><h3>Your trade room is ready.</h3><p>Enter your Sleeper username above to load a league and start moving players.</p></section>}
      <footer className="footer"><span>MADE FOR THE LOVE OF THE DEAL <span className="footer-star">✳</span></span><span>Powered by Sleeper’s public API</span></footer>
    </div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
