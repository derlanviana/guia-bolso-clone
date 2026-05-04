import React from 'react';

const NAV = [
  { key: 'dashboard', label: 'Visão geral', icon: '📊' },
  { key: 'transacoes', label: 'Transações', icon: '↕️' },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: '📋' },
  { key: 'assinaturas', label: 'Assinaturas', icon: '📅' },
  { key: 'categorias', label: 'Categorias', icon: '🏷️' },
  { key: 'cartoes', label: 'Cartões', icon: '💳' },
];

export default function Navbar({ page, setPage }) {
  return (
    <nav className="topnav">
      <div className="topnav-links">
        {NAV.map(n => (
          <button
            key={n.key}
            className={`topnav-link${page === n.key ? ' active' : ''}`}
            onClick={() => setPage(n.key)}
          >
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
      </div>
      <div className="topnav-right">
        <div className="avatar">DV</div>
      </div>
    </nav>
  );
}
