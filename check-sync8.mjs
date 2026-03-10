import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jzzjbwonvntlznrcquaf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6empid29udm50bHpucmNxdWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Mjg0NDAsImV4cCI6MjA4MzIwNDQ0MH0.Ej5PcbPXXEA0-o_qcZatoU2uNS2Wms_s1uT5sCXj47g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SHEET_ID = '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0';

const fetchSheet = async (sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) return { cols: [], rows: [] };
    const data = JSON.parse(match[1]);
    if (data.status === 'error' || !data?.table?.rows) {
        return { cols: [], rows: [] };
    }
    return { cols: data.table.cols || [], rows: data.table.rows };
};

const parseSheetData = (sheetResult, sourceName, headerKeywords) => {
    const rows = sheetResult.rows || [];
    const cols = sheetResult.cols || [];
    let headerRowIndex = -1;
    let colMap = {};

    // Check if headers are in cols array
    const colLabels = cols.map(c => (c.label || '').toLowerCase());
    if (headerKeywords.some(kw => colLabels.includes(kw))) {
        colLabels.forEach((val, idx) => {
            if (val) colMap[val] = idx;
        });
    } else {
        // Fallback to searching inside rows
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
        dataRows.forEach((row, index) => {
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
                const fName = getVal(['first_name']);
                const lName = getVal(['last_name']);
                if (fName || lName) name = `${fName} ${lName}`.trim();
            }

            let phone = getVal(['phone', 'phone_number', 'phone number']);
            if (phone && typeof phone === 'string' && phone.startsWith('p:')) phone = phone.substring(2);
            if (phone && typeof phone !== 'string') phone = phone.toString();
            if (!phone && c[colMap['phone number']] && c[colMap['phone number']].f) {
                phone = c[colMap['phone number']].f;
            }

            let email = getVal(['email', 'email_address', 'email address']);
            let company = getVal(['company_name', 'company', 'organization name', 'organisation name']);
            let job_title = getVal(['job_title', 'job title']);
            let message = getVal(['message', 'message content', 'inquiry']);

            let dateStr = getVal(['date', 'created_time', 'date time']);
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

            if (index < 3) {
                console.log(`Parsed index ${index} mapped cell -> Name: ${name}, Phone: ${phone}, Email: ${email}`);
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
                        date: date,
                        source: sourceName,
                    });
                }
            }
        });
    }
    return parsedLeads;
};

async function checkSync() {
    let metaResult = await fetchSheet('Meta Lead');
    const metaLeads = parseSheetData(metaResult, 'Meta', ['full_name', 'name', 'email', 'phone', 'first_name', 'phone number']);

    console.log(`Total Leads identified in 'Meta Lead': ${metaLeads.length}`);

    const { data: existing } = await supabase.from('leads').select('email, phone, lead_name');

    const newLeads = metaLeads.filter(l => {
        const cleanPhone = String(l.phone || '').replace(/\D/g, '');
        return !existing?.some(e => {
            const eCleanPhone = String(e.phone || '').replace(/\D/g, '');
            return (
                (l.email && e.email && e.email === l.email) ||
                (cleanPhone && eCleanPhone && eCleanPhone === cleanPhone && e.lead_name === l.lead_name)
            );
        });
    });

    console.log(`After deduplication, ${newLeads.length} NEW leads will be inserted.`);
}

checkSync();
