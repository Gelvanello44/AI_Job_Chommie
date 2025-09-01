import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const useRateLimiting = (options = {}) => {
  const {
    maxRequests = 10,
    windowMs = 60000, // 1 minute
    onRateLimitExceeded = null
  } = options;

  const [requestCount, setRequestCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [resetTime, setResetTime] = useState(null);
  const [remainingRequests, setRemainingRequests] = useState(maxRequests);

  useEffect(() => {
    // Load existing rate limit data from localStorage
    const storedData = localStorage.getItem('rateLimitData');
    if (storedData) {
      const data = JSON.parse(storedData);
      const now = Date.now();
      
      if (data.resetTime > now) {
        setRequestCount(data.count);
        setResetTime(data.resetTime);
        setRemainingRequests(maxRequests - data.count);
        
        if (data.count >= maxRequests) {
          setIsRateLimited(true);
        }
      } else {
        // Reset if window has passed
        resetRateLimit();
      }
    }
  }, [maxRequests]);

  useEffect(() => {
    if (resetTime) {
      const timer = setTimeout(() => {
        resetRateLimit();
      }, resetTime - Date.now());

      return () => clearTimeout(timer);
    }
  }, [resetTime]);

  const resetRateLimit = () => {
    setRequestCount(0);
    setIsRateLimited(false);
    setResetTime(null);
    setRemainingRequests(maxRequests);
    localStorage.removeItem('rateLimitData');
  };

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    
    if (resetTime && now >= resetTime) {
      resetRateLimit();
      return true;
    }

    if (requestCount >= maxRequests) {
      setIsRateLimited(true);
      
      if (onRateLimitExceeded) {
        onRateLimitExceeded();
      } else {
        const timeRemaining = Math.ceil((resetTime - now) / 1000);
        toast.error(`Rate limit exceeded. Please wait ${timeRemaining} seconds.`);
      }
      
      return false;
    }

    return true;
  }, [requestCount, maxRequests, resetTime, onRateLimitExceeded]);

  const incrementRequestCount = useCallback(() => {
    const now = Date.now();
    const newCount = requestCount + 1;
    const newResetTime = resetTime || now + windowMs;
    
    setRequestCount(newCount);
    setResetTime(newResetTime);
    setRemainingRequests(maxRequests - newCount);
    
    // Store in localStorage
    localStorage.setItem('rateLimitData', JSON.stringify({
      count: newCount,
      resetTime: newResetTime
    }));

    if (newCount >= maxRequests) {
      setIsRateLimited(true);
    }
  }, [requestCount, resetTime, windowMs, maxRequests]);

  const makeRequest = useCallback(async (requestFn) => {
    if (!checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    incrementRequestCount();

    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      // If request fails, decrement the count
      setRequestCount(prev => Math.max(0, prev - 1));
      setRemainingRequests(prev => Math.min(maxRequests, prev + 1));
      throw error;
    }
  }, [checkRateLimit, incrementRequestCount, maxRequests]);

  const getRateLimitInfo = useCallback(() => {
    const now = Date.now();
    const timeUntilReset = resetTime ? Math.max(0, resetTime - now) : windowMs;
    
    return {
      limit: maxRequests,
      remaining: remainingRequests,
      reset: resetTime || now + windowMs,
      resetIn: Math.ceil(timeUntilReset / 1000)
    };
  }, [maxRequests, remainingRequests, resetTime, windowMs]);

  return {
    isRateLimited,
    remainingRequests,
    resetTime,
    checkRateLimit,
    makeRequest,
    getRateLimitInfo,
    resetRateLimit
  };
};

export default useRateLimiting;
