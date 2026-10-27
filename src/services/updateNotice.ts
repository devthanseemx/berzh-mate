import AsyncStorage from '@react-native-async-storage/async-storage';

const REPO = 'devthanseemx/berzh-mate';
export const PENDING_INSTALL_NOTICE_KEY = 'berzh-mate-pending-install-notice';

export type UpdateNoticeDetails = {
  version: string;
  notes: string;
};

type GitHubRelease = { body?: string | null };
type GitHubComparison = { commits?: { commit?: { message?: string } }[] };

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
    const release = (await response.json()) as GitHubRelease;
    const body = release.body?.trim() ?? '';
    const compareMatch = body.match(
      /https:\/\/github\.com\/devthanseemx\/berzh-mate\/compare\/(.+?)\.\.\.([^\s/]+)/
    );
    const humanNotes = body
      .split(/\r?\n/)
      .filter((line) => !/full changelog|github\.com\/devthanseemx\/berzh-mate\/compare\//i.test(line))
      .join('\n')
      .trim();

    if (!compareMatch) return humanNotes;

    const compareResponse = await fetch(
      `https://api.github.com/repos/${REPO}/compare/${encodeURIComponent(compareMatch[1])}...${encodeURIComponent(compareMatch[2])}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal }
    );
    if (!compareResponse.ok) {
      if (humanNotes) return humanNotes;
      throw new Error(`Could not load release changes (HTTP ${compareResponse.status}).`);
    }

    const comparison = (await compareResponse.json()) as GitHubComparison;
    const commits = (comparison.commits ?? [])
      .map((item) => item.commit?.message?.split(/\r?\n/, 1)[0]?.trim() ?? '')
      .filter((message) => message && !/^merge\b/i.test(message))
      .map((message) => message.replace(/^(feat|fix|chore|refactor|docs|style|test|perf|build|ci)(\([^)]*\))?:\s*/i, ''))
      .filter((message, index, list) => list.indexOf(message) === index)
      .slice(0, 12);
    const commitNotes = commits.map((message) => `• ${message}`).join('\n');
    const remaining = Math.max(0, (comparison.commits?.length ?? 0) - commits.length);
    const moreNotes = remaining > 0 ? `\n• And ${remaining} more change${remaining === 1 ? '' : 's'}.` : '';
    return [humanNotes, commitNotes ? `${commitNotes}${moreNotes}` : ''].filter(Boolean).join('\n\n');
  } finally {
    clearTimeout(timeout);
  }
}
