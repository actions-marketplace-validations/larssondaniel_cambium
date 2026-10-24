/**
 * The GitHub port: the four operations Cambium needs from GitHub, with no
 * logic beyond them. The Octokit adapter implements it for real runs and an
 * in-memory fake implements it for tests.
 */

export interface StickyCommentRequest {
  /** Hidden marker that identifies the comment Cambium owns for one schema file. */
  marker: string
  /** Full comment body, marker included. */
  body: string
  /** When false, the zero state: update an existing comment but never create one. */
  createIfMissing: boolean
}

export type StickyCommentResult =
  | 'created'
  | 'updated'
  /** No comment existed and `createIfMissing` was false. */
  | 'none'
  /** GitHub refused the write; on a same-repo PR that means a missing permission. */
  | 'forbidden'

export interface GitHubPort {
  /** The last commit the two shas share. */
  resolveMergeBase(baseSha: string, headSha: string): Promise<string>
  /** File contents at a commit, or `undefined` when the file is absent there. */
  readFile(path: string, sha: string): Promise<string | undefined>
  /** Find the sticky comment by its marker and update it, or create it. */
  upsertStickyComment(
    request: StickyCommentRequest
  ): Promise<StickyCommentResult>
  /** Append markdown to the step's job summary. */
  writeSummary(markdown: string): Promise<void>
}
