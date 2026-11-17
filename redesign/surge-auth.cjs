// One-time Surge login using the ledger credential.
// Reads email+password from the accounts ledger, exchanges them for a token
// via POST https://surge.sh/token, stores the token in ~/.netrc (mode 600).
// Prints nothing secret.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ledger = JSON.parse(fs.readFileSync(
  path.join(os.homedir(), 'workspace/makefun/accounts-created.json'), 'utf8'));
const { email, password } = ledger.accounts.surge;

const tmp = path.join(os.tmpdir(), 'surge-auth-netrc-' + process.pid);
fs.writeFileSync(tmp, `machine surge.surge.sh\n\tlogin ${email}\n\tpassword ${password}\n`, { mode: 0o600 });
try {
  const out = execFileSync('curl', ['-s', '--netrc-file', tmp, '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ msg: 'login from ' + os.hostname() }),
    'https://surge.surge.sh/token'],
    { encoding: 'utf8', timeout: 30000 });
  const data = JSON.parse(out);
  if (!data.token) throw new Error('no token in response, keys: ' + Object.keys(data).join(','));
  const creds = require('/usr/lib/node_modules/surge/lib/util/creds.js')({ host: 'surge.sh' });
  creds.set(email, data.token);
  console.log('Surge login ok as ' + email);
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}
