import fs from 'fs';

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
        return { rowsCount: data.table.rows.length, sampleRows: data.table.rows.slice(0, 5), cols: data.table.cols };
    } catch (e) {
        return { error: e.message };
    }
};

async function test() {
    const results = {};
    results['Meta Lead'] = await fetchSheet('Meta Lead');
    fs.writeFileSync('meta-sheet-test-results2.json', JSON.stringify(results, null, 2));
    console.log("Done");
}

test();
