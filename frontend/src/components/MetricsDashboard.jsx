import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Activity, Server, Clock, AlertTriangle } from 'lucide-react';

const MetricsDashboard = () => {
  const [metrics, setMetrics] = useState({
    system: {},
    requests: {},
    errors: [],
    uptime: []
  });
  const [realTimeData, setRealTimeData] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    const ws = connectWebSocket();
    
    return () => {
      clearInterval(interval);
      ws?.close();
    };
  }, [selectedTimeRange]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/monitoring/metrics?range=${selectedTimeRange}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:3001/metrics');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRealTimeData(prev => [...prev.slice(-50), data]);
    };

    return ws;
  };

  const systemChart = {
    labels: realTimeData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'CPU Usage',
        data: realTimeData.map(d => d.cpu * 100),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Memory Usage',
        data: realTimeData.map(d => d.memory * 100),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      }
    ]
  };

  const requestChart = {
    labels: Object.keys(metrics.requests || {}),
    datasets: [{
      label: 'Requests',
      data: Object.values(metrics.requests || {}).map(r => r.count),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ]
    }]
  };

  const errorChart = {
    labels: metrics.errors?.slice(-10).map(e => new Date(e.timestamp).toLocaleTimeString()) || [],
    datasets: [{
      label: 'Errors',
      data: metrics.errors?.slice(-10).map((e, i) => i + 1) || [],
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 2
    }]
  };

  const uptimeCards = metrics.uptime?.map(monitor => (
    <div key={monitor.id} className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 backdrop-blur-xl border border-white/10">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{monitor.name}</h3>
          <p className="text-sm text-gray-400">{monitor.url}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          monitor.status === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {monitor.status?.toUpperCase()}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div>
          <p className="text-gray-400 text-xs">Uptime</p>
          <p className="text-white font-semibold">{monitor.uptime?.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Response</p>
          <p className="text-white font-semibold">{monitor.responseTime}ms</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Incidents</p>
          <p className="text-white font-semibold">{monitor.incidents}</p>
        </div>
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">System Metrics Dashboard</h1>
          <select 
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 backdrop-blur-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              System Performance
            </h2>
            <Line data={systemChart} options={{ responsive: true, plugins: { legend: { labels: { color: 'white' }}}}} />
          </div>

          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 backdrop-blur-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-green-400" />
              Request Distribution
            </h2>
            <Doughnut data={requestChart} options={{ responsive: true, plugins: { legend: { labels: { color: 'white' }}}}} />
          </div>
        </div>

        {/* Error Tracking */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 backdrop-blur-xl border border-white/10 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Recent Errors
          </h2>
          <Bar data={errorChart} options={{ responsive: true, plugins: { legend: { labels: { color: 'white' }}}}} />
        </div>

        {/* Uptime Monitoring */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Service Uptime
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uptimeCards}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
