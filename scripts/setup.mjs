import { getDb, resetDemo } from '../lib/db.js';
getDb();
if (process.argv.includes('--reset')) resetDemo();
console.log(process.argv.includes('--reset') ? 'Blue Hour event data cleared.' : 'Blue Hour database initialized.');
