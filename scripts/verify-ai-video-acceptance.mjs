import { pathToFileURL } from 'node:url';

import { runVideoPlatformVerification } from './verify-video-platform.mjs';
import { runVideoRendererReconciliationDryRun } from './verify-video-renderer-reconciliation-dry-run.mjs';
import { runVideoWorkbenchPilotVerification } from './verify-video-workbench-pilot.mjs';

/**
 * The default AI-video gate is deliberately provider-free. It validates the
 * contracts, state transitions, recovery behavior, and billing invariants
 * without creating a paid generation request or touching a user wallet.
 */
export async function runAiVideoAcceptance({
  platform = () => runVideoPlatformVerification({ local: true, noPaidGeneration: true, database: ':memory:' }),
  renderer = () => runVideoRendererReconciliationDryRun(),
  workbench = () => runVideoWorkbenchPilotVerification(),
} = {}) {
  const platformReport = await platform();
  const rendererReport = await renderer();
  const workbenchReport = await workbench();
  const providerSubmissions = [platformReport, rendererReport, workbenchReport]
    .reduce((total, report) => total + Number(report?.providerSubmissions || report?.providerCalls || 0), 0);
  const billingMutated = [platformReport, rendererReport, workbenchReport]
    .some(report => report?.billingMutated === true || report?.billingMutation === true);
  const paidGenerationRequested = [platformReport, rendererReport, workbenchReport]
    .some(report => report?.paidGenerationRequested === true);
  const ok = platformReport?.ok !== false
    && rendererReport?.ok !== false
    && workbenchReport?.ok !== false
    && providerSubmissions === 0
    && !billingMutated
    && !paidGenerationRequested;
  return {
    ok,
    profile: 'local-no-paid-generation',
    providerSubmissions,
    billingMutated,
    paidGenerationRequested,
    stages: { platform: platformReport, renderer: rendererReport, workbench: workbenchReport },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const report = await runAiVideoAcceptance();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
