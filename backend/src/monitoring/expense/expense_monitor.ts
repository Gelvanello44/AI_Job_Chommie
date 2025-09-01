/**
 * Temporary stub for expense monitor to resolve import errors
 * This can be fully implemented later
 */

export class ExpenseTracker {
  constructor() {
    // Stub implementation
  }

  async start(): Promise<void> {
    // Stub implementation
  }

  async stop(): Promise<void> {
    // Stub implementation
  }

  async trackExpense(data: any): Promise<void> {
    // Stub implementation - does nothing for now
    console.log('ExpenseTracker.trackExpense called (stub)');
  }

  async getExpenses(): Promise<any[]> {
    // Stub implementation
    return [];
  }

  getCurrentMonthExpenses(): Map<string, number> {
    // Stub implementation
    return new Map();
  }

  getActiveAlerts(): any[] {
    // Stub implementation
    return [];
  }

  on(event: string, listener: (...args: any[]) => void): this {
    // Stub implementation for EventEmitter interface
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    // Stub implementation for EventEmitter interface
    return true;
  }
}

export default new ExpenseTracker();
