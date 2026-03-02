import { spawn } from "node:child_process";
import net from "node:net";

const HOST = process.env.SMOKE_HOST ?? "127.0.0.1";
const SHOULD_BUILD = process.env.SMOKE_SKIP_BUILD !== "1";
const START_TIMEOUT_MS = 30000;
const BASE_PORT = Number(process.env.SMOKE_PORT ?? 3100);

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnCmd(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "pipe",
    ...options,
  });
}

function streamProcess(prefix, child) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${prefix}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${prefix}] ${chunk}`));
}

async function runNpmTask(args) {
  return new Promise((resolve, reject) => {
    const child = spawnCmd(npmBin, args);
    streamProcess(args.join(" "), child);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: npm ${args.join(" ")} (exit ${code ?? "null"})`));
    });
  });
}

async function waitForServer(port) {
  const baseUrl = `http://${HOST}:${port}`;
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/pt-BR/login`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // ignore while server boots
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for server at ${baseUrl}`);
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function pickPort(startPort) {
  for (let i = 0; i < 30; i += 1) {
    const port = startPort + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found from ${startPort} to ${startPort + 29}`);
}

async function check(name, input, expected) {
  let status = -1;
  let location = "";
  let ok = false;
  let error = "";
  let bodySnippet = "";

  try {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      headers: input.headers,
      body: input.body,
      redirect: "manual",
    });
    status = res.status;
    location = res.headers.get("location") ?? "";
    ok = expected(status);
    if (!ok) {
      try {
        const body = await res.text();
        bodySnippet = body.replace(/\s+/g, " ").trim().slice(0, 220);
      } catch {
        // ignore body parsing errors
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    ok = false;
  }

  return { name, status, location, ok, error, bodySnippet };
}

function printResults(results) {
  console.log("\nSmoke results:");
  for (const result of results) {
    const statusPart = result.status >= 0 ? String(result.status) : "ERR";
    const locationPart = result.location ? ` location=${result.location}` : "";
    const errorPart = result.error ? ` error=${result.error}` : "";
    const bodyPart = result.bodySnippet ? ` body="${result.bodySnippet}"` : "";
    const flag = result.ok ? "PASS" : "FAIL";
    console.log(`${flag} ${result.name} -> ${statusPart}${locationPart}${errorPart}${bodyPart}`);
  }
}

async function main() {
  const PORT = await pickPort(BASE_PORT);
  const BASE_URL = `http://${HOST}:${PORT}`;

  if (SHOULD_BUILD) {
    console.log("Running production build...");
    await runNpmTask(["run", "build"]);
  }

  console.log(`Starting Next.js on ${BASE_URL}...`);
  const server = spawnCmd(npmBin, ["run", "start", "--", "-p", String(PORT), "-H", HOST]);
  streamProcess("start", server);

  let serverExitCode = null;
  server.on("close", (code) => {
    serverExitCode = code;
  });

  try {
    await waitForServer(PORT);
    if (serverExitCode !== null) {
      throw new Error(`Server exited before checks (exit ${serverExitCode}).`);
    }

    const results = [];
    results.push(
      await check(
        "pt-BR login page",
        { url: `${BASE_URL}/pt-BR/login` },
        (s) => s >= 200 && s < 400 && s !== 404 && s < 500,
      ),
    );
    results.push(
      await check(
        "en login page",
        { url: `${BASE_URL}/en/login` },
        (s) => s >= 200 && s < 400 && s !== 404 && s < 500,
      ),
    );
    results.push(
      await check(
        "pt-BR dashboard route",
        { url: `${BASE_URL}/pt-BR/dashboard` },
        (s) => s === 200 || (s >= 300 && s < 400),
      ),
    );
    results.push(
      await check(
        "en dashboard route",
        { url: `${BASE_URL}/en/dashboard` },
        (s) => s === 200 || (s >= 300 && s < 400),
      ),
    );
    results.push(
      await check(
        "cobrancas export route",
        { url: `${BASE_URL}/api/cobrancas/export-csv` },
        (s) => s !== 404 && s < 500,
      ),
    );
    results.push(
      await check(
        "set-workspace route",
        {
          url: `${BASE_URL}/api/set-workspace`,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        (s) => s !== 404 && s < 500,
      ),
    );

    printResults(results);

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
      throw new Error(`${failed.length} smoke check(s) failed.`);
    }

    console.log("\nSmoke routing check passed.");
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(`\nSmoke routing check failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
