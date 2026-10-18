import Constants from 'expo-constants';

const REPO = 'devthanseemx/berzh-mate'; // replace with your GitHub repository

export type UpdateInfo = { version: string; notes: string; url: string } | null;

const current = Constants.expoConfig?.version ?? '0.0.0';

const parts = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

function isNewer(latest: string, installed: string): boolean {
  const a = parts(latest);
  const b = parts(installed);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// Compares the latest GitHub release tag with the installed version.
export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;

    const release = await res.json();
    const tag: string = release.tag_name ?? '';
    if (!tag || !isNewer(tag, current)) return null;

    const apk = (release.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
    return {
      version: tag.replace(/^v/, ''),
      notes: release.body ?? '',
      url: apk?.browser_download_url ?? release.html_url,
    };
  } catch {
    return null; // no internet or GitHub unavailable: stay quiet
  }
}

export const installedVersion = current;