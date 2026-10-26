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
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Could not connect to the update service.');
    }
    if (!res.ok) {
      throw new Error(`The update service returned status ${res.status}.`);
    }

    const release = await res.json();
    const tag: string = release.tag_name ?? '';
    if (!tag) throw new Error('The latest release does not include a version tag.');
    if (!isNewer(tag, current)) return null;

    const apk = (release.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
    return {
      version: tag.replace(/^v/, ''),
      notes: release.body ?? '',
      url: apk?.browser_download_url ?? release.html_url,
    };
}

export const installedVersion = current;