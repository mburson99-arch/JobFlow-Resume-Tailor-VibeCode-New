console.log("[JobFlow Scraper] Content script loaded:", window.location.href);

const isJobFlowPage = window.location.href.includes("localhost:3000") || window.location.href.includes("127.0.0.1:3000");

function text(selector) {
  return document.querySelector(selector)?.innerText?.trim() || "";
}

function meta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim()
    || document.querySelector(`meta[property="${name}"]`)?.getAttribute("content")?.trim()
    || "";
}

function getJsonLdJob() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const job = entries.find((entry) => entry && (entry["@type"] === "JobPosting" || entry.title || entry.hiringOrganization));
      if (job) return job;
    } catch (_) {}
  }
  return null;
}

function clean(value, fallback) {
  return String(value || fallback || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+job post$/i, "")
    .trim();
}

function extractJobContent() {
  const url = window.location.href;
  const jsonLd = getJsonLdJob();

  let title = clean(
    jsonLd?.title
      || text("h1.jobsearch-JobInfoHeader-title")
      || text("[data-testid='jobsearch-JobInfoHeader-title']")
      || text("[class*='JobInfoHeader-title']")
      || text(".job-details-jobs-unified-top-card__job-title")
      || text(".jobs-unified-top-card__job-title")
      || text("h1")
      || meta("og:title"),
    "Unknown Job Title"
  );

  let company = clean(
    jsonLd?.hiringOrganization?.name
      || text("[data-testid='inlineHeader-companyName']")
      || text("div[data-company-name='true'] a")
      || text(".jobsearch-InlineCompanyRating div")
      || text(".jobsearch-CompanyInfoContainer")
      || text(".job-details-jobs-unified-top-card__company-name")
      || text(".jobs-unified-top-card__company-name")
      || meta("og:site_name"),
    "Unknown Company"
  );

  let description = clean(
    jsonLd?.description
      || text("#jobDescriptionText")
      || text(".jobsearch-JobComponent-description")
      || text(".jobs-description__content")
      || text("#job-details")
      || text("main"),
    ""
  );

  if (title.toLowerCase().includes(company.toLowerCase())) {
    title = clean(title.replace(company, ""), title);
  }

  return {
    title,
    company,
    url,
    description,
    date: new Date().toISOString()
  };
}

function syncToWorkspace(jobData) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "syncToWorkspace", data: jobData },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: "No response from extension background worker." });
      }
    );
  });
}

function injectFloatingButton() {
  if (isJobFlowPage || !document.body || document.getElementById("jobflow-scrape-btn")) return;

  const btn = document.createElement("button");
  btn.id = "jobflow-scrape-btn";
  btn.type = "button";
  btn.innerText = "Sync to JobFlow";
  btn.style.cssText = [
    "position:fixed",
    "bottom:30px",
    "right:30px",
    "z-index:2147483647",
    "background:#2563eb",
    "color:white",
    "border:3px solid white",
    "border-radius:12px",
    "padding:14px 22px",
    "font:700 15px system-ui,-apple-system,Segoe UI,sans-serif",
    "box-shadow:0 10px 30px rgba(0,0,0,.45)",
    "cursor:pointer"
  ].join(";");

  btn.addEventListener("click", async () => {
    btn.innerText = "Scraping...";
    btn.disabled = true;

    try {
      const data = extractJobContent();
      if (!data.title || data.title === "Unknown Job Title" || !data.company || data.company === "Unknown Company") {
        throw new Error(`Could not read this job page. Got title="${data.title}", company="${data.company}".`);
      }

      const result = await syncToWorkspace(data);
      if (result && result.success) {
        alert(`Captured into JobFlow:\n${data.title}\n${data.company}`);
      } else {
        alert(`JobFlow sync failed:\n${result?.error || "Unknown extension error"}`);
      }
    } catch (error) {
      alert(`JobFlow scrape failed:\n${error && error.message ? error.message : String(error)}`);
    } finally {
      btn.innerText = "Sync to JobFlow";
      btn.disabled = false;
    }
  });

  document.body.appendChild(btn);
}

setTimeout(injectFloatingButton, 1000);
setTimeout(injectFloatingButton, 3000);
setInterval(injectFloatingButton, 5000);
