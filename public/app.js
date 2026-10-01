// Hämta verktyg från react
const { useState, useEffect, useRef } = React;

// lägger till /api framför alla fetch-anrop. Servern vet vem man är via session-cookien,
// som webbläsaren skickar med automatiskt.
function api(path, options = {}) {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
    // access denied om servern svarar med 403, övriga fel kastas med serverns meddelande
  }).then(async (r) => {
    const data = await r.json();
    if (r.status === 403) throw new Error('ACCESS_DENIED');
    if (!r.ok) throw new Error(data.message);
    return data;
  });
}

// Visar en dropdown med alla användare som kan logga in, ett lösenordsfält och en knapp för att logga in.
// När man loggar in sparas användaren i localStorage och skickas upp till App-komponenten via onLogin.
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const users = ['drsmith', 'nursejoy', 'clinic1', 'johndoe', 'randomguy'];

  const submit = async (e) => {
    e.preventDefault();
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      // servern svarar { message, role, name }, så användarobjektet byggs ihop här
      const user = { username, name: data.name, role: data.role };
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h1>Logga in</h1>
      <form onSubmit={submit}>
        <select value={username} onChange={(e) => setUsername(e.target.value)}>
          <option value="">Välj användare</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lösenord" />
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
  const [chainLogs, setChainLogs] = useState([]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [denied, setDenied] = useState(false);
  // Sätts när vi själva sparar en anteckning, så vi inte laddar om journalen två gånger
  // (en gång efter vår POST och en gång när servern skickar note-added).
  const skipNextNoteEvent = useRef(false);

  // Hämtar journalen från servern. Svaret innehåller { patient, notes, logs }.
  // Om servern svarar med ACCESS_DENIED sätts denied=true och AccessDenied-komponenten visas.
  // OBS: varje journalhämtning loggas och skapar ett nytt block i kedjan.
  const load = async () => {
    try {
      const journal = await api(`/patients/${patientId}`);
      setData(journal);
    } catch {
      setDenied(true);
    }
  };

  // Hämtar åtkomstloggarna ur blockkedjan, med verified per logg. Skapar INTE något nytt block.
  const loadChain = async () => {
    try {
      setChainLogs(await api(`/chain/patient/${patientId}`));
    } catch {
      // saknas behörighet visas det redan via load()
    }
  };

    // Kör load() när sidan visas, och igen om patientId ändras.
  useEffect(() => { load().then(loadChain); }, [patientId]);

  // WebSocket-anslutning som lyssnar på händelser från servern.
  // chain-updated laddar bara om loggarna (inte journalen), annars skulle varje omladdning
  // skapa ett nytt block, som skapar ett nytt event, som laddar om igen... i all oändlighet.
  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socket = new WebSocket(protocol + location.host);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chain-updated') loadChain(); // kan gälla vilken patient som helst, t.ex. efter P2P-sync
      if (msg.type === 'note-added' && msg.patientId === patientId) {
        if (skipNextNoteEvent.current) skipNextNoteEvent.current = false;
        else load();
      }
    };
    return () => socket.close();
  }, [patientId]);

  // Skickar POST med patient, texten och vald synlighet, tömmer rutan och laddar om.
  const addNote = async () => {
    skipNextNoteEvent.current = true;
    await api('/notes', {
      method: 'POST',
      body: JSON.stringify({ patientId, content: note, visibility })
    });
    setNote('');
    load();
  };

  if (denied) return <AccessDenied />;
  if (!data) return <p>Laddar...</p>;

  return (
    <div className="card">
      <h2>{data.patient.name}</h2>
      <p>Personnummer: {data.patient.personal_number}</p>

      <h3>Anteckningar</h3>
      <ul>
        {data.notes.map((n) => (
          <li key={n.id}><b>{n.author_name}</b> ({n.visibility}): {n.content}</li>
        ))}
      </ul>

      {user.role !== 'patient' && (
        <div className="note-form">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ny anteckning..." />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Endast jag</option>
            <option value="staff">Vårdpersonal</option>
            <option value="everyone">Alla (inkl. patient)</option>
          </select>
          <button onClick={addNote}>Spara anteckning</button>
        </div>
      )}

      <h3>Åtkomstloggar (blockkedja)</h3>
      <ul>
        {chainLogs.map((l, i) => (
          <li key={`${l.blockIndex}-${i}`}>
            {new Date(l.timestamp).toLocaleString()} — {l.userName} — {l.action}{' '}
            <span className={l.verified ? 'badge-ok' : 'badge-bad'}>
              {l.verified ? '✓ Verifierad' : '✗ Manipulerad!'}
            </span>
            {/* DEMO: visar att verifieringen upptäcker en ändrad logg */}
            {user.role !== 'patient' && l.verified && (
              <button className="demo-tamper" onClick={() => api(`/chain/tamper/${l.blockIndex}`, { method: 'POST' })}>
                Demo: manipulera
              </button>
            )}
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
    // en patient skickas direkt till sin egen journal
    if (user && user.role === 'patient') {
      api('/patients/me').then((p) => setPatientId(p.id)).catch(() => {});
    }
  }, [user]);

  // Loggar ut på servern (förstör sessionen) och rensar sedan lokalt.
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('user');
    setUser(null);
    setPatientId(null);
  };

  if (!user) return <LoginPage onLogin={setUser} />;
  if (user.role === 'unauthorized') return <AccessDenied />;

  return (
    <div>
      <header className="topbar">
        Inloggad som: {user.username} ({user.role})
        <button onClick={logout}>
          Logga ut
        </button>
      </header>
      {patientId ? <PatientView patientId={patientId} user={user} /> : <SearchPage onSelectPatient={setPatientId} />}
    </div>
  );
}
// Startar allt genom att rendera App-komponenten i root-elementet.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
