const axios = require('axios');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class UptimeMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.monitors = new Map();
    this.healthChecks = new Map();
    this.uptimeData = new Map();
    this.dataFile = path.join(__dirname, '../../data/uptime.json');
    this.loadData();
    this.startMonitoring();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        data.forEach(item => this.uptimeData.set(item.id, item));
      }
    } catch (error) {
      console.error('Error loading uptime data:', error);
    }
  }

  saveData() {
    const data = Array.from(this.uptimeData.values());
    fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
  }

  addMonitor(config) {
    const monitor = {
      id: config.id || Date.now().toString(),
      name: config.name,
      url: config.url,
      type: config.type || 'http',
      interval: config.interval || 60000,
      timeout: config.timeout || 10000,
      method: config.method || 'GET',
      headers: config.headers || {},
      expectedStatus: config.expectedStatus || 200,
      expectedText: config.expectedText || null,
      enabled: true,
      alerts: config.alerts || { email: true, slack: false }
    };

    this.monitors.set(monitor.id, monitor);
    this.startHealthCheck(monitor.id);
    
    if (!this.uptimeData.has(monitor.id)) {
      this.uptimeData.set(monitor.id, {
        id: monitor.id,
        name: monitor.name,
        uptime: 100,
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        lastCheck: null,
        status: 'unknown',
        history: [],
        incidents: []
      });
    }

    return monitor;
  }

  startHealthCheck(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor || !monitor.enabled) return;

    const check = setInterval(async () => {
      await this.performHealthCheck(monitorId);
    }, monitor.interval);

    this.healthChecks.set(monitorId, check);
    this.performHealthCheck(monitorId);
  }

  async performHealthCheck(monitorId) {
    const monitor = this.monitors.get(monitorId);
    const uptimeRecord = this.uptimeData.get(monitorId);
    
    const checkResult = {
      timestamp: new Date().toISOString(),
      success: false,
      responseTime: null,
      statusCode: null,
      error: null
    };

    const startTime = Date.now();

    try {
      const response = await axios({
        method: monitor.method,
        url: monitor.url,
        headers: monitor.headers,
        timeout: monitor.timeout,
        validateStatus: () => true
      });

      checkResult.responseTime = Date.now() - startTime;
      checkResult.statusCode = response.status;
      checkResult.success = response.status === monitor.expectedStatus;

      if (monitor.expectedText && !response.data.includes(monitor.expectedText)) {
        checkResult.success = false;
        checkResult.error = 'Expected text not found';
      }
    } catch (error) {
      checkResult.error = error.message;
      checkResult.success = false;
    }

    uptimeRecord.totalChecks++;
    if (checkResult.success) {
      uptimeRecord.successfulChecks++;
      if (uptimeRecord.status === 'down') {
        this.handleRecovery(monitorId, checkResult);
      }
      uptimeRecord.status = 'up';
    } else {
      uptimeRecord.failedChecks++;
      if (uptimeRecord.status === 'up') {
        this.handleIncident(monitorId, checkResult);
      }
      uptimeRecord.status = 'down';
    }

    uptimeRecord.lastCheck = checkResult;
    uptimeRecord.uptime = (uptimeRecord.successfulChecks / uptimeRecord.totalChecks) * 100;
    uptimeRecord.history.push(checkResult);
    
    if (uptimeRecord.history.length > 1440) {
      uptimeRecord.history.shift();
    }

    this.emit('healthCheck', { monitor, result: checkResult });
    this.saveData();
  }

  handleIncident(monitorId, checkResult) {
    const monitor = this.monitors.get(monitorId);
    const uptimeRecord = this.uptimeData.get(monitorId);
    
    const incident = {
      id: Date.now().toString(),
      startTime: checkResult.timestamp,
      endTime: null,
      duration: null,
      reason: checkResult.error || `Status code: ${checkResult.statusCode}`,
      resolved: false
    };

    uptimeRecord.incidents.push(incident);
    this.emit('incident', { monitor, incident });
    
    if (monitor.alerts.email) {
      console.log(`[ALERT] ${monitor.name} is DOWN - ${incident.reason}`);
    }
  }

  handleRecovery(monitorId, checkResult) {
    const monitor = this.monitors.get(monitorId);
    const uptimeRecord = this.uptimeData.get(monitorId);
    
    const lastIncident = uptimeRecord.incidents[uptimeRecord.incidents.length - 1];
    if (lastIncident && !lastIncident.resolved) {
      lastIncident.endTime = checkResult.timestamp;
      lastIncident.duration = Date.now() - new Date(lastIncident.startTime).getTime();
      lastIncident.resolved = true;
    }

    this.emit('recovery', { monitor, incident: lastIncident });
    console.log(`[RECOVERY] ${monitor.name} is UP`);
  }

  getStatus(monitorId) {
    const uptimeRecord = this.uptimeData.get(monitorId);
    if (!uptimeRecord) return null;

    return {
      ...uptimeRecord,
      monitor: this.monitors.get(monitorId)
    };
  }

  getAllStatuses() {
    return Array.from(this.monitors.keys()).map(id => this.getStatus(id));
  }

  getUptimeReport(monitorId, duration = 86400000) {
    const uptimeRecord = this.uptimeData.get(monitorId);
    if (!uptimeRecord) return null;

    const since = Date.now() - duration;
    const recentHistory = uptimeRecord.history.filter(h => 
      new Date(h.timestamp).getTime() > since
    );

    const recentIncidents = uptimeRecord.incidents.filter(i => 
      new Date(i.startTime).getTime() > since
    );

    return {
      monitor: this.monitors.get(monitorId),
      uptime: uptimeRecord.uptime,
      averageResponseTime: recentHistory.reduce((sum, h) => sum + (h.responseTime || 0), 0) / recentHistory.length,
      incidents: recentIncidents,
      checks: recentHistory.length,
      successful: recentHistory.filter(h => h.success).length,
      failed: recentHistory.filter(h => !h.success).length
    };
  }

  stopMonitor(monitorId) {
    const check = this.healthChecks.get(monitorId);
    if (check) {
      clearInterval(check);
      this.healthChecks.delete(monitorId);
    }
  }

  startMonitoring() {
    this.monitors.forEach((monitor, id) => {
      this.startHealthCheck(id);
    });
  }
}

module.exports = new UptimeMonitoringService();
