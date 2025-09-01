const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class AlertConfigurationService extends EventEmitter {
  constructor() {
    super();
    this.alerts = new Map();
    this.alertHistory = [];
    this.configFile = path.join(__dirname, '../../data/alerts.json');
    this.loadAlerts();
  }

  loadAlerts() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        data.forEach(alert => this.alerts.set(alert.id, alert));
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }

  saveAlerts() {
    const data = Array.from(this.alerts.values());
    fs.writeFileSync(this.configFile, JSON.stringify(data, null, 2));
  }

  createAlert(config) {
    const alert = {
      id: config.id || Date.now().toString(),
      name: config.name,
      description: config.description,
      type: config.type,
      condition: config.condition,
      threshold: config.threshold,
      duration: config.duration || 0,
      severity: config.severity || 'warning',
      enabled: config.enabled !== false,
      channels: config.channels || ['email'],
      metadata: config.metadata || {},
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      triggerCount: 0
    };

    this.alerts.set(alert.id, alert);
    this.saveAlerts();
    return alert;
  }

  evaluateAlert(alertId, value) {
    const alert = this.alerts.get(alertId);
    if (!alert || !alert.enabled) return false;

    let shouldTrigger = false;
    
    switch (alert.condition) {
      case 'greater_than':
        shouldTrigger = value > alert.threshold;
        break;
      case 'less_than':
        shouldTrigger = value < alert.threshold;
        break;
      case 'equals':
        shouldTrigger = value === alert.threshold;
        break;
      case 'contains':
        shouldTrigger = String(value).includes(alert.threshold);
        break;
    }

    if (shouldTrigger) {
      this.triggerAlert(alertId, value);
    }

    return shouldTrigger;
  }

  triggerAlert(alertId, value) {
    const alert = this.alerts.get(alertId);
    
    const incident = {
      id: Date.now().toString(),
      alertId,
      alertName: alert.name,
      severity: alert.severity,
      value,
      threshold: alert.threshold,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alertHistory.push(incident);
    alert.lastTriggered = incident.timestamp;
    alert.triggerCount++;
    
    this.saveAlerts();
    this.sendNotifications(alert, incident);
    this.emit('alert', incident);
    
    return incident;
  }

  sendNotifications(alert, incident) {
    alert.channels.forEach(channel => {
      switch (channel) {
        case 'email':
          console.log(`[EMAIL ALERT] ${alert.name}: ${incident.value} ${alert.condition} ${alert.threshold}`);
          break;
        case 'slack':
          console.log(`[SLACK ALERT] ${alert.name}: ${incident.value}`);
          break;
        case 'webhook':
          console.log(`[WEBHOOK ALERT] ${alert.name}`);
          break;
      }
    });
  }

  getAlertHistory(filters = {}) {
    let history = [...this.alertHistory];
    
    if (filters.alertId) {
      history = history.filter(h => h.alertId === filters.alertId);
    }
    if (filters.severity) {
      history = history.filter(h => h.severity === filters.severity);
    }
    if (filters.resolved !== undefined) {
      history = history.filter(h => h.resolved === filters.resolved);
    }
    
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  resolveIncident(incidentId) {
    const incident = this.alertHistory.find(i => i.id === incidentId);
    if (incident) {
      incident.resolved = true;
      incident.resolvedAt = new Date().toISOString();
      this.emit('resolved', incident);
    }
    return incident;
  }

  updateAlert(alertId, updates) {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    
    Object.assign(alert, updates);
    this.saveAlerts();
    return alert;
  }

  deleteAlert(alertId) {
    const deleted = this.alerts.delete(alertId);
    if (deleted) {
      this.saveAlerts();
    }
    return deleted;
  }

  getAllAlerts() {
    return Array.from(this.alerts.values());
  }
}

module.exports = new AlertConfigurationService();
