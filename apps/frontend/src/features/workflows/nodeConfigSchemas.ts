import type { NodeKind } from "./workflowTypes";

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
  placeholder?: string;
}

export const NODE_CONFIG_SCHEMAS: Record<NodeKind, ConfigField[]> = {
  http_request: [
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE"] },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/endpoint" },
    { key: "body", label: "Body (JSON)", type: "textarea", placeholder: '{"key":"value"}' },
  ],
  delay: [
    { key: "durationMs", label: "Duration (ms)", type: "number", placeholder: "1000" },
  ],
  conditional: [
    { key: "field", label: "Variable name", type: "text", placeholder: "node-1_output" },
    {
      key: "operator",
      label: "Operator",
      type: "select",
      options: ["equals", "notEquals", "greaterThan", "lessThan", "contains"],
    },
    { key: "value", label: "Compare value", type: "text" },
  ],
  slack: [
    { key: "webhookUrl", label: "Slack Webhook URL", type: "text", placeholder: "https://hooks.slack.com/..." },
    { key: "message", label: "Message", type: "textarea" },
  ],
  ai_prompt: [
    { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Summarize {node-1_output}..." },
  ],
  webhook: [
    { key: "url", label: "Target URL", type: "text" },
    { key: "method", label: "Method", type: "select", options: ["POST", "PUT"] },
  ],
};