import { spawn } from "node:child_process";

const env = { ...process.env, ATHENE_API_PORT: "8788", ATHENE_ADMIN_TOKEN: "athene-e2e-admin-token" };
const api = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { cwd: process.cwd(), env, stdio: "inherit" });
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173"], { cwd: process.cwd(), env, stdio: "inherit" });

const stop = () => { api.kill(); web.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", (code) => { web.kill(); process.exit(code ?? 1); });
web.on("exit", (code) => { api.kill(); process.exit(code ?? 1); });
