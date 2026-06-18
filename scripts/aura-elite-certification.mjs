/**
 * Aura Elite Certification — cenário:
 * "Quero vender um produto de emagrecimento nos EUA"
 * Meta: Aura Elite Score >= 90 + reality validation aligned
 */
import { execSync } from "node:child_process";
import {
  AURA_ELITE_TARGET,
  runAuraCertificationRuntime,
} from "../utils/aura-certification-runtime.ts";

const ROOT = process.cwd();

const runtime = runAuraCertificationRuntime(ROOT);

const buildChecks = { build: "pending", typecheck: "pending", lint: "pending" };
const checkErrors = [];

for (const [name, cmd] of [
  ["typecheck", "npm run typecheck"],
  ["lint", "npm run lint"],
  ["build", "npm run build"],
]) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", encoding: "utf8", shell: true });
    buildChecks[name] = "OK";
  } catch (err) {
    buildChecks[name] = "FAIL";
    const execErr = err && typeof err === "object" ? err : null;
    const stderr = execErr && "stderr" in execErr ? String(execErr.stderr ?? "") : "";
    const stdout = execErr && "stdout" in execErr ? String(execErr.stdout ?? "") : "";
    const message = err instanceof Error ? err.message : String(err);
    checkErrors.push({
      check: name,
      error: (stderr || stdout || message).slice(0, 2000),
    });
  }
}

let realityReport = null;
let realityExitCode = 0;
try {
  const realityStdout = execSync("node --import tsx scripts/aura-reality-validation.mjs", {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    shell: true,
  });
  realityReport = JSON.parse(realityStdout);
} catch (err) {
  realityExitCode = typeof err === "object" && err && "status" in err ? Number(err.status) : 1;
  const stdout =
    typeof err === "object" && err && "stdout" in err ? String(err.stdout ?? "") : "";
  try {
    realityReport = stdout ? JSON.parse(stdout) : null;
  } catch {
    realityReport = null;
  }
}

const allChecksOk = Object.values(buildChecks).every((value) => value === "OK");
const realityScore = realityReport?.finalScore ?? 0;
const scoreDelta = Math.abs(runtime.auraEliteScore - realityScore);
const realityAligned =
  realityExitCode === 0 &&
  realityReport?.overallStatus === "PASS" &&
  realityReport?.certified === true &&
  scoreDelta <= 5;

const passCount = runtime.stages.filter((stage) => stage.status === "PASS").length;
const criticalStages = runtime.stages.filter((stage) =>
  ["product_factory", "creative_director", "ads_commander", "commercial_excellence", "master_flow"].includes(
    stage.id
  )
);
const allCriticalPass = criticalStages.every((stage) => stage.score >= 85);

const certified =
  runtime.auraEliteScore >= AURA_ELITE_TARGET &&
  runtime.overallStatus === "PASS" &&
  allChecksOk &&
  realityAligned &&
  allCriticalPass;

const report = {
  certification: "Aura Elite",
  simulation: runtime.simulation,
  timestamp: new Date().toISOString(),
  auraEliteScore: runtime.auraEliteScore,
  realityScore,
  scoreDelta,
  target: AURA_ELITE_TARGET,
  overallStatus: certified ? "PASS" : runtime.overallStatus === "PASS" && !realityAligned ? "PARTIAL" : runtime.overallStatus,
  certified,
  stages: runtime.stages,
  scores: runtime.scores,
  buildChecks,
  checkErrors: checkErrors.length ? checkErrors : undefined,
  pipeline: runtime.pipeline,
  realityChecks: runtime.realityChecks,
  realityValidation: realityReport,
  realityAligned,
  allCriticalPass,
};

console.log(JSON.stringify(report, null, 2));

if (!certified) {
  process.exitCode = 1;
}
