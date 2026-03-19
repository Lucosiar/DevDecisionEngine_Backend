import { Injectable } from '@nestjs/common';

interface GithubRepositoryResponse {
  default_branch?: string;
}

interface GithubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

interface GithubTreeResponse {
  tree: GithubTreeItem[];
}

@Injectable()
export class RepositoryContextService {
  private readonly maxCharsPerFile = 2500;
  private readonly maxContextChars = 45000;

  async loadContext(repositoryUrl: string): Promise<string> {
    const { owner, repository } = this.parseGithubRepository(repositoryUrl);
    const repositoryInfo = await this.fetchJson<GithubRepositoryResponse>(
      `https://api.github.com/repos/${owner}/${repository}`,
    );

    const branch = repositoryInfo.default_branch ?? 'main';
    const tree = await this.fetchJson<GithubTreeResponse>(
      `https://api.github.com/repos/${owner}/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );

    const candidateFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' && this.isAnalyzableFile(item.path, item.size),
    );

    let context = `Repository URL: ${repositoryUrl}
Default branch: ${branch}
Total analyzable files found: ${candidateFiles.length}
Files in repository:
${candidateFiles.map((file) => `- ${file.path}`).join('\n')}`;

    for (const file of candidateFiles) {
      if (context.length >= this.maxContextChars) {
        break;
      }

      const encodedPath = file.path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${encodedPath}`;
      const content = await this.fetchText(rawUrl);

      if (!content || content.includes('\u0000')) {
        continue;
      }

      const normalizedContent = content.slice(0, this.maxCharsPerFile);
      const block = `

FILE: ${file.path}
${normalizedContent}`;

      if (context.length + block.length > this.maxContextChars) {
        context += block.slice(0, this.maxContextChars - context.length);
        break;
      }

      context += block;
    }

    return context;
  }

  private parseGithubRepository(repositoryUrl: string): {
    owner: string;
    repository: string;
  } {
    const parsedUrl = new URL(repositoryUrl);
    if (parsedUrl.hostname !== 'github.com') {
      throw new Error('Only github.com URLs are supported');
    }

    const [owner, rawRepository] = parsedUrl.pathname
      .split('/')
      .filter((segment) => segment.length > 0);

    if (!owner || !rawRepository) {
      throw new Error('Invalid GitHub repository URL');
    }

    const repository = rawRepository.endsWith('.git')
      ? rawRepository.slice(0, -4)
      : rawRepository;

    return { owner, repository };
  }

  private isAnalyzableFile(path: string, size?: number): boolean {
    if (size && size > 25000) {
      return false;
    }

    const blockedPaths = [
      '/node_modules/',
      '/dist/',
      '/build/',
      '/coverage/',
      '/.next/',
      '/.git/',
    ];

    const normalizedPath = `/${path.toLowerCase()}/`;
    if (blockedPaths.some((segment) => normalizedPath.includes(segment))) {
      return false;
    }

    if (path.includes('.min.')) {
      return false;
    }

    const allowedExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
      '.md',
      '.yml',
      '.yaml',
      '.sql',
      '.env.example',
    ];

    return allowedExtensions.some((extension) =>
      path.toLowerCase().endsWith(extension),
    );
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevDecisionEngine-Backend',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status}) for ${url}`);
    }

    return (await response.json()) as T;
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevDecisionEngine-Backend',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub raw file request failed (${response.status})`);
    }

    return response.text();
  }
}
