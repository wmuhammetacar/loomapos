const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const esbuild = require("esbuild");

const rootDir = path.resolve(__dirname, "..");
const rendererDir = path.join(rootDir, "src", "renderer");
const outDir = path.join(rootDir, "dist", "renderer");
const watchMode = process.argv.includes("--watch");
const tailwindCli = path.join(rootDir, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");

const copyStaticFiles = () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(path.join(rendererDir, "index.html"), path.join(outDir, "index.html"));
};

const buildStyles = () => {
  execFileSync(process.execPath, [
    tailwindCli,
    "-i",
    path.join(rendererDir, "styles.css"),
    "-o",
    path.join(outDir, "styles.css")
  ], {
    cwd: rootDir,
    stdio: "inherit"
  });
};

const buildOptions = {
  entryPoints: [path.join(rendererDir, "main.tsx")],
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  target: ["chrome120"],
  outfile: path.join(outDir, "app.js"),
  sourcemap: true,
  logLevel: "info"
};

async function run() {
  copyStaticFiles();
  buildStyles();

  if (!watchMode) {
    await esbuild.build(buildOptions);
    return;
  }

  const tailwindWatcher = spawn(process.execPath, [
    tailwindCli,
    "-i",
    path.join(rendererDir, "styles.css"),
    "-o",
    path.join(outDir, "styles.css"),
    "--watch"
  ], {
    cwd: rootDir,
    stdio: "inherit"
  });

  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  fs.watch(rendererDir, { recursive: true }, () => {
    copyStaticFiles();
  });

  const shutdown = () => {
    tailwindWatcher.kill();
  };
  process.on("exit", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
