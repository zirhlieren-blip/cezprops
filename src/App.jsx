import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Database,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase';
import { MOCK_PROPS } from './mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [propsList, setPropsList] = useState(MOCK_PROPS);
  const [trackedBets, setTrackedBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('demo');
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('ev_pct');

  const fetchLiveData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setDataSource('demo');
      return;
    }

    setLoading(true);
    try {
      const { data: signals, error: sigErr } = await supabase
        .from('ev_signals')
        .select('*')
        .order('ev_pct', { ascending: false })
        .limit(50);

      if (!sigErr && signals && signals.length > 0) {
        setPropsList(signals);
        setDataSource('live');
      } else {
        setPropsList(MOCK_PROPS);
        setDataSource('demo');
      }

      const { data: bets, error: betErr } = await supabase
        .from('tracked_bets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!betErr && bets) {
        setTrackedBets(bets);
      }
    } catch (err) {
      console.error('Supabase fetch error:', err);
      setDataSource('demo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, []);

  const filteredProps = useMemo(() => {
    return propsList
      .filter((item) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          item.player_name?.toLowerCase().includes(q) ||
          item.team?.toLowerCase().includes(q) ||
          item.opponent?.toLowerCase().includes(q);
        const matchesMarket = marketFilter === 'ALL' || item.market === marketFilter;
        return matchesSearch && matchesMarket;
      })
      .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [propsList, search, marketFilter, sortBy]);

  const handleTrackBet = async (prop) => {
    const newBet = {
      id: `bet-${Date.now()}`,
      player_name: prop.player_name,
      market: prop.market,
      line: prop.line,
      side: prop.side,
      odds: prop.odds,
      stake: 100,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tracked_bets')
        .insert([
          {
            player_name: newBet.player_name,
            market: newBet.market,
            line: newBet.line,
            side: newBet.side,
            odds: newBet.odds,
            stake: newBet.stake,
            status: 'PENDING',
          },
        ])
        .select();

      if (!error && data && data[0]) {
        setTrackedBets((prev) => [data[0], ...prev]);
        return;
      }
    }

    setTrackedBets((prev) => [newBet, ...prev]);
  };

  const updateBetStatus = async (betId, status) => {
    setTrackedBets((prev) =>
      prev.map((b) => (b.id === betId ? { ...b, status } : b))
    );

    if (isSupabaseConfigured && supabase && !String(betId).startsWith('bet-')) {
      await supabase.from('tracked_bets').update({ status }).eq('id', betId);
    }
  };

  const avgEv = useMemo(() => {
    if (!filteredProps.length) return '0.0';
    const sum = filteredProps.reduce((acc, p) => acc + Number(p.ev_pct || 0), 0);
    return (sum / filteredProps.length).toFixed(1);
  }, [filteredProps]);

  const trackerStats = useMemo(() => {
    let won = 0;
    let lost = 0;
    let profit = 0;
    trackedBets.forEach((b) => {
      const stake = Number(b.stake || 100);
      const odds = Number(b.odds || 1.9);
      if (b.status === 'WON') {
        won += 1;
        profit += stake * (odds - 1);
      } else if (b.status === 'LOST') {
        lost += 1;
        profit -= stake;
      }
    });
    const settled = won + lost;
    const winRate = settled ? ((won / settled) * 100).toFixed(1) : '0.0';
    return { won, lost, profit: profit.toFixed(0), winRate };
  }, [trackedBets]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">CP</div>
          <div>
            <h1>CEZPROPS</h1>
            <p>NBA Player Props &amp; +EV Analiz Terminali</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-pill">
            <span className={`status-dot ${dataSource === 'live' ? 'live' : 'demo'}`} />
            {dataSource === 'live' ? 'Supabase Canlı' : isSupabaseConfigured ? 'Bağlı (Demo Veri)' : 'Demo Modu'}
          </div>
          <button className="btn" onClick={fetchLiveData} disabled={loading}>
            <RefreshCw size={15} />
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>
      </header>

      <section className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Aktif +EV Fırsatı</div>
          <div className="kpi-value">{filteredProps.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ortalama Beklenen Değer</div>
          <div className="kpi-value green">+{avgEv}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Takip Edilen Kupon</div>
          <div className="kpi-value">{trackedBets.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Kasa Kâr / Zarar (Birim)</div>
          <div className={`kpi-value ${Number(trackerStats.profit) >= 0 ? 'green' : ''}`}>
            {Number(trackerStats.profit) >= 0 ? '+' : ''}
            {trackerStats.profit} ₺
          </div>
        </div>
      </section>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          <TrendingUp size={16} />
          Prop Tarayıcı
        </button>
        <button
          className={`tab ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          <Wallet size={16} />
          Kupon Takibi ({trackedBets.length})
        </button>
        <button
          className={`tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <Database size={16} />
          Sistem &amp; Supabase
        </button>
      </nav>

      {activeTab === 'scanner' && (
        <>
          <div className="filters-bar">
            <input
              className="input"
              type="text"
              placeholder="Oyuncu veya takım ara (örn: Jokic, OKC)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
            >
              <option value="ALL">Tüm Marketler</option>
              <option value="PTS">PTS (Sayı)</option>
              <option value="REB">REB (Ribaund)</option>
              <option value="AST">AST (Asist)</option>
              <option value="PRA">PRA</option>
              <option value="3PM">3PM (Üçlük)</option>
            </select>
            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="ev_pct">Sırala: En Yüksek EV%</option>
              <option value="l5_hit_rate">Sırala: Son 5 Maç %</option>
              <option value="l10_hit_rate">Sırala: Son 10 Maç %</option>
            </select>
          </div>

          <div className="props-grid">
            {filteredProps.map((prop) => (
              <article key={prop.id} className="prop-card">
                <div className="prop-top">
                  <div>
                    <div className="player-name">{prop.player_name}</div>
                    <div className="matchup">
                      {prop.team} {prop.opponent} • {prop.tipoff || 'Bu Gece'}
                    </div>
                  </div>
                  <div className="ev-badge">+{prop.ev_pct}% EV</div>
                </div>

                <div className="line-box">
                  <div className="line-main">
                    <span className={`side-tag ${prop.side === 'OVER' ? 'over' : 'under'}`}>
                      {prop.side}
                    </span>
                    {prop.line} {prop.market}
                  </div>
                  <div className="odds-val">{Number(prop.odds).toFixed(2)}</div>
                </div>

                <div className="metrics-row">
                  <div className="metric-item">
                    <span>Projeksiyon</span>
                    <strong>{prop.projected}</strong>
                  </div>
                  <div className="metric-item">
                    <span>Son 5 Maç</span>
                    <strong>%{prop.l5_hit_rate}</strong>
                  </div>
                  <div className="metric-item">
                    <span>Son 10 Maç</span>
                    <strong>%{prop.l10_hit_rate}</strong>
                  </div>
                </div>

                {prop.note && <div className="prop-note">{prop.note}</div>}

                <div className="prop-footer">
                  <span>Büro: {prop.sportsbook || 'Global'}</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleTrackBet(prop)}
                  >
                    <Plus size={14} />
                    Takibe Al
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === 'tracker' && (
        <div className="panel">
          <h2>Kupon &amp; Performans Takibi (Kazanma Oranı: %{trackerStats.winRate})</h2>
          {trackedBets.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Henüz takip edilen bir prop yok. Prop Tarayıcı sekmesinden "Takibe Al" butonuna basarak ekleyebilirsin.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Oyuncu</th>
                    <th>Seçim</th>
                    <th>Oran</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedBets.map((bet) => (
                    <tr key={bet.id}>
                      <td><strong>{bet.player_name}</strong></td>
                      <td>{bet.side} {bet.line} {bet.market}</td>
                      <td>{Number(bet.odds).toFixed(2)}</td>
                      <td>{bet.stake} ₺</td>
                      <td>
                        <span
                          className={
                            bet.status === 'WON'
                              ? 'badge-won'
                              : bet.status === 'LOST'
                              ? 'badge-lost'
                              : 'badge-pending'
                          }
                        >
                          {bet.status === 'WON'
                            ? 'KAZANDI'
                            : bet.status === 'LOST'
                            ? 'KAYBETTİ'
                            : 'BEKLİYOR'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => updateBetStatus(bet.id, 'WON')}
                            title="Kazandı"
                          >
                            <CheckCircle2 size={14} color="#10b981" />
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => updateBetStatus(bet.id, 'LOST')}
                            title="Kaybetti"
                          >
                            <XCircle size={14} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && (
        <div className="panel">
          <h2>Sistem Durumu ve Supabase Kurulumu</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
            Supabase Bağlantısı:{' '}
            <strong style={{ color: isSupabaseConfigured ? 'var(--accent)' : 'var(--amber)' }}>
              {isSupabaseConfigured ? 'Aktif (Ortam değişkenleri tanımlı)' : 'Eksik (Vercel Environment Variables eklenmeli)'}
            </strong>
          </p>
          <p style={{ fontSize: '0.88rem', marginBottom: '6px' }}>
            1. Vercel proje ayarlarında aşağıdaki iki ortam değişkenini tanımla:
          </p>
          <div className="code-block">
            SUPABASE_URL=https://PROJE_ID.supabase.co{'
'}
            SUPABASE_ANON_KEY=sb_publishable_...
          </div>
          <p style={{ fontSize: '0.88rem', marginTop: '14px', marginBottom: '6px' }}>
            2. Supabase SQL Editor üzerinden <strong>supabase/schema.sql</strong> dosyasını çalıştırarak 12 tabloyu oluştur.
          </p>
          <p style={{ fontSize: '0.88rem', marginTop: '10px', color: 'var(--muted)' }}>
            <Activity size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Edge Functions (The Odds API &amp; BallDontLie) klasördeki <strong>supabase/functions</strong> dizininde hazırdır.
          </p>
        </div>
      )}
    </div>
  );
}
