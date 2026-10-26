import AsyncStorage from '@react-native-async-storage/async-storage';

const REPO = 'devthanseemx/berzh-mate';
export const PENDING_INSTALL_NOTICE_KEY = 'berzh-mate-pending-install-notice';

export type UpdateNoticeDetails = {
  version: string;
  notes: string;
};

export async function savePendingInstallNotice(notice: UpdateNoticeDetails): Promise<void> {
  await AsyncStorage.setItem(PENDING_INSTALL_NOTICE_KEY, JSON.stringify(notice));
}

export async function clearPendingInstallNotice(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INSTALL_NOTICE_KEY);
}

export async function getReleaseNotes(version: string): Promise<string> {
  const tag = `v${version.replace(/^v/, '')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal }
    );
    if (!response.ok) {
      throw new Error(`Could not load release notes (HTTP ${response.status}).`);
    }
    const release = (await response.json()) as { body?: string | null };
    return release.body?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}
