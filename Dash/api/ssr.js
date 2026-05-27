// Vercel Serverless Function (Node.js runtime)
// This wraps the Cloudflare Worker-style "fetch" handler and handles the Node-to-Web API translation.

export default async function handler(req, res) {
  try {
    // 1. Dynamically import the built server entry
    const serverModule = await import("../dist/server/index.js");
    const server = serverModule.default;

    // 2. Construct the absolute URL
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // 3. Build headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    // 4. Gather request body if applicable
    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    // 5. Create Web standard Request
    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    // 6. Call the standard fetch handler
    const webResponse = await server.fetch(webRequest, process.env, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });

    // 7. Write status and headers back to res
    res.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // 8. Stream the Web standard response body back to Node's res
    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    console.error("SSR Handler Error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Internal Server Error");
  }
}
