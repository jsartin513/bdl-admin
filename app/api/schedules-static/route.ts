import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week') || '1'
    
    // Read the XLSX file from the public directory
    const filePath = join(process.cwd(), 'public', 'league_schedules', 'Inaugural Draft League Schedules.xlsx')
    const fileBuffer = readFileSync(filePath)
    
    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    
    // Get available sheet names (include all weeks 1-6 with flexible naming)
    console.log('🔍 ALL EXCEL SHEETS:', workbook.SheetNames);
    
    const availableWeeks = workbook.SheetNames.filter(name => {
      const nameLower = name.toLowerCase()
      return nameLower.includes('week') ||
             nameLower.match(/w\s*[1-6]/) ||
             nameLower.match(/[1-6]\s*week/) ||
             nameLower.includes('9.30') || nameLower.includes('9/30') ||
             nameLower.includes('10.7') || nameLower.includes('10/7') ||
             nameLower.includes('10.14') || nameLower.includes('10/14') ||
             nameLower.includes('10.21') || nameLower.includes('10/21') ||
             nameLower.includes('10.28') || nameLower.includes('10/28')
    }).sort()
    
    console.log('✅ WEEK SHEETS DETECTED:', availableWeeks);
    
    // Handle "all" weeks case
    if (week === 'all') {
      // Combine data from all available weeks
      let combinedCsvData = ''
      const weekData: string[] = []
      
      for (const weekSheet of availableWeeks) {
        const worksheet = workbook.Sheets[weekSheet]
        const csvData = XLSX.utils.sheet_to_csv(worksheet)
        
        // Extract week number from sheet name for game numbering
        const weekMatch = weekSheet.match(/week\s*(\d+)/i)
        const weekNum = weekMatch ? weekMatch[1] : availableWeeks.indexOf(weekSheet) + 1
        
        // Process CSV data to make game numbers unique across weeks
        const lines = csvData.split('\n')
        const processedLines = lines.map(line => {
          if (line.includes('Game ') && !line.includes('Game Number')) {
            // Replace "Game X" with "Week Y Game X" to make it unique
            return line.replace(/Game\s+(\d+)/i, `Week ${weekNum} Game $1`)
          }
          return line
        })
        
        weekData.push(processedLines.join('\n'))
        console.log(`Processed ${weekSheet}: ${lines.length} lines, week ${weekNum}`)
      }
      
      // Combine data: take header from first week, then all data lines from all weeks
      const allLines: string[] = []
      let headerAdded = false
      
      for (const csvData of weekData) {
        const lines = csvData.split('\n')
        for (const line of lines) {
          if (line.includes('Game Number') || line.includes('Court 1 Team 1')) {
            // This is a header line
            if (!headerAdded) {
              allLines.push(line)
              headerAdded = true
            }
            // Skip additional headers
          } else if (line.trim()) {
            // This is a data line
            allLines.push(line)
          }
        }
      }
      
      combinedCsvData = allLines.join('\n')
      
      return NextResponse.json({
        success: true,
        week: 'all',
        sheetName: 'All Weeks Combined',
        availableWeeks,
        csvData: combinedCsvData,
        weekCount: availableWeeks.length,
        debug: {
          allSheetNames: workbook.SheetNames,
          filteredWeeks: availableWeeks,
          combinedDataLength: combinedCsvData.length,
          totalLines: combinedCsvData.split('\n').length
        }
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