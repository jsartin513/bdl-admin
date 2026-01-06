/**
 * Test script to create a league spreadsheet locally
 * Usage: node test-create-league.js
 */

const XLSX = require('xlsx')
const { writeFileSync } = require('fs')
const { join } = require('path')

function createLeagueWorkbook(data) {
  const { leagueName, teams, numWeeks } = data

  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  // 1. Teams Sheet
  const teamsData = [['Team Names', '', ...teams]]
  const teamsSheet = XLSX.utils.aoa_to_sheet(teamsData)
  XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams')

  // 2. Schedule Generator Sheet
  const scheduleGenData = []
  
  // Header row
  scheduleGenData.push(['', '', ...teams])
  
  // Data rows
  for (const team of teams) {
    const row = [team]
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

  // Add team rows (17-22 for 6 teams)
  const startRow = 17
  for (let i = 0; i < teams.length; i++) {
    const row = startRow + i
    const team = teams[i]
    
    // Build wins formula (sum from all week sheets)
    const winsParts = []
    for (let week = 1; week <= numWeeks; week++) {
      winsParts.push(`'Week ${week}'!B${32 + i}`)
    }
    const winsFormula = `=${winsParts.join('+')}`
    
    // Magic number formula
    const magicFormula = `=B${row}+ROW(B${row})/10000`
    
    // Build losses formula
    const lossesParts = []
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
  const endRow = startRow + teams.length - 1
  for (let rank = 1; rank <= teams.length; rank++) {
    const row = 2 + rank
    
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

  // NEW ALGORITHM: 6 teams, each plays each opponent twice per week
  function generate6TeamSchedule(teams) {
    // Step 1: Generate all game pairs with home/away alternation
    const gamePairs = []
    
    // Generate all unique pairs (6 choose 2 = 15 pairs)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Each pair plays twice, alternating home/away
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[i] }) // First game: team1 home
        gamePairs.push({ team1: teams[i], team2: teams[j], homeTeam: teams[j] }) // Second game: team2 home
      }
    }
    
    // Step 2: Distribute games evenly with constraint-based approach to minimize gaps
    const teamGameCount = new Map()
    const teamLastPosition = new Map()
    const teamLargeGapCount = new Map() // Track how many large gaps each team has already had
    const maxWaitThreshold = 4 // Maximum games a team should wait between appearances (ideally)
    teams.forEach(team => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
      teamLargeGapCount.set(team, 0)
    })
    
    const distributedGames = []
    const remainingGames = [...gamePairs]
    
    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity
      
      // Calculate current wait times for all teams
      const teamWaitTimes = new Map()
      teams.forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        const waitTime = lastPos === -1 ? distributedGames.length : distributedGames.length - lastPos
        teamWaitTimes.set(team, waitTime)
      })
      
      // Find teams that are approaching or exceeding the threshold
      const urgentTeams = new Set()
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
      
      if (bestGameIndex === -1) {
        // Fallback: just take the first game if scoring failed
        bestGameIndex = 0
      }
      
      const selectedGame = remainingGames.splice(bestGameIndex, 1)[0]
      
      if (!selectedGame) {
        throw new Error('No game selected from remaining games')
      }
      
      const game = {
        team1: selectedGame.homeTeam,
        team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1,
        ref: undefined
      }
      
      if (!game.team1 || !game.team2) {
        throw new Error(`Invalid game: team1=${game.team1}, team2=${game.team2}, selectedGame=${JSON.stringify(selectedGame)}`)
      }
      
      distributedGames.push(game)
      
      // Check if this game creates a large gap for either team
      const teamsInGame = [game.team1, game.team2].filter(t => t) // Filter out any undefined
      teamsInGame.forEach(team => {
        const lastPos = teamLastPosition.get(team) || -1
        if (lastPos !== -1) {
          const gap = distributedGames.length - 1 - lastPos
          if (gap >= maxWaitThreshold) {
            // This team just experienced a large gap
            teamLargeGapCount.set(team, (teamLargeGapCount.get(team) || 0) + 1)
          }
        }
      })
      
      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, distributedGames.length - 1)
      teamLastPosition.set(game.team2, distributedGames.length - 1)
    }
    
    // Step 2.5: Try multiple random orderings and pick the best one
    // Run the algorithm multiple times with different random seeds and pick the best result
    let bestSchedule = [...distributedGames]
    let bestScore = Infinity
    
    // Calculate schedule quality score (lower is better)
    // Penalizes: max gap, teams with multiple large gaps
    const calculateScheduleScore = (schedule, teamList) => {
      const teamLastPos = new Map()
      const teamLargeGaps = new Map()
      let maxGap = 0
      teamList.forEach(team => {
        teamLastPos.set(team, -1)
        teamLargeGaps.set(team, 0)
      })
      
      schedule.forEach((game, idx) => {
        [game.team1, game.team2].forEach(team => {
          const lastPos = teamLastPos.get(team)
          if (lastPos !== -1) {
            const gap = idx - lastPos
            if (gap > maxGap) maxGap = gap
            if (gap >= maxWaitThreshold) {
              teamLargeGaps.set(team, (teamLargeGaps.get(team) || 0) + 1)
            }
          }
          teamLastPos.set(team, idx)
        })
      })
      
      // Count teams with multiple large gaps
      let teamsWithMultipleLargeGaps = 0
      teamLargeGaps.forEach((count) => {
        if (count > 1) teamsWithMultipleLargeGaps++
      })
      
      // Score: prioritize schedules with lower max gap and fewer teams with multiple large gaps
      return maxGap * 1000 + teamsWithMultipleLargeGaps * 100
    }
    
    bestScore = calculateScheduleScore(distributedGames, teams)
    
    // Try a few more iterations with different game pair orderings
    for (let attempt = 0; attempt < 5; attempt++) {
      // Shuffle game pairs
      const shuffledPairs = [...gamePairs].sort(() => Math.random() - 0.5)
      
      // Re-run distribution with shuffled pairs
      const attemptGameCount = new Map()
      const attemptLastPosition = new Map()
      const attemptLargeGapCount = new Map()
      teams.forEach(team => {
        attemptGameCount.set(team, 0)
        attemptLastPosition.set(team, -1)
        attemptLargeGapCount.set(team, 0)
      })
      
      const attemptGames = []
      const attemptRemaining = [...shuffledPairs]
      
      while (attemptRemaining.length > 0) {
        let bestGameIndex = -1
        let bestGameScore = -Infinity
        
        const attemptWaitTimes = new Map()
        teams.forEach(team => {
          const lastPos = attemptLastPosition.get(team) || -1
          const waitTime = lastPos === -1 ? attemptGames.length : attemptGames.length - lastPos
          attemptWaitTimes.set(team, waitTime)
        })
        
        const attemptUrgentTeams = new Set()
        attemptWaitTimes.forEach((waitTime, team) => {
          if (waitTime >= maxWaitThreshold) {
            attemptUrgentTeams.add(team)
          }
        })
        
        attemptRemaining.forEach((gamePair, index) => {
          const team1 = gamePair.team1
          const team2 = gamePair.team2
          const wait1 = attemptWaitTimes.get(team1) || 0
          const wait2 = attemptWaitTimes.get(team2) || 0
          const addressesUrgent = attemptUrgentTeams.has(team1) || attemptUrgentTeams.has(team2)
          const largeGapCount1 = attemptLargeGapCount.get(team1) || 0
          const largeGapCount2 = attemptLargeGapCount.get(team2) || 0
          
          const urgency1 = wait1 >= maxWaitThreshold 
            ? Math.pow(2, wait1 - maxWaitThreshold + 2) * 50000 
            : wait1 * 200
          const urgency2 = wait2 >= maxWaitThreshold 
            ? Math.pow(2, wait2 - maxWaitThreshold + 2) * 50000 
            : wait2 * 200
          
          const team1Games = attemptGameCount.get(team1) || 0
          const team2Games = attemptGameCount.get(team2) || 0
          
          const largeGapPenalty1 = largeGapCount1 > 0 ? largeGapCount1 * 5000 : 0
          const largeGapPenalty2 = largeGapCount2 > 0 ? largeGapCount2 * 5000 : 0
          
          const score = 
            urgency1 + urgency2 +
            (10 - team1Games) * 5 +
            (10 - team2Games) * 5 +
            (addressesUrgent ? 1000 : 0) -
            largeGapPenalty1 - largeGapPenalty2
          
          if (score > bestGameScore) {
            bestGameScore = score
            bestGameIndex = index
          }
        })
        
        const selectedGame = attemptRemaining.splice(bestGameIndex, 1)[0]
        const game = {
          team1: selectedGame.homeTeam,
          team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1,
          ref: undefined
        }
        
        attemptGames.push(game)
        
        // Track large gaps
        const attemptTeamsInGame = [game.team1, game.team2].filter(t => t) // Filter out any undefined
        attemptTeamsInGame.forEach(team => {
          const lastPos = attemptLastPosition.get(team) || -1
          if (lastPos !== -1) {
            const gap = attemptGames.length - 1 - lastPos
            if (gap >= maxWaitThreshold) {
              attemptLargeGapCount.set(team, (attemptLargeGapCount.get(team) || 0) + 1)
            }
          }
        })
        
        attemptGameCount.set(game.team1, (attemptGameCount.get(game.team1) || 0) + 1)
        attemptGameCount.set(game.team2, (attemptGameCount.get(game.team2) || 0) + 1)
        attemptLastPosition.set(game.team1, attemptGames.length - 1)
        attemptLastPosition.set(game.team2, attemptGames.length - 1)
      }
      
      const attemptScore = calculateScheduleScore(attemptGames, teams)
      if (attemptScore < bestScore) {
        bestScore = attemptScore
        bestSchedule = attemptGames
      }
    }
    
    // Use the best schedule found
    distributedGames.length = 0
    distributedGames.push(...bestSchedule)
    
    // Step 3: Assign refs
    // Avoid having the same team ref twice in a row
    const refPool = new Map()
    teams.forEach(team => refPool.set(team, 5))
    
    let lastRef = undefined
    
    distributedGames.forEach((game) => {
      // Find a team that's not playing, still needs to ref, and wasn't the last ref
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
        const refIndex = Math.floor(Math.random() * finalAvailableRefs.length)
        const selectedRef = finalAvailableRefs[refIndex]
        game.ref = selectedRef
        refPool.set(selectedRef, (refPool.get(selectedRef) || 0) - 1)
        lastRef = selectedRef
      } else {
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
      }
    })
    
    return distributedGames
  }

  // Generate games for each week
  const weekGames = []
  for (let week = 0; week < numWeeks; week++) {
    weekGames.push(generate6TeamSchedule(teams))
  }

  // Create week sheets
  for (let week = 1; week <= numWeeks; week++) {
    const weekDate = new Date(startDate)
    weekDate.setDate(startDate.getDate() + (week - 1) * 7)
    const weekName = `Week ${week} (${weekDate.getMonth() + 1}.${weekDate.getDate()})`
    
    const weekData = [
      ['', 'Court 1', '', '', '', '', '', '', '', ''] // Ensure 10 columns (A-J)
    ]

    const games = weekGames[week - 1] || []
    let gameNum = 1
    for (const game of games) {
      // Game row: A=Game#, B=Team1, C=(empty/score), D=Team2, E=(empty/score)
      const gameRow = [`Game ${String(gameNum).padStart(2, '0')}`, game.team1, '', game.team2, '', '', '', '', '', '']
      weekData.push(gameRow)
      
      // Ref row: A=(empty), B=Refs: TeamName
      const refRow = ['', '', '', '', '', '', '', '', '', '']
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
      const winsFormula = `=SUMIFS(C:C,B:B,"${team}")+SUMIFS(E:E,D:D,"${team}")`
      const lossesFormula = `=SUMIFS(E:E,B:B,"${team}")+SUMIFS(C:C,D:D,"${team}")`
      weekData.push([team, winsFormula, lossesFormula, '', '', '', '', '', '', ''])
    }

    const weekSheet = XLSX.utils.aoa_to_sheet(weekData)
    XLSX.utils.book_append_sheet(workbook, weekSheet, weekName)
  }

  return workbook
}

