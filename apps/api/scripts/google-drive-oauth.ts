/**
 * One-time helper: get a Google Drive OAuth refresh token (personal Drive).
 *
 * Why: service accounts have no storage quota on normal My Drive folders.
 * OAuth uploads as your Google user, into the shared folder.
 *
 * Setup:
 * 1. Cloud Console → APIs & Services → Credentials → Create OAuth client ID
 *    Type: Desktop app (or Web, with redirect http://127.0.0.1:3456/oauth2callback)
 * 2. Put into apps/api/.env:
 *      GOOGLE_OAUTH_CLIENT_ID=...
 *      GOOGLE_OAUTH_CLIENT_SECRET=...
 * 3. From apps/api: npx tsx scripts/google-drive-oauth.ts
 * 4. Sign in with the Google account that owns the School folder
 * 5. Copy printed GOOGLE_OAUTH_REFRESH_TOKEN into .env and restart API
 */
import { createServer } from 'http';
import { google } from 'googleapis';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const PORT = 3456;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in apps/api/.env',
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n1) In Google Cloud OAuth client, add authorized redirect URI:');
console.log(`   ${REDIRECT}`);
console.log('\n2) Open this URL and approve access:\n');
console.log(url);
console.log('\nWaiting for callback…\n');

const server = createServer(async (req, res) => {
  try {
    if (!req.url?.startsWith('/oauth2callback')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = new URL(req.url, REDIRECT).searchParams.get('code');
    if (!code) {
      res.writeHead(400);
      res.end('Missing code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<h1>OK</h1><p>You can close this tab and return to the terminal.</p>',
    );

    if (!tokens.refresh_token) {
      console.error(
        'No refresh_token. Revoke the app at https://myaccount.google.com/permissions and retry.',
      );
      process.exit(1);
    }

    console.log('\nAdd to apps/api/.env:\n');
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(
      `GOOGLE_DRIVE_FOLDER_ID=${process.env.GOOGLE_DRIVE_FOLDER_ID || '1aa5dWvoAA3UjJPX0I-CY9bzrfH9rqNQS'}`,
    );
    console.log('');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Error');
    process.exit(1);
  }
});

server.listen(PORT);
