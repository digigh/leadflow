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

async function test() {
    const data = await fetchSheet('Meta Lead');
    fs.writeFileSync('meta-lead-raw.json', JSON.stringify(data, null, 2));
    console.log("Wrote meta-lead-raw.json");
}

test();
