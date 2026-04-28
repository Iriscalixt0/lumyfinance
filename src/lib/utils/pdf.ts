import jsPDF from "jspdf";

/**
 * Generate and download a PDF report from tabular data.
 */
export function downloadPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: string[][],
  subtitle?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  y += 8;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(subtitle, 14, y);
    doc.setTextColor(0);
    y += 8;
  }

  y += 4;

  // Table header
  const colWidth = (pageWidth - 28) / headers.length;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 4, pageWidth - 28, 8, "F");

  headers.forEach((h, i) => {
    doc.text(h, 14 + i * colWidth, y);
  });
  y += 8;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  rows.forEach((row) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    row.forEach((cell, i) => {
      const text = cell.length > 25 ? cell.slice(0, 22) + "..." : cell;
      doc.text(text, 14 + i * colWidth, y);
    });
    y += 6;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Lumy — Gerado em ${new Date().toLocaleDateString("pt-BR")} — Página ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  doc.save(filename);
}
