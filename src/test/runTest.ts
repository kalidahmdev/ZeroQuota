import * as path from "path";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
    const vscodeExecutablePath = await downloadAndUnzipVSCode("1.90.0");
    const extensionTestsPath = path.resolve(__dirname, "./suite/");
    await runTests({
      extensionDevelopmentPath,
      vscodeExecutablePath,
      extensionTestsPath,
      launchArgs: [],
    });
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

main();
