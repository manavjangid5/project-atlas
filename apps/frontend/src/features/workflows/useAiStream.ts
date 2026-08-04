import { useState, useCallback, useRef } from "react";

export function useAiStream() {
  const [streamedText, setStreamedText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const runStream = useCallback(async (prompt: string) => {
    setStreamedText("");
    setError("");
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";
      const activeOrgId = localStorage.getItem("activeOrgId");

      const res = await fetch(`${baseUrl}/ai/stream-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeOrgId ? { "X-Organization-Id": activeOrgId } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ prompt }),
        signal: abortRef.current.signal,
      });

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.error) setError(payload.error);
          else if (payload.text) setStreamedText((prev) => prev + payload.text);
          else if (payload.done) setStreaming(false);
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message || "Stream failed");
    } finally {
      setStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { streamedText, streaming, error, runStream, cancel };
}