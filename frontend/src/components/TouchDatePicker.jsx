import React, { useState } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTouchGestures } from '../hooks/useTouchGestures';

const TouchDatePicker = ({ value, onChange, showTime = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value || new Date());
  const [selectedTime, setSelectedTime] = useState({ hours: 0, minutes: 0 });
  const [view, setView] = useState('date'); // 'date' or 'time'

  const gestures = useTouchGestures({
    onSwipeLeft: () => nextMonth(),
    onSwipeRight: () => prevMonth(),
    swipeThreshold: 50
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const selectDate = (date) => {
    setSelectedDate(date);
    if (!showTime) {
      onChange?.(date);
      setIsOpen(false);
    } else {
      setView('time');
    }
  };

  const selectTime = () => {
    const finalDate = new Date(selectedDate);
    finalDate.setHours(selectedTime.hours);
    finalDate.setMinutes(selectedTime.minutes);
    onChange?.(finalDate);
    setIsOpen(false);
  };

  const formatDisplay = () => {
    if (!value) return 'Select date';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    if (showTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return value.toLocaleDateString('en-US', options);
  };

  return (
    <div className="relative">
      {/* Input Field */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-left flex items-center justify-between hover:border-cyan-500/50 transition-colors"
      >
        <span>{formatDisplay()}</span>
        <Calendar className="h-5 w-5 text-gray-400" />
      </button>

      {/* Date Picker Dropdown */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 mt-2 w-full md:w-80 bg-gradient-to-br from-[#1a1f3a] to-[#131829] rounded-xl border border-white/10 shadow-2xl p-4"
        >
          {view === 'date' ? (
            <div {...gestures.gestureProps}>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <h3 className="text-white font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs text-gray-400 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentMonth).map((day, index) => {
                  const isSelected = selectedDate?.toDateString() === day.date.toDateString();
                  const isToday = new Date().toDateString() === day.date.toDateString();
                  
                  return (
                    <button
                      key={index}
                      onClick={() => selectDate(day.date)}
                      disabled={!day.isCurrentMonth}
                      className={`
                        p-3 rounded-lg text-sm transition-all
                        ${!day.isCurrentMonth ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:bg-white/10'}
                        ${isSelected ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : ''}
                        ${isToday && !isSelected ? 'border border-cyan-500/50' : ''}
                      `}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => selectDate(new Date())}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Today
                </button>
                {showTime && (
                  <button
                    onClick={() => setView('time')}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  >
                    Select Time
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Time Picker */}
              <div className="flex items-center justify-center gap-4 py-8">
                <div className="text-center">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={selectedTime.hours}
                    onChange={(e) => setSelectedTime({ ...selectedTime, hours: parseInt(e.target.value) || 0 })}
                    className="w-16 h-16 text-2xl text-center rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-2">Hours</p>
                </div>
                <span className="text-2xl text-white">:</span>
                <div className="text-center">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={selectedTime.minutes}
                    onChange={(e) => setSelectedTime({ ...selectedTime, minutes: parseInt(e.target.value) || 0 })}
                    className="w-16 h-16 text-2xl text-center rounded-lg bg-white/10 border border-white/20 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-2">Minutes</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setView('date')}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={selectTime}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default TouchDatePicker;
