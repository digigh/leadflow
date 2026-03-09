import fs from 'fs';

const sheetId = '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0';
const sheetName = 'Meta Leads';
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

try {
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (match) {
        const data = JSON.parse(match[1]);
        fs.writeFileSync('meta_leads_raw.json', JSON.stringify({
            cols: data.table.cols,
            rows: data.table.rows.slice(0, 5) // Get first 5 rows to see where headers might be
        }, null, 2), 'utf8');
        console.log('Wrote meta_leads_raw.json');
    } else {
        console.error("No match found in response");
    }
} catch (err) {
    console.error(err);
}
