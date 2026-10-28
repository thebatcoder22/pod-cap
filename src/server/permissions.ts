import type { Viewer } from "./viewer";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Allowlisted leads edit their own pods only. Being admin grants no extra pod edit rights. Given several pods, as for
 * a person who is in two, being in any of them is enough.
 */
export function assertCanEditPod(viewer: Viewer | null, ...podIds: number[]): asserts viewer is Viewer {
  if (!viewer?.canEdit || !viewer.pods.some((p) => podIds.includes(p.id)))
    throw new ForbiddenError("You can only edit your own pod.");
}

export function assertAdmin(viewer: Viewer | null): asserts viewer is Viewer {
  if (!viewer?.isAdmin) throw new ForbiddenError("Only the admin can do that.");
}
