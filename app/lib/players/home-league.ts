export const HOME_LEAGUES = {
  boston_dodgeball_league: 'Boston Dodgeball League',
  nutmeg_dodgeball: 'Nutmeg Dodgeball',
  connecticut_dodgeball: 'Connecticut Dodgeball',
  dmv_dodgeball: 'DMV Dodgeball',
  philly_dodgeball: 'Philly Dodgeball',
  cactus_dodgeball: 'Cactus Dodgeball (Arizona)',
  minnesota_dodgeball: 'Minnesota Dodgeball',
  big_apple_dodgeball: 'Big Apple Dodgeball',
  li_kick: 'LI Kick',
  dallas_dodgeball: 'Dallas Dodgeball',
  dodgeball_pdx: 'Dodgeball PDX (Portland Oregon)',
  dodgeball_san_diego: 'Dodgeball San Diego',
  seattle_dodgeball: 'Seattle Dodgeball',
  new_york_dodgeball: 'New York Dodgeball',
  rose_city_dodgeball_association: 'Rose City Dodgeball Association (Portland)',
  sandlot_sports: 'Sandlot Sports',
  twin_cities_dodgeball: 'Twin Cities Dodgeball (St Paul)',
  summit_sports_league: 'Summit Sports League (Denver)',
  three_rivers_dodgeball_club: 'Three Rivers Dodgeball Club (Pittsburgh)',
  world_dodgeball_society: 'World Dodgeball Society (Los Angeles)',
} as const

export type HomeLeague = keyof typeof HOME_LEAGUES

export const HOME_LEAGUE_CODES = Object.keys(HOME_LEAGUES) as HomeLeague[]

export function isValidHomeLeague(value: unknown): value is HomeLeague {
  return typeof value === 'string' && value in HOME_LEAGUES
}

export function homeLeagueLabel(code: string | null | undefined): string {
  if (code == null) return '—'
  if (isValidHomeLeague(code)) return HOME_LEAGUES[code]
  return '—'
}
