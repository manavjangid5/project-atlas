import { useEffect, useRef, useState } from "react";
import { listFiles, uploadFile, getDownloadUrl, deleteFile, createShareLink } from "./filesApi";
import type { FileAsset } from "./filesApi";
import { Button } from "../../components/Button";

const FILE_ICONS: Record<string, string> = {
  "image/png": "🖼", "image/jpeg": "🖼", "image/gif": "🖼",
  "application/pdf": "📄", "text/plain": "📝", "application/json": "🗂", "text/csv": "📊",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ fileId: string; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    listFiles().then((f) => {
      setFiles(f);
      setLoading(false);
    });
  }

  useEffect(refresh, []);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadFile(file);
      }
      refresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id: string) {
    const url = await getDownloadUrl(id);
    window.open(url, "_blank");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this file?")) return;
    await deleteFile(id);
    refresh();
  }

  async function handleShare(id: string) {
    const link = await createShareLink(id);
    const shareUrl = `${window.location.origin}/share/${link.token}`;
    setShareInfo({ fileId: id, url: shareUrl });
  }

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">Files</h2>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition-colors mb-6 ${
          dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <p className="text-sm text-muted">
          {uploading ? "Uploading…" : "Drag & drop a file here, or click to browse"}
        </p>
        <p className="text-xs text-muted mt-1">Max 20MB — images, PDF, text, JSON, CSV</p>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-muted text-sm">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 bg-surface border border-border rounded-md px-4 py-3">
              <span className="text-lg">{FILE_ICONS[file.mimeType] || "📎"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                <p className="text-xs text-muted">
                  {formatSize(file.sizeBytes)} · v{file.version} · {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => handleDownload(file.id)} className="text-xs text-accent hover:underline">
                Download
              </button>
              <button onClick={() => handleShare(file.id)} className="text-xs text-accent hover:underline">
                Share
              </button>
              <button onClick={() => handleDelete(file.id)} className="text-xs text-muted hover:text-danger">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {shareInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShareInfo(null)}>
          <div className="bg-surface border border-border rounded-md p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Share link created</h3>
            <p className="text-xs text-muted mb-3">Expires in 24 hours.</p>
            <div className="flex gap-2">
              <input readOnly value={shareInfo.url} className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-xs" />
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(shareInfo.url)}>Copy</Button>
            </div>
            <Button variant="ghost" onClick={() => setShareInfo(null)} className="mt-3">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}