import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTerminalStore, SplitPane } from '../store/terminalStore';
import { SplitProvider } from '../contexts/SplitContext';
import Terminal from './Terminal';
import './SplitTerminalView.css';

interface SplitTerminalViewProps {
  sessionId: string;
  sessionName: string;
  isActive: boolean;
  isVisible: boolean;
}

const SplitTerminalView: React.FC<SplitTerminalViewProps> = ({
  sessionId,
  sessionName,
  isActive,
  isVisible
}) => {
  const session = useTerminalStore((state) => 
    state.sessions.find(s => s.id === sessionId)
  );
  const createTerminalInSession = useTerminalStore((state) => state.createTerminalInSession);
  const getSessionLayout = useTerminalStore((state) => state.getSessionLayout);
  const setSessionLayout = useTerminalStore((state) => state.setSessionLayout);
  const ensureSessionHasTerminal = useTerminalStore((state) => state.ensureSessionHasTerminal);
  const getSessionActiveTerminal = useTerminalStore((state) => state.getSessionActiveTerminal);
  const setSessionActiveTerminal = useTerminalStore((state) => state.setSessionActiveTerminal);
  
  const splitLayout = useTerminalStore((state) => state.sessionLayouts[sessionId] || null);
  const storeActiveTerminal = useTerminalStore((state) => state.sessionActiveTerminals[sessionId]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(() => getSessionActiveTerminal(sessionId) || null);
  const isSplittingRef = useRef<boolean>(false);
  const dragStateRef = useRef<{
    paneId: string;
    childIndex: number;
    direction: 'horizontal' | 'vertical';
    startPos: number;
    firstSize: number;
    secondSize: number;
    containerSize: number;
  } | null>(null);

  const MIN_PANE_FRACTION = 0.1;

  const extractTerminalIds = useCallback((layout: SplitPane): string[] => {
    if (layout.terminalId) {
      return [layout.terminalId];
    }
    if (layout.children) {
      return layout.children.flatMap(child => extractTerminalIds(child));
    }
    return [];
  }, []);

  useEffect(() => {
    if (isActive) {
      ensureSessionHasTerminal(sessionId);
      
      if (!activeTerminalId && session && session.terminalIds.length > 0) {
        console.log(`[SplitTerminalView] Setting activeTerminalId to ${session.terminalIds[0]}`);
    setActiveTerminalId(session.terminalIds[0]);
    setSessionActiveTerminal(sessionId, session.terminalIds[0]);
      }
    }
  }, [isActive, sessionId, ensureSessionHasTerminal, activeTerminalId, session]);

  // Sync with store's activeTerminal (for keyboard shortcuts)
  useEffect(() => {
    if (storeActiveTerminal && storeActiveTerminal !== activeTerminalId) {
      setActiveTerminalId(storeActiveTerminal);
    }
  }, [storeActiveTerminal]);



  useEffect(() => {
    if (!session || session.terminalIds.length === 0) return;
    if (splitLayout) return;
    
    const initialLayout: SplitPane = {
      id: 'root',
      terminalId: session.terminalIds[0]
    };
    setSessionLayout(sessionId, initialLayout);
    setActiveTerminalId(session.terminalIds[0]);
  }, [session?.terminalIds, splitLayout, sessionId, setSessionLayout]);



  useEffect(() => {
    if (!session || !splitLayout || isSplittingRef.current) return;
    
    const currentTerminalIds = session.terminalIds;
    const layoutTerminalIds = extractTerminalIds(splitLayout);
    
    const removedTerminalIds = layoutTerminalIds.filter(id => !currentTerminalIds.includes(id));
    
    if (removedTerminalIds.length > 0) {
      if (splitLayout) {
        const updated = removeTerminalsFromLayout(splitLayout, removedTerminalIds);
        if (updated) {
          setSessionLayout(sessionId, updated);
        }
      }
      
      if (activeTerminalId && removedTerminalIds.includes(activeTerminalId)) {
        const newActiveId = currentTerminalIds[0] || null;
        setActiveTerminalId(newActiveId);
        if (newActiveId) {
          setSessionActiveTerminal(sessionId, newActiveId);
        }
      }
    }
  }, [session?.terminalIds, splitLayout, activeTerminalId, sessionId, setSessionLayout, extractTerminalIds]);

  const splitTerminal = async (terminalId: string, direction: 'horizontal' | 'vertical') => {
    if (!session || isSplittingRef.current) return;
    
    isSplittingRef.current = true;
    
    try {
      const newTerminalId = await createTerminalInSession(sessionId);
      if (!newTerminalId) {
        isSplittingRef.current = false;
        return;
      }

      if (splitLayout) {
        const newLayout = updateLayoutForSplit(splitLayout, terminalId, newTerminalId, direction);
        setSessionLayout(sessionId, newLayout);
      }

      setActiveTerminalId(newTerminalId);
      setSessionActiveTerminal(sessionId, newTerminalId);
      
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    } finally {
      setTimeout(() => {
        isSplittingRef.current = false;
      }, 100);
    }
  };

  const removeTerminalsFromLayout = (layout: SplitPane, terminalIdsToRemove: string[]): SplitPane | null => {
    if (layout.terminalId) {
      return terminalIdsToRemove.includes(layout.terminalId) ? null : layout;
    }
    
    if (layout.children) {
      const filteredChildren = layout.children
        .map(child => removeTerminalsFromLayout(child, terminalIdsToRemove))
        .filter(child => child !== null) as SplitPane[];
      
      if (filteredChildren.length === 0) {
        return null;
      }
      
      if (filteredChildren.length === 1) {
        return filteredChildren[0];
      }
      
      return {
        ...layout,
        children: filteredChildren
      };
    }
    
    return layout;
  };

  const updateChildSizes = useCallback((layout: SplitPane, paneId: string, childIndex: number, newFirstSize: number, newSecondSize: number): SplitPane => {
    if (layout.id === paneId && layout.children) {
      const updatedChildren = layout.children.map((child, idx) => {
        if (idx === childIndex) {
          return { ...child, size: newFirstSize };
        }
        if (idx === childIndex + 1) {
          return { ...child, size: newSecondSize };
        }
        return child;
      });
      return {
        ...layout,
        children: updatedChildren,
      };
    }

    if (layout.children) {
      return {
        ...layout,
        children: layout.children.map(child => updateChildSizes(child, paneId, childIndex, newFirstSize, newSecondSize)),
      };
    }

    return layout;
  }, []);

  const handleMouseMove = (event: MouseEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const currentPos = dragState.direction === 'horizontal' ? event.clientY : event.clientX;
    const deltaPx = currentPos - dragState.startPos;
    const deltaFraction = deltaPx / dragState.containerSize;

    const total = dragState.firstSize + dragState.secondSize;
    let newFirstSize = dragState.firstSize + deltaFraction;
    const minLimit = Math.min(MIN_PANE_FRACTION, total - 0.05);
    const clampedMin = Math.max(0.01, minLimit);
    const clampedMax = total - clampedMin;
    newFirstSize = Math.min(clampedMax, Math.max(clampedMin, newFirstSize));
    const newSecondSize = total - newFirstSize;

    const currentLayout = useTerminalStore.getState().sessionLayouts[sessionId];
    if (currentLayout) {
      const updatedLayout = updateChildSizes(currentLayout, dragState.paneId, dragState.childIndex, newFirstSize, newSecondSize);
      useTerminalStore.getState().setSessionLayout(sessionId, updatedLayout);
    }
  };

  const handleMouseUp = () => {
    dragStateRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove as any);
    document.removeEventListener('mouseup', handleMouseUp as any);
    
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  const stopDragging = useCallback(() => {
    handleMouseUp();
  }, []);



  useEffect(() => {
    return () => {
      stopDragging();
    };
  }, [stopDragging]);

  const handleDividerMouseDown = (event: React.MouseEvent<HTMLDivElement>, pane: SplitPane, childIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pane.direction || !pane.children || pane.children.length <= childIndex + 1) return;

    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const containerSize = pane.direction === 'horizontal' ? rect.height : rect.width;

    const childCount = pane.children.length;
    const defaultSize = 1 / childCount;
    const firstSize = pane.children[childIndex].size ?? defaultSize;
    const secondSize = pane.children[childIndex + 1].size ?? defaultSize;

    dragStateRef.current = {
      paneId: pane.id,
      childIndex,
      direction: pane.direction,
      startPos: pane.direction === 'horizontal' ? event.clientY : event.clientX,
      firstSize,
      secondSize,
      containerSize,
    };

    document.addEventListener('mousemove', handleMouseMove as any);
    document.addEventListener('mouseup', handleMouseUp as any);
  };

  const updateLayoutForSplit = (
    layout: SplitPane, 
    targetTerminalId: string, 
    newTerminalId: string, 
    direction: 'horizontal' | 'vertical'
  ): SplitPane => {
    if (layout.terminalId === targetTerminalId) {
      const now = Date.now();
      return {
        id: `split-${now}`,
        direction,
        children: [
          { id: `pane-${layout.terminalId}`, terminalId: layout.terminalId, size: 0.5 },
          { id: `pane-${newTerminalId}`, terminalId: newTerminalId, size: 0.5 }
        ]
      };
    }
    
    if (layout.children) {
      return {
        ...layout,
        children: layout.children.map(child => 
          updateLayoutForSplit(child, targetTerminalId, newTerminalId, direction)
        )
      };
    }
    
    return layout;
  };

  const renderSplitPane = (pane: SplitPane, containerStyle: React.CSSProperties = {}): React.ReactNode => {
    if (pane.terminalId) {
      const isThisTerminalActive = activeTerminalId === pane.terminalId;
      
      const handleTerminalActivate = (e: React.MouseEvent) => {
        if (!pane.terminalId) return;
        
        // Prevent the event from propagating to avoid double-handling
        e.stopPropagation();
        
        document.querySelectorAll('[data-recently-clicked="true"]').forEach(el => {
          el.removeAttribute('data-recently-clicked');
        });
        
        const currentElement = document.querySelector(`[data-terminal-id="${pane.terminalId}"]`);
        if (currentElement) {
          currentElement.setAttribute('data-recently-clicked', 'true');
          setTimeout(() => {
            currentElement.removeAttribute('data-recently-clicked');
          }, 1000);
        }
        
        setActiveTerminalId(pane.terminalId);
        setSessionActiveTerminal(sessionId, pane.terminalId);
        
        const focusHiddenInput = () => {
          const terminalElement = document.querySelector(`[data-terminal-id="${pane.terminalId}"]`);
          const hiddenInput = terminalElement?.querySelector('textarea');
          if (hiddenInput) {
            hiddenInput.focus({ preventScroll: true });
            return true;
          }
          return false;
        };
        
        if (!focusHiddenInput()) {
          setTimeout(() => {
            if (!focusHiddenInput()) {
              setTimeout(focusHiddenInput, 100);
            }
          }, 0);
        }
      };

      return (
        <div 
          key={pane.id || pane.terminalId}
          className={`split-pane-terminal ${isThisTerminalActive ? 'active' : ''}`}
          style={containerStyle}
        >
          {/* Transparent overlay to capture clicks when terminal is not active */}
          {!isThisTerminalActive && (
            <div
              className="terminal-activation-overlay"
              onMouseDown={handleTerminalActivate}
              onClick={handleTerminalActivate}
            />
          )}
          <Terminal
            sessionId={sessionId}
            terminalId={pane.terminalId}
            sessionName={sessionName}
            isActive={isActive && isThisTerminalActive}
            isVisible={isVisible}
            useRelativePosition={session ? session.terminalIds.length > 1 : false}
          />
        </div>
      );
    }
    
    if (pane.children && pane.direction) {
      const isHorizontal = pane.direction === 'horizontal';
      
      return (
        <div 
          key={pane.id}
          className={`split-container ${pane.direction}`}
          style={containerStyle}
        >
          {pane.children.map((child, index) => {
            const size = child.size || (1 / pane.children!.length);
            const childStyle: React.CSSProperties = isHorizontal 
              ? { height: `${size * 100}%`, width: '100%' }
              : { width: `${size * 100}%`, height: '100%' };
            
            return (
              <React.Fragment key={child.id || `child-${index}`}>
                {renderSplitPane(child, childStyle)}
                {index < pane.children!.length - 1 && (
                  <div 
                    className={`split-divider ${pane.direction}`}
                    onMouseDown={(e) => handleDividerMouseDown(e, pane, index)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }
    
    return null;
  };

  if (!session || !splitLayout) {
    return <div className="split-terminal-loading">Loading...</div>;
  }

  return (
    <SplitProvider splitTerminal={splitTerminal}>
      <div 
        className="split-terminal-view"
        style={{
          // Use isActive (not isVisible) to control display
          // isVisible = session has an open tab
          // isActive = session's tab is currently selected
          display: isActive ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {renderSplitPane(splitLayout, { width: '100%', height: '100%' })}
      </div>
    </SplitProvider>
  );
};

export default SplitTerminalView;
