// Typed messages between content scripts, the popup, and the service
// worker. No `tabs`/`webRequest` permission, so the popup asks the content
// script for the hostname by message instead. SPEC.md §3, §6.2.
//
// TODO(build order step 6): flesh out as popup/options/background are built.

import type { VideoState } from "../content/video-registry";

export interface GetStatusRequest {
  type: "flashguard:get-status";
}

export interface StatusResponse {
  hostname: string;
  videosByState: Record<VideoState, number>;
}

export type FlashGuardMessage = GetStatusRequest;

export function isFlashGuardMessage(value: unknown): value is FlashGuardMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string" &&
    (value as { type: string }).type.startsWith("flashguard:")
  );
}
