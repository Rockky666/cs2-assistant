import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Uses the existing Git credential manager; credentials never go to logs or disk.
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const tag = `v${version}`;
const repository = 'Rockky666/cs2-assistant';
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  const credential = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  token = credential
    .split(/\r?\n/)
    .find((line) => line.startsWith('password='))
    ?.slice(9);
}
if (!token) throw new Error('GitHub credentials unavailable');
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};
async function api(endpoint, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const repo = await api('');
if (process.argv.includes('--check')) {
  console.log(
    JSON.stringify({ repository: repo.full_name, canPush: repo.permissions?.push, release: tag }),
  );
  process.exit(0);
}
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
  throw new Error('Commit source changes before publishing');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const remote = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {
  encoding: 'utf8',
}).split(/\s/)[0];
if (sha !== remote) throw new Error('Push the release commit before publishing');
const filename = `CS2-Assistant-${version}-portable.exe`;
const executable = await readFile(`release/${filename}`);
const digest = createHash('sha256').update(executable).digest('hex');
const checksum = Buffer.from(`${digest}  ${filename}\n`);
await writeFile(`release/${filename}.sha256`, checksum);
const notes = await readFile(`docs/RELEASE-${version}.md`, 'utf8');
const releases = await api('/releases?per_page=100');
let release = releases.find((r) => r.tag_name === tag);
if (release && !release.draft) throw new Error('Release already published; refusing to overwrite');
if (!release)
  release = await api('/releases', 'POST', {
    tag_name: tag,
    target_commitish: sha,
    name: `CS2 Assistant ${version}`,
    body: notes,
    draft: true,
    prerelease: false,
  });
for (const [name, data, type] of [
  [filename, executable, 'application/octet-stream'],
  [`${filename}.sha256`, checksum, 'text/plain'],
]) {
  const existing = release.assets.find((asset) => asset.name === name);
  if (existing) {
    if (existing.digest === `sha256:${createHash('sha256').update(data).digest('hex')}`) continue;
    throw new Error(`Draft already has a different asset: ${name}`);
  }
  const url = release.upload_url.split('{')[0] + `?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': type },
    body: data,
  });
  if (!response.ok) throw new Error(`Asset upload ${name}: HTTP ${response.status}`);
  const asset = await response.json();
  if (asset.size !== data.length) throw new Error(`Unexpected upload size: ${name}`);
  console.log(`Uploaded ${name} (${asset.size} bytes)`);
}
const published = await api(`/releases/${release.id}`, 'PATCH', { draft: false, body: notes });
const verified = await api(`/releases/${published.id}`);
if (verified.draft || verified.assets.length < 2) throw new Error('Release verification failed');
console.log(
  JSON.stringify(
    {
      url: verified.html_url,
      tag,
      sha,
      assets: verified.assets.map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
        digest: a.digest,
      })),
    },
    null,
    2,
  ),
);
