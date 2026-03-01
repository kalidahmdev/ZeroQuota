const vscode = acquireVsCodeApi();

function sendMessage(type, data = {}) {
  vscode.postMessage({ type, ...data });
}

function handleAction(action) {
  sendMessage("recoveryAction", { action });
}

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "updateStatus":
      updateUI(message.status);
      break;
  }
});

function updateUI(status) {
  if (!status) return;

  // Update credits (subtle bars)
  const promptPct =
    (status.availablePromptCredits / status.promptCredits) * 100;
  const flowPct = (status.availableFlowCredits / status.flowCredits) * 100;

  document.getElementById("prompt-bar").style.width = `${promptPct}%`;
  document.getElementById("prompt-text").textContent =
    `${status.availablePromptCredits}/${Math.round(status.promptCredits / 1000)}k`;

  document.getElementById("flow-bar").style.width = `${flowPct}%`;
  document.getElementById("flow-text").textContent =
    `${status.availableFlowCredits}/${Math.round(status.flowCredits / 1000)}k`;

  // Update models with Semi-Arc Gauges
  const grid = document.getElementById("model-grid");
  grid.innerHTML = "";

  // Limits to top 3 models for the "ring" layout to match screenshot
  status.modelConfigs.slice(0, 3).forEach((m) => {
    if (!m.quotaInfo) return;

    const pct = m.quotaInfo.remainingFraction;
    const pctDisplay = Math.round(pct * 100);
    const color = pct >= 0.4 ? "#4ECB71" : pct >= 0.2 ? "#FFD700" : "#FF4D4D";

    // Circumference of semi-circle (r=32): 100
    const dashOffset = 100 - pct * 100;

    const container = document.createElement("div");
    container.className = "gauge-container";
    container.innerHTML = `
            <div class="gauge">
                <svg class="gauge-svg" viewBox="0 0 80 80">
                    <path class="gauge-bg" d="M 10 40 A 30 30 0 0 1 70 40" stroke="#333" fill="none" />
                    <path class="gauge-fill" d="M 10 40 A 30 30 0 0 1 70 40" 
                        stroke="${color}" 
                        stroke-dasharray="100 100" 
                        stroke-dashoffset="${dashOffset}" 
                        fill="none" />
                </svg>
                <div class="gauge-text">${pctDisplay}%</div>
            </div>
            <div class="model-label">${m.label.replace("Gemini ", "")}</div>
            <div class="reset-timer">${formatResetTime(m.quotaInfo.resetTime)}</div>
        `;
    grid.appendChild(container);
  });
}

function formatResetTime(resetStr) {
  if (!resetStr) return "";
  try {
    const resetDate = new Date(resetStr);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    if (diffMs <= 0) return "Ready";

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  } catch (e) {
    return "";
  }
}
