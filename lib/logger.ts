/**
 * Enhanced Backend Error Logging System
 * Logs all errors to console and file with structured formatting
 * Provides real-time access to logs via API
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  stack?: string;
  request?: {
    url?: string;
    method?: string;
    body?: any;
    headers?: any;
  };
  response?: {
    status?: number;
    body?: any;
  };
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private logDir: string;
  private currentLogFile: string;
  private errorLogFile: string;

  constructor() {
    // Ensure logs directory exists
    this.logDir = join(process.cwd(), 'logs');
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }

      // Create daily log files
      const dateStr = new Date().toISOString().split('T')[0];
      this.currentLogFile = join(this.logDir, `app-${dateStr}.log`);
      this.errorLogFile = join(this.logDir, `errors-${dateStr}.log`);

      // Create files if they don't exist
      if (!existsSync(this.currentLogFile)) {
        writeFileSync(this.currentLogFile, '');
      }
      if (!existsSync(this.errorLogFile)) {
        writeFileSync(this.errorLogFile, '');
      }
    } catch (error) {
      console.warn('Unable to create log files (permission denied). Logging to console only.');
      // Set dummy paths so the logger still works
      this.currentLogFile = '';
      this.errorLogFile = '';
    }
  }

  private formatLog(entry: LogEntry): string {
    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
    }[entry.level];

    let log = `${emoji} [${entry.timestamp}] [${entry.context}] ${entry.message}`;

    // Add request details if present
    if (entry.request) {
      log += `\n  📥 Request: ${entry.request.method || 'GET'} ${entry.request.url || 'unknown'}`;
      if (entry.request.body) {
        log += `\n  Body: ${JSON.stringify(entry.request.body, null, 2)}`;
      }
    }

    // Add response details if present
    if (entry.response) {
      log += `\n  📤 Response Status: ${entry.response.status}`;
      if (entry.response.body) {
        const bodyStr = typeof entry.response.body === 'string'
          ? entry.response.body.substring(0, 500) // Limit to first 500 chars
          : JSON.stringify(entry.response.body, null, 2);
        log += `\n  Response Body: ${bodyStr}`;
      }
    }

    return log;
  }

  private formatFileLog(entry: LogEntry): string {
    let log = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;

    if (entry.request) {
      log += `\n  Request: ${entry.request.method || 'GET'} ${entry.request.url || 'unknown'}`;
      if (entry.request.body) {
        log += `\n  Body: ${JSON.stringify(entry.request.body, null, 2)}`;
      }
    }

    if (entry.response) {
      log += `\n  Response Status: ${entry.response.status}`;
      if (entry.response.body) {
        const bodyStr = typeof entry.response.body === 'string'
          ? entry.response.body.substring(0, 1000)
          : JSON.stringify(entry.response.body, null, 2);
        log += `\n  Response Body: ${bodyStr}`;
      }
    }

    if (entry.data) {
      log += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.stack) {
      log += `\n  Stack: ${entry.stack}`;
    }

    return log + '\n' + '='.repeat(80) + '\n';
  }

  private writeToFile(entry: LogEntry) {
    // Skip file writing if log files couldn't be created
    if (!this.currentLogFile || !this.errorLogFile) {
      return;
    }

    try {
      const fileLog = this.formatFileLog(entry);
      appendFileSync(this.currentLogFile, fileLog);

      // Also write errors to error log
      if (entry.level === 'error') {
        appendFileSync(this.errorLogFile, fileLog);
      }
    } catch (error) {
      // Silently fail - don't spam console with permission errors
    }
  }

  private createEntry(
    level: LogLevel,
    context: string,
    message: string,
    data?: any,
    error?: Error,
    request?: any,
    response?: any
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
      stack: error?.stack,
      request,
      response,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Write to file
    this.writeToFile(entry);

    return entry;
  }

  info(context: string, message: string, data?: any) {
    const entry = this.createEntry('info', context, message, data);
    console.log(this.formatLog(entry));
    if (data) console.log('Data:', JSON.stringify(data, null, 2));
  }

  warn(context: string, message: string, data?: any) {
    const entry = this.createEntry('warn', context, message, data);
    console.warn(this.formatLog(entry));
    if (data) console.warn('Data:', JSON.stringify(data, null, 2));
  }

  error(context: string, message: string, error?: Error | any, data?: any) {
    const actualError = error instanceof Error ? error : new Error(String(error));
    const entry = this.createEntry('error', context, message, data, actualError);
    console.error(this.formatLog(entry));
    if (data) console.error('Data:', JSON.stringify(data, null, 2));
    if (actualError) {
      console.error('Error:', actualError.message);
      console.error('Stack:', actualError.stack);
    }
  }

  debug(context: string, message: string, data?: any) {
    const entry = this.createEntry('debug', context, message, data);
    console.debug(this.formatLog(entry));
    if (data) console.debug('Data:', JSON.stringify(data, null, 2));
  }

  /**
   * Special method for API request/response logging
   */
  api(context: string, message: string, req?: any, res?: any, error?: Error) {
    const request = req ? {
      url: req.url,
      method: req.method,
      body: req.body,
      headers: req.headers,
    } : undefined;

    const response = res ? {
      status: res.status,
      body: res.body,
    } : undefined;

    const level: LogLevel = error ? 'error' : 'info';
    const entry = this.createEntry(level, context, message, undefined, error, request, response);

    if (error) {
      console.error(this.formatLog(entry));
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.log(this.formatLog(entry));
    }
  }

  /**
   * Get recent logs (useful for debugging endpoints)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel, count: number = 50): LogEntry[] {
    return this.logs.filter((log) => log.level === level).slice(-count);
  }

  /**
   * Get errors only
   */
  getErrors(count: number = 20): LogEntry[] {
    return this.logs.filter((log) => log.level === 'error').slice(-count);
  }

  /**
   * Read today's log file
   */
  getTodaysLogs(): string {
    try {
      return readFileSync(this.currentLogFile, 'utf-8');
    } catch (error) {
      return 'Unable to read log file';
    }
  }

  /**
   * Read today's error log file
   */
  getTodaysErrors(): string {
    try {
      return readFileSync(this.errorLogFile, 'utf-8');
    } catch (error) {
      return 'Unable to read error log file';
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Get log file paths for debugging
   */
  getLogPaths() {
    return {
      currentLog: this.currentLogFile,
      errorLog: this.errorLogFile,
      logDir: this.logDir,
    };
  }
}

// Export singleton instance
export const logger = new Logger();