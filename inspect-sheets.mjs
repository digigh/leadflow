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
    for (const name of sheets) {
        console.log(`Inspecting ${name}...`);
        const data = await fetchSheet(name);
        if (data.error) {
            console.error(`Error for ${name}: ${data.error}`);
            continue;
        }
        
        // Log column labels
        console.log(`Columns for ${name}:`, data.cols.map((c, i) => `[${i}] ${c.label}`));
        
        // Log first row of data
        if (data.rows.length > 0) {
            const firstRow = data.rows[0].c?.map(cell => cell?.v) || [];
            console.log(`First row for ${name}:`, firstRow);
        }
    }
}

inspect();