// Test function
function testLeagueCreation() {
  console.log('🧪 Testing League Creation...\n')
  
  const testData = {
    leagueName: 'Test League 2027',
    teams: ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta', 'Team Epsilon', 'Team Zeta'],
    numWeeks: 6
  }
  
  console.log('📋 Test Data:')
  console.log(`  League: ${testData.leagueName}`)
  console.log(`  Teams: ${testData.teams.join(', ')}`)
  console.log(`  Weeks: ${testData.numWeeks}\n`)
  
  try {
    console.log('📝 Creating workbook...')
    const workbook = createLeagueWorkbook(testData)
    
    console.log('✅ Workbook created successfully!')
    console.log(`  Sheets: ${workbook.SheetNames.join(', ')}\n`)
    
    // Validate structure
    console.log('🔍 Validating structure...')
    
    // Check Teams sheet
    const teamsSheet = workbook.Sheets['Teams']
    if (!teamsSheet) {
      throw new Error('Teams sheet not found')
    }
    console.log('  ✓ Teams sheet exists')
    
    // Check Schedule Generator
    const scheduleGenSheet = workbook.Sheets['Schedule Generator']
    if (!scheduleGenSheet) {
      throw new Error('Schedule Generator sheet not found')
    }
    console.log('  ✓ Schedule Generator sheet exists')
    
    // Check League Standings
    const standingsSheet = workbook.Sheets['League Standings']
    if (!standingsSheet) {
      throw new Error('League Standings sheet not found')
    }
    console.log('  ✓ League Standings sheet exists')
    
    // Check Week sheets
    const weekSheets = workbook.SheetNames.filter(name => name.startsWith('Week'))
    if (weekSheets.length !== 6) {
      throw new Error(`Expected 6 week sheets, found ${weekSheets.length}`)
    }
    console.log(`  ✓ ${weekSheets.length} week sheets exist`)
    
    // Check games per week
    const week1Sheet = workbook.Sheets[weekSheets[0]]
    const week1Data = XLSX.utils.sheet_to_json(week1Sheet, { header: 1, defval: '' })
    const gameRows = week1Data.filter(row => row[0] && String(row[0]).startsWith('Game'))
    console.log(`  ✓ Week 1 has ${gameRows.length} games (expected 30)`)
    
    if (gameRows.length !== 30) {
      console.warn(`  ⚠️  Warning: Expected 30 games, found ${gameRows.length}`)
    }
    
    // Check home/away alternation for first pair
    console.log('\n🔍 Checking home/away alternation...')
    const team1 = testData.teams[0]
    const team2 = testData.teams[1]
    const team1Games = week1Data.filter((row, idx) => {
      return (row[1] === team1 && row[3] === team2) || (row[1] === team2 && row[3] === team1)
    })
    if (team1Games.length === 2) {
      const firstHome = team1Games[0][1]
      const secondHome = team1Games[1][1]
      if (firstHome !== secondHome) {
        console.log(`  ✓ ${team1} vs ${team2}: Home/away alternates correctly`)
      } else {
        console.warn(`  ⚠️  ${team1} vs ${team2}: Both games have same home team`)
      }
    }
    
    // Check ref distribution
    console.log('\n🔍 Checking ref assignments...')
    const refCounts = new Map()
    testData.teams.forEach(team => refCounts.set(team, 0))
    
    week1Data.forEach(row => {
      if (row[1] && String(row[1]).startsWith('Refs: ')) {
        const refTeam = String(row[1]).replace('Refs: ', '').trim()
        refCounts.set(refTeam, (refCounts.get(refTeam) || 0) + 1)
      }
    })
    
    let refsBalanced = true
    refCounts.forEach((count, team) => {
      if (count !== 5) {
        refsBalanced = false
        console.warn(`  ⚠️  ${team}: ${count} ref assignments (expected 5)`)
      }
    })
    if (refsBalanced) {
      console.log('  ✓ All teams have 5 ref assignments')
    }
    
    // Check for consecutive refs
    console.log('\n🔍 Checking for consecutive ref assignments...')
    let consecutiveRefs = false
    let lastRefTeam = null
    week1Data.forEach((row, index) => {
      if (row[1] && String(row[1]).startsWith('Refs: ')) {
        const refTeam = String(row[1]).replace('Refs: ', '').trim()
        if (refTeam === lastRefTeam) {
          consecutiveRefs = true
          console.warn(`  ⚠️  Consecutive refs at row ${index + 1}: ${refTeam} refs twice in a row`)
        }
        lastRefTeam = refTeam
      } else if (row[0] && String(row[0]).startsWith('Game')) {
        // Reset on new game (ref row comes after game row)
        lastRefTeam = null
      }
    })
    if (!consecutiveRefs) {
      console.log('  ✓ No consecutive ref assignments')
    }
    
    // Check that teams don't ref games they're playing in
    console.log('\n🔍 Checking ref/player conflicts...')
    let refPlayerConflicts = false
    week1Data.forEach((row, index) => {
      if (row[1] && String(row[1]).startsWith('Refs: ')) {
        // Previous row should be the game row
        if (index > 0) {
          const gameRow = week1Data[index - 1]
          if (gameRow[0] && String(gameRow[0]).startsWith('Game')) {
            const team1 = gameRow[1]
            const team2 = gameRow[3]
            const refTeam = String(row[1]).replace('Refs: ', '').trim()
            
            if (refTeam === team1 || refTeam === team2) {
              refPlayerConflicts = true
              console.warn(`  ⚠️  Conflict at row ${index + 1}: ${refTeam} is reffing their own game (${team1} vs ${team2})`)
            }
          }
        }
      }
    })
    if (!refPlayerConflicts) {
      console.log('  ✓ No teams ref games they are playing in')
    }
    
    // Check game distribution gaps (minimize time between games)
    console.log('\n🔍 Checking game distribution gaps...')
    const largeGapThreshold = 4 // Same threshold used in scheduling algorithm
    const teamGamePositions = new Map()
    testData.teams.forEach(team => {
      teamGamePositions.set(team, [])
    })
    
    // Track which games each team plays in (by game number, not row index)
    let gameNumber = 0
    week1Data.forEach((row, index) => {
      if (row[0] && String(row[0]).startsWith('Game')) {
        const team1 = row[1]
        const team2 = row[3]
        if (team1) {
          const positions = teamGamePositions.get(team1) || []
          positions.push(gameNumber)
          teamGamePositions.set(team1, positions)
        }
        if (team2) {
          const positions = teamGamePositions.get(team2) || []
          positions.push(gameNumber)
          teamGamePositions.set(team2, positions)
        }
        gameNumber++
      }
    })
    
    // Calculate gaps for each team (in terms of games, not rows)
    const allGaps = []
    const teamGapStats = new Map()
    let maxGap = 0
    let maxGapTeam = null
    let maxGapDetails = null
    
    teamGamePositions.forEach((positions, team) => {
      if (positions.length === 0) return
      
      // Sort positions
      positions.sort((a, b) => a - b)
      
      // Calculate gaps between consecutive games
      const gaps = []
      for (let i = 1; i < positions.length; i++) {
        const gap = positions[i] - positions[i - 1] // Gap in number of games
        gaps.push(gap)
        allGaps.push(gap)
        
        if (gap > maxGap) {
          maxGap = gap
          maxGapTeam = team
          maxGapDetails = { from: positions[i - 1] + 1, to: positions[i] + 1, gap } // +1 for 1-based game numbers
        }
      }
      
      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
      const maxTeamGap = gaps.length > 0 ? Math.max(...gaps) : 0
      const minTeamGap = gaps.length > 0 ? Math.min(...gaps) : 0
      const largeGaps = gaps.filter(g => g >= largeGapThreshold).length
      
      teamGapStats.set(team, {
        avgGap: avgGap,
        maxGap: maxTeamGap,
        minGap: minTeamGap,
        gaps: gaps,
        largeGapCount: largeGaps
      })
    })
    
    // Calculate overall statistics
    const overallAvgGap = allGaps.length > 0 ? allGaps.reduce((a, b) => a + b, 0) / allGaps.length : 0
    const overallMaxGap = allGaps.length > 0 ? Math.max(...allGaps) : 0
    const overallMinGap = allGaps.length > 0 ? Math.min(...allGaps) : 0
    
    // Report statistics
    console.log(`  📊 Overall gap statistics:`)
    console.log(`     Average gap: ${overallAvgGap.toFixed(2)} games`)
    console.log(`     Max gap: ${overallMaxGap} games`)
    console.log(`     Min gap: ${overallMinGap} games`)
    
    if (maxGapTeam && maxGapDetails) {
      console.log(`  📍 Largest gap: ${maxGapTeam} (${maxGapDetails.gap} games between game ${maxGapDetails.from} and ${maxGapDetails.to})`)
    }
    
    // Check if any gaps are too large (threshold: 9 games = ~30% of total games)
    // With 30 games and 10 games per team, ideal average gap is ~3 games
    // Gaps > 9 indicate a team is waiting too long between games
    const gapThreshold = 9
    const largeGaps = []
    teamGapStats.forEach((stats, team) => {
      stats.gaps.forEach((gap, idx) => {
        if (gap > gapThreshold) {
          largeGaps.push({ team, gap, index: idx })
        }
      })
    })
    
    if (largeGaps.length > 0) {
      console.warn(`  ⚠️  Found ${largeGaps.length} gap(s) larger than ${gapThreshold} games:`)
      largeGaps.forEach(({ team, gap }) => {
        console.warn(`     ${team}: ${gap} games`)
      })
    } else {
      console.log(`  ✓ No gaps larger than ${gapThreshold} games`)
    }
    
    // Check for teams with multiple large gaps
    const teamsWithMultipleLargeGaps = []
    teamGapStats.forEach((stats, team) => {
      if (stats.largeGapCount > 1) {
        teamsWithMultipleLargeGaps.push({ team, count: stats.largeGapCount })
      }
    })
    
    if (teamsWithMultipleLargeGaps.length > 0) {
      console.warn(`  ⚠️  Teams with multiple large gaps (>= ${largeGapThreshold} games):`)
      teamsWithMultipleLargeGaps.forEach(({ team, count }) => {
        console.warn(`     ${team}: ${count} large gap(s)`)
      })
    } else {
      console.log(`  ✓ No teams have multiple large gaps`)
    }
    
    // Show per-team statistics for teams with above-average gaps
    console.log(`  📋 Teams with above-average gaps:`)
    let teamsWithLargeGaps = 0
    teamGapStats.forEach((stats, team) => {
      if (stats.avgGap > overallAvgGap * 1.2) { // 20% above average
        teamsWithLargeGaps++
        console.log(`     ${team}: avg ${stats.avgGap.toFixed(2)}, max ${stats.maxGap}, min ${stats.minGap}`)
      }
    })
    if (teamsWithLargeGaps === 0) {
      console.log(`     (All teams have well-distributed games)`)
    }
    
    // Save file
    const outputPath = join(process.cwd(), 'test-league-output.xlsx')
    XLSX.writeFile(workbook, outputPath)
    console.log(`\n💾 Saved to: ${outputPath}`)
    
    console.log('\n✅ Test completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`  - ${testData.teams.length} teams`)
    console.log(`  - ${testData.numWeeks} weeks`)
    console.log(`  - ${gameRows.length} games per week`)
    console.log(`  - ${gameRows.length * testData.numWeeks} total games`)
    console.log(`  - Each team plays 10 games per week`)
    console.log(`  - Each team refs 5 games per week`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run test
testLeagueCreation()

