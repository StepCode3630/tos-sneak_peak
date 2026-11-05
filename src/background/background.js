chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "extractTos") {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }

    if (!tabs[0]?.id) {
      sendResponse({ error: "No active tab found." });
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse(response);
    });
  });

  return true;
});
