import { Injectable } from '@nestjs/common';

interface GithubRepositoryResponse {
  default_branch?: string | null;
}

interface GithubContentItem {
  name?: string;
  path?: string;
  type?: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;
  encoding?: string;
  size?: number;
}

interface GithubTreeResponse {
  tree?: GithubTreeItem[];
}

interface GithubTreeItem {
  path?: string;
  type?: 'blob' | 'tree' | 'commit';
  size?: number;
}

@Injectable()
export class RepositoryContextService {
  private readonly maxRepositoryFiles = 8;
  private readonly maxFileCharacters = 2200;
  private readonly excludedPathFragments = [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '__pycache__/',
    '.git/',
  ];

  async isRepositoryEmpty(repositoryUrl: string): Promise<boolean> {
    const coordinates = this.parseGithubRepository(repositoryUrl);
    if (!coordinates) {
      return false;
    }

    const repository = await this.fetchRepositoryMetadata(coordinates);

    if (!repository.default_branch) {
      return true;
    }

    const contents = await this.fetchRepositoryRootContents(
      coordinates,
      repository.default_branch,
    );

    if (!Array.isArray(contents)) {
      return false;
    }

    return contents.length === 0;
  }

  async buildAnalysisContext(repositoryUrl: string): Promise<string> {
    const coordinates = this.parseGithubRepository(repositoryUrl);
    if (!coordinates) {
      return '';
    }

    const repository = await this.fetchRepositoryMetadata(coordinates);
    if (!repository.default_branch) {
      return '';
    }

    const tree = await this.fetchRepositoryTree(
      coordinates,
      repository.default_branch,
    );
    const selectedFiles = this.selectRepositoryFiles(tree);

    if (selectedFiles.length === 0) {
      return '';
    }

    const fileSections: string[] = [];

    for (const file of selectedFiles) {
      const content = await this.fetchFileContent(
        coordinates,
        file.path,
        repository.default_branch,
      );

      if (!content) {
        continue;
      }

      fileSections.push(this.formatFileSection(file.path, content));
    }

    if (fileSections.length === 0) {
      return '';
    }

    return [
      `Repositorio: ${repositoryUrl}`,
      `Branch por defecto: ${repository.default_branch}`,
      'Archivos analizados:',
      ...selectedFiles.map((file) => `- ${file.path}`),
      '',
      ...fileSections,
    ].join('\n');
  }

  private parseGithubRepository(
    repositoryUrl: string,
  ): { owner: string; repository: string } | null {
    try {
      const parsed = new URL(repositoryUrl);
      if (parsed.hostname !== 'github.com') {
        return null;
      }

      const [owner, rawRepository] = parsed.pathname
        .split('/')
        .filter((segment) => segment.length > 0);

      if (!owner || !rawRepository) {
        return null;
      }

      return {
        owner,
        repository: rawRepository.endsWith('.git')
          ? rawRepository.slice(0, -4)
          : rawRepository,
      };
    } catch {
      return null;
    }
  }

  private async fetchRepositoryMetadata(coordinates: {
    owner: string;
    repository: string;
  }): Promise<GithubRepositoryResponse> {
    return this.fetchGithubJson<GithubRepositoryResponse>(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}`,
    );
  }

  private async fetchRepositoryRootContents(
    coordinates: { owner: string; repository: string },
    branch: string,
  ): Promise<GithubContentItem[] | GithubContentItem> {
    const response = await fetch(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}/contents?ref=${encodeURIComponent(branch)}`,
      {
        headers: this.buildGithubHeaders(),
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`GitHub contents request failed (${response.status})`);
    }

