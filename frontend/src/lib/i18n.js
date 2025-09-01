// Internationalization utilities for South African locale (en-ZA)
// Centralized formatting for dates, numbers, and currency

// South African timezone and locale constants
export const SA_LOCALE = 'en-ZA'
export const SA_TIMEZONE = 'Africa/Johannesburg'
export const SA_CURRENCY = 'ZAR'

// Date formatting utilities
export class SADateFormatter {
  constructor() {
    this.timezone = SA_TIMEZONE
    this.locale = SA_LOCALE
  }

  // Standard date formats
  formatDate(date, options = {}) {
    const defaultOptions = {
      timeZone: this.timezone,
      ...options
    }
    
    return new Intl.DateTimeFormat(this.locale, defaultOptions).format(new Date(date))
  }

  // Common date format presets
  formatShortDate(date) {
    return this.formatDate(date, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  formatLongDate(date) {
    return this.formatDate(date, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  formatMediumDate(date) {
    return this.formatDate(date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  formatDateTime(date) {
    return this.formatDate(date, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  formatTime(date) {
    return this.formatDate(date, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  formatRelativeTime(date) {
    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' })
    const now = new Date()
    const targetDate = new Date(date)
    const diffInSeconds = (targetDate - now) / 1000
    
    const intervals = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2628000 },
      { unit: 'week', seconds: 604800 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'minute', seconds: 60 }
    ]
    
    for (const interval of intervals) {
      const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds)
      if (count >= 1) {
        return rtf.format(diffInSeconds < 0 ? -count : count, interval.unit)
      }
    }
    
    return rtf.format(0, 'second')
  }

  // Job alert digest timing utilities
  getNextDigestTime(frequency, sendDay, sendHour) {
    const now = new Date()
    const saTime = new Date(now.toLocaleString('en-US', { timeZone: SA_TIMEZONE }))
    
    let nextDigest = new Date(saTime)
    
    switch (frequency) {
      case 'daily':
        nextDigest.setHours(sendHour, 0, 0, 0)
        if (nextDigest <= saTime) {
          nextDigest.setDate(nextDigest.getDate() + 1)
        }
        break
        
      case 'weekly':
        const targetDay = this.getDayNumber(sendDay)
        const currentDay = saTime.getDay()
        let daysUntilTarget = targetDay - currentDay
        
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && saTime.getHours() >= sendHour)) {
          daysUntilTarget += 7
        }
        
        nextDigest.setDate(nextDigest.getDate() + daysUntilTarget)
        nextDigest.setHours(sendHour, 0, 0, 0)
        break
        
      case 'monthly':
        nextDigest.setDate(1) // First day of month
        nextDigest.setHours(sendHour, 0, 0, 0)
        if (nextDigest <= saTime) {
          nextDigest.setMonth(nextDigest.getMonth() + 1)
        }
        break
    }
    
    return nextDigest
  }

  getDayNumber(dayName) {
    const days = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    return days[dayName] || 1 // Default to Monday
  }

  // Handle DST transitions and edge cases
  isDSTTransition(date) {
    // South Africa doesn't observe DST, but this is useful for future expansion
    const jan = new Date(date.getFullYear(), 0, 1)
    const jul = new Date(date.getFullYear(), 6, 1)
    return jan.getTimezoneOffset() !== jul.getTimezoneOffset()
  }

  // Format for job posting dates
  formatJobPostedDate(date) {
    const now = new Date()
    const posted = new Date(date)
    const diffInHours = (now - posted) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return 'Today'
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)} days ago`
    } else {
      return this.formatMediumDate(posted)
    }
  }
}

// Number and currency formatting utilities
export class SANumberFormatter {
  constructor() {
    this.locale = SA_LOCALE
    this.currency = SA_CURRENCY
  }

  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.locale, options).format(number)
  }

  formatCurrency(amount, options = {}) {
    const defaultOptions = {
      style: 'currency',
      currency: this.currency,
      ...options
    }
    return new Intl.NumberFormat(this.locale, defaultOptions).format(amount)
  }

  formatSalary(amount, period = 'month') {
    const formatted = this.formatCurrency(amount, { maximumFractionDigits: 0 })
    
    switch (period) {
      case 'hour':
        return `${formatted}/hour`
      case 'day':
        return `${formatted}/day`
      case 'month':
        return `${formatted}/month`
      case 'year':
        return `${formatted}/year`
      default:
        return formatted
    }
  }

  formatPercentage(value, decimals = 1) {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100)
  }

  formatCompactNumber(number) {
    return new Intl.NumberFormat(this.locale, {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(number)
  }
}

// Create singleton instances
export const saDateFormatter = new SADateFormatter()
export const saNumberFormatter = new SANumberFormatter()

// Convenience functions
export const formatDate = (date, options) => saDateFormatter.formatDate(date, options)
export const formatShortDate = (date) => saDateFormatter.formatShortDate(date)
export const formatLongDate = (date) => saDateFormatter.formatLongDate(date)
export const formatMediumDate = (date) => saDateFormatter.formatMediumDate(date)
export const formatDateTime = (date) => saDateFormatter.formatDateTime(date)
export const formatTime = (date) => saDateFormatter.formatTime(date)
export const formatRelativeTime = (date) => saDateFormatter.formatRelativeTime(date)
export const formatJobPostedDate = (date) => saDateFormatter.formatJobPostedDate(date)

export const formatCurrency = (amount, options) => saNumberFormatter.formatCurrency(amount, options)
export const formatSalary = (amount, period) => saNumberFormatter.formatSalary(amount, period)
export const formatNumber = (number, options) => saNumberFormatter.formatNumber(number, options)
export const formatPercentage = (value, decimals) => saNumberFormatter.formatPercentage(value, decimals)
export const formatCompactNumber = (number) => saNumberFormatter.formatCompactNumber(number)

// Validation helpers
export function isValidSADate(dateString) {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

export function isBusinessHour(date = new Date()) {
  const saTime = new Date(date.toLocaleString('en-US', { timeZone: SA_TIMEZONE }))
  const hour = saTime.getHours()
  const day = saTime.getDay()
  
  // Monday to Friday, 8 AM to 5 PM SAST
  return day >= 1 && day <= 5 && hour >= 8 && hour < 17
}

// Time zone utilities
export function convertToSATime(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: SA_TIMEZONE }))
}

export function getSATimeOffset() {
  const now = new Date()
  const saTime = new Date(now.toLocaleString('en-US', { timeZone: SA_TIMEZONE }))
  return (saTime.getTime() - now.getTime()) / (1000 * 60) // offset in minutes
}
