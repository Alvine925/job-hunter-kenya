// Vercel Serverless Function — wraps the TanStack Start SSR handler
// This bridges the Cloudflare Worker "fetch" export to Vercel's (req, res) interface.

import { createServer } from "node:http";
import { Readable } from "node:stream";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // Dynamically import the built server entry
  const serverModule = await import("../dist/server/index.js");
  const server = serverModule.default;

  // The server exports a Cloudflare Worker-style { fetch } handler
  const response = await server.fetch(request, process.env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
  });

  return response;
}
