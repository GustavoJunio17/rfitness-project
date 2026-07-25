export const AGENT_ACTION_REPOSITORY = Symbol("AGENT_ACTION_REPOSITORY");

export interface LogAgentActionInput {
  action: string;
  input: unknown;
  output: unknown;
}

export interface AgentActionRepository {
  log(input: LogAgentActionInput): Promise<void>;
}
