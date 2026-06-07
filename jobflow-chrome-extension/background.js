const JOBFLOW_TARGETS = [
  "http://localhost:3000/api/jobs/scrape",
  "http://127.0.0.1:3000/api/jobs/scrape"
];

async function postToJobFlow(jobData) {
  let lastError = "";

  for (const targetUrl of JOBFLOW_TARGETS) {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData)
      });

      const body = await response.text();
      if (response.ok) {
        return { success: true, targetUrl, body };
      }

      lastError = `${targetUrl} returned ${response.status}: ${body}`;
    } catch (error) {
      lastError = `${targetUrl} failed: ${error && error.message ? error.message : String(error)}`;
    }
  }

  return { success: false, error: lastError || "Could not reach JobFlow local API." };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || request.action !== "syncToWorkspace") return false;

  postToJobFlow(request.data)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({
      success: false,
      error: error && error.message ? error.message : String(error)
    }));

  return true;
});
