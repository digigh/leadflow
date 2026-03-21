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

async function testSupabaseInsert() {
    let allLeads = [];

    // Website Leads
    try {
        const websiteResult = await fetchSheet('Sheet1');
        const websiteLeads = parseSheetData(websiteResult, 'Website', ['name', 'email', 'phone number']);
        console.log("Website leads fetched: ", websiteLeads.length);
        allLeads.push(...websiteLeads);
    } catch (e) { console.error('Website Error', e); }

    // Meta Leads
    try {
        const metaResult = await fetchSheet('Meta Lead Subsheet');
        if (metaResult.rows && metaResult.rows.length > 0) {
            const metaLeads = parseSheetData(metaResult, 'Meta', ['full_name', 'name', 'email', 'phone', 'first_name', 'phone number']);
            console.log("Meta Lead Subsheet fetched: ", metaLeads.length);
            const fetchTime = new Date().toISOString();
            const timestampedMetaLeads = metaLeads.map(lead => ({ ...lead, date: fetchTime }));
            allLeads.push(...timestampedMetaLeads);
        }
    } catch (e) { console.error('Meta Lead Subsheet Error', e); }

    // Landing Page 2
    try {
        const landingPage2Result = await fetchSheet('Landing Page 2');
        if (landingPage2Result.rows && landingPage2Result.rows.length > 0) {
            const landingPageLeads = parseSheetData(landingPage2Result, 'Landing Page 2', ['first name', 'last name', 'email', 'phone number', 'company', 'job title', 'message', 'date and time']);
            console.log("Landing Page 2 fetched: ", landingPageLeads.length);
            allLeads.push(...landingPageLeads);
        }
    } catch (e) { console.error('Landing Page 2 Error', e); }

    // New Meta Leads March
    try {
        const newMetaResult = await fetchSheet('New Meta Leads March');
        if (newMetaResult.rows && newMetaResult.rows.length > 0) {
            const newMetaLeads = parseSheetData(newMetaResult, 'New Meta Leads March', ['full_name', 'name', 'email', 'phone']);
            console.log("New Meta Leads March fetched: ", newMetaLeads.length);
            const fetchTime = new Date().toISOString();
            const timestampedNewMetaLeads = newMetaLeads.map(lead => ({
                ...lead,
                date: fetchTime
            }));
            allLeads.push(...timestampedNewMetaLeads);
        }
    } catch (e) { console.error('New Meta Leads March Error', e); }

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

    if (insertLeads.length > 0) {
        console.log("BACKEND SYNC: Inserting these new leads:", insertLeads.length);
        const { error, data } = await supabase.from('leads').insert(insertLeads).select();
        if (error) {
            console.error("SUPABASE ERROR:", error);
        } else {
            console.log("Successfully inserted!");
        }
    } else {
        console.log("No new leads to insert.");
    }

    if (updatePromises.length > 0) {
        console.log(`BACKEND SYNC: Updating ${updatePromises.length} existing leads with fresh payloads.`);
        const updateResults = await Promise.all(updatePromises);
        const errors = updateResults.filter(r => r.error);
        if (errors.length > 0) {
            console.error("SUPABASE UPDATE ERROR:", errors[0].error);
        } else {
            console.log("Successfully updated all returning leads!");
        }
    } else {
        console.log("No existing leads to update.");
    }
}

testSupabaseInsert();
