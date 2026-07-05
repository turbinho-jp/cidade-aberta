/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  // @ts-ignore - serverless.mjs is a generated JS bundle without type declarations
  const mod = await import("../artifacts/api-server/dist/serverless.mjs");
  return mod.default(req, res);
}
import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  // @ts-ignore - serverless.mjs is a generated JS bundle without type declarations
  const mod = await import("../artifacts/api-server/dist/serverless.mjs");
  return mod.default(req, res);
}
