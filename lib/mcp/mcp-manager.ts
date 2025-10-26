import { telemetryServer } from "./servers/telemetry-server";
import { anomalyServer } from "./servers/anomaly-server";
import { analysisServer } from "./servers/analysis-server";

export class MCPManager {
  private servers: any[] = [];
  
  constructor() {
    this.servers = [telemetryServer, anomalyServer, analysisServer];
  }
  
  getTools() {
    const tools: any = {};
    
    this.servers.forEach(server => {
      Object.entries(server.tools).forEach(([toolName, tool]: [string, any]) => {
        tools[toolName] = {
          description: tool.description,
          parameters: tool.inputSchema,
          execute: async (args: any) => {
            try {
              const result = await tool.handler(args);
              return result;
            } catch (error) {
              console.error(`MCP Tool ${toolName} error:`, error);
              return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
              };
            }
          }
        };
      });
    });
    
    return tools;
  }
  
  getToolDefinitions() {
    const toolDefinitions: any[] = [];
    
    this.servers.forEach(server => {
      Object.entries(server.tools).forEach(([toolName, tool]: [string, any]) => {
        toolDefinitions.push({
          type: "function",
          function: {
            name: toolName,
            description: tool.description,
            parameters: tool.inputSchema
          }
        });
      });
    });
    
    return toolDefinitions;
  }
  
  async executeTool(toolName: string, args: any) {
    for (const server of this.servers) {
      if (server.tools[toolName]) {
        try {
          return await server.tools[toolName].handler(args);
        } catch (error) {
          console.error(`MCP Tool ${toolName} execution error:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    }
    
    return {
      success: false,
      error: `Tool ${toolName} not found`
    };
  }
}

export const mcpManager = new MCPManager();
