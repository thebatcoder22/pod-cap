import type { Viewer } from "./viewer";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Allowlisted leads edit their own pod only. Being admin grants no extra pod edit rights. */
export function assertCanEditPod(viewer: Viewer | null, podId: number): asserts viewer is Viewer {
  if (!viewer?.canEdit || viewer.pod?.id !== podId) throw new ForbiddenError("You can only edit your own pod.");
}

export function assertAdmin(viewer: Viewer | null): asserts viewer is Viewer {
  if (!viewer?.isAdmin) throw new ForbiddenError("Only the admin can do that.");
}
