chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "extractTos") {
    return;
  }

  requestPageText(request).then(sendResponse, (error) => {
    sendResponse({ error: error.message });
  });

  return true;
});

async function requestPageText(request) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) {
    throw new Error("No active tab found.");
  }

  const target = { frameId: 0 };
  try {
    return await chrome.tabs.sendMessage(tab.id, request, target);
  } catch (error) {
    if (!error.message.includes("Receiving end does not exist")) {
      throw error;
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch {
    throw new Error(
      "Brave blocked access to this tab. Open a regular website and make sure the extension has site access.",
    );
  }

  return chrome.tabs.sendMessage(tab.id, request, target);
}
