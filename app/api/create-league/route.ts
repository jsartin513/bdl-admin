import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseTeamCountFromTemplateName } from '@/app/lib/parseTemplateTeamCount'
import { exportGoogleSpreadsheetAsXlsx } from '@/app/lib/driveExportSpreadsheet'
import {
  applyTeamRenamesToWorkbook,
  buildTeamRenamePairs,
  extractTemplateTeams,
  findTemplateTeamsNeverInGame01,
} from '@/app/lib/mutateLeagueTemplate'

interface CreateLeagueRequest {
  leagueName: string
  /** Prefer deriving from `templateName`; optional for callers without a template. */
  numTeams?: number
  teams: string[]
  numWeeks: number
  /** Team that should not play in the very first game slot (setup constraint) */
  avoidFirstRound?: string
  /** Google Drive spreadsheet id — when set, workbook is exported from Drive and team names are replaced */
  templateId?: string
  /** Human-readable name of the selected template (written into the workbook) */
  templateName?: string
}

/** Sheet names with quotes for formulas (escaped apostrophe). */
function escapeSheetTitleForFormula(name: string): string {
  return name.replace(/'/g, "''")
}

/** 1-based Excel column index → column letter(s). */
function colLetterOneBased(columnNumber: number): string {
  let n = columnNumber
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Head-to-head wins for row-team vs column-team from weekly game rows (B/D teams, C/E scores). */
function buildHeadToHeadCellFormula(
  rowTeamAbs: string,
  colTeamAbs: string,
  weekNames: string[],
  maxRow: number,
): string {
  const parts = weekNames.map((wk) => {
    const q = `'${escapeSheetTitleForFormula(wk)}'`
    return (
      '(' +
      `SUMPRODUCT(--(${q}!$B$2:$B$${maxRow}=${rowTeamAbs}),--(${q}!$D$2:$D$${maxRow}=${colTeamAbs}),--(${q}!$C$2:$C$${maxRow}>${q}!$E$2:$E$${maxRow}))` +
      '+' +
      `SUMPRODUCT(--(${q}!$B$2:$B$${maxRow}=${colTeamAbs}),--(${q}!$D$2:$D$${maxRow}=${rowTeamAbs}),--(${q}!$E$2:$E$${maxRow}>${q}!$C$2:$C$${maxRow}))` +
      ')'
    )
  })
  return `=${parts.join('+')}`
}

function createLeagueWorkbook(data: CreateLeagueRequest & { numTeams: 4 | 6 | 7 }) {
  const { numTeams, teams, numWeeks, avoidFirstRound, templateName } = data

  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  // 1. Teams Sheet
  const teamsData: (string | number)[][] = [['Team Names', '', ...teams]]
  if (templateName) {
    teamsData.push(['Based on template', templateName])
  }
  const teamsSheet = XLSX.utils.aoa_to_sheet(teamsData)
  XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams')

  // 2. Schedule Generator Sheet
  const scheduleGenData: (string | number)[][] = []
  
  // Header row
  scheduleGenData.push(['', '', ...teams])
  
  // Data rows
  for (const team of teams) {
    const row: (string | number)[] = [team]
    for (const opponent of teams) {
      if (team === opponent) {
        row.push('-')
      } else {
        row.push(2) // Default: 2 games per matchup
      }
    }
    scheduleGenData.push(row)
  }
  
  const scheduleGenSheet = XLSX.utils.aoa_to_sheet(scheduleGenData)
  XLSX.utils.book_append_sheet(workbook, scheduleGenSheet, 'Schedule Generator')

  // Tab names shared by League Standings, head-to-head, and week tabs (Scores / wins use these sheets)
  const today = new Date()
  const daysUntilSunday = (6 - today.getDay()) % 7 || 7
  const leagueSunday = new Date(today)
  leagueSunday.setDate(today.getDate() + daysUntilSunday)
  const weekSheetNames: string[] = []
  for (let w = 1; w <= numWeeks; w++) {
    const weekDate = new Date(leagueSunday)
    weekDate.setDate(leagueSunday.getDate() + (w - 1) * 7)
    weekSheetNames.push(`Week ${w} (${weekDate.getMonth() + 1}.${weekDate.getDate()})`)
  }

  // 3. League Standings Sheet
  const standingsRows = numTeams
  const standingsData: (string | number)[][] = [
    ['LEAGUE STANDINGS', '', '', '', ''],
    ['Team Name', 'Points For', 'Points Against', 'Point Differential', ''],
  ]
  for (let r = 0; r < numTeams; r++) {
    standingsData.push(['', '', '', '', ''])
  }

  standingsData.push(
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Week #', 0, '', '', ''],
    ['', '', '', '', ''],
    ['', `=SUM(B3:B${2 + standingsRows})`, `=SUM(C3:C${2 + standingsRows})`, '', ''], // Sum for all teams
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Teams', 'Wins', '', '', 'Losses'],
  )

  // Add team rows (17-20 or based on number of teams)
  const startRow = 17
  for (let i = 0; i < teams.length; i++) {
    const row = startRow + i
    const team = teams[i]
    
    // Build wins formula (sum from all week sheets)
    // Row calculation: 
    // - Row 1: Header "Court 1"
    // - Games block: n(n−1) games/week × 2 rows (game + ref), then win/loss block
    const gamesPerWeek = numTeams * (numTeams - 1)
    const teamFormulaStartRow = 1 + gamesPerWeek * 2 + 3 + 1 // 1 header + games*2 + spacing(1) + header(1) + header(1) + 1
    const winsParts: string[] = []
    for (let week = 1; week <= numWeeks; week++) {
      winsParts.push(
        `'${escapeSheetTitleForFormula(weekSheetNames[week - 1])}'!B${teamFormulaStartRow + i}`
      )
    }
    const winsFormula = `=${winsParts.join('+')}`
    
    // Tie-break: literal row (not ROW(B)) — merged B column breaks ROW()-based tiebreak
    const magicFormula = `=ROUND(B${row}+${row}/10000,8)`
    
    // Build losses formula
    const lossesParts: string[] = []
    for (let week = 1; week <= numWeeks; week++) {
      lossesParts.push(
        `'${escapeSheetTitleForFormula(weekSheetNames[week - 1])}'!C${teamFormulaStartRow + i}`
      )
    }
    const lossesFormula = `=${lossesParts.join('+')}`
    
    standingsData.push([
      team,
      winsFormula,
      magicFormula,
      '',
      lossesFormula
    ])
  }

  // Standings leaderboard (sheet rows 3–8): must run after team rows so LARGE/MATCH refs point at B17+:E…
  const nt = teams.length
  const teamBlockEndSheetRow = startRow + nt - 1
  const cRng = `C${startRow}:C${teamBlockEndSheetRow}`
  for (let rank = 1; rank <= nt; rank++) {
    const sheetRow = 2 + rank
    const idx = sheetRow - 1
    const largeK = `ROUND(LARGE(${cRng},${rank}),8)`
    const teamNameFormula = `=INDEX(A${startRow}:A${teamBlockEndSheetRow},MATCH(${largeK},${cRng},0))`
    const winsDisplay = `=INDEX(B${startRow}:B${teamBlockEndSheetRow},MATCH(${largeK},${cRng},0))`
    const lossesDisplay = `=INDEX(E${startRow}:E${teamBlockEndSheetRow},MATCH(${largeK},${cRng},0))`
    const diffFormula = `=B${sheetRow}-C${sheetRow}`
    standingsData[idx] = [teamNameFormula, winsDisplay, lossesDisplay, diffFormula, '']
  }

  // Head-to-head matrix: row numbers computed from standingsData length so they stay aligned with spacer rows above
  const h2hMaxScan = 500
  standingsData.push([])
  standingsData.push([
    'Head-to-head wins (row vs column; higher score wins)',
    '',
    '',
    '',
    '',
  ])
  const headerRow = standingsData.length + 1
  const h2hHead: (string | number)[] = ['']
  for (const t of teams) h2hHead.push(t)
  standingsData.push(h2hHead)

  const dataStart = standingsData.length + 1
  for (let i = 0; i < nt; i++) {
    const excelDataRow = dataStart + i
    const rowCell = `$A${excelDataRow}`
    const rowVals: (string | number)[] = [teams[i]]
    for (let j = 0; j < nt; j++) {
      if (i === j) {
        rowVals.push('—')
      } else {
        const colL = colLetterOneBased(j + 2)
        rowVals.push(
          buildHeadToHeadCellFormula(
            rowCell,
            `$${colL}$${headerRow}`,
            weekSheetNames,
            h2hMaxScan
          )
        )
      }
    }
    standingsData.push(rowVals)
  }

  const standingsSheet = XLSX.utils.aoa_to_sheet(standingsData)
  XLSX.utils.book_append_sheet(workbook, standingsSheet, 'League Standings')

  // 4. Create Week Sheets
  // (weeksheet names aligned with standings + head-to-head: weekSheetNames)

  // ============================================================================
  // ROUND-ROBIN ALGORITHM (preserved for future use when more options are added)
  // ============================================================================
  // function generateRoundRobinSchedule(teams: string[], numWeeks: number) {
  //   const allGames: Array<{ team1: string; team2: string }> = []
  //   for (let i = 0; i < teams.length; i++) {
  //     for (let j = i + 1; j < teams.length; j++) {
  //       // Each matchup plays 2 games
  //       allGames.push({ team1: teams[i], team2: teams[j] })
  //       allGames.push({ team1: teams[i], team2: teams[j] })
  //     }
  //   }
  //   // Distribute games across weeks
  //   const gamesPerWeek = Math.ceil(allGames.length / numWeeks)
  //   const weekGames: Array<Array<{ team1: string; team2: string }>> = []
  //   for (let week = 0; week < numWeeks; week++) {
  //     weekGames.push([])
  //   }
  //   allGames.forEach((game, index) => {
  //     const weekIndex = Math.floor(index / gamesPerWeek)
  //     if (weekIndex < numWeeks) {
  //       weekGames[weekIndex].push(game)
  //     } else {
  //       weekGames[numWeeks - 1].push(game)
  //     }
  //   })
  //   return weekGames
  // }
  // ============================================================================

  // 4-TEAM SCHEDULE: Each team plays each opponent twice per week
  // This generates 12 games per week (6 unique pairs × 2 games each)
  // Each team plays 6 games per week, refs 3 games per week
  function generate4TeamSchedule(teams: string[]): Array<{ team1: string; team2: string; ref?: string }> {
    // Step 1: Generate all game pairs with home/away alternation
    const gamePairs: Array<{ team1: string; team2: string; homeTeam: string }> = []
    
    // Generate all unique pairs (4 choose 2 = 6 pairs)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Each pair plays twice, alternating home/away
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[i] })
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[j] })
      }
    }
    
    // Step 2: Distribute games evenly (same algorithm as 6-team)
    const teamGameCount: Map<string, number> = new Map()
    const teamLastPosition: Map<string, number> = new Map()
    const teamLargeGapCount: Map<string, number> = new Map()
    const maxWaitThreshold = 3 // Lower threshold for 4 teams (fewer games)
    teams.forEach(team => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
      teamLargeGapCount.set(team, 0)
    })
    
    const distributedGames: Array<{ team1: string; team2: string; ref?: string }> = []
    const remainingGames = [...gamePairs]
    
    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity
      
      const teamWaitTimes: Map<string, number> = new Map()
      const currentLength: number = distributedGames.length
      teams.forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        const waitTime = lastPos === -1 ? currentLength : currentLength - lastPos
        teamWaitTimes.set(team, waitTime)
      })
      
      const urgentTeams = new Set<string>()
      teamWaitTimes.forEach((waitTime, team) => {
        if (waitTime >= maxWaitThreshold) {
          urgentTeams.add(team)
        }
      })
      
      remainingGames.forEach((gamePair, index) => {
        const team1 = gamePair.team1
        const team2 = gamePair.team2
        const team1Games = teamGameCount.get(team1) || 0
        const team2Games = teamGameCount.get(team2) || 0
        const wait1 = teamWaitTimes.get(team1) || 0
        const wait2 = teamWaitTimes.get(team2) || 0
        const largeGapCount1 = teamLargeGapCount.get(team1) || 0
        const largeGapCount2 = teamLargeGapCount.get(team2) || 0
        const addressesUrgent = urgentTeams.has(team1) || urgentTeams.has(team2)
        
        const urgency1 = wait1 >= maxWaitThreshold 
          ? Math.pow(2, wait1 - maxWaitThreshold + 2) * 50000 
          : wait1 * 200
        const urgency2 = wait2 >= maxWaitThreshold 
          ? Math.pow(2, wait2 - maxWaitThreshold + 2) * 50000 
          : wait2 * 200
        
        const largeGapPenalty1 = largeGapCount1 > 0 ? largeGapCount1 * 5000 : 0
        const largeGapPenalty2 = largeGapCount2 > 0 ? largeGapCount2 * 5000 : 0
        
        const score = 
          urgency1 + urgency2 +
          (6 - team1Games) * 5 + // 6 games per team for 4-team league
          (6 - team2Games) * 5 +
          (addressesUrgent ? 1000 : 0) -
          largeGapPenalty1 - largeGapPenalty2
        
      if (score > bestScore) {
        bestScore = score
        bestGameIndex = index
      }
    })
    
    if (bestGameIndex === -1) {
      // Fallback: just take the first game if scoring failed
      bestGameIndex = 0
    }
    
    const selectedGame = remainingGames.splice(bestGameIndex, 1)[0]
    if (!selectedGame) {
      throw new Error('No game selected from remaining games')
    }
    
    const game: { team1: string; team2: string; ref?: string } = {
      team1: selectedGame.homeTeam,
      team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1,
      ref: undefined
    }
    
    distributedGames.push(game)
      
      const gamesLength: number = distributedGames.length as number
      [game.team1, game.team2].forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        if (lastPos !== -1) {
          const gap = gamesLength - 1 - lastPos
          if (gap >= maxWaitThreshold) {
            teamLargeGapCount.set(team, (teamLargeGapCount.get(team) || 0) + 1)
          }
        }
      })
      
      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, gamesLength - 1)
      teamLastPosition.set(game.team2, gamesLength - 1)
    }
    
    // Step 3: Assign refs (3 refs per team for 4-team league)
    const refPool: Map<string, number> = new Map()
    teams.forEach(team => refPool.set(team, 3)) // Each team refs 3 games
    
    let lastRef: string | undefined = undefined
    
    distributedGames.forEach((game) => {
      const allAvailableRefs = teams.filter(team => 
        team !== game.team1 && 
        team !== game.team2 && 
        (refPool.get(team) || 0) > 0
      )
      
      if (allAvailableRefs.length === 0) {
        const anyAvailable = teams.find(team => 
          team !== game.team1 && 
          team !== game.team2 && 
          (refPool.get(team) || 0) > 0
        )
        if (anyAvailable) {
          game.ref = anyAvailable
          refPool.set(anyAvailable, (refPool.get(anyAvailable) || 0) - 1)
          lastRef = anyAvailable
        }
        return
      }
      
      const preferredRefs = allAvailableRefs.filter(team => team !== lastRef)
      const refsToChooseFrom = preferredRefs.length > 0 ? preferredRefs : allAvailableRefs
      
      const refIndex = Math.floor(Math.random() * refsToChooseFrom.length)
      const selectedRef = refsToChooseFrom[refIndex]
      game.ref = selectedRef
      refPool.set(selectedRef, (refPool.get(selectedRef) || 0) - 1)
      lastRef = selectedRef
    })
    
    return distributedGames
  }

  // 6-TEAM SCHEDULE: Each team plays each opponent twice per week
  // This generates 30 games per week (15 unique pairs × 2 games each)
  // Home/away alternates for each pair's two games
  // Games are distributed evenly so teams don't sit out too many games in a row
  function generate6TeamSchedule(teams: string[]): Array<{ team1: string; team2: string; ref?: string }> {
    // Step 1: Generate all game pairs with home/away alternation
    const gamePairs: Array<{ team1: string; team2: string; homeTeam: string }> = []
    
    // Generate all unique pairs (6 choose 2 = 15 pairs)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Each pair plays twice, alternating home/away
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[i] }) // First game: team1 home
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[j] }) // Second game: team2 home
      }
    }
    
    // Step 2: Distribute games evenly with constraint-based approach to minimize gaps
    // Track game counts and last game positions for each team
    const teamGameCount: Map<string, number> = new Map()
    const teamLastPosition: Map<string, number> = new Map()
    const teamLargeGapCount: Map<string, number> = new Map() // Track how many large gaps each team has already had
    const maxWaitThreshold = 4 // Maximum games a team should wait between appearances (ideally)
    teams.forEach(team => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
      teamLargeGapCount.set(team, 0)
    })
    
    // Sort games to distribute evenly
    const distributedGames: Array<{ team1: string; team2: string; ref?: string }> = []
    const remainingGames = [...gamePairs]
    
    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity
      
      // Calculate current wait times for all teams
      const teamWaitTimes: Map<string, number> = new Map()
      const currentLength: number = distributedGames.length as number
      teams.forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        const waitTime = lastPos === -1 ? currentLength : currentLength - lastPos
        teamWaitTimes.set(team, waitTime)
      })
      
      // Find teams that are approaching or exceeding the threshold
      const urgentTeams = new Set<string>()
      teamWaitTimes.forEach((waitTime, team) => {
        if (waitTime >= maxWaitThreshold) {
          urgentTeams.add(team)
        }
      })
      
      // Score each remaining game based on how evenly it distributes play
      remainingGames.forEach((gamePair, index) => {
        const team1 = gamePair.team1
        const team2 = gamePair.team2
        
        const team1Games = teamGameCount.get(team1) || 0
        const team2Games = teamGameCount.get(team2) || 0
        const wait1 = teamWaitTimes.get(team1) || 0
        const wait2 = teamWaitTimes.get(team2) || 0
        const largeGapCount1 = teamLargeGapCount.get(team1) || 0
        const largeGapCount2 = teamLargeGapCount.get(team2) || 0
        
        // Check if this game addresses urgent teams
        const addressesUrgent = urgentTeams.has(team1) || urgentTeams.has(team2)
        
        // Calculate urgency score (exponential penalty for long waits)
        // Teams waiting >= threshold get massive priority
        // Use even more aggressive exponential: 2^(wait - threshold + 2) for teams at/over threshold
        const urgency1 = wait1 >= maxWaitThreshold 
          ? Math.pow(2, wait1 - maxWaitThreshold + 2) * 50000 
          : wait1 * 200
        const urgency2 = wait2 >= maxWaitThreshold 
          ? Math.pow(2, wait2 - maxWaitThreshold + 2) * 50000 
          : wait2 * 200
        
        // Penalize teams that already have large gaps
        // Teams with existing large gaps get additional penalty to avoid multiple large gaps
        const largeGapPenalty1 = largeGapCount1 > 0 ? largeGapCount1 * 5000 : 0
        const largeGapPenalty2 = largeGapCount2 > 0 ? largeGapCount2 * 5000 : 0
        
        // Score prioritizes:
        // 1. Urgent teams (waiting >= threshold) - exponential priority
        // 2. Teams with longer waits (to minimize gaps)
        // 3. Teams with fewer games (to ensure even distribution)
        // 4. Penalize teams that already have large gaps (to avoid multiple large gaps)
        const score = 
          urgency1 + urgency2 + // Urgency (exponential for long waits)
          (10 - team1Games) * 5 + // Secondary: ensure even game distribution
          (10 - team2Games) * 5 +
          (addressesUrgent ? 1000 : 0) - // Bonus for addressing urgent teams
          largeGapPenalty1 - largeGapPenalty2 // Penalty for teams with existing large gaps
        
        if (score > bestScore) {
          bestScore = score
          bestGameIndex = index
        }
      })
      
      // Select the best game
      const selectedGame = remainingGames.splice(bestGameIndex, 1)[0]
      
      // Determine team1 and team2 based on home team
      const game = {
        team1: selectedGame.homeTeam, // Home team goes in team1 position (column B)
        team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1, // Away team
        ref: undefined as string | undefined
      }
      
      distributedGames.push(game)
      
      // Check if this game creates a large gap for either team
      const gamesLength: number = distributedGames.length as number
      [game.team1, game.team2].forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        if (lastPos !== -1) {
          const gap = gamesLength - 1 - lastPos
          if (gap >= maxWaitThreshold) {
            // This team just experienced a large gap
            teamLargeGapCount.set(team, (teamLargeGapCount.get(team) || 0) + 1)
          }
        }
      })
      
      // Update counts and positions for both teams
      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, gamesLength - 1)
      teamLastPosition.set(game.team2, gamesLength - 1)
    }
    
    // Step 3: Assign refs: each team refs 5 games per week
    // 6 teams × 5 refs = 30 ref assignments for 30 games
    // Teams cannot ref games they're playing in
    // Prioritize reducing wait times over avoiding consecutive refs
    // Consecutive refs are acceptable if they help with overall schedule quality
    const refPool: Map<string, number> = new Map()
    teams.forEach(team => refPool.set(team, 5)) // Each team needs to ref 5 games
    
    let lastRef: string | undefined = undefined
    
    // Assign refs to games, prioritizing schedule quality over avoiding consecutive refs
    distributedGames.forEach((game) => {
      // Find all teams that can ref (not playing in this game and still need to ref)
      const allAvailableRefs = teams.filter(team => 
        team !== game.team1 && 
        team !== game.team2 && 
        (refPool.get(team) || 0) > 0
      )
      
      if (allAvailableRefs.length === 0) {
        // Fallback: find any team that's not playing and still needs to ref
        const anyAvailable = teams.find(team => 
          team !== game.team1 && 
          team !== game.team2 && 
          (refPool.get(team) || 0) > 0
        )
        if (anyAvailable) {
          game.ref = anyAvailable
          refPool.set(anyAvailable, (refPool.get(anyAvailable) || 0) - 1)
          lastRef = anyAvailable
        }
        return
      }
      
      // Prefer refs that aren't the last ref, but don't make it a hard requirement
      // This allows consecutive refs when necessary to maintain schedule quality
      const preferredRefs = allAvailableRefs.filter(team => team !== lastRef)
      const refsToChooseFrom = preferredRefs.length > 0 ? preferredRefs : allAvailableRefs
      
      // Pick a random ref from available options
      const refIndex = Math.floor(Math.random() * refsToChooseFrom.length)
      const selectedRef = refsToChooseFrom[refIndex]
      game.ref = selectedRef
      refPool.set(selectedRef, (refPool.get(selectedRef) || 0) - 1)
      lastRef = selectedRef
    })
    
    return distributedGames
  }

  // 7-TEAM SCHEDULE: Each team plays each opponent twice per week
  // 42 games per week (21 unique pairs × 2 games each); each team plays 12 games and refs 6
  function generate7TeamSchedule(teams: string[]): Array<{ team1: string; team2: string; ref?: string }> {
    const gamePairs: Array<{ team1: string; team2: string; homeTeam: string }> = []

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[i] })
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[j] })
      }
    }

    const teamGameCount: Map<string, number> = new Map()
    const teamLastPosition: Map<string, number> = new Map()
    const teamLargeGapCount: Map<string, number> = new Map()
    const maxWaitThreshold = 5
    teams.forEach((team) => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
      teamLargeGapCount.set(team, 0)
    })

    const distributedGames: Array<{ team1: string; team2: string; ref?: string }> = []
    const remainingGames = [...gamePairs]

    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity

      const teamWaitTimes: Map<string, number> = new Map()
      const currentLength: number = distributedGames.length as number
      teams.forEach((team) => {
        const lastPos = teamLastPosition.get(team) || -1
        const waitTime = lastPos === -1 ? currentLength : currentLength - lastPos
        teamWaitTimes.set(team, waitTime)
      })

      const urgentTeams = new Set<string>()
      teamWaitTimes.forEach((waitTime, team) => {
        if (waitTime >= maxWaitThreshold) {
          urgentTeams.add(team)
        }
      })

      remainingGames.forEach((gamePair, index) => {
        const team1 = gamePair.team1
        const team2 = gamePair.team2

        const team1Games = teamGameCount.get(team1) || 0
        const team2Games = teamGameCount.get(team2) || 0
        const wait1 = teamWaitTimes.get(team1) || 0
        const wait2 = teamWaitTimes.get(team2) || 0
        const largeGapCount1 = teamLargeGapCount.get(team1) || 0
        const largeGapCount2 = teamLargeGapCount.get(team2) || 0

        const addressesUrgent = urgentTeams.has(team1) || urgentTeams.has(team2)

        const urgency1 =
          wait1 >= maxWaitThreshold
            ? Math.pow(2, wait1 - maxWaitThreshold + 2) * 50000
            : wait1 * 200
        const urgency2 =
          wait2 >= maxWaitThreshold
            ? Math.pow(2, wait2 - maxWaitThreshold + 2) * 50000
            : wait2 * 200

        const largeGapPenalty1 = largeGapCount1 > 0 ? largeGapCount1 * 5000 : 0
        const largeGapPenalty2 = largeGapCount2 > 0 ? largeGapCount2 * 5000 : 0

        const score =
          urgency1 +
          urgency2 +
          (12 - team1Games) * 5 +
          (12 - team2Games) * 5 +
          (addressesUrgent ? 1000 : 0) -
          largeGapPenalty1 -
          largeGapPenalty2

        if (score > bestScore) {
          bestScore = score
          bestGameIndex = index
        }
      })

      const selectedGame = remainingGames.splice(bestGameIndex, 1)[0]

      const game = {
        team1: selectedGame.homeTeam,
        team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1,
        ref: undefined as string | undefined,
      }

      distributedGames.push(game)

      const gamesLength: number = distributedGames.length as number
      ;[game.team1, game.team2].forEach((team) => {
        const lastPos = teamLastPosition.get(team) || -1
        if (lastPos !== -1) {
          const gap = gamesLength - 1 - lastPos
          if (gap >= maxWaitThreshold) {
            teamLargeGapCount.set(team, (teamLargeGapCount.get(team) || 0) + 1)
          }
        }
      })

      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, gamesLength - 1)
      teamLastPosition.set(game.team2, gamesLength - 1)
    }

    const refPool: Map<string, number> = new Map()
    teams.forEach((team) => refPool.set(team, 6))

    let lastRef: string | undefined = undefined

    distributedGames.forEach((game) => {
      const allAvailableRefs = teams.filter(
        (team) =>
          team !== game.team1 && team !== game.team2 && (refPool.get(team) || 0) > 0
      )

      if (allAvailableRefs.length === 0) {
        const anyAvailable = teams.find(
          (team) =>
            team !== game.team1 && team !== game.team2 && (refPool.get(team) || 0) > 0
        )
        if (anyAvailable) {
          game.ref = anyAvailable
          refPool.set(anyAvailable, (refPool.get(anyAvailable) || 0) - 1)
          lastRef = anyAvailable
        }
        return
      }

      const preferredRefs = allAvailableRefs.filter((team) => team !== lastRef)
      const refsToChooseFrom = preferredRefs.length > 0 ? preferredRefs : allAvailableRefs

      const refIndex = Math.floor(Math.random() * refsToChooseFrom.length)
      const selectedRef = refsToChooseFrom[refIndex]
      game.ref = selectedRef
      refPool.set(selectedRef, (refPool.get(selectedRef) || 0) - 1)
      lastRef = selectedRef
    })

    return distributedGames
  }

  // Generate games for each week using the appropriate schedule function
  const weekGames: Array<Array<{ team1: string; team2: string; ref?: string }>> = []
  const generateSchedule =
    numTeams === 4
      ? generate4TeamSchedule
      : numTeams === 7
        ? generate7TeamSchedule
        : generate6TeamSchedule
  for (let week = 0; week < numWeeks; week++) {
    const games = generateSchedule(teams)

    // For Week 1 only: ensure the avoidFirstRound team doesn't appear in game 1
    if (week === 0 && avoidFirstRound && games.length > 0) {
      const firstGameInvolves =
        games[0].team1 === avoidFirstRound || games[0].team2 === avoidFirstRound
      if (firstGameInvolves) {
        const swapIndex = games.findIndex(
          (g) => g.team1 !== avoidFirstRound && g.team2 !== avoidFirstRound
        )
        if (swapIndex > 0) {
          ;[games[0], games[swapIndex]] = [games[swapIndex], games[0]]
        }
      }
    }

    weekGames.push(games)
  }

  // Create week sheets
  for (let week = 1; week <= numWeeks; week++) {
    const weekName = weekSheetNames[week - 1]
    
    const weekData: (string | number)[][] = [
      ['', 'Court 1', '', '', '', '', '', '', '', ''] // Ensure 10 columns (A-J)
    ]

    const games = weekGames[week - 1] || []
    let gameNum = 1
    for (const game of games) {
      // Game row: A=Game#, B=Team1, C=(empty/score), D=Team2, E=(empty/score)
      const gameRow: (string | number)[] = [`Game ${String(gameNum).padStart(2, '0')}`, game.team1, '', game.team2, '', '', '', '', '', '']
      weekData.push(gameRow)
      
      // Ref row: A=(empty), B=Refs: TeamName
      const refRow: (string | number)[] = ['', '', '', '', '', '', '', '', '', '']
      refRow[1] = game.ref ? `Refs: ${game.ref}` : '' // Column B (index 1) - ref team name
      weekData.push(refRow)
      gameNum++
    }

    // Add win/loss section
    weekData.push(['', '', '', '', '', '', '', '', '', ''])
    weekData.push(['Team Wins/Losses This Week', '', '', '', '', '', '', '', '', ''])
    weekData.push(['Team Name', 'Wins', 'Losses', '', '', '', '', '', '', ''])

    // Add team formulas
    for (const team of teams) {
      // Wins formula: SUMIFS for when team wins
      const winsFormula = `=SUMIFS(C:C,B:B,"${team}")+SUMIFS(E:E,D:D,"${team}")`
      // Losses formula: SUMIFS for when team loses
      const lossesFormula = `=SUMIFS(E:E,B:B,"${team}")+SUMIFS(C:C,D:D,"${team}")`
      weekData.push([team, winsFormula, lossesFormula, '', '', '', '', '', '', ''])
    }

    const weekSheet = XLSX.utils.aoa_to_sheet(weekData)
    XLSX.utils.book_append_sheet(workbook, weekSheet, weekName)
  }

  return workbook
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateLeagueRequest = await request.json()

    if (!body.leagueName || !body.teams) {
      return NextResponse.json(
        { error: 'League name and teams are required' },
        { status: 400 }
      )
    }

    let numTeams: number
    if (body.templateName?.trim()) {
      const parsed = parseTeamCountFromTemplateName(body.templateName)
      if (parsed === null) {
        return NextResponse.json(
          {
            error:
              'Could not determine team count from the template name. Use a name like "Six Team League" or "4 Team".',
          },
          { status: 400 },
        )
      }
      numTeams = parsed
    } else if (body.numTeams === 4 || body.numTeams === 6 || body.numTeams === 7) {
      numTeams = body.numTeams
    } else {
      return NextResponse.json(
        {
          error:
            'Select a league template (team count comes from its name), or send numTeams 4, 6, or 7 when calling the API without a template.',
        },
        { status: 400 },
      )
    }

    if (numTeams !== 4 && numTeams !== 6 && numTeams !== 7) {
      return NextResponse.json(
        { error: 'Only 4-, 6-, and 7-team leagues are supported.' },
        { status: 400 },
      )
    }

    if (body.teams.length !== numTeams) {
      return NextResponse.json(
        { error: `Number of teams must match: expected ${numTeams}, got ${body.teams.length}` },
        { status: 400 },
      )
    }

    if (body.numWeeks !== 6) {
      return NextResponse.json(
        { error: 'Number of weeks must be 6' },
        { status: 400 }
      )
    }

    if (body.templateId?.trim()) {
      try {
        const xlsxBuf = await exportGoogleSpreadsheetAsXlsx(body.templateId.trim())
        const wb = XLSX.read(xlsxBuf, { type: 'array', cellDates: true })
        const templateTeams = extractTemplateTeams(wb)
        if (templateTeams.length !== numTeams) {
          return NextResponse.json(
            {
              error: `This sheet has ${templateTeams.length} teams in standings / roster, but the selected template name implies ${numTeams}. Align the Drive file with the template or pick the matching entry.`,
            },
            { status: 400 },
          )
        }
        if (templateTeams.length !== body.teams.length) {
          return NextResponse.json(
            {
              error: `Template has ${templateTeams.length} team rows; you entered ${body.teams.length} names.`,
            },
            { status: 400 },
          )
        }

        const neverG01 = findTemplateTeamsNeverInGame01(wb, templateTeams)
        const pairs = buildTeamRenamePairs(
          templateTeams,
          body.teams,
          body.avoidFirstRound,
          neverG01,
        )
        applyTeamRenamesToWorkbook(wb, pairs)

        const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${body.leagueName.replace(/\s+/g, '_')}.xlsx"`,
          },
        })
      } catch (e) {
        console.error('Template export/mutate failed:', e)
        const message =
          e instanceof Error
            ? e.message
            : 'Could not load the Google Sheet template. Check Drive sharing and GOOGLE_DRIVE_API_KEY.'
        return NextResponse.json({ error: message }, { status: 502 })
      }
    }

    const workbook = createLeagueWorkbook({ ...body, numTeams })
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${body.leagueName.replace(/\s+/g, '_')}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Error creating league:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create league' },
      { status: 500 }
    )
  }
}

