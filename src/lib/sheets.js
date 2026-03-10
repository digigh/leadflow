import { supabase } from './supabase';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

const fetchSheet = async (sheetName) => {
    if (!SHEET_ID) throw new Error('Google Sheet ID not configured in .env');
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
};

export const syncGoogleSheets = async () => {
    try {
        const allLeads = [];

        // Helper to dynamically parse a sheet based on expected header keywords
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
                    // Meta leads specific logic for first_name/last_name
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
                    if (phone) phone = phone.replace(/\D/g, '');

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

                    if (name && name !== 'Unknown' && name !== 'first_name last_name' && email !== 'email') {
                        // Allow if there is an email OR a phone number
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

        // 1. Fetch Website Leads (Sheet1)
        try {
            const websiteResult = await fetchSheet('Sheet1');
            const websiteLeads = parseSheetData(websiteResult, 'Website', ['name', 'email', 'phone number']);
            allLeads.push(...websiteLeads);
        } catch (e) {
            console.warn('Could not fetch Website Leads', e);
        }

        // 2. Fetch Meta Leads
        try {
            const metaResult = await fetchSheet('Meta Lead');

            if (metaResult.rows && metaResult.rows.length > 0) {
                // Meta lead columns can be name, full_name, email, phone, etc. Let's cover possible values
                const metaLeads = parseSheetData(metaResult, 'Meta', ['full_name', 'name', 'email', 'phone', 'first_name', 'phone number']);
                // Override the date to be the exact time it was pulled from Google Sheet
                const fetchTime = new Date().toISOString();
                const timestampedMetaLeads = metaLeads.map(lead => ({
                    ...lead,
                    date: fetchTime
                }));
                allLeads.push(...timestampedMetaLeads);
            }
        } catch (e) {
            console.warn("Could not fetch Meta Leads", e);
        }

        // 3. Upsert to Supabase
        const { data: existing } = await supabase.from('leads').select('email, phone, lead_name');

        const newLeads = allLeads.filter(l => {
            const cleanPhone = String(l.phone || '').replace(/\D/g, '');
            return !existing?.some(e => {
                const eCleanPhone = String(e.phone || '').replace(/\D/g, '');
                return (
                    (l.email && e.email && e.email === l.email) ||
                    (cleanPhone && eCleanPhone && eCleanPhone === cleanPhone && e.lead_name === l.lead_name)
                );
            });
        });

        if (newLeads.length > 0) {
            console.log("FRONTEND SYNC: Inserting these leads:", newLeads);
            const { error } = await supabase.from('leads').insert(newLeads);
            if (error) {
                console.error("FRONTEND SYNC SUPABASE ERROR:", error);
                throw error;
            }
        } else {
            console.log("FRONTEND SYNC: No new leads to insert.");
        }

        return { success: true, count: newLeads.length };
    } catch (error) {
        console.error('Error syncing sheets:', error);
        throw error;
    }
};
