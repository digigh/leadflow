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
        return { cols: data.table.cols, rows: data.table.rows };
    } catch (e) {
        return { error: e.message };
    }
};

async function inspect() {
    const sheets = ['Sheet1', 'Meta Lead Subsheet', 'Landing Page 2', 'New Meta Leads March'];
    const results = {};
    for (const name of sheets) {
        const data = await fetchSheet(name);
        if (data.error) {
            results[name] = { error: data.error };
            continue;
        }
        
        results[name] = {
            cols: data.cols.map((c, i) => ({ index: i, label: c.label })),
            firstRows: data.rows.slice(0, 3).map(r => r.c?.map(cell => cell?.v || cell?.f || ''))
        };
    }
    fs.writeFileSync('inspection_results.json', JSON.stringify(results, null, 2));
    console.log("Wrote inspection_results.json");
}

inspect();
