import crypto from 'crypto';
const name='blue_hour_organizer';
const secret=()=>process.env.ORGANIZER_SESSION_SECRET||process.env.ORGANIZER_PASSCODE||'local-development-secret-change-me';
export function organizerCookie(){return name;}
export function makeOrganizerToken(){const sig=crypto.createHmac('sha256',secret()).update('blue-hour-organizer').digest('base64url');return `v1.${sig}`;}
export function isOrganizer(value){if(!value)return false;const a=Buffer.from(value),b=Buffer.from(makeOrganizerToken());return a.length===b.length&&crypto.timingSafeEqual(a,b);}
