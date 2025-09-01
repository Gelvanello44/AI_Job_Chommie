import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for handling touch gestures
 * Supports swipe, pinch, tap, double tap, and long press
 */
export const useTouchGestures = (options = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onTap,
    onDoubleTap,
    onLongPress,
    swipeThreshold = 50,
    swipeVelocityThreshold = 0.5,
    tapThreshold = 10,
    doubleTapDelay = 300,
    longPressDelay = 500,
    preventScroll = false
  } = options;

  const [gesture, setGesture] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  
  const touchStartTime = useRef(null);
  const lastTapTime = useRef(null);
  const longPressTimer = useRef(null);
  const initialDistance = useRef(null);
  const elementRef = useRef(null);

  // Calculate distance between two touch points
  const getDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = useCallback((e) => {
    if (preventScroll) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    const startPoint = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    setTouchStart(startPoint);
    setTouchEnd(null);
    touchStartTime.current = Date.now();

    // Handle pinch gesture initialization
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress({
          x: touch.clientX,
          y: touch.clientY,
          target: e.target
        });
        setGesture('longPress');
      }, longPressDelay);
    }
  }, [preventScroll, onLongPress, longPressDelay]);

  // Handle touch move
  const handleTouchMove = useCallback((e) => {
    if (!touchStart) return;

    // Clear long press timer on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const touch = e.touches[0];
    const currentPoint = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    setTouchEnd(currentPoint);

    // Calculate velocity
    const timeDiff = (currentPoint.time - touchStart.time) / 1000;
    if (timeDiff > 0) {
      setVelocity({
        x: (currentPoint.x - touchStart.x) / timeDiff,
        y: (currentPoint.y - touchStart.y) / timeDiff
      });
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && initialDistance.current && onPinch) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance.current;
      
      onPinch({
        scale,
        distance: currentDistance,
        center: {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        }
      });
      
      setGesture('pinch');
    }
  }, [touchStart, onPinch]);

  // Handle touch end
  const handleTouchEnd = useCallback((e) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!touchStart) return;

    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime.current;
    
    // If no touchEnd was set (no move), use the touch start position
    const endPoint = touchEnd || touchStart;
    
    const deltaX = endPoint.x - touchStart.x;
    const deltaY = endPoint.y - touchStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Check for tap
    if (distance < tapThreshold && touchDuration < longPressDelay) {
      // Check for double tap
      if (lastTapTime.current && touchEndTime - lastTapTime.current < doubleTapDelay) {
        if (onDoubleTap) {
          onDoubleTap({
            x: touchStart.x,
            y: touchStart.y,
            target: e.target
          });
          setGesture('doubleTap');
        }
        lastTapTime.current = null;
      } else {
        // Single tap
        if (onTap) {
          onTap({
            x: touchStart.x,
            y: touchStart.y,
            target: e.target
          });
          setGesture('tap');
        }
        lastTapTime.current = touchEndTime;
      }
    }
    
    // Check for swipe
    else if (distance >= swipeThreshold) {
      const absVelocityX = Math.abs(velocity.x);
      const absVelocityY = Math.abs(velocity.y);
      
      if (absVelocityX > swipeVelocityThreshold || absVelocityY > swipeVelocityThreshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight({ distance: deltaX, velocity: velocity.x });
            setGesture('swipeRight');
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft({ distance: Math.abs(deltaX), velocity: Math.abs(velocity.x) });
            setGesture('swipeLeft');
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown({ distance: deltaY, velocity: velocity.y });
            setGesture('swipeDown');
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp({ distance: Math.abs(deltaY), velocity: Math.abs(velocity.y) });
            setGesture('swipeUp');
          }
        }
      }
    }

    // Reset states
    setTouchStart(null);
    setTouchEnd(null);
    setVelocity({ x: 0, y: 0 });
    initialDistance.current = null;
  }, [
    touchStart,
    touchEnd,
    velocity,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    swipeThreshold,
    swipeVelocityThreshold,
    tapThreshold,
    doubleTapDelay,
    longPressDelay
  ]);

  // Bind event listeners
  const bind = useCallback((element) => {
    if (!element) return;
    
    elementRef.current = element;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventScroll });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll]);

  // Return props to spread on element
  const gestureProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };

  return {
    bind,
    gestureProps,
    gesture,
    touchStart,
    touchEnd,
    velocity,
    isGesturing: !!touchStart
  };
};

/**
 * Hook for swipeable cards
 */
export const useSwipeableCard = (options = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    swipeThreshold = 100,
    animationDuration = 300
  } = options;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [opacity, setOpacity] = useState(1);

  const gestures = useTouchGestures({
    onSwipeLeft: (data) => {
      animateSwipe('left');
      if (onSwipeLeft) onSwipeLeft(data);
    },
    onSwipeRight: (data) => {
      animateSwipe('right');
      if (onSwipeRight) onSwipeRight(data);
    },
    swipeThreshold
  });

  const animateSwipe = (direction) => {
    const targetX = direction === 'left' ? -window.innerWidth : window.innerWidth;
    
    setOffset({ x: targetX, y: 0 });
    setOpacity(0);
    
    setTimeout(() => {
      setOffset({ x: 0, y: 0 });
      setOpacity(1);
    }, animationDuration);
  };

  const handleTouchMove = (e) => {
    if (!gestures.touchStart) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - gestures.touchStart.x;
    const deltaY = touch.clientY - gestures.touchStart.y;
    
    setOffset({ x: deltaX, y: deltaY * 0.2 });
    setIsDragging(true);
    
    // Calculate opacity based on swipe distance
    const swipeProgress = Math.abs(deltaX) / swipeThreshold;
    setOpacity(Math.max(0.3, 1 - swipeProgress * 0.5));
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    // Snap back if not swiped far enough
    if (Math.abs(offset.x) < swipeThreshold) {
      setOffset({ x: 0, y: 0 });
      setOpacity(1);
    }
    
    setIsDragging(false);
  };

  const cardStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x * 0.1}deg)`,
    opacity,
    transition: isDragging ? 'none' : `all ${animationDuration}ms ease-out`
  };

  return {
    ...gestures,
    cardStyle,
    offset,
    isDragging,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

/**
 * Hook for pinch to zoom
 */
export const usePinchZoom = (options = {}) => {
  const {
    minScale = 1,
    maxScale = 3,
    initialScale = 1
  } = options;

  const [scale, setScale] = useState(initialScale);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  const handlePinch = useCallback((data) => {
    const newScale = Math.min(maxScale, Math.max(minScale, data.scale));
    setScale(newScale);
    setOrigin(data.center);
  }, [minScale, maxScale]);

  const gestures = useTouchGestures({
    onPinch: handlePinch,
    onDoubleTap: () => {
      // Toggle between min and max scale on double tap
      setScale(current => current > minScale ? minScale : maxScale);
    }
  });

  const zoomStyle = {
    transform: `scale(${scale})`,
    transformOrigin: `${origin.x}px ${origin.y}px`,
    transition: 'transform 0.2s ease-out'
  };

  return {
    ...gestures,
    scale,
    zoomStyle,
    resetZoom: () => setScale(initialScale)
  };
};

export default useTouchGestures;
