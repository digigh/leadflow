import fs from 'fs';

function investigateCols() {
    const data = JSON.parse(fs.readFileSync('meta-sheet-test-results.json', 'utf8'));
    const cols = data["Meta Lead Subsheet"].cols;
    const colLabels = cols.map(c => (c.label || '').toLowerCase());
    console.log("Cols:", colLabels);

    const row0 = data["Meta Lead Subsheet"].sampleRows[0];
    const row1 = data["Meta Lead Subsheet"].sampleRows[1];

    console.log("Row 0:");
    row0.c.forEach((cell, i) => console.log(`  Col ${i}: ${cell?.v} (type: ${typeof cell?.v})`));

    console.log("Row 1:");
    row1.c.forEach((cell, i) => console.log(`  Col ${i}: ${cell?.v} (type: ${typeof cell?.v})`));
}

investigateCols();
