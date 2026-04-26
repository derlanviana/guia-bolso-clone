import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#129E3F','#E74C3C','#3498db','#e67e22','#9b59b6','#f1c40f','#1abc9c','#e91e63'];
const CATEGORY_ICONS = {
  'Alimentação':'🛒','Moradia':'🏠','Transporte':'🚗','Saúde':'💊','Lazer':'🎮',
  'Salário':'💰','Investimentos':'📈','Educação':'📚','Outros':'📦','Geral':'📋'
};

export default function Dashboard({ transactions, accounts, formatCurrency, setPage, openModal }) {
  const [showBalance, setShowBalance] = useState(true);
  const [billsTab, setBillsTab] = useState('proximas');

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName = now.toLocaleDateString('pt-BR',{month:'long'}).replace(/^\w/,c=>c.toUpperCase());

  const monthTx = transactions.filter(tx => tx?.date?.startsWith(currentMonth));
  const income = monthTx.filter(t=>t.amount>0).reduce((a,b)=>a+b.amount,0);
  const expense = monthTx.filter(t=>t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);

  const balance = transactions.reduce((a,b)=>a+b.amount,0);

  // Top expenses by category
  const categoryExpenses = {};
  monthTx.filter(t=>t.amount<0).forEach(t=>{
    const cat = t.category||'Outros';
    categoryExpenses[cat] = (categoryExpenses[cat]||0)+Math.abs(t.amount);
  });
  const chartData = Object.entries(categoryExpenses)
    .map(([name,value])=>({name,value}))
    .sort((a,b)=>b.value-a.value)
    .slice(0,5);
  const totalExpense = chartData.reduce((a,b)=>a+b.value,0);

  // Bills
  const upcoming = transactions
    .filter(t=>t.amount<0 && t.isrecurring)
    .slice(0,3);
  const toReceive = transactions
    .filter(t=>t.amount>0 && t.isrecurring)
    .slice(0,3);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const greetEmoji = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';

  return (
    <div className="page">
      <div className="dash-full" style={{marginBottom:16}}>
        <div className="welcome-card">
          <div className="welcome-left">
            <div className="welcome-greeting">{greeting},</div>
            <div className="welcome-name">Derlan! {greetEmoji}</div>
            <div className="welcome-stats">
              <div className="welcome-stat">
                <label>Receitas no mês atual</label>
                <div className="amount-income">{formatCurrency(income)}</div>
              </div>
              <div className="welcome-stat">
                <label>Despesas no mês atual</label>
                <div className="amount-expense">{formatCurrency(expense)}</div>
              </div>
            </div>
          </div>
          <div className="welcome-right">
            <h3>Acesso rápido</h3>
            <div className="quick-actions">
              <button className="quick-action" onClick={()=>openModal('expense')}>
                <div className="quick-action-icon red">➖</div>
                <span>DESPESA</span>
              </button>
              <button className="quick-action" onClick={()=>openModal('income')}>
                <div className="quick-action-icon green">➕</div>
                <span>RECEITA</span>
              </button>
              <button className="quick-action" onClick={()=>setPage('lancamentos')}>
                <div className="quick-action-icon blue">🔗</div>
                <span>IMPORTAR</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Minhas Contas */}
        <div className="card">
          <div className="card-body">
            <div className="balance-label">Saldo geral</div>
            <div className="balance-amount">
              {showBalance ? formatCurrency(balance) : 'R$ ••••••'}
              <button className="balance-eye" onClick={()=>setShowBalance(v=>!v)}>
                {showBalance ? '👁️' : '🙈'}
              </button>
            </div>
            <div className="card-title">Minhas contas</div>
            <div className="accounts-list">
              {accounts.length === 0 ? (
                <p style={{color:'var(--text-muted)',fontSize:13}}>Nenhuma conta cadastrada.</p>
              ) : accounts.map(acc=>(
                <div className="account-item" key={acc.id}>
                  <div className="account-avatar" style={{background:'#8B5CF6'}}>
                    {acc.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div className="account-info">
                    <div className="account-name">{acc.name}</div>
                    <div className="account-sub">{acc.number||'Conta manual'}</div>
                  </div>
                  <div className="account-balance">{formatCurrency(acc.balance||0)}</div>
                </div>
              ))}
            </div>
            <button className="manage-btn" onClick={()=>setPage('lancamentos')}>Gerenciar contas</button>
          </div>
        </div>

        {/* Maiores Gastos */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">Maiores gastos de {monthName}</div>
            {chartData.length === 0 ? (
              <p style={{color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sem despesas este mês.</p>
            ) : (
              <div className="donut-chart-wrap">
                <div className="chart-side">
                  {chartData.map((entry,i)=>(
                    <div className="expense-item" key={entry.name}>
                      <div className="expense-icon">{CATEGORY_ICONS[entry.name]||'📦'}</div>
                      <div className="expense-info">
                        <div className="expense-name">{entry.name}</div>
                      </div>
                      <div className="expense-pct">
                        {totalExpense>0?((entry.value/totalExpense)*100).toFixed(0):0}%
                      </div>
                    </div>
                  ))}
                  <button className="view-report-btn" onClick={()=>setPage('relatorios')}>Ver relatório</button>
                </div>
                <div style={{width:130,height:130,flexShrink:0}}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                        {chartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={v=>formatCurrency(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contas a Pagar */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">Contas a pagar</div>
            <div className="bills-tabs">
              <button className={`bills-tab${billsTab==='proximas'?' active':''}`} onClick={()=>setBillsTab('proximas')}>Próximas</button>
              <button className={`bills-tab${billsTab==='atrasadas'?' active':''}`} onClick={()=>setBillsTab('atrasadas')}>Atrasadas</button>
            </div>
            {upcoming.length===0?(
              <div className="bills-empty">Você não possui contas a pagar pendentes</div>
            ):upcoming.map(tx=>(
              <div className="bill-item" key={tx.id}>
                <div className="bill-icon">📋</div>
                <div className="bill-info">
                  <div className="bill-name">{tx.description?.split(' | ')[0]}</div>
                  <div className="bill-date">{new Date(tx.date).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="bill-amount">{formatCurrency(Math.abs(tx.amount))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Limite de Gastos */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">Limite de gastos de {monthName}</div>
            <div className="limit-empty">Nenhum Limite de Gasto definido para o período</div>
            <div style={{marginTop:16}}>
              <div className="card-title" style={{marginBottom:8}}>Contas a receber</div>
              {toReceive.length===0?(
                <div className="bills-empty">Você não possui contas a receber pendentes</div>
              ):toReceive.map(tx=>(
                <div className="bill-item" key={tx.id}>
                  <div className="bill-icon">💰</div>
                  <div className="bill-info">
                    <div className="bill-name">{tx.description?.split(' | ')[0]}</div>
                    <div className="bill-date">{new Date(tx.date).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div className="bill-amount" style={{color:'var(--green)'}}>{formatCurrency(tx.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
