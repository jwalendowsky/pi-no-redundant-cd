// pi-no-redundant-cd: coding agents keep prefixing bash calls with
// `cd <the directory the shell already runs in> &&`, even when told not to.
// The first one in a session is blocked with a one-line reason so the model
// learns; later ones are stripped so they cost no extra round trip.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { makeHandler } from "./rule.ts";

export default function (pi: ExtensionAPI) {
  const handle = makeHandler();
  pi.on("tool_call", async (event: any, ctx: any) => handle(event, ctx.cwd));
}
