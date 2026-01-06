import React from 'react'
import { Game } from './types'

interface PrintableScheduleProps {
  games: Game[]
  selectedWeek: string
  title?: string
}

export const PrintableSchedule: React.FC<PrintableScheduleProps> = ({ 
  games, 
  selectedWeek, 
  title = "Dodgeball League Schedule" 
}) => {
  // Separate games by court for column layout
  const court1Games = games.map(game => ({
    gameNumber: game.gameNumber,
    team1: game.court1Team1,
    team2: game.court1Team2,
    ref: game.court1Ref
  })).filter(game => game.team1 || game.team2)

  const court2Games = games.map(game => ({
    gameNumber: game.gameNumber,
    team1: game.court2Team1,
    team2: game.court2Team2,
    ref: game.court2Ref
  })).filter(game => game.team1 || game.team2)

  return (
    <div className="print-schedule">
      {/* Print-specific styles */}
      <style jsx>{`
        @media print {
          .print-schedule {
            font-family: 'Arial', sans-serif;
            color: black !important;
            background: white !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0.3in !important;
            font-size: 9pt;
            line-height: 1.1;
          }
          
          .print-header {
            text-align: center;
            margin-bottom: 0.1in;
            border-bottom: 2px solid black;
            padding-bottom: 0.03in;
          }
          
          .print-title {
            font-size: 14pt;
            font-weight: bold;
            margin: 0;
          }
          
          .print-subtitle {
            font-size: 11pt;
            margin: 0.02in 0 0 0;
            font-weight: bold;
          }
          
          .print-date {
            font-size: 8pt;
            margin: 0.02in 0 0 0;
          }
          
          .courts-layout {
            display: flex;
            gap: 0.1in;
            margin-top: 0.05in;
          }
          
          .court-column {
            flex: 1;
            border: 1px solid black;
          }
          
          .court-header {
            background: #f0f0f0 !important;
            text-align: center;
            font-weight: bold;
            font-size: 11pt;
            padding: 0.03in;
            border-bottom: 1px solid black;
          }
          
          .game-entry {
            border-bottom: 1px solid #ccc;
            padding: 0.02in;
            font-size: 8pt;
          }
          
          .game-entry:last-child {
            border-bottom: none;
          }
          
          .game-number {
            font-weight: bold;
            font-size: 9pt;
            text-align: center;
            margin-bottom: 0.01in;
          }
          
          .teams-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 0.01in 0;
            padding: 0.005in 0;
          }
          
          .team-with-checkbox {
            display: flex;
            align-items: center;
            flex: 1;
          }
          
          .team-name {
            font-weight: bold;
            font-size: 7pt;
          }
          
          .winner-checkbox {
            width: 0.06in;
            height: 0.06in;
            border: 1px solid black;
            margin-left: 0.03in;
          }
          
          .vs-text {
            margin: 0 0.05in;
            font-style: italic;
            font-size: 6pt;
          }
          
          .ref-info {
            text-align: center;
            font-size: 6pt;
            margin-top: 0.01in;
            font-style: italic;
            color: #333;
          }
          
          .no-games {
            text-align: center;
            font-style: italic;
            color: #666;
            padding: 0.1in;
            font-size: 8pt;
          }
          
          /* Hide non-print elements */
          .no-print {
            display: none !important;
          }
          
          @page {
            margin: 0.3in;
            size: letter;
          }
        }
        
        @media screen {
          .print-schedule {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            font-family: Arial, sans-serif;
          }
          
          .courts-layout {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
          }
          
          .court-column {
            flex: 1;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          
          .court-header {
            background: #f0f0f0;
            padding: 0.5rem;
            font-weight: bold;
            text-align: center;
            border-bottom: 1px solid #ccc;
          }
          
          .game-entry {
            border-bottom: 1px solid #eee;
            padding: 0.5rem;
          }
          
          .game-entry:last-child {
            border-bottom: none;
          }
          
          .game-number {
            font-weight: bold;
            text-align: center;
            margin-bottom: 0.5rem;
          }
          
          .teams-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 0.25rem 0;
            padding: 0.125rem 0;
          }
          
          .team-with-checkbox {
            display: flex;
            align-items: center;
            flex: 1;
          }
          
          .team-name {
            font-weight: bold;
            font-size: 0.875rem;
          }
          
          .winner-checkbox {
            width: 1rem;
            height: 1rem;
            border: 1px solid black;
            margin-left: 0.5rem;
          }
          
          .vs-text {
            margin: 0 0.5rem;
            font-style: italic;
            font-size: 0.75rem;
          }
          
          .ref-info {
            text-align: center;
            font-size: 0.875rem;
            margin-top: 0.5rem;
            font-style: italic;
            color: #666;
          }
          
          .no-games {
            text-align: center;
            font-style: italic;
            color: #666;
            padding: 2rem;
          }
        }
      `}</style>
      
      <div className="print-header">
        <h1 className="print-title">{title}</h1>
        {selectedWeek !== 'all' && (
          <h2 className="print-subtitle">Week {selectedWeek}</h2>
        )}
        <div className="print-date">
          Date: ________________
        </div>
      </div>

      <div className="courts-layout">
        {/* Court 1 Column */}
        <div className="court-column">
          <div className="court-header">Court 1</div>
          {court1Games.length === 0 ? (
            <div className="no-games">No games scheduled</div>
          ) : (
            court1Games.map((game, index) => (
              <div key={index} className="game-entry">
                <div className="game-number">{game.gameNumber}</div>
                
                <div className="teams-line">
                  <div className="team-with-checkbox">
                    <span className="team-name">{game.team1 || 'BYE'}</span>
                    <div className="winner-checkbox"></div>
                  </div>
                  
                  <span className="vs-text">vs</span>
                  
                  <div className="team-with-checkbox">
                    <span className="team-name">{game.team2 || 'BYE'}</span>
                    <div className="winner-checkbox"></div>
                  </div>
                </div>
                
                <div className="ref-info">
                  Ref: {game.ref || 'TBD'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Court 2 Column */}
        <div className="court-column">
          <div className="court-header">Court 2</div>
          {court2Games.length === 0 ? (
            <div className="no-games">No games scheduled</div>
          ) : (
            court2Games.map((game, index) => (
              <div key={index} className="game-entry">
                <div className="game-number">{game.gameNumber}</div>
                
                <div className="teams-line">
                  <div className="team-with-checkbox">
                    <span className="team-name">{game.team1 || 'BYE'}</span>
                    <div className="winner-checkbox"></div>
                  </div>
                  
                  <span className="vs-text">vs</span>
                  
                  <div className="team-with-checkbox">
                    <span className="team-name">{game.team2 || 'BYE'}</span>
                    <div className="winner-checkbox"></div>
                  </div>
                </div>
                
                <div className="ref-info">
                  Ref: {game.ref || 'TBD'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default PrintableSchedule