'use client';

import { useRef, useCallback, useEffect } from 'react';
import { InputAction } from '@/engine/types';

interface VirtualControllerProps {
  onAction: (action: InputAction) => void;
  onActionStart?: (action: InputAction) => void;
  onActionEnd?: (action: InputAction) => void;
  compact?: boolean;
}

export default function VirtualController({
  onAction,
  onActionStart,
  onActionEnd,
  compact = false,
}: VirtualControllerProps) {
  const repeatTimers = useRef<Map<InputAction, ReturnType<typeof setTimeout>>>(new Map());
  const dpadButtonWidth = compact ? 50 : 58;
  const dpadButtonHeight = compact ? 36 : 42;
  const actionButtonSize = compact ? 48 : 56;
  const mainGap = compact ? 8 : 12;
  const buttonGap = compact ? 8 : 12;
  const containerPadding = compact ? '6px 8px' : '8px 12px';
  const holdPadding = compact ? '8px 14px' : '8px 22px';
  const downPadding = compact ? '8px 16px' : '9px 20px';
  const labelFontSize = compact ? '8px' : '9px';
  const repeatDelay = 160;

  const clearRepeat = useCallback((action: InputAction) => {
    const timer = repeatTimers.current.get(action);
    if (timer) {
      clearTimeout(timer);
      repeatTimers.current.delete(action);
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of repeatTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const scheduleRepeat = useCallback((action: InputAction) => {
    clearRepeat(action);
    const loop = () => {
      const timer = setTimeout(() => {
        onAction(action);
        loop();
      }, repeatDelay);
      repeatTimers.current.set(action, timer);
    };
    loop();
  }, [clearRepeat, onAction, repeatDelay]);

  const handleStart = useCallback((action: InputAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (action === 'down') {
      onActionStart?.(action);
      return;
    }

    onAction(action);
    onActionStart?.(action);

    if (action === 'left' || action === 'right') {
      scheduleRepeat(action);
    }
  }, [onAction, onActionStart, scheduleRepeat]);

  const handleEnd = useCallback((action: InputAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearRepeat(action);
    onActionEnd?.(action);
  }, [clearRepeat, onActionEnd]);

  const tp = (action: InputAction) => ({
    onTouchStart: (e: React.TouchEvent) => handleStart(action, e),
    onTouchEnd: (e: React.TouchEvent) => handleEnd(action, e),
    onTouchCancel: (e: React.TouchEvent) => handleEnd(action, e),
    onMouseDown: (e: React.MouseEvent) => handleStart(action, e),
    onMouseUp: (e: React.MouseEvent) => handleEnd(action, e),
    onMouseLeave: (e: React.MouseEvent) => handleEnd(action, e),
  });

  const baseBtn: React.CSSProperties = {
    background: '#2a2a2a',
    border: '1px solid #555',
    color: '#ccc',
    fontSize: '16px',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    cursor: 'pointer',
    minWidth: 0,
    minHeight: 0,
    borderRadius: '6px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.5)',
  };

  const roundBtn = (bg: string, shadow: string): React.CSSProperties => ({
    width: `${actionButtonSize}px`,
    height: `${actionButtonSize}px`,
    borderRadius: '50%',
    background: bg,
    border: '2px solid rgba(0,0,0,0.3)',
    color: '#fff',
    fontSize: compact ? '10px' : '11px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    cursor: 'pointer',
    boxShadow: `inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -2px 3px rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.5), 0 0 8px ${shadow}`,
  });

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: containerPadding,
      gap: `${mainGap}px`,
      boxSizing: 'border-box',
      touchAction: 'none',
      background: 'linear-gradient(180deg, #2e2e2e 0%, #1a1a1a 100%)',
      borderTop: '2px solid #444',
    }}>
      {/* Left: D-pad cross */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}>
        <button style={{ ...baseBtn, width: `${dpadButtonWidth}px`, height: `${dpadButtonHeight}px` }} {...tp('left')}>&#9664;</button>
        <div style={{
          width: compact ? '18px' : '22px',
          height: compact ? '18px' : '22px',
          background: '#222',
          border: '1px solid #444',
          borderRadius: '999px',
        }} />
        <button style={{ ...baseBtn, width: `${dpadButtonWidth}px`, height: `${dpadButtonHeight}px` }} {...tp('right')}>&#9654;</button>
      </div>

      {/* Center: HOLD pill button + label */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? '4px' : '6px',
        flex: '1 1 auto',
        minWidth: 0,
      }}>
        {!compact && (
          <span style={{
            fontSize: '7px',
            fontFamily: 'monospace',
            color: '#555',
            letterSpacing: '2px',
          }}>METEOR CRUSH</span>
        )}
        <button
          style={{
            padding: holdPadding,
            borderRadius: '20px',
            background: '#333',
            border: '1px solid #555',
            color: '#aaa',
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '1px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
          {...tp('hold')}
        >HOLD</button>
        <button
          style={{
            padding: downPadding,
            borderRadius: '18px',
            background: '#244d2e',
            border: '1px solid #4f9c63',
            color: '#d8ffe0',
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '1px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
          {...tp('down')}
        >DOWN</button>
      </div>

      {/* Right: Round action buttons (NES style) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${buttonGap}px`,
        flexShrink: 0,
      }}>
        {/* B = DROP (left, lower) */}
        <div style={{ marginTop: compact ? '12px' : '20px', textAlign: 'center' }}>
          <button style={roundBtn('#c0392b', 'rgba(192,57,43,0.3)')} {...tp('hardDrop')}>DROP</button>
          <div style={{ marginTop: '2px', fontSize: labelFontSize, color: '#555', fontFamily: 'monospace' }}>B</div>
        </div>
        {/* A = ROT (right, higher) */}
        <div style={{ textAlign: 'center' }}>
          <button style={roundBtn('#2471a3', 'rgba(36,113,163,0.3)')} {...tp('rotateCW')}>ROT</button>
          <div style={{ marginTop: '2px', fontSize: labelFontSize, color: '#555', fontFamily: 'monospace' }}>A</div>
        </div>
      </div>
    </div>
  );
}
