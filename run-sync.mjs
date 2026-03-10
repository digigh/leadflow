import { syncGoogleSheets } from './src/lib/sheets.js';

async function run() {
    try {
        console.log("Running Sync...");
        const result = await syncGoogleSheets();
        console.log("Sync Result:", result);
    } catch (e) {
        console.error("Sync Failed:", e);
    }
}
run();
