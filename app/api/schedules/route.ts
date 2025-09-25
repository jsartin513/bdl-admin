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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const googleAuth = await authenticateWithGoogle({
      accessToken: session.accessToken as string,
      refreshToken: session.refreshToken as string,
      expiresAt: new Date(session.expiresAt).getTime(),
    });

    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week') || '1';

    // Get all available sheets first
    const availableSheets = await fetchAllSheets(googleAuth);
    const weekSheets = availableSheets.filter(sheet => 
      sheet.name.toLowerCase().includes('week')
    );

    if (week === 'all') {
      // Get all sheets and combine data
      let combinedCsvData = '';
      const weekData: string[] = [];
      
      for (const sheet of weekSheets) {
        try {
          const sheetData = await fetchSheetData(googleAuth, SHEET_ID, sheet.name);
          const csvData = convertToCsv(sheetData);
          weekData.push(csvData);
        } catch (error) {
          console.error(`Error fetching sheet ${sheet.name}:`, error);
        }
      }
      
      combinedCsvData = weekData.join('\n\n');
      
      return NextResponse.json({
        success: true,
        week: 'all',
        sheetName: 'All Weeks Combined',
        availableWeeks: weekSheets.map(s => s.name),
        csvData: combinedCsvData,
        weekCount: weekSheets.length
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