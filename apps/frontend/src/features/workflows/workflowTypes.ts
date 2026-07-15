export type NodeKind =
  | "http_request"
  | "delay"
  | "conditional"
  | "slack"
  | "ai_prompt"
  | "webhook";

export interface WorkflowNodeData {
  label: string;
  kind: NodeKind;
  config: Record<string, any>;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}