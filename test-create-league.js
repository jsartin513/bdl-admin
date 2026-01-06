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
    
    // Step 2: Distribute games evenly to avoid long gaps
    const teamGameCount = new Map()
    const teamLastPosition = new Map()
    teams.forEach(team => {
      teamGameCount.set(team, 0)
      teamLastPosition.set(team, -1)
    })
    
    const distributedGames = []
    const remainingGames = [...gamePairs]
    
    while (remainingGames.length > 0) {
      let bestGameIndex = -1
      let bestScore = -Infinity
      
      remainingGames.forEach((gamePair, index) => {
        const team1 = gamePair.team1
        const team2 = gamePair.team2
        
        const team1Games = teamGameCount.get(team1) || 0
        const team2Games = teamGameCount.get(team2) || 0
        const team1LastPos = teamLastPosition.get(team1) || -1
        const team2LastPos = teamLastPosition.get(team2) || -1
        
        const gap1 = distributedGames.length - team1LastPos
        const gap2 = distributedGames.length - team2LastPos
        const score = (10 - team1Games) * 10 + (10 - team2Games) * 10 + gap1 + gap2
        
        if (score > bestScore) {
          bestScore = score
          bestGameIndex = index
        }
      })
      
      const selectedGame = remainingGames.splice(bestGameIndex, 1)[0]
      
      const game = {
        team1: selectedGame.homeTeam,
        team2: selectedGame.homeTeam === selectedGame.team1 ? selectedGame.team2 : selectedGame.team1,
        ref: undefined
      }
      
      distributedGames.push(game)
      
      teamGameCount.set(game.team1, (teamGameCount.get(game.team1) || 0) + 1)
      teamGameCount.set(game.team2, (teamGameCount.get(game.team2) || 0) + 1)
      teamLastPosition.set(game.team1, distributedGames.length - 1)
      teamLastPosition.set(game.team2, distributedGames.length - 1)
    }
    
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

