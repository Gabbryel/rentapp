"use client";

import Image from "next/image";

export default function ScanViewer({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const isApi = /^\/api\/uploads\//i.test(url);
  const isPdf = /\.pdf(?:$|[?#])/i.test(url);
  if (isApi || isPdf) {
    // iOS Safari often shows only the first page or wrong scaling in iframes.
    // Prefer <embed> on iOS and use a responsive fixed-height container so the
    // PDF can scroll internally and fits page width.
    const isIOS = (() => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      const maxTouchPoints =
        typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
      const isTouchMac = navigator.platform === "MacIntel" && maxTouchPoints > 1;
      return /iPad|iPhone|iPod/.test(ua) || isTouchMac;
    })();
    // Append a hint to fit to page width when the viewer supports it
    const withFit = url.includes("#") ? url : `${url}#zoom=page-width`;
    return (
      <div className="rounded-md overflow-hidden bg-background">
        {isIOS ? (
          <embed
            src={withFit}
            type="application/pdf"
            title={title}
            className="block w-full h-[70vh] md:h-[80vh] bg-background"
          />
        ) : (
          <iframe
            src={withFit}
            title={title}
            className="block w-full h-[70vh] md:h-[80vh] bg-background"
          />
        )}
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={title}
      width={1600}
      height={1000}
      className="w-full h-auto"
    />
  );
}
