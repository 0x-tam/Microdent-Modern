import { Button } from "@microdent/ui";
import {
  POST_WRITE_LOCAL_COPY_REFRESH_ACTION,
  POST_WRITE_LOCAL_COPY_REFRESH_BODY,
  POST_WRITE_LOCAL_COPY_REFRESH_TITLE,
} from "./read-only-ui-copy.js";

export type PostWriteLocalCopyRefreshState = {
  needed: boolean;
  lastCommitAt: number | null;
};

export function createCleanPostWriteLocalCopyState(): PostWriteLocalCopyRefreshState {
  return { needed: false, lastCommitAt: null };
}

export function markPostWriteLocalCopyRefreshNeeded(
  nowMs = Date.now(),
): PostWriteLocalCopyRefreshState {
  return { needed: true, lastCommitAt: nowMs };
}

export function clearPostWriteLocalCopyRefreshNeeded(): PostWriteLocalCopyRefreshState {
  return createCleanPostWriteLocalCopyState();
}

export type PostWriteLocalCopyRefreshNoticeProps = {
  state: PostWriteLocalCopyRefreshState;
  className?: string;
  onOpenSettings?: () => void;
};

export function PostWriteLocalCopyRefreshNotice({
  state,
  className,
  onOpenSettings,
}: PostWriteLocalCopyRefreshNoticeProps) {
  if (!state.needed) return null;
  return (
    <div
      className={["app-info-callout", "app-post-write-local-copy", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      data-testid="post-write-local-copy-refresh-needed"
    >
      <p className="app-post-write-local-copy__title">
        <strong>{POST_WRITE_LOCAL_COPY_REFRESH_TITLE}</strong>
      </p>
      <p className="app-post-write-local-copy__body">{POST_WRITE_LOCAL_COPY_REFRESH_BODY}</p>
      {onOpenSettings ? (
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="ui-focusable app-post-write-local-copy__action"
          onClick={onOpenSettings}
        >
          {POST_WRITE_LOCAL_COPY_REFRESH_ACTION}
        </Button>
      ) : null}
    </div>
  );
}
