document.addEventListener("DOMContentLoaded", () => {
  // Set default to 1 hour
  document.getElementById("hours").value = "1";
  // Autofocus hours input
  document.getElementById("hours").focus();
});

// Add enter key listener for inputs
document.querySelectorAll("#time-input input").forEach((input) => {
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("startTimer").click();
    }
  });
});

function formatTime(ms) {
  if (ms <= 0) return "";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return `Time left: ${parts.join(" ")}`;
}

function updateUI(isDNDActive) {
  const startButton = document.getElementById("startTimer");
  const stopButton = document.getElementById("stopTimer");
  const timeInputs = document.getElementById("time-input");

  startButton.hidden = isDNDActive;
  stopButton.hidden = !isDNDActive;
  timeInputs.style.display = isDNDActive ? "none" : "flex";
}

let timerHandle = null;
let updateHandle = null;

function scheduleTimerCheck(endTime) {
  if (timerHandle) clearTimeout(timerHandle);
  if (updateHandle) clearInterval(updateHandle);

  const remaining = endTime - Date.now();
  if (remaining <= 0) return handleTimerEnd();

  updateUI(true);
  updateTimerText(endTime);

  updateHandle = setInterval(() => updateTimerText(endTime), 1000);
  timerHandle = setTimeout(() => handleTimerEnd(), remaining);
}

function updateTimerText(endTime) {
  const remaining = endTime - Date.now();
  document.getElementById("timeLeft").textContent = formatTime(remaining);
}

async function handleTimerEnd() {
  if (updateHandle) clearInterval(updateHandle);
  if (timerHandle) clearTimeout(timerHandle);

  chrome.storage.local.remove("notionDndEndTime");
  updateUI(false);
  document.getElementById("timeLeft").textContent = "";
}

// Initial check and storage change listener
chrome.storage.local.get(["notionDndEndTime"], (result) => {
  if (result.notionDndEndTime) {
    scheduleTimerCheck(result.notionDndEndTime);
  } else {
    updateUI(false);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.notionDndEndTime) {
    const endTime = changes.notionDndEndTime.newValue;
    if (endTime) {
      scheduleTimerCheck(endTime);
    } else {
      handleTimerEnd();
    }
  }
});

document.getElementById("startTimer").addEventListener("click", async () => {
  const hours = Math.max(
    0,
    parseInt(document.getElementById("hours").value) || 0
  );
  const minutes = Math.max(
    0,
    parseInt(document.getElementById("minutes").value) || 0
  );
  const seconds = Math.max(
    0,
    parseInt(document.getElementById("seconds").value) || 0
  );
  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

  // If no time entered, default to 1 hour
  if (totalMs === 0) {
    document.getElementById("hours").value = "1";
    return document.getElementById("startTimer").click();
  }

  const endTime = Date.now() + totalMs;
  await chrome.storage.local.set({ notionDndEndTime: endTime });

  document.getElementById("hours").value = "1";
  document.getElementById("minutes").value = "";
  document.getElementById("seconds").value = "";
});

document.getElementById("stopTimer").addEventListener("click", () => {
  chrome.storage.local.remove("notionDndEndTime");
});
