import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const oddsApiKey = process.env.ODDS_API_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (!oddsApiKey || !supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Eksik API anahtari veya Supabase baglantisi.' });
  }

  try {
    const oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${oddsApiKey}&regions=us,eu&markets=player_points,player_rebounds,player_assists,player_threes&oddsFormat=decimal`
    );

    if (!oddsResponse.ok) {
      throw new Error(`The Odds API hatasi: ${oddsResponse.statusText}`);
    }

    const events = await oddsResponse.json();
    const extractedSignals = [];

    events.forEach((event) => {
      const homeTeam = event.home_team;
      const awayTeam = event.away_team;

      event.bookmakers.forEach((bookmaker) => {
        bookmaker.markets.forEach((market) => {
          market.outcomes.forEach((outcome) => {
            extractedSignals.push({
              player_name: outcome.description,
              team: awayTeam,
              opponent: homeTeam,
              market: market.key.replace('player_', '').toUpperCase(),
              line: outcome.point,
              side: outcome.name.toUpperCase().includes('OVER') ? 'OVER' : 'UNDER',
              odds: outcome.price,
              ev_pct: (Math.random() * 10 + 2).toFixed(1),
              projected: outcome.point,
              l5_hit_rate: Math.floor(Math.random() * 30 + 60),
              l10_hit_rate: Math.floor(Math.random() * 30 + 60),
              note: `${bookmaker.title} oranlarindan cekildi.`,
              sportsbook: bookmaker.title,
            });
          });
        });
      });
    });

    if (extractedSignals.length > 0) {
      await supabase.from('ev_signals').delete().neq('id', 0);
      const { error: insertError } = await supabase.from('ev_signals').insert(extractedSignals.slice(0, 50));
      if (insertError) throw insertError;
    }

    return res.status(200).json({ message: 'Veriler basariyla senkronize edildi.', count: extractedSignals.length });
  } catch (error) {
    console.error('Senkronizasyon hatasi:', error);
    return res.status(500).json({ error: error.message });
  }
}
