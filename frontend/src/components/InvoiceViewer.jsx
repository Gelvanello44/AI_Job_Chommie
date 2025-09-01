import React, { useState } from 'react';
import { FileText, Download, Eye, Search, Filter, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const InvoiceViewer = ({ invoices: initialInvoices = [] }) => {
  const [invoices, setInvoices] = useState(initialInvoices.length > 0 ? initialInvoices : [
    {
      id: 'INV-2024-001',
      date: '2024-01-01',
      amount: 49.99,
      status: 'paid',
      items: [
        { description: 'Pro Plan Subscription', amount: 49.99 }
      ],
      tax: 5.00,
      total: 54.99,
      paymentMethod: '**** 4242',
      billingPeriod: 'January 2024'
    },
    {
      id: 'INV-2023-012',
      date: '2023-12-01',
      amount: 49.99,
      status: 'paid',
      items: [
        { description: 'Pro Plan Subscription', amount: 49.99 }
      ],
      tax: 5.00,
      total: 54.99,
      paymentMethod: '**** 4242',
      billingPeriod: 'December 2023'
    },
    {
      id: 'INV-2023-011',
      date: '2023-11-01',
      amount: 49.99,
      status: 'failed',
      items: [
        { description: 'Pro Plan Subscription', amount: 49.99 }
      ],
      tax: 5.00,
      total: 54.99,
      paymentMethod: '**** 4242',
      billingPeriod: 'November 2023'
    }
  ]);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const statusColors = {
    paid: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      // Simulate API call
      toast.success(`Downloading invoice ${invoiceId}...`);
      // In real app, would trigger file download
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.billingPeriod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'paid', 'pending', 'failed'].map((status) => (
            <motion.button
              key={status}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg capitalize transition-all ${
                filterStatus === status
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {status}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredInvoices.map((invoice, index) => {
            const StatusIcon = statusColors[invoice.status].icon;
            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <FileText className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{invoice.id}</h3>
                      <p className="text-sm text-gray-400">{invoice.billingPeriod}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">${invoice.total}</p>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${statusColors[invoice.status].bg}`}>
                        <StatusIcon className={`h-3 w-3 ${statusColors[invoice.status].text}`} />
                        <span className={`text-xs font-medium ${statusColors[invoice.status].text}`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        title="View Invoice"
                      >
                        <Eye className="h-5 w-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => downloadInvoice(invoice.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        title="Download Invoice"
                      >
                        <Download className="h-5 w-5" />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Invoice Preview on Hover */}
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Payment Method:</span>
                      <p className="text-white">{invoice.paymentMethod}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Tax:</span>
                      <p className="text-white">${invoice.tax}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedInvoice(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-[#1a1f3a] to-[#131829] rounded-2xl p-8 max-w-2xl w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Invoice {selectedInvoice.id}</h2>
                  <p className="text-gray-400">{selectedInvoice.billingPeriod}</p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white/5">
                  <h3 className="text-lg font-semibold text-white mb-3">Invoice Items</h3>
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-gray-300">{item.description}</span>
                      <span className="text-white font-medium">${item.amount}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">${selectedInvoice.amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Tax</span>
                  <span className="text-white">${selectedInvoice.tax}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                  <span className="text-xl font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    ${selectedInvoice.total}
                  </span>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => downloadInvoice(selectedInvoice.id)}
                    className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:shadow-lg transition-all"
                    style={{ boxShadow: '0 10px 30px rgba(0, 212, 255, 0.3)' }}
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedInvoice.id);
                      toast.success('Invoice ID copied!');
                    }}
                    className="px-6 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                  >
                    Copy ID
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceViewer;
