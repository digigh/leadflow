const fs = require('fs');
const SHEET_ID = '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0';

const fetchSheet = async (sheetName) => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
        const res = await fetch(url);
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (!match) return { error: "No match" };
        const data = JSON.parse(match[1]);
        if (data.status === 'error') {
            return { error: data.errors[0]?.message };
        }
        return { rows: data.table.rows.length, sample: data.table.rows[0], sampleHeader: data.table.cols };
    } catch (e) {
        return { error: e.message };
    }
};

async function test() {
    const results = {};
    results['Meta Leads'] = await fetchSheet('Meta Leads');
    results['Meta Lead Subsheet'] = await fetchSheet('Meta Lead Subsheet');
    results['Meta Lead'] = await fetchSheet('Meta Lead');
    results['Sheet1'] = await fetchSheet('Sheet1');
    fs.writeFileSync('sheet-results.json', JSON.stringify(results, null, 2));
}

test();
