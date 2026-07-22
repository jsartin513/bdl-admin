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

/** Logos sourced from https://usadodgeball.com/member-organizations */
export const HOME_LEAGUE_LOGOS: Record<HomeLeague, string> = {
  boston_dodgeball_league: '/home-leagues/boston_dodgeball_league.webp',
  nutmeg_dodgeball: '/home-leagues/nutmeg_dodgeball.webp',
  connecticut_dodgeball: '/home-leagues/connecticut_dodgeball.webp',
  dmv_dodgeball: '/home-leagues/dmv_dodgeball.webp',
  philly_dodgeball: '/home-leagues/philly_dodgeball.webp',
  cactus_dodgeball: '/home-leagues/cactus_dodgeball.webp',
  minnesota_dodgeball: '/home-leagues/minnesota_dodgeball.webp',
  big_apple_dodgeball: '/home-leagues/big_apple_dodgeball.webp',
  li_kick: '/home-leagues/li_kick.webp',
  dallas_dodgeball: '/home-leagues/dallas_dodgeball.webp',
  dodgeball_pdx: '/home-leagues/dodgeball_pdx.webp',
  dodgeball_san_diego: '/home-leagues/dodgeball_san_diego.webp',
  seattle_dodgeball: '/home-leagues/seattle_dodgeball.webp',
  new_york_dodgeball: '/home-leagues/new_york_dodgeball.webp',
  rose_city_dodgeball_association: '/home-leagues/rose_city_dodgeball_association.webp',
  sandlot_sports: '/home-leagues/sandlot_sports.webp',
  twin_cities_dodgeball: '/home-leagues/twin_cities_dodgeball.webp',
  summit_sports_league: '/home-leagues/summit_sports_league.webp',
  three_rivers_dodgeball_club: '/home-leagues/three_rivers_dodgeball_club.webp',
  world_dodgeball_society: '/home-leagues/world_dodgeball_society.webp',
}

export function isValidHomeLeague(value: unknown): value is HomeLeague {
  return typeof value === 'string' && value in HOME_LEAGUES
}

export function homeLeagueLabel(code: string | null | undefined): string {
  if (code == null) return '—'
  if (isValidHomeLeague(code)) return HOME_LEAGUES[code]
  return '—'
}

export function homeLeagueLogoUrl(code: string | null | undefined): string | null {
  if (!isValidHomeLeague(code)) return null
  return HOME_LEAGUE_LOGOS[code]
}
