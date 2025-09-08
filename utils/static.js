import { join } from "path";

export async function serveStatic(request, publicDir) {
  const url = new URL(request.url);
  const filePath = join(
    publicDir,
    url.pathname === "/" ? "index.html" : url.pathname
  );

  if (Bun.file(filePath).exists) {
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": getContentType(filePath),
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

function getContentType(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const types = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return types[ext] || "text/plain";
}