    return (await response.json()) as GithubContentItem[] | GithubContentItem;
  }

  private async fetchRepositoryTree(
    coordinates: { owner: string; repository: string },
    branch: string,
  ): Promise<GithubTreeItem[]> {
    const response = await this.fetchGithubJson<GithubTreeResponse>(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );

    return Array.isArray(response.tree) ? response.tree : [];
  }

  private async fetchFileContent(
    coordinates: { owner: string; repository: string },
    path: string,
    branch: string,
  ): Promise<string> {
    const response = await this.fetchGithubJson<GithubContentItem>(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}/contents/${path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}?ref=${encodeURIComponent(branch)}`,
    );

    if (response.encoding !== 'base64' || !response.content) {
      return '';
    }

    return Buffer.from(response.content, 'base64').toString('utf-8');
  }

  private async fetchGithubJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: this.buildGithubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }

  private buildGithubHeaders(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DevDecisionEngine-Backend',
    };
  }

  private selectRepositoryFiles(
    tree: GithubTreeItem[],
  ): Array<{ path: string }> {
    return tree
      .filter(this.hasFilePath)
      .filter((item) => this.isCandidateFile(item.path, item.size))
      .sort((left, right) => {
        const scoreDifference =
          this.scoreRepositoryPath(right.path) -
          this.scoreRepositoryPath(left.path);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return left.path.localeCompare(right.path);
      })
      .slice(0, this.maxRepositoryFiles)
      .map((item) => ({ path: item.path }));
  }

  private isCandidateFile(path: string, size?: number): boolean {
    const normalized = path.toLowerCase();

    if (size && size > 30_000) {
      return false;
    }

    if (
      this.excludedPathFragments.some((fragment) =>
        normalized.includes(fragment),
      )
    ) {
      return false;
    }

    if (
      normalized.endsWith('.lock') ||
      normalized.endsWith('.pyc') ||
      normalized.endsWith('.png') ||
      normalized.endsWith('.jpg') ||
      normalized.endsWith('.jpeg') ||
      normalized.endsWith('.svg') ||
      normalized.endsWith('.ico')
    ) {
      return false;
    }

    return (
      normalized.endsWith('.md') ||
      normalized.endsWith('.txt') ||
      normalized.endsWith('.log') ||
      normalized.endsWith('.py') ||
      normalized.endsWith('.ts') ||
      normalized.endsWith('.tsx') ||
      normalized.endsWith('.js') ||
      normalized.endsWith('.jsx') ||
      normalized.endsWith('.json') ||
      normalized.endsWith('.yml') ||
      normalized.endsWith('.yaml')
    );
  }

  private scoreRepositoryPath(path: string): number {
    const normalized = path.toLowerCase();
    let score = 0;

    if (normalized === 'readme.md' || normalized.endsWith('/readme.md')) {
      score += 100;
    }

    if (
      normalized.includes('stacktrace') ||
      normalized.includes('/logs/') ||
      normalized.endsWith('.log')
    ) {
      score += 80;
    }

    if (normalized.startsWith('src/') || normalized.includes('/src/')) {
      score += 60;
    }

    if (normalized.startsWith('app/') || normalized.includes('/app/')) {
      score += 40;
    }

    if (
      normalized.endsWith('app.py') ||
      normalized.endsWith('main.py') ||
      normalized.endsWith('main.ts') ||
      normalized.endsWith('index.ts') ||
      normalized.endsWith('package.json')
    ) {
      score += 35;
    }

    if (
      normalized.includes('config') ||
      normalized.includes('order') ||
      normalized.includes('notification') ||
      normalized.includes('error')
    ) {
      score += 20;
    }

    if (
      normalized.includes('test') ||
      normalized.includes('.spec.') ||
      normalized.includes('.test.')
    ) {
      score -= 25;
    }

    return score;
  }

  private formatFileSection(path: string, content: string): string {
    const normalized = content.replace(/\r\n/g, '\n').trim();
    const snippet =
      normalized.length <= this.maxFileCharacters
        ? normalized
        : `${normalized.slice(0, this.maxFileCharacters).trimEnd()}\n...`;

    return [`### ${path}`, '```text', snippet, '```'].join('\n');
  }

  private hasFilePath(
    this: void,
    item: GithubTreeItem,
  ): item is GithubTreeItem & { path: string; type: 'blob' } {
    return item.type === 'blob' && typeof item.path === 'string';
  }
}
