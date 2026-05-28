import html2pdf from "html2pdf.js";

interface PdfOptions {
  company?: string;
}

export function downloadResumePdf(printNode: HTMLElement, options: PdfOptions = {}) {
  return html2pdf()
    .set({
      margin: 15,
      filename: `Tailored_Resume_${options.company || "employer"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "letter", orientation: "portrait" as const },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(printNode)
    .save();
}
