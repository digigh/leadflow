import fs from 'fs';

const SHEET_ID = '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0';

const fetchSheet = async (sheetName) => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
        const res = await fetch(url);
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (!match) return { cols: [], rows: [] };
        const data = JSON.parse(match[1]);

        if (data.status === 'error' || !data?.table?.rows) {
            console.warn(`Could not fetch sheet: ${sheetName}`);
            return { cols: [], rows: [] };
        }

        return { cols: data.table.cols || [], rows: data.table.rows };
    } catch (e) {
        console.warn(e);
        return { cols: [], rows: [] };
    }
};

const parseSheetData = (sheetResult, sourceName, headerKeywords) => {
    const rows = sheetResult.rows || [];
    const cols = sheetResult.cols || [];
    let headerRowIndex = -1;
    let colMap = {};

    const colLabels = cols.map(c => (c.label || '').toLowerCase());
    let hasValidColLabels = false;
    if (headerKeywords.some(kw => colLabels.includes(kw))) {
        colLabels.forEach((val, idx) => {
            if (val) colMap[val] = idx;
        });
        hasValidColLabels = true;
    }

    if (!hasValidColLabels) {
        for (let i = 0; i < rows.length; i++) {
            const rowVals = rows[i].c?.map(cell => (cell ? (cell.v || '').toString().toLowerCase() : '')) || [];
            
            const hasDataInRow = rowVals.some(v => v.includes('@') || v.includes('p:+') || /^\d{10}$/.test(v));
            
            if (headerKeywords.some(kw => rowVals.includes(kw)) && !hasDataInRow) {
                headerRowIndex = i;
                rowVals.forEach((val, idx) => {
                    if (val) colMap[val] = idx;
                });
                break;
            }
        }
    }

    const parsedLeads = [];
    if (Object.keys(colMap).length === 0 && sourceName === 'New Meta Leads March') {
        rows.forEach((row) => {
            const c = row.c || [];
            const safeVal = (idx) => (c[idx] && c[idx].v) ? c[idx].v.toString() : '';
            let name = safeVal(14);
            let phone = safeVal(15);
            if (phone.startsWith('p:')) phone = phone.substring(2);
            phone = phone.replace(/\D/g, '');
            let email = safeVal(16);
            let company = safeVal(17);
            let job_title = safeVal(18);
            let website = safeVal(19);
            let business_type = safeVal(12);
            let looking_for = safeVal(13);
            let dateStr = safeVal(1);
            
            if (name || email || phone) {
                parsedLeads.push({
                    lead_name: name,
                    company: company,
                    email: email,
                    phone: phone,
                    job_title: job_title,
                    message: '',
                    business_type: business_type,
                    looking_for: looking_for,
                    website: website,
                    date: dateStr || new Date().toISOString(),
                    source: sourceName,
                });
            }
        });
        return parsedLeads;
    }

    if (Object.keys(colMap).length > 0) {
        const dataRows = headerRowIndex !== -1 ? rows.slice(headerRowIndex + 1) : rows;
        dataRows.forEach(row => {
            const c = row.c || [];
            const getVal = (colNames) => {
                const names = Array.isArray(colNames) ? colNames : [colNames];
                for (const name of names) {
                    const idx = colMap[name.toLowerCase()];
                    if (idx !== undefined && c[idx] !== null && c[idx] !== undefined) {
                        return c[idx].v ? c[idx].v.toString() : '';
                    }
                }
                return '';
            };

            let name = getVal(['full_name', 'name', 'lead_name']);
            if (!name) {
                const fName = getVal(['first_name', 'first name']);
                const lName = getVal(['last_name', 'last name']);
                if (fName || lName) name = `${fName} ${lName}`.trim();
            }

            let phone = getVal(['phone', 'phone_number', 'phone number']);
            if (phone && typeof phone === 'string' && phone.startsWith('p:')) phone = phone.substring(2);
            if (phone && typeof phone !== 'string') phone = phone.toString();
            if (!phone && c[colMap['phone number']] && c[colMap['phone number']].f) {
                phone = c[colMap['phone number']].f;
            }
            if (phone) phone = phone.replace(/\D/g, '');

            let email = getVal(['email', 'email_address', 'email address']);
            let company = getVal(['company_name', 'company', 'organization name', 'organisation name']);
            let job_title = getVal(['job_title', 'job title']);
            let message = getVal(['message', 'message content', 'inquiry']);
            let business_type = getVal(['business_type', 'business type', 'which_best_describes_your_business?', 'which best describes your business?', 'which best describes your business']);
            let looking_for = getVal(['looking_for', 'looking for', 'what_are_you_looking_for?', 'what are you looking for?', 'what are you looking for']);
            let website = getVal(['website', 'url', 'site']);

            let dateStr = getVal(['date', 'created_time', 'date time', 'date and time']);
            let date = null;
            if (dateStr) {
                const match = dateStr.match(/^Date\((.*)\)$/);
                if (match) {
                    const dVals = match[1].split(',');
                    date = new Date(dVals[0], dVals[1], dVals[2], dVals[3] || 0, dVals[4] || 0, dVals[5] || 0).toISOString();
                } else {
                    try { date = new Date(dateStr).toISOString(); } catch (e) { }
                }
            }

            if (!date) {
                date = new Date().toISOString();
            }

            if (name && name !== 'Unknown' && name !== 'first_name last_name' && email !== 'email') {
                if (email || phone) {
                    parsedLeads.push({
                        lead_name: name,
                        company: company,
                        email: email,
                        phone: phone,
                        job_title: job_title,
                        message: message,
                        business_type: business_type,
                        looking_for: looking_for,
                        website: website,
                        date: date,
                        source: sourceName,
                    });
                }
            }
        });
    }
    return parsedLeads;
};

async function test() {
    const results = {};

    const sheetsToTest = ['Sheet1', 'Meta Lead Subsheet', 'Landing Page 2', 'New Meta Leads March'];
    const parsedResults = {};
    for (const sheet of sheetsToTest) {
        console.log(`Fetching ${sheet}...`);
        const result = await fetchSheet(sheet);
        if (result.rows && result.rows.length > 0) {
            results[sheet] = {
                cols: result.cols,
                row0: result.rows[0]?.c,
                row1: result.rows[1]?.c
            };
            
            let parsed = [];
            if (sheet === 'Landing Page 2') {
                parsed = parseSheetData({ rows: result.rows, cols: result.cols }, sheet, ['first name', 'last name', 'email', 'phone number', 'company', 'job title']);
            } else if (sheet === 'New Meta Leads March') {
                parsed = parseSheetData({ rows: result.rows, cols: result.cols }, sheet, ['full_name', 'name', 'email', 'phone']);
            } else {
                parsed = parseSheetData({ rows: result.rows, cols: result.cols }, sheet, ['name', 'email', 'phone number', 'full_name', 'phone']);
            }
            parsedResults[sheet] = parsed;
        }
    }
    fs.writeFileSync('debug-all-sheets.json', JSON.stringify(results, null, 2));
    console.log("Wrote debug-all-sheets.json");

    fs.writeFileSync('test-new-sheets-result.json', JSON.stringify(parsedResults, null, 2));
    console.log("Wrote results to test-new-sheets-result.json");
}

test();
