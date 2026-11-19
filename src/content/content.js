async function extractTos() {
  // Search link to the TOS
  const tosLinks = Array.from(document.links).filter(
    (link) =>
      link.href.includes("terms") ||
      link.href.includes("conditions") ||
      link.href.includes("privacy"),
  );
  if (tosLinks.length > 0) {
    try {
      const response = await fetch(tosLinks[0].href);
      if (response.ok) {
        const source = await response.text();
        const page = new DOMParser().parseFromString(source, "text/html");
        page
          .querySelectorAll("script, style, template, noscript")
          .forEach((node) => node.remove());
        const body = page.querySelector("main, article") ?? page.body;
        const text = extractTextFromPage(body) || body.textContent.trim();
        if (text) return text;
      }
    } catch {
      // Fall back to the current page if the linked terms are unavailable.
    }
  }

  // Extract text from the page
  return extractTextFromPage();
}

function extractTextFromPage(page = document) {
  const paragraphs = Array.from(page.querySelectorAll("p, li, h1, h2, h3"));
  return paragraphs.map((p) => p.textContent).join("\n");
}

// Hear messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "extractTos") {
    return;
  }

  extractTos().then(
    (text) => sendResponse({ text }),
    (error) => sendResponse({ error: error.message }),
  );
  return true;
});
