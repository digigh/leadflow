import { syncGoogleSheets } from './src/lib/sheets.js';

async function test() {
    try {
        console.log("Running syncGoogleSheets...");
        const result = await syncGoogleSheets();
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed:", e);
    }
}

test();
