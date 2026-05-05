import React from 'react';
import Icon from './Icon';

const NAV = [
  { key: 'dashboard', label: 'Visão geral', icon: 'layoutDashboard' },
  { key: 'transacoes', label: 'Transações', icon: 'arrowUpDown' },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: 'layers' },
  { key: 'assinaturas', label: 'Assinaturas', icon: 'repeat' },
  { key: 'categorias', label: 'Categorias', icon: 'tag' },
  { key: 'cartoes', label: 'Cartões', icon: 'creditCard' },
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
            <Icon name={n.icon} size={15} strokeWidth={page === n.key ? 2.2 : 1.8} />
            {n.label}
          </button>
        ))}
      </div>
      <div className="topnav-right">
        <button className="topnav-icon-btn"><Icon name="bell" size={18} /></button>
        <button className="topnav-icon-btn"><Icon name="settings" size={18} /></button>
        <div className="avatar">DV</div>
      </div>
    </nav>
  );
}
