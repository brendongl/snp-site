// Global in-memory store for SSE connections
export class SwitchNotifier {
  private static instance: SwitchNotifier;
  private connections: Set<ReadableStreamDefaultController> = new Set();

  private constructor() {}

  static getInstance(): SwitchNotifier {
    if (!SwitchNotifier.instance) {
      SwitchNotifier.instance = new SwitchNotifier();
    }
    return SwitchNotifier.instance;
  }

  addConnection(controller: ReadableStreamDefaultController) {
    this.connections.add(controller);

    // Send initial connection message
    const encoder = new TextEncoder();
    try {
      controller.enqueue(encoder.encode(`data: {"type":"connected","message":"Connected to Switch notifications"}\n\n`));
    } catch (error) {
      this.connections.delete(controller);
    }
  }

  removeConnection(controller: ReadableStreamDefaultController) {
    this.connections.delete(controller);
  }

  broadcast(data: any) {
    const encoder = new TextEncoder();
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encodedMessage = encoder.encode(message);

    // Send to all connected clients
    const deadConnections: ReadableStreamDefaultController[] = [];

    this.connections.forEach(controller => {
      try {
        controller.enqueue(encodedMessage);
      } catch (error) {
        // Connection is closed, mark for removal
        deadConnections.push(controller);
      }
    });

    // Clean up dead connections
    deadConnections.forEach(controller => {
      this.connections.delete(controller);
    });

    console.log(`[SwitchNotifier] Broadcasted to ${this.connections.size} clients`);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}