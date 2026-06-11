import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readdir, readFile, writeFile, mkdir, rm } from "fs/promises";
import { join, relative } from "path";

const app = new Hono();

app.use("*", async (c, next) => {
  const queryRoot = c.req.query("root");
  c.set("root", queryRoot ?? process.env.WORKSPACE ?? process.cwd());
  await next();
});

// Recursively list files
async function listFiles(dir: string, currentRoot: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listFiles(full, currentRoot)));
    else files.push(relative(currentRoot, full));
  }
  return files;
}

app.get("/api/files", async (c) => {
  const currentRoot = c.get("root");
  const files = await listFiles(currentRoot, currentRoot);
  return c.json(files);
});

app.get("/api/file", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.text("missing path", 400);
  const currentRoot = c.get("root");
  const content = await readFile(join(currentRoot, path), "utf-8");
  return c.text(content);
});

app.post("/api/file", async (c) => {
  const { path, content } = await c.req.json();
  if (!path) return c.text("missing path", 400);
  const currentRoot = c.get("root");
  await writeFile(join(currentRoot, path), content ?? "", "utf-8");
  return c.text("ok");
});

app.post("/api/mkdir", async (c) => {
  const { path } = await c.req.json();
  if (!path) return c.text("missing path", 400);
  const currentRoot = c.get("root");
  await mkdir(join(currentRoot, path), { recursive: true });
  return c.text("ok");
});

app.delete("/api/file", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.text("missing path", 400);
  const currentRoot = c.get("root");
  await rm(join(currentRoot, path), { recursive: true, force: true });
  return c.text("ok");
});

app.get("/api/root", (c) => {
  return c.text(c.get("root"));
});

app.use("/*", serveStatic({ root: "./src" }));

const port = Number(process.env.PORT ?? 4242);
console.log(`🚀 Web IDE running at http://localhost:${port}`);

console.log(`💻 Start terminal: bunx @zuppif/termx -p 7681`);

export default { port, fetch: app.fetch };
