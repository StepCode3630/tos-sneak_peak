function extractTos() {
  // Search link to the TOS
  const tosLinks = Array.from(document.links).filter(
    (link) =>
      link.href.includes("terms") ||
      link.href.includes("conditions") ||
      link.href.includes("privacy"),
  );
  if (tosLinks.length > 0) {
    return fetch(tosLinks[0].href)
      .then((res) => res.text())
      .catch(() => extractTextFromPage());
  }

  // Extract text from the page
  return extractTextFromPage();
}

function extractTextFromPage() {
  const paragraphs = Array.from(document.querySelectorAll("p, li, h1, h2, h3"));
  return paragraphs.map((p) => p.textContent).join("\n");
}

// Hear messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractTos") {
    extractTos().then((text) => sendResponse({ text }));
  }
  return true; // Async
});
