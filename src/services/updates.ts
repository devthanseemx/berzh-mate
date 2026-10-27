import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getReleaseNotes } from './updateNotice';

const REPO = 'devthanseemx/berzh-mate';

export type UpdateInfo = {
  version: string;
  notes: string;
  apkUrl: string | null;
} | null;

type ReleaseAsset = { name: string; browser_download_url: string };
type ReleaseResponse = {
  tag_name?: string;
  body?: string | null;
  assets?: ReleaseAsset[];
};

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

  const release = (await res.json()) as ReleaseResponse;
  const tag: string = release.tag_name ?? '';
  if (!tag) throw new Error('The latest release does not include a version tag.');
  if (!isNewer(tag, current)) return null;

  const apk = (release.assets ?? []).find((asset) =>
    asset.name.toLowerCase().startsWith('berzh-mate-') &&
    asset.name.toLowerCase().endsWith('.apk')
  ) ?? (release.assets ?? []).find((asset) => asset.name.toLowerCase().endsWith('.apk'));
  let notes = release.body ?? '';
  try {
    notes = await getReleaseNotes(tag) || notes;
  } catch (error: unknown) {
    console.warn('Could not load detailed release notes:', error);
  }
  return {
    version: tag.replace(/^v/, ''),
    notes,
    apkUrl: apk?.browser_download_url ?? null,
  };
}

export const installedVersion = current;

export async function downloadAndInstallUpdate(
  update: NonNullable<UpdateInfo>,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('APK updates can only be installed on Android.');
  }
  if (!update.apkUrl) {
    throw new Error('This release does not include an Android APK.');
  }
  if (!FileSystem.cacheDirectory) {
    throw new Error('The app cache directory is unavailable.');
  }

  const safeVersion = update.version.replace(/[^a-zA-Z0-9.-]/g, '-');
  const fileUri = `${FileSystem.cacheDirectory}berzh-mate-${safeVersion}.apk`;
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
  const download = FileSystem.createDownloadResumable(
    update.apkUrl,
    fileUri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress?.(Math.min(1, totalBytesWritten / totalBytesExpectedToWrite));
      }
    }
  );
  const result = await download.downloadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error('The APK download did not complete successfully.');
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  const { startActivityAsync } = await import('expo-intent-launcher');
  await startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
}