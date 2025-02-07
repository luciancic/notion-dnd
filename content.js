let isDNDEnabled = false;
let titleObserver = null;
let styleObserver = null;
let latestNotificationCount = 0;
let timerHandle = null;

// Timer management
function scheduleTimerCheck(endTime) {
  if (timerHandle) clearTimeout(timerHandle);

  const remaining = endTime - Date.now();
  if (remaining <= 0) return handleTimerEnd();

  isDNDEnabled = true;
  toggleNotifications(true);
  timerHandle = setTimeout(() => handleTimerEnd(), remaining);
}

async function handleTimerEnd() {
  if (timerHandle) clearTimeout(timerHandle);

  chrome.storage.local.remove("notionDndEndTime");
  isDNDEnabled = false;
  toggleNotifications(false);
}

function initialCheck() {
  chrome.storage.local.get(["notionDndEndTime"], (result) => {
    console.log("NotionDND - Initial timer check:", result.notionDndEndTime);
    if (result.notionDndEndTime) {
      scheduleTimerCheck(result.notionDndEndTime);
    }
  });
}

// Run initial check when script loads
initialCheck();
setupInboxBadgeObserver();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log("NotionDND - Storage changed:", changes, namespace);
  if (namespace === "local" && changes.notionDndEndTime) {
    const endTime = changes.notionDndEndTime.newValue;
    if (endTime) {
      scheduleTimerCheck(endTime);
    } else {
      handleTimerEnd();
    }
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "toggleDND":
      isDNDEnabled = !isDNDEnabled;
      toggleNotifications(isDNDEnabled);
      break;
    case "disableDND":
      isDNDEnabled = false;
      toggleNotifications(false);
      break;
    case "enableDND":
      isDNDEnabled = true;
      toggleNotifications(true);
      break;
    default:
      console.warn("Unknown action:", request.action);
  }
});

function cleanupNotificationCountFromTitle() {
  // re-write this function
  const title = document.title;
  const notificationCount = extractNotificationCount(title);
  console.log("NotionDND - Notification count:", notificationCount);
  if (notificationCount) {
    console.log("NotionDND - Cleaning title:", title);
    latestNotificationCount = notificationCount;
    document.title = title.replace(/^\(\d+\)\s*/, "");
  }
}

function extractNotificationCount(title) {
  const match = title.match(/^\(\d+\)\s*/);
  return match ? parseInt(match[0].replace(/[()]/g, "")) : 0;
}

function restoreTitle() {
  const doesTitleAlreadyContainNotificationCount =
    document.title.match(/^\(\d+\)\s*/);
  if (latestNotificationCount && !doesTitleAlreadyContainNotificationCount) {
    console.log("NotionDND - Restoring title:", latestNotificationCount);
    document.title = `(${latestNotificationCount}) ${document.title}`;
  }
}

function setupTitleObserver() {
  if (titleObserver) return;

  console.log("NotionDND - Setting up title observer");
  titleObserver = new MutationObserver(() => {
    console.log("NotionDND - Title changed:", document.title);
    cleanupNotificationCountFromTitle();
  });

  titleObserver.observe(document.querySelector("title"), {
    subtree: true,
    characterData: true,
    childList: true,
  });
}

function applyDNDStyle() {
  console.log("NotionDND - Applying DND style");
  const style = document.createElement("style");
  style.id = "notion-dnd-style";
  style.textContent = `
    .notion-record-icon + div[style*="background-color"] { 
      display: none !important; 
    }

    #notion-inbox-badge {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeDNDStyle() {
  console.log(
    "NotionDND - Removing DND style, styleObserver is:",
    styleObserver ? "connected" : "disconnected"
  );
  document.getElementById("notion-dnd-style")?.remove();
}

function setupDNDStyleObserver() {
  if (styleObserver) return;

  console.log("NotionDND - Setting up DND style observer");
  styleObserver = new MutationObserver(() => {
    if (isDNDEnabled && !document.getElementById("notion-dnd-style")) {
      applyDNDStyle();
    }
  }).observe(document.head, { childList: true });
}

const cleanup = () => {
  console.log("NotionDND - Starting cleanup");
  titleObserver?.disconnect();
  styleObserver?.disconnect();
  console.log("NotionDND - Observers disconnected");
  titleObserver = styleObserver = null;
  removeDNDStyle();
  restoreTitle();
};

function toggleNotifications(hide) {
  if (hide) {
    console.log("NotionDND - Toggling notifications on");
    applyDNDStyle();
    setupDNDStyleObserver();
    cleanupNotificationCountFromTitle();
    setupTitleObserver();
  } else {
    console.log("NotionDND - Toggling notifications off");
    cleanup();
  }
}

function setupInboxBadgeObserver() {
  console.log("NotionDND - Setting up inbox badge observer");
  const observer = new MutationObserver(() => {
    const inboxBadge = selectInboxBadge();
    if (inboxBadge) {
      console.log("NotionDND - Found inbox badge, setting id");
      inboxBadge.id = "notion-inbox-badge";
      if (isDNDEnabled) {
        applyDNDStyle();
      }
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function selectInboxBadge() {
  const inboxDiv = document.querySelector(".newSidebarInbox");
  const badgeElement = inboxDiv?.parentElement?.parentElement?.childNodes?.[2];
  console.log("NotionDND - Badge:", badgeElement);
  return badgeElement;
}
