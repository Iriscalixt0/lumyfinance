#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const patterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\s*["']?\s*your_service_role_key\s*["']?\s*|.*xxx).+/i,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(?!your_anon_key|.*xxx).+/i,
  /eyJhbGciOiJIUzI1Ni/i,
  /re_(?!xxx\b)[A-Za-z0-9]{10,}/,
];

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter(
    (f) =>
      !f.includes("node_modules") &&
      !f.endsWith("package-lock.json") &&
      f !== "scripts/scan-secrets.mjs"
  );

const findings = [];
for (const file of files) {
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      findings.push({ file, pattern: pattern.toString() });
      break;
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding.file} matched ${finding.pattern}`);
  }
  process.exit(1);
}

console.log("No obvious secrets found.");
