import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface ShareResult {
  url: string;
  fileName: string;
}

export default function SharePage() {
  const { token } = useParams();
  const [result, setResult] = useState<ShareResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";
    axios
      .get(`${baseUrl}/share/${token}`)
      .then((res) => setResult(res.data))
      .catch((err) => {
        setError(err?.response?.data?.error || "This link is invalid or has expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 text-center">
        <h1 className="font-extrabold text-lg mb-4">Atlas</h1>

        {error ? (
          <p className="text-danger text-sm">{error}</p>
        ) : !result ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-muted mb-1">Shared file</p>
            <p className="font-semibold mb-6 break-words">{result.fileName}</p>
            
              <a href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-accent text-white px-5 py-2.5 rounded-pill text-sm font-semibold hover:bg-accentHover"
            >
              Download
            </a>
          </>
        )}
      </div>
    </div>
  );
}