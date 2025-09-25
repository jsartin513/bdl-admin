import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week') || '1'
    
    // Read the XLSX file from the public directory
    const filePath = join(process.cwd(), 'public', 'league_schedules', 'Inaugural Draft League Schedules.xlsx')
    const fileBuffer = readFileSync(filePath)
    
    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    
    // Get available sheet names (excluding certain sheets)
    const availableWeeks = workbook.SheetNames.filter(name => 
      name.includes('Week') && !name.includes('10/14') && !name.includes('10/21')
    ).sort()
    
    // Handle "all" weeks case
    if (week === 'all') {
      // Combine data from all available weeks
      let combinedCsvData = ''
      const weekData: string[] = []
      
      for (const weekSheet of availableWeeks) {
        const worksheet = workbook.Sheets[weekSheet]
        const csvData = XLSX.utils.sheet_to_csv(worksheet)
        
        // Add week identifier to each line for aggregation
        const lines = csvData.split('\n')
        const modifiedLines = lines.map((line, index) => {
          if (index === 0 || !line.trim()) return line // Keep header and empty lines as is
          if (line.includes('Game ')) {
            return line // Keep game lines as is - they already have game numbers
          }
          return line // Keep other lines as is
        })
        
        weekData.push(modifiedLines.join('\n'))
      }
      
      // Combine all weeks data
      combinedCsvData = weekData.join('\n\n')
      
      return NextResponse.json({
        success: true,
        week: 'all',
        sheetName: 'All Weeks Combined',
        availableWeeks,
        csvData: combinedCsvData,
        weekCount: availableWeeks.length
      })
    }
    
    // Handle individual week case
    let sheetName = ''
    if (week === '1') {
      sheetName = workbook.SheetNames.find(name => name.includes('Week 1') || name.includes('9.30')) || ''
    } else {
      sheetName = workbook.SheetNames.find(name => name.includes(`Week ${week}`)) || ''
    }
    
    if (!sheetName) {
      return NextResponse.json(
        { error: `Week ${week} not found. Available weeks: ${availableWeeks.join(', ')}` },
        { status: 404 }
      )
    }
    
    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to CSV format (similar to what we had before)
    const csvData = XLSX.utils.sheet_to_csv(worksheet)
    
    return NextResponse.json({
      success: true,
      week,
      sheetName,
      availableWeeks,
      csvData
    })
    
  } catch (error) {
    console.error('Error reading XLSX file:', error)
    return NextResponse.json(
      { error: 'Failed to read schedule data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}