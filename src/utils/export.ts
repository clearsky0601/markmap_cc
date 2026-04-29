// Collect all <style> text that is relevant to the markmap SVG
function collectStyles(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules ?? []);
      parts.push(rules.map((r) => r.cssText).join("\n"));
    } catch {
      // cross-origin stylesheet — skip
    }
  }
  return parts.join("\n");
}

export function exportSVG(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Inject computed CSS so the standalone SVG renders correctly
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = collectStyles();
  clone.insertBefore(style, clone.firstChild);

  // Remove interaction-only attributes
  clone.removeAttribute("tabindex");
  clone
    .querySelectorAll("[data-selected],[data-editing],[data-droptarget]")
    .forEach((el) => {
      el.removeAttribute("data-selected");
      el.removeAttribute("data-editing");
      el.removeAttribute("data-droptarget");
    });

  const box = svg.getBoundingClientRect();
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

export async function exportPNG(
  svg: SVGSVGElement,
  filename: string,
  scale = 2,
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = collectStyles();
  clone.insertBefore(style, clone.firstChild);
  clone
    .querySelectorAll("[data-selected],[data-editing],[data-droptarget]")
    .forEach((el) => {
      el.removeAttribute("data-selected");
      el.removeAttribute("data-editing");
      el.removeAttribute("data-droptarget");
    });

  const box = svg.getBoundingClientRect();
  const w = Math.round(box.width);
  const h = Math.round(box.height);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;

      // Fill background matching current theme
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      ctx.fillStyle = bg || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("canvas.toBlob returned null"));
        triggerDownload(blob, filename);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image load failed"));
    };
    img.src = url;
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
