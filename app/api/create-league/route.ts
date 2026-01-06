import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface CreateLeagueRequest {
  leagueName: string
  teams: string[]
  numWeeks: number
}

function createLeagueWorkbook(data: CreateLeagueRequest) {
  const { leagueName, teams, numWeeks } = data

  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  // 1. Teams Sheet
  const teamsData = [['Team Names', '', ...teams]]
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

  // 3. League Standings Sheet
  const standingsData = [
    ['LEAGUE STANDINGS', '', '', '', ''],
    ['Team Name', 'Points For', 'Points Against', 'Point Differential', ''],
    ['', '', '', '', ''], // Row 3 - 1st place
    ['', '', '', '', ''], // Row 4 - 2nd place
    ['', '', '', '', ''], // Row 5 - 3rd place
    ['', '', '', '', ''], // Row 6 - 4th place
    ['', '', '', '', ''], // Row 7 - 5th place
    ['', '', '', '', ''], // Row 8 - 6th place
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Week #', 0, '', '', ''],
    ['', '', '', '', ''],
    ['', '=SUM(B3:B8)', '=SUM(C3:C8)', '', ''], // Sum for 6 teams
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['Teams', 'Wins', '', '', 'Losses'],
  ]

  // Add team rows (17-20 or based on number of teams)
  const startRow = 17
  for (let i = 0; i < teams.length; i++) {
    const row = startRow + i
    const team = teams[i]
    
    // Build wins formula (sum from all week sheets)
    const winsParts: string[] = []
    for (let week = 1; week <= numWeeks; week++) {
      // Try to match existing week sheet names, or use default pattern
      winsParts.push(`'Week ${week}'!B${32 + i}`)
    }
    const winsFormula = `=${winsParts.join('+')}`
    
    // Magic number formula
    const magicFormula = `=B${row}+ROW(B${row})/10000`
    
    // Build losses formula
    const lossesParts: string[] = []
    for (let week = 1; week <= numWeeks; week++) {
      lossesParts.push(`'Week ${week}'!C${32 + i}`)
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

  // Add standings display formulas (rows 3-8 for 6 teams)
  const endRow = startRow + teams.length - 1 // Row 22 for 6 teams
  for (let rank = 1; rank <= teams.length; rank++) {
    const row = 2 + rank // Row 3, 4, 5, 6, 7, 8
    
    const teamNameFormula = `=INDEX(A${startRow}:A${endRow},MATCH(LARGE(C${startRow}:C${endRow},${rank}),C${startRow}:C${endRow},0))`
    const winsFormula = `=INDEX(B${startRow}:B${endRow},MATCH(LARGE(C${startRow}:C${endRow},${rank}),C${startRow}:C${endRow},0))`
    const lossesFormula = `=INDEX(E${startRow}:E${endRow},MATCH(LARGE(C${startRow}:C${endRow},${rank}),C${startRow}:C${endRow},0))`
    const diffFormula = `=B${row}-C${row}`
    
    standingsData[row] = [teamNameFormula, winsFormula, lossesFormula, diffFormula, '']
  }

  const standingsSheet = XLSX.utils.aoa_to_sheet(standingsData)
  XLSX.utils.book_append_sheet(workbook, standingsSheet, 'League Standings')

  // 4. Create Week Sheets
  const today = new Date()
  const daysUntilSunday = (6 - today.getDay()) % 7 || 7
  const startDate = new Date(today)
  startDate.setDate(today.getDate() + daysUntilSunday)

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

  // NEW ALGORITHM: 6 teams, each plays each opponent twice per week
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
    
    // Step 2: Distribute games evenly to avoid long gaps
    // Track game counts and last game positions for each team
    const teamGameCount: Map<string, number> = new Map()
    const teamLastPosition: Map<string, number> = new Map()
    teams.forEach(team => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
    })
    
    // Sort games to distribute evenly
    const distributedGames: Array<{ team1: string; team2: string; ref?: string }> = []
    const remainingGames = [...gamePairs]
    
    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity
      
      // Score each remaining game based on how evenly it distributes play
      remainingGames.forEach((gamePair, index) => {
        const team1 = gamePair.team1
        const team2 = gamePair.team2
        
        // Calculate score: prefer teams that have played fewer games and haven't played recently
        const team1Games = teamGameCount.get(team1) || 0
        const team2Games = teamGameCount.get(team2) || 0
        const team1LastPos = teamLastPosition.get(team1) || -1
        const team2LastPos = teamLastPosition.get(team2) || -1
        
        // Score favors: fewer games played, longer gap since last game
        const gap1 = distributedGames.length - team1LastPos
        const gap2 = distributedGames.length - team2LastPos
        const score = (10 - team1Games) * 10 + (10 - team2Games) * 10 + gap1 + gap2
        
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
      
      // Update counts and positions for both teams
      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, distributedGames.length - 1)
      teamLastPosition.set(game.team2, distributedGames.length - 1)
    }
    
    // Step 3: Assign refs: each team refs 5 games per week
    // 6 teams × 5 refs = 30 ref assignments for 30 games
    // Teams cannot ref games they're playing in
    // Avoid having the same team ref twice in a row
    const refPool: Map<string, number> = new Map()
    teams.forEach(team => refPool.set(team, 5)) // Each team needs to ref 5 games
    
    let lastRef: string | undefined = undefined
    
    // Assign refs to games, avoiding conflicts and consecutive refs
    distributedGames.forEach((game, index) => {
      // Find a team that's not playing in this game, still needs to ref, and wasn't the last ref
      const availableRefs = teams.filter(team => 
        team !== game.team1 && 
        team !== game.team2 && 
        (refPool.get(team) || 0) > 0 &&
        team !== lastRef // Avoid consecutive refs
      )
      
      // If no refs available (excluding last ref), allow last ref if necessary
      const finalAvailableRefs = availableRefs.length > 0 
        ? availableRefs 
        : teams.filter(team => 
            team !== game.team1 && 
            team !== game.team2 && 
            (refPool.get(team) || 0) > 0
          )
      
      if (finalAvailableRefs.length > 0) {
        // Pick a random available ref
        const refIndex = Math.floor(Math.random() * finalAvailableRefs.length)
        const selectedRef = finalAvailableRefs[refIndex]
        game.ref = selectedRef
        refPool.set(selectedRef, (refPool.get(selectedRef) || 0) - 1)
        lastRef = selectedRef
      } else {
        // Fallback: if no perfect match, use any team that still needs refs
        const anyAvailable = teams.find(team => (refPool.get(team) || 0) > 0)
        if (anyAvailable) {
          game.ref = anyAvailable
          refPool.set(anyAvailable, (refPool.get(anyAvailable) || 0) - 1)
          lastRef = anyAvailable
        }
      }
    })
    
    return distributedGames
  }

  // Generate games for each week (same schedule structure each week)
  const weekGames: Array<Array<{ team1: string; team2: string; ref?: string }>> = []
  for (let week = 0; week < numWeeks; week++) {
    weekGames.push(generate6TeamSchedule(teams))
  }

  // Create week sheets
  for (let week = 1; week <= numWeeks; week++) {
    const weekDate = new Date(startDate)
    weekDate.setDate(startDate.getDate() + (week - 1) * 7)
    const weekName = `Week ${week} (${weekDate.getMonth() + 1}.${weekDate.getDate()})`
    
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

    // Validation - currently only support 6 teams and 6 weeks
    if (!body.leagueName || !body.teams || body.teams.length !== 6) {
      return NextResponse.json(
        { error: 'League name and exactly 6 teams are required' },
        { status: 400 }
      )
    }

    if (body.numWeeks !== 6) {
      return NextResponse.json(
        { error: 'Number of weeks must be 6' },
        { status: 400 }
      )
    }

    // Create workbook
    const workbook = createLeagueWorkbook(body)

    // Convert workbook to buffer directly (no temp file needed)
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
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

