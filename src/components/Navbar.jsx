import React from 'react';

export default function Navbar({ page, setPage, onAddExpense, onAddIncome }) {
  const links = [
    { key: 'dashboard', label: 'visão geral' },
    { key: 'lancamentos', label: 'lançamentos' },
    { key: 'relatorios', label: 'relatórios' },
  ];

  return (
    <nav className="topnav">
      <button className="topnav-logo" onClick={() => setPage('dashboard')} style={{cursor:'pointer',background:'none',border:'none'}}>
        <div className="topnav-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#129E3F" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <span style={{color:'white',fontWeight:700,fontSize:18}}>organizze</span>
      </button>

      <div className="topnav-links">
        {links.map(l => (
          <button
            key={l.key}
            className={`topnav-link${page === l.key ? ' active' : ''}`}
            onClick={() => setPage(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="topnav-actions">
        <button className="topnav-icon-btn" title="Configurações">⚙️</button>
        <button className="topnav-icon-btn" title="Notificações">🔔</button>
        <button className="topnav-icon-btn" title="Perfil">👤</button>
      </div>
    </nav>
  );
}
