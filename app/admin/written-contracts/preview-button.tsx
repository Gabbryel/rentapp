"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import PdfModal from "@/app/components/pdf-modal";
import type { WrittenContract } from "@/lib/schemas/written-contract";

type Props = {
  document: WrittenContract;
  buttonLabel?: string;
  buttonTitle?: string;
  className?: string;
};

export function WrittenContractPreviewButton({
  document,
  buttonLabel = "Previzualizează",
  buttonTitle = "Previzualizează contractul scris",
  className,
}: Props) {
  const payload = useMemo(
    () =>
      JSON.stringify({
        document,
      }),
    [document]
  );
  const previewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  const resolveUrl = useCallback(async () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    const response = await fetch("/api/written-contract/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    if (!response.ok) {
      let message = "Nu am putut genera PDF-ul contractului.";
      try {
        const data = await response.json();
        if (data && typeof data.error === "string") {
          message = data.error;
        }
      } catch {
        // best-effort, păstrăm mesajul implicit
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    previewObjectUrlRef.current = objectUrl;
    return objectUrl;
  }, [payload]);

  const handleClose = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  return (
    <PdfModal
      resolveUrl={resolveUrl}
      onClose={handleClose}
      buttonLabel={buttonLabel}
      buttonTitle={buttonTitle}
      title={document.title || "Contract scris"}
      className={className}
      resolveErrorMessage="Nu am putut genera PDF-ul contractului."
    />
  );
}
