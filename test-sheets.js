const SHEET_ID = '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0';

const fetchSheet = async (sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    if (data.status === 'error') {
        console.error(`Sheet error for ${sheetName}:`, data.errors[0]?.message);
        return [];
    }
    return data.table.rows;
};

async function test() {
    console.log("Testing 'Meta Leads'");
    let data = await fetchSheet('Meta Leads');
    console.log("Rows found:", data?.length);

    console.log("Testing 'Meta Lead Subsheet'");
    data = await fetchSheet('Meta Lead Subsheet');
    console.log("Rows found:", data?.length);
    if (data?.length) {
        console.log("Sample:", JSON.stringify(data[0]));
    }

    console.log("Testing 'Meta Lead'");
    data = await fetchSheet('Meta Lead');
    console.log("Rows found:", data?.length);
    if (data?.length) {
        console.log("Sample:", JSON.stringify(data[0]));
    }
}

test();
