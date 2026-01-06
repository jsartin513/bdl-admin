#!/usr/bin/env python3
"""
Interactive master script to create a complete new league from scratch.
Guides the user through each step with prompts.
"""

import sys
import os
from create_league_template import create_league_template
from create_schedule_from_generator import main as generate_schedule
from setup_standings import main as setup_standings

def main():
    print("🏀 New League Creator")
    print("=" * 50)
    print()
    print("This will guide you through creating a complete league spreadsheet.")
    print("You'll be asked for:")
    print("  - League name")
    print("  - Team names")
    print("  - Number of weeks")
    print()
    
    # Step 1: Get league info
    print("📝 Step 1: League Information")
    print("-" * 50)
    league_name = input("League name: ").strip()
    if not league_name:
        league_name = "New League"
        print(f"  Using default: {league_name}")
    
    output_path = input(f"Output filename (default: '{league_name}.xlsx'): ").strip()
    if not output_path:
        output_path = f"{league_name}.xlsx"
    if not output_path.endswith('.xlsx'):
        output_path += '.xlsx'
    
    # Step 2: Get teams
    print()
    print("📋 Step 2: Teams")
    print("-" * 50)
    print("Enter team names (press Enter on empty line when done):")
    teams = []
    while True:
        team = input(f"  Team {len(teams) + 1}: ").strip()
        if not team:
            if len(teams) < 2:
                print("  ⚠️  Need at least 2 teams. Enter another team:")
                continue
            break
        teams.append(team)
    
    # Step 3: Get number of weeks
    print()
    print("📅 Step 3: Schedule")
    print("-" * 50)
    num_weeks_input = input("Number of weeks (default: 6): ").strip()
    num_weeks = int(num_weeks_input) if num_weeks_input.isdigit() else 6
    
    # Summary
    print()
    print("📋 Summary")
    print("-" * 50)
    print(f"  League: {league_name}")
    print(f"  Teams: {', '.join(teams)}")
    print(f"  Weeks: {num_weeks}")
    print(f"  Output: {output_path}")
    print()
    
    confirm = input("Create league? (Y/n): ").strip().lower()
    if confirm and confirm != 'y':
        print("Cancelled.")
        return
    
    print()
    print("🚀 Creating league...")
    print()
    
    # Step 4: Create template
    print("📝 Creating template...")
    try:
        create_league_template(output_path, league_name, teams, num_weeks)
        print("  ✅ Template created")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return
    
    # Step 5: Generate schedule
    print()
    print("📅 Generating schedule...")
    try:
        generate_schedule(output_path, num_weeks)
        print("  ✅ Schedule generated")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return
    
    # Step 6: Setup standings
    print()
    print("📊 Setting up standings...")
    try:
        setup_standings(output_path)
        print("  ✅ Standings formulas added")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return
    
    # Done!
    print()
    print("=" * 50)
    print("✅ League created successfully!")
    print("=" * 50)
    print()
    print(f"📁 File: {output_path}")
    print()
    print("Next steps:")
    print("  1. Open the spreadsheet in Excel or Google Sheets")
    print("  2. Review the generated schedule in week sheets")
    print("  3. Adjust game order if needed")
    print("  4. Start tracking games by filling in scores in columns C or E")
    print()

if __name__ == '__main__':
    main()


