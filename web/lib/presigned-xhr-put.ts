/**
 * PUT a blob body to an S3 presigned URL via XMLHttpRequest.
 * Prefer this over fetch for large files: callers can show upload progress and the
 * request still omits Content-Type when the Blob has no type (matching host-only PUT signatures).
 */
export function xhrPutPresignedBlob(
  uploadUrl: string,
  blob: Blob,
  options?: {
    onProgress?: (percent0To100OrNullWhenUnknown: number | null) => void;
  },
): Promise<{ ok: boolean; status: number; responseText: string }> {
  const { onProgress } = options ?? {};

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    xhr.upload.onloadstart = () => {
      onProgress?.(0);
    };

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const pct = Math.min(100, Math.round((100 * ev.loaded) / ev.total));
        onProgress?.(pct);
      } else {
        onProgress?.(null);
      }
    };

    xhr.onload = () => {
      onProgress?.(100);
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        responseText: typeof xhr.responseText === "string" ? xhr.responseText : "",
      });
    };

    xhr.onerror = () => {
      reject(new TypeError("Upload failed — network error."));
    };

    xhr.ontimeout = () => {
      reject(new TypeError("Upload timed out."));
    };

    xhr.timeout = 0;
    xhr.send(blob);
  });
}
