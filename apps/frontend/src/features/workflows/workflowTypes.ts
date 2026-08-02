export type NodeKind =
  | "http_request"
  | "delay"
  | "conditional"
  | "slack"
  | "ai_prompt"
  | "webhook"
  | "github"
  | "email"
  | "switch"
  | "loop"
  | "database_query";

export interface WorkflowNodeData {
  label: string;
  kind: NodeKind;
  config: Record<string, unknown>;
}

export interface WorkflowGraph {
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: WorkflowNodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
}

export interface Workflow {
  id: string;
  name: string;
  graph: WorkflowGraph;
  webhookToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}