/**
 * Saves a blob to the user's downloads. The API is fetched with an Authorization header, so a
 * plain <a href> to the endpoint would 401 — the file has to come back through fetch and then be
 * handed to the browser via an object URL.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
