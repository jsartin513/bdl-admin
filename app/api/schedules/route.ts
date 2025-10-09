import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { authenticateWithGoogle, fetchSheetData } from '@/app/_lib/googleSheetsUtils';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SHEET_ID = '1MT9DRwu_e9QjhDdy7Lc9QcbdmysTjbzAxsE_2blPSeo';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.accessToken || !session?.refreshToken || !session?.expiresAt) {
      return NextResponse.json({ 
        error: 'Not authenticated', 
        message: 'Please log in to access live schedule data'
      }, { status: 401 });
    }

    // The JWT callback in auth.ts handles token refresh automatically
    // So we can directly use the session tokens
    const googleAuth = await authenticateWithGoogle({
      accessToken: session.accessToken as string,
      refreshToken: session.refreshToken as string,
      expiresAt: new Date(session.expiresAt).getTime(),
    });

    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week') || '1';

    try {
      // Get all available sheets first
      const availableSheets = await fetchAllSheets(googleAuth);
      console.log('🔍 ALL SHEETS FOUND:', availableSheets.map(s => s.name));
      
      const weekSheets = availableSheets.filter(sheet => {
        const name = sheet.name.toLowerCase();
        return name.includes('week') || 
               name.match(/w\s*[1-6]/) || 
               name.match(/[1-6]\s*week/) ||
               name.includes('9.30') || name.includes('9/30') ||
               name.includes('10.7') || name.includes('10/7') ||
               name.includes('10.14') || name.includes('10/14') ||
               name.includes('10.21') || name.includes('10/21') ||
               name.includes('10.28') || name.includes('10/28');
      });
      
      console.log('✅ WEEK SHEETS DETECTED:', weekSheets.map(s => s.name));

      if (week === 'all') {
        // Get all sheets and combine data
        let combinedCsvData = '';
        const weekData: string[] = [];
        
        for (const sheet of weekSheets) {
          try {
            console.log(`🔍 Fetching data for sheet: ${sheet.name}`);
            const sheetData = await fetchSheetData(googleAuth, SHEET_ID, sheet.name);
            console.log(`📊 Raw sheet data rows for ${sheet.name}:`, sheetData.length);
            
            const csvData = convertToCsv(sheetData);
            console.log(`📝 CSV data for ${sheet.name} (length: ${csvData.length}, first 200 chars):`, csvData.substring(0, 200));
            
            // Extract week number from sheet name for game numbering
            const weekMatch = sheet.name.match(/week\s*(\d+)/i);
            const weekNum = weekMatch ? weekMatch[1] : weekSheets.indexOf(sheet) + 1;
            console.log(`🔢 Detected week number for ${sheet.name}: ${weekNum}`);
            
            // Process CSV data to make game numbers unique across weeks
            const lines = csvData.split('\n');
            console.log(`📏 Total lines in ${sheet.name}:`, lines.length);
            
            const processedLines = lines.map(line => {
              if (line.includes('Game ') && !line.includes('Game Number')) {
                // Replace "Game X" with "Week Y Game X" to make it unique
                return line.replace(/Game\s+(\d+)/i, `Week ${weekNum} Game $1`);
              }
              return line;
            });
            
            const processedCsv = processedLines.join('\n');
            weekData.push(processedCsv);
            console.log(`✅ Processed ${sheet.name}: ${lines.length} lines, week ${weekNum}, processed length: ${processedCsv.length}`);
          } catch (error) {
            console.error(`Error fetching sheet ${sheet.name}:`, error);
          }
        }
        
        // Combine data: take header from first week, then all data lines from all weeks
        const allLines: string[] = [];
        let headerAdded = false;
        
        for (const csvData of weekData) {
          const lines = csvData.split('\n');
          for (const line of lines) {
            if (line.includes('Game Number') || line.includes('Court 1 Team 1')) {
              // This is a header line
              if (!headerAdded) {
                allLines.push(line);
                headerAdded = true;
              }
              // Skip additional headers
            } else if (line.trim()) {
              // This is a data line
              allLines.push(line);
            }
          }
        }
        
        combinedCsvData = allLines.join('\n');
        
        return NextResponse.json({
          success: true,
          week: 'all',
          sheetName: 'All Weeks Combined',
          availableWeeks: weekSheets.map(s => s.name),
          csvData: combinedCsvData,
          weekCount: weekSheets.length,
          debug: {
            allSheets: availableSheets.map(s => s.name),
            weekSheets: weekSheets.map(s => s.name),
            combinedDataLength: combinedCsvData.length,
            totalLines: combinedCsvData.split('\n').length
          }
        });
      } else {
        // Get specific week
        let targetSheet = null;
        
        if (week === '1') {
          targetSheet = weekSheets.find(s => 
            s.name.includes('Week 1') || s.name.includes('9.30')
          );
        } else {
          targetSheet = weekSheets.find(s => 
            s.name.includes(`Week ${week}`)
          );
        }
        
        if (!targetSheet) {
          return NextResponse.json({ 
            error: `Week ${week} not found. Available weeks: ${weekSheets.map(s => s.name).join(', ')}` 
          }, { status: 404 });
        }
        
        const sheetData = await fetchSheetData(googleAuth, SHEET_ID, targetSheet.name);
        const csvData = convertToCsv(sheetData);
        
        return NextResponse.json({
          success: true,
          week,
          sheetName: targetSheet.name,
          availableWeeks: weekSheets.map(s => s.name),
          csvData
        });
      }
    } catch (apiError) {
      console.error('Google Sheets API error:', apiError);
      
      // Check if it's an authentication error
      if (apiError instanceof Error) {
        if (apiError.message.includes('Invalid Credentials') || 
            apiError.message.includes('Request had invalid authentication') ||
            apiError.message.includes('unauthorized')) {
          return NextResponse.json({ 
            error: 'Authentication failed', 
            message: 'Session expired. Please refresh the page and try again.'
          }, { status: 401 });
        }
      }
      
      throw apiError; // Re-throw non-auth errors to be caught by outer catch
    }
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch schedule data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function fetchAllSheets(auth: OAuth2Client) {
  const sheets = google.sheets({ version: 'v4', auth });
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });
  
  return response.data.sheets?.map((sheet) => ({
    name: sheet.properties?.title || '',
    id: sheet.properties?.sheetId || 0,
  })) || [];
}

function convertToCsv(data: string[][]): string {
  return data.map(row => 
    row.map(cell => {
      // Escape commas and quotes in CSV
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}