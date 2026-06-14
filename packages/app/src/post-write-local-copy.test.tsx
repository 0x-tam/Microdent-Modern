// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PostWriteLocalCopyRefreshNotice,
  clearPostWriteLocalCopyRefreshNeeded,
  createCleanPostWriteLocalCopyState,
  markPostWriteLocalCopyRefreshNeeded,
} from "./post-write-local-copy.js";

describe("post-write local copy refresh state", () => {
  it("starts clean, marks sandbox commit risk, and clears after local copy refresh", () => {
    expect(createCleanPostWriteLocalCopyState()).toEqual({ needed: false, lastCommitAt: null });
    expect(markPostWriteLocalCopyRefreshNeeded(1234)).toEqual({ needed: true, lastCommitAt: 1234 });
    expect(clearPostWriteLocalCopyRefreshNeeded()).toEqual({ needed: false, lastCommitAt: null });
  });

  it("renders a polite status notice only when write success may leave the local copy stale", () => {
    const clean = renderToStaticMarkup(
      <PostWriteLocalCopyRefreshNotice state={createCleanPostWriteLocalCopyState()} />,
    );
    expect(clean).toBe("");

    const html = renderToStaticMarkup(
      <PostWriteLocalCopyRefreshNotice
        state={markPostWriteLocalCopyRefreshNeeded(1234)}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Local copy may need refresh");
    expect(html).toContain("A sandbox commit succeeded");
    expect(html).toContain("Open Settings");
  });
});
