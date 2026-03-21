import { supabase } from './supabase.js';

const env = typeof process !== 'undefined' ? process.env : (import.meta && import.meta.env ? import.meta.env : {});
const SHEET_ID = env.VITE_GOOGLE_SHEET_ID || '152DaLI6uPMR2fFKb38eJwpXsATTFA8uBCzIyM1plDy0'; 

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
                    
                    // IF it contains headers, AND does NOT contain obvious data like an email address or "p:+" in the same row
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
            // If colMap is empty, fallback to Zapier row static heuristics for 'New Meta Leads March'
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
                    // Meta and Landing Page specific logic for first_name/last_name
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
                        // Allow if there is an email OR a phone number
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
            const metaResult = await fetchSheet('Meta Lead Subsheet');

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

        // 3. Fetch Landing Page 2 Leads
        try {
            const landingPage2Result = await fetchSheet('Landing Page 2');
            
            if (landingPage2Result.rows && landingPage2Result.rows.length > 0) {
                const landingPageLeads = parseSheetData(landingPage2Result, 'Landing Page 2', ['first name', 'last name', 'email', 'phone number', 'company', 'job title', 'message', 'date and time']);
                console.log("DEBUG LandingPageLeads:", landingPageLeads);
                allLeads.push(...landingPageLeads);
            }
        } catch (e) {
            console.warn("Could not fetch Landing Page 2 Leads", e);
        }

        // 4. Fetch New Meta Leads March
        try {
            const newMetaResult = await fetchSheet('New Meta Leads March');

            if (newMetaResult.rows && newMetaResult.rows.length > 0) {
                const newMetaLeads = parseSheetData(newMetaResult, 'New Meta Leads March', ['full_name', 'name', 'email', 'phone']);
                const fetchTime = new Date().toISOString();
                const timestampedNewMetaLeads = newMetaLeads.map(lead => ({
                    ...lead,
                    date: fetchTime
                }));
                allLeads.push(...timestampedNewMetaLeads);
            }
        } catch (e) {
            console.warn("Could not fetch New Meta Leads March", e);
        }

        // 5. Upsert to Supabase
        const { data: existing } = await supabase.from('leads').select('id, email, phone, lead_name');

        const insertLeads = [];
        const updatePromises = [];

        const uniqueAllLeadsMap = new Map();
        for (const lead of allLeads) {
            const key = lead.email ? lead.email.toLowerCase() : lead.phone;
            uniqueAllLeadsMap.set(key, lead);
        }
        const uniqueAllLeads = Array.from(uniqueAllLeadsMap.values());

        for (const l of uniqueAllLeads) {
            const cleanPhone = String(l.phone || '').replace(/\D/g, '');
            
            const existingMatch = existing?.find(e => {
                const eCleanPhone = String(e.phone || '').replace(/\D/g, '');
                return (
                    (l.email && e.email && e.email.toLowerCase() === l.email.toLowerCase()) ||
                    (cleanPhone && eCleanPhone && eCleanPhone === cleanPhone && e.lead_name === l.lead_name)
                );
            });

            if (existingMatch) {
                const updatePayload = {};
                if (l.date) updatePayload.date = l.date;
                if (l.source) updatePayload.source = l.source;
                if (l.message) updatePayload.message = l.message;
                if (l.business_type) updatePayload.business_type = l.business_type;
                if (l.looking_for) updatePayload.looking_for = l.looking_for;
                if (l.website) updatePayload.website = l.website;
                if (l.job_title) updatePayload.job_title = l.job_title;
                if (l.company) updatePayload.company = l.company;
                
                if (Object.keys(updatePayload).length > 0) {
                    updatePromises.push(
                        supabase.from('leads').update(updatePayload).eq('id', existingMatch.id)
                    );
                }
            } else {
                insertLeads.push(l);
            }
        }

        let insertedCount = 0;
        let updatedCount = updatePromises.length;

        if (insertLeads.length > 0) {
            console.log("FRONTEND SYNC: Inserting these new leads:", insertLeads.length);
            const { error } = await supabase.from('leads').insert(insertLeads);
            if (error) {
                console.error("FRONTEND SYNC SUPABASE ERROR:", error);
                throw error;
            }
            insertedCount = insertLeads.length;
        } else {
            console.log("FRONTEND SYNC: No new leads to insert.");
        }

        if (updatePromises.length > 0) {
            console.log(`FRONTEND SYNC: Updating ${updatePromises.length} existing leads with fresh payloads.`);
            const updateResults = await Promise.all(updatePromises);
            const errors = updateResults.filter(r => r.error);
            if (errors.length > 0) {
                console.error("FRONTEND SYNC SUPABASE UPDATE ERROR:", errors[0].error);
                throw errors[0].error;
            }
        } else {
            console.log("FRONTEND SYNC: No existing leads to update.");
        }

        return { success: true, count: insertedCount, updated: updatedCount };
    } catch (error) {
        console.error('Error syncing sheets:', error);
        throw error;
    }
};
