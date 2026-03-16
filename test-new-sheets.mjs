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
    if (headerKeywords.some(kw => colLabels.includes(kw))) {
        colLabels.forEach((val, idx) => {
            if (val) colMap[val] = idx;
        });
    } else {
        for (let i = 0; i < rows.length; i++) {
            const rowVals = rows[i].c?.map(cell => (cell ? (cell.v || '').toString().toLowerCase() : '')) || [];
            if (headerKeywords.some(kw => rowVals.includes(kw))) {
                headerRowIndex = i;
                rowVals.forEach((val, idx) => {
                    if (val) colMap[val] = idx;
                });
                break;
            }
        }
    }

    const parsedLeads = [];
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

    console.log("Fetching Landing Page 2...");
    const landingPage2Result = await fetchSheet('Landing Page 2');
    if (landingPage2Result.rows && landingPage2Result.rows.length > 0) {
        const landingPageLeads = parseSheetData(landingPage2Result, 'Landing Page 2', ['first name', 'last name', 'email', 'phone number', 'company', 'job title', 'message', 'date and time']);
        results['Landing Page 2'] = landingPageLeads;
    }

    console.log("Fetching New Meta Leads March...");
    const newMetaResult = await fetchSheet('New Meta Leads March');
    if (newMetaResult.rows && newMetaResult.rows.length > 0) {
        const newMetaLeads = parseSheetData(newMetaResult, 'New Meta Leads March', ['full_name', 'name', 'email', 'phone']);
        const fetchTime = new Date().toISOString();
        const timestampedNewMetaLeads = newMetaLeads.map(lead => ({
            ...lead,
            date: fetchTime
        }));
        results['New Meta Leads March'] = timestampedNewMetaLeads;
    }

    fs.writeFileSync('test-new-sheets-result.json', JSON.stringify(results, null, 2));
    console.log("Wrote results to test-new-sheets-result.json");
}

test();
