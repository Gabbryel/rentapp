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
    return (
      <div className="rounded-md overflow-hidden">
        <iframe src={url} title={title} className="block w-full aspect-[4/3]" />
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
