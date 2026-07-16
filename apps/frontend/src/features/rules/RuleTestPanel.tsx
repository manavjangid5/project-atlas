import { useState } from "react";
import { evaluateRule } from "./rulesApi";
import { Button } from "../../components/Button";

export default function RuleTestPanel({ ruleId }: { ruleId: string }) {
  const [jsonInput, setJsonInput] = useState('{\n  "location": "India",\n  "experience": 7\n}');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleTest() {
    setError("");
    setResult(null);
    try {
      const data = JSON.parse(jsonInput);
      const res = await evaluateRule(ruleId, data);
      setResult(res);
    } catch {
      setError("Invalid JSON input");
    }
  }

  return (
    <div className="bg-surface border border-border rounded-md p-4 space-y-3">
      <label className="text-xs text-muted block">Test data (JSON)</label>
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        rows={6}
        className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm font-mono resize-none"
      />
      <Button variant="secondary" onClick={handleTest}>Run test</Button>

      {error && <p className="text-danger text-xs">{error}</p>}
      {result && (
        <div className={`text-sm rounded-sm px-3 py-2 border ${result.matched ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border bg-bg text-muted"}`}>
          {result.matched ? "✓ Matched — action would fire" : "✗ Did not match"}
        </div>
      )}
    </div>
  );
}