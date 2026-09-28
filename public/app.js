// Hämta verktyg från react
const { useState, useEffect } = React;

// lägger till /api framför alla fetch-anrop, och skickar med x-username-headern
function api(path, options = {}) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-username': user ? user.username : '',
      ...(options.headers || {})
    }
    // access denied om servern svarar med 403 eller om den returnerar { error: 'ACCESS_DENIED' }
  }).then(async (r) => {
    const data = await r.json();
    if (r.status === 403 || data.error === 'ACCESS_DENIED') throw new Error('ACCESS_DENIED');
    return data;
  });
}

// Visar en dropdown med alla användare som kan logga in och en knapp för att logga in. 
// När man loggar in sparas användaren i localStorage och skickas upp till App-komponenten via onLogin.
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const users = ['lakare_lisa', 'ssk_sara', 'vardcentral_x', 'patient_anna', 'obehorig_ove'];

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.error) return setError(data.error);
    localStorage.setItem('user', JSON.stringify(data.user));
    onLogin(data.user);
  };

  return (
    <div className="card">
      <h1>Logga in</h1>
      <form onSubmit={submit}>
        <select value={username} onChange={(e) => setUsername(e.target.value)}>
          <option value="">Välj användare</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="submit">Logga in</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// Sida med rubrik Åtkomst nekad. 
// Visas om man försöker logga in som obehörig användare eller om man försöker öppna en journal man inte har rätt till.
function AccessDenied() {
  return <div className="card"><h1>Åtkomst nekad</h1></div>;
}

// Sida med sökfält för patientnamn och lista med sökresultat.
function SearchPage({ onSelectPatient }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const data = await api(`/patients/search?name=${encodeURIComponent(q)}`);
    setResults(data);
  };

  return (
    <div className="card">
      <h2>Sök patient</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Namn..." />
      <button onClick={search}>Sök</button>
      <ul>
        {results.map((p) => (
          <li key={p.id}>
            {p.name} <button onClick={() => onSelectPatient(p.id)}>Öppna journal</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Visar en patients journal med anteckningar och åtkomstloggar.
function PatientView({ patientId, user }) {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [denied, setDenied] = useState(false);

  // Hämtar journaldata och åtkomstloggar från servern. 
  // Om servern svarar med ACCESS_DENIED sätts denied=true och AccessDenied-komponenten visas.
  const load = async () => {
    try {
      const journal = await api(`/patients/${patientId}`);
      setData(journal);
      const logData = await api(`/patients/${patientId}/access-logs`);
      setLogs(logData);
    } catch {
      setDenied(true);
    }
  };
    // Kör load() när sidan visas, och igen om patientId ändras.
  useEffect(() => { load(); }, [patientId]);

  // Socket.io-anslutning som lyssnar på nya anteckningar/block från båda sjukhusservrarna
  useEffect(() => {
    const socket = io();
    socket.on('note-added', (n) => { if (n.patientId === patientId) load(); });
    socket.on('chain-updated', () => load());
    return () => socket.disconnect();
  }, [patientId]);

  // Skickar POST med texten och vald synlighet, tömmer rutan och laddar om.
  const addNote = async () => {
    await api(`/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content: note, visibility })
    });
    setNote('');
    load();
  };

  if (denied) return <AccessDenied />;
  if (!data) return <p>Laddar...</p>;

  return (
    <div className="card">
      <h2>{data.patient.name}</h2>
      <p>Diagnos: {data.patient.diagnosis}</p>

      <h3>Anteckningar</h3>
      <ul>
        {data.notes.map((n) => (
          <li key={n.id}><b>{n.author}</b> ({n.visibility}): {n.content}</li>
        ))}
      </ul>

      {user.role !== 'patient' && (
        <div className="note-form">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ny anteckning..." />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Endast jag</option>
            <option value="staff">Vårdpersonal</option>
            <option value="all">Alla (inkl. patient)</option>
          </select>
          <button onClick={addNote}>Spara anteckning</button>
        </div>
      )}

      <h3>Åtkomstloggar (blockkedja)</h3>
      <ul>
        {logs.map((l, i) => (
          <li key={i}>
            {new Date(l.timestamp).toLocaleString()} — {l.actor} ({l.role}) — {l.action}{' '}
            <span className={l.verified ? 'badge-ok' : 'badge-bad'}>
              {l.verified ? '✓ Verifierad' : '✗ Manipulerad!'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Huvudkomponenten som visar antingen login, search eller patientview beroende på inloggad användare och val av patient.
function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [patientId, setPatientId] = useState(null);

  useEffect(() => {
    if (user && user.role === 'patient') setPatientId(user.patient_id); // direkt till egen journal
  }, [user]);

  if (!user) return <LoginPage onLogin={setUser} />;
  if (user.role === 'unauthorized') return <AccessDenied />;

  return (
    <div>
      <header className="topbar">
        Inloggad som: {user.username} ({user.role})
        <button onClick={() => { localStorage.removeItem('user'); setUser(null); setPatientId(null); }}>
          Logga ut
        </button>
      </header>
      {patientId ? <PatientView patientId={patientId} user={user} /> : <SearchPage onSelectPatient={setPatientId} />}
    </div>
  );
}
// Startar allt genom att rendera App-komponenten i root-elementet.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
