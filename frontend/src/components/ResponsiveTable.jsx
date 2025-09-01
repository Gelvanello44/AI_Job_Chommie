import React, { useState } from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';

const ResponsiveTable = ({ columns, data, onRowClick, actions }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Desktop Table View
  const DesktopTable = () => (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-sm font-medium text-gray-400"
              >
                {col.label}
              </th>
            ))}
            {actions && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <motion.tr
              key={row.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onRowClick?.(row)}
              className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-4 text-sm text-white">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-4">
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>
                </td>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Mobile Card View
  const MobileCards = () => (
    <div className="md:hidden space-y-3">
      {data.map((row, index) => (
        <motion.div
          key={row.id || index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/10 overflow-hidden"
        >
          {/* Card Header - Always visible */}
          <div
            onClick={() => toggleRow(row.id || index)}
            className="p-4 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {/* Display first 2-3 important columns */}
                {columns.slice(0, 2).map((col) => (
                  <div key={col.key} className="mb-2">
                    <span className="text-xs text-gray-400">{col.label}</span>
                    <div className="text-white">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </div>
                  </div>
                ))}
              </div>
              <ChevronRight
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  expandedRows.has(row.id || index) ? 'rotate-90' : ''
                }`}
              />
            </div>
          </div>

          {/* Expanded Content */}
          {expandedRows.has(row.id || index) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 border-t border-white/10"
            >
              <div className="pt-4 space-y-3">
                {columns.slice(2).map((col) => (
                  <div key={col.key}>
                    <span className="text-xs text-gray-400">{col.label}</span>
                    <div className="text-white mt-1">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </div>
                  </div>
                ))}
              </div>
              
              {actions && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                  {actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(row);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white text-sm hover:from-cyan-500/30 hover:to-blue-600/30 transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );

  return (
    <>
      <DesktopTable />
      <MobileCards />
    </>
  );
};

export default ResponsiveTable;
