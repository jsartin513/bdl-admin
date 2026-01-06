#!/bin/bash
# Master script to create a complete new league from scratch
# Can be run interactively (no args) or with command-line arguments

if [ $# -ge 3 ]; then
    # Non-interactive mode with arguments
    LEAGUE_NAME="$1"
    shift
    TEAMS=("$@")
    OUTPUT_FILE="${LEAGUE_NAME}.xlsx"
    
    echo "🏀 Creating new league: $LEAGUE_NAME"
    echo "📋 Teams: ${TEAMS[*]}"
    echo ""
    
    # Step 1: Create template
    echo "📝 Step 1: Creating template..."
    python3 create_league_template.py "$OUTPUT_FILE" "${TEAMS[@]}"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create template"
        exit 1
    fi
    
    # Step 2: Generate schedule
    echo ""
    echo "📅 Step 2: Generating schedule..."
    python3 create_schedule_from_generator.py "$OUTPUT_FILE" 6
    if [ $? -ne 0 ]; then
        echo "❌ Failed to generate schedule"
        exit 1
    fi
    
    # Step 3: Setup standings
    echo ""
    echo "📊 Step 3: Setting up standings formulas..."
    python3 setup_standings.py "$OUTPUT_FILE"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to setup standings"
        exit 1
    fi
    
    echo ""
    echo "✅ League created successfully: $OUTPUT_FILE"
else
    # Interactive mode - scripts will prompt for input
    echo "🏀 New League Creator (Interactive Mode)"
    echo "=" | head -c 50 && echo ""
    echo ""
    echo "This will guide you through creating a complete league."
    echo "You'll be prompted for:"
    echo "  - League name"
    echo "  - Team names"
    echo "  - Number of weeks"
    echo ""
    read -p "Press Enter to continue..."
    echo ""
    
    # Step 1: Create template (interactive)
    echo "📝 Step 1: Creating template..."
    python3 create_league_template.py
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create template"
        exit 1
    fi
    
    # Get the file that was created (this is a bit hacky, but works)
    echo ""
    read -p "Enter the filename that was just created: " OUTPUT_FILE
    
    # Step 2: Generate schedule (interactive)
    echo ""
    echo "📅 Step 2: Generating schedule..."
    python3 create_schedule_from_generator.py "$OUTPUT_FILE"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to generate schedule"
        exit 1
    fi
    
    # Step 3: Setup standings (interactive)
    echo ""
    echo "📊 Step 3: Setting up standings formulas..."
    python3 setup_standings.py "$OUTPUT_FILE"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to setup standings"
        exit 1
    fi
    
    echo ""
    echo "✅ League created successfully: $OUTPUT_FILE"
fi

echo ""
echo "Next steps:"
echo "  1. Open the spreadsheet in Excel or Google Sheets"
echo "  2. Review the generated schedule in week sheets"
echo "  3. Adjust game order if needed"
echo "  4. Start tracking games by filling in scores in columns C or E"
echo ""

