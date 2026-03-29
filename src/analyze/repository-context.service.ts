import { Injectable } from '@nestjs/common';

interface GithubRepositoryResponse {
  default_branch?: string | null;
}

interface GithubContentItem {
  name?: string;
  path?: string;
  type?: 'file' | 'dir' | 'symlink' | 'submodule';
}

@Injectable()
export class RepositoryContextService {
  async isRepositoryEmpty(repositoryUrl: string): Promise<boolean> {
    const coordinates = this.parseGithubRepository(repositoryUrl);
    if (!coordinates) {
      return false;
    }

    const repositoryResponse = await fetch(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DevDecisionEngine-Backend',
        },
      },
    );

    if (!repositoryResponse.ok) {
      throw new Error(`GitHub request failed (${repositoryResponse.status})`);
    }

    const repository =
      (await repositoryResponse.json()) as GithubRepositoryResponse;

    if (!repository.default_branch) {
      return true;
    }

    const contentsResponse = await fetch(
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repository}/contents?ref=${encodeURIComponent(repository.default_branch)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DevDecisionEngine-Backend',
        },
      },
    );

    if (contentsResponse.status === 404) {
      return true;
    }

    if (!contentsResponse.ok) {
      throw new Error(`GitHub contents request failed (${contentsResponse.status})`);
    }

    const contents = (await contentsResponse.json()) as
      | GithubContentItem[]
      | GithubContentItem;

    if (!Array.isArray(contents)) {
      return false;
    }

    return contents.length === 0;
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
}
