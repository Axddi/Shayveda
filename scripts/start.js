const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const requestedFrontendPort = Number(process.env.FRONTEND_PORT || 8080);
const backendPort = Number(process.env.PORT || 5000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function proxyApiRequest(request, response) {
  const proxyRequest = http.request(
    {
      hostname: "localhost",
      port: backendPort,
      path: request.url,
      method: request.method,
      headers: {
        ...request.headers,
        host: `localhost:${backendPort}`,
      },
    },
    (proxyResponse) => {
      response.writeHead(
        proxyResponse.statusCode || 500,
        proxyResponse.headers
      );

      proxyResponse.pipe(response);
    }
  );

  proxyRequest.on("error", () => {
    response.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(
      JSON.stringify({
        message:
          "Backend unavailable. Start the backend server and try again.",
      })
    );
  });

  request.pipe(proxyRequest);
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
    });
    response.end(content);
  });
}

function createFrontendServer(frontendPort) {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://localhost:${frontendPort}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      proxyApiRequest(request, response);
      return;
    }

    const safePath = path
      .normalize(pathname)
      .replace(/^(\.\.[/\\])+/, "");

    let filePath = path.join(rootDir, safePath);

    if (pathname === "/" || pathname.endsWith("/")) {
      filePath = path.join(rootDir, "index.html");
    }

    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    sendFile(response, filePath);
  });
}

let backend = null;

function backendHealthCheck() {
  return new Promise((resolve) => {
    const request = http.get(
      `http://localhost:${backendPort}/`,
      (response) => {
        response.resume();
        resolve(response.statusCode && response.statusCode < 500);
      }
    );

    request.on("error", () => {
      resolve(false);
    });

    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  if (await backendHealthCheck()) {
    console.log(`Backend already running at http://localhost:${backendPort}`);
    return;
  }

  backend = spawn("node", ["server.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(backendPort),
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  backend.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Backend exited with code ${code}`);
    }
  });
}

let frontend = null;

function listenFrontend(port, attemptsLeft = 10) {
  frontend = createFrontendServer(port);

  frontend.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      frontend.close();
      listenFrontend(port + 1, attemptsLeft - 1);
      return;
    }

    console.error(error.message);
    shutdown();
    process.exit(1);
  });

  frontend.listen(port, () => {
    console.log(`Frontend running at http://localhost:${port}`);
    console.log(`Backend expected at http://localhost:${backendPort}`);
  });
}

listenFrontend(requestedFrontendPort);
startBackend();

function shutdown() {
  if (frontend) {
    frontend.close();
  }

  if (backend && !backend.killed) {
    backend.kill();
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
