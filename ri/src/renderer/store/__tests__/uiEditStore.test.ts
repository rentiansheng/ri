import { describe, it, expect, beforeEach } from 'vitest';
import { useUIEditStore } from '../uiEditStore';

describe('UIEditStore', () => {
  beforeEach(() => {
    useUIEditStore.setState({
      editingSessionId: null,
      sessionEditName: '',
      editingTabId: null,
      tabEditName: '',
    });
  });

  describe('Initial State', () => {
    it('should have null editingSessionId', () => {
      const state = useUIEditStore.getState();
      expect(state.editingSessionId).toBeNull();
    });

    it('should have empty sessionEditName', () => {
      const state = useUIEditStore.getState();
      expect(state.sessionEditName).toBe('');
    });

    it('should have null editingTabId', () => {
      const state = useUIEditStore.getState();
      expect(state.editingTabId).toBeNull();
    });

    it('should have empty tabEditName', () => {
      const state = useUIEditStore.getState();
      expect(state.tabEditName).toBe('');
    });
  });

  describe('Session Edit Operations', () => {
    describe('startEditSession', () => {
      it('should set editingSessionId and sessionEditName', () => {
        const { startEditSession } = useUIEditStore.getState();

        startEditSession('session-1', 'My Session');

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBe('session-1');
        expect(state.sessionEditName).toBe('My Session');
      });

      it('should update existing edit state', () => {
        const { startEditSession } = useUIEditStore.getState();

        startEditSession('session-1', 'First Name');
        startEditSession('session-2', 'Second Name');

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBe('session-2');
        expect(state.sessionEditName).toBe('Second Name');
      });
    });

    describe('updateSessionEditName', () => {
      it('should update sessionEditName', () => {
        const { startEditSession, updateSessionEditName } = useUIEditStore.getState();

        startEditSession('session-1', 'Old Name');
        updateSessionEditName('New Name');

        const state = useUIEditStore.getState();
        expect(state.sessionEditName).toBe('New Name');
      });

      it('should work with empty string', () => {
        const { startEditSession, updateSessionEditName } = useUIEditStore.getState();

        startEditSession('session-1', 'Some Name');
        updateSessionEditName('');

        const state = useUIEditStore.getState();
        expect(state.sessionEditName).toBe('');
      });

      it('should preserve whitespace in name', () => {
        const { startEditSession, updateSessionEditName } = useUIEditStore.getState();

        startEditSession('session-1', 'Initial');
        updateSessionEditName('  Spaced  ');

        const state = useUIEditStore.getState();
        expect(state.sessionEditName).toBe('  Spaced  ');
      });
    });

    describe('finishEditSession', () => {
      it('should clear editing state', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();

        startEditSession('session-1', 'My Session');
        finishEditSession();

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBeNull();
        expect(state.sessionEditName).toBe('');
      });

      it('should call onSave with trimmed name', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();
        const onSave = (name: string) => expect(name).toBe('New Name');

        startEditSession('session-1', '  New Name  ');
        finishEditSession(onSave);
      });

      it('should not call onSave when name is empty', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditSession('session-1', '');
        finishEditSession(onSave as any);

        expect(onSave).not.toHaveBeenCalled();
      });

      it('should not call onSave when name is only whitespace', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditSession('session-1', '   ');
        finishEditSession(onSave as any);

        expect(onSave).not.toHaveBeenCalled();
      });

      it('should clear state even if onSave is not provided', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();

        startEditSession('session-1', 'Session');
        finishEditSession();

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBeNull();
        expect(state.sessionEditName).toBe('');
      });

      it('should clear state even if name is invalid', () => {
        const { startEditSession, finishEditSession } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditSession('session-1', '   ');
        finishEditSession(onSave as any);

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBeNull();
        expect(state.sessionEditName).toBe('');
      });
    });

    describe('cancelEditSession', () => {
      it('should clear editing state without saving', () => {
        const { startEditSession, cancelEditSession } = useUIEditStore.getState();

        startEditSession('session-1', 'Session Name');
        cancelEditSession();

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBeNull();
        expect(state.sessionEditName).toBe('');
      });

      it('should work even if not editing', () => {
        const { cancelEditSession } = useUIEditStore.getState();

        expect(() => cancelEditSession()).not.toThrow();

        const state = useUIEditStore.getState();
        expect(state.editingSessionId).toBeNull();
      });
    });
  });

  describe('Tab Edit Operations', () => {
    describe('startEditTab', () => {
      it('should set editingTabId and tabEditName', () => {
        const { startEditTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'My Tab');

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBe('tab-1');
        expect(state.tabEditName).toBe('My Tab');
      });

      it('should update existing edit state', () => {
        const { startEditTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'First Tab');
        startEditTab('tab-2', 'Second Tab');

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBe('tab-2');
        expect(state.tabEditName).toBe('Second Tab');
      });
    });

    describe('updateTabEditName', () => {
      it('should update tabEditName', () => {
        const { startEditTab, updateTabEditName } = useUIEditStore.getState();

        startEditTab('tab-1', 'Old Name');
        updateTabEditName('New Name');

        const state = useUIEditStore.getState();
        expect(state.tabEditName).toBe('New Name');
      });

      it('should work with empty string', () => {
        const { startEditTab, updateTabEditName } = useUIEditStore.getState();

        startEditTab('tab-1', 'Some Name');
        updateTabEditName('');

        const state = useUIEditStore.getState();
        expect(state.tabEditName).toBe('');
      });

      it('should preserve whitespace in name', () => {
        const { startEditTab, updateTabEditName } = useUIEditStore.getState();

        startEditTab('tab-1', 'Initial');
        updateTabEditName('  Spaced  ');

        const state = useUIEditStore.getState();
        expect(state.tabEditName).toBe('  Spaced  ');
      });
    });

    describe('finishEditTab', () => {
      it('should clear editing state', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'My Tab');
        finishEditTab();

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBeNull();
        expect(state.tabEditName).toBe('');
      });

      it('should call onSave with trimmed name', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();
        const onSave = (name: string) => expect(name).toBe('New Name');

        startEditTab('tab-1', '  New Name  ');
        finishEditTab(onSave);
      });

      it('should not call onSave when name is empty', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditTab('tab-1', '');
        finishEditTab(onSave as any);

        expect(onSave).not.toHaveBeenCalled();
      });

      it('should not call onSave when name is only whitespace', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditTab('tab-1', '   ');
        finishEditTab(onSave as any);

        expect(onSave).not.toHaveBeenCalled();
      });

      it('should clear state even if onSave is not provided', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');
        finishEditTab();

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBeNull();
        expect(state.tabEditName).toBe('');
      });

      it('should clear state even if name is invalid', () => {
        const { startEditTab, finishEditTab } = useUIEditStore.getState();
        const onSave = jest.fn();

        startEditTab('tab-1', '   ');
        finishEditTab(onSave as any);

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBeNull();
        expect(state.tabEditName).toBe('');
      });
    });

    describe('cancelEditTab', () => {
      it('should clear editing state without saving', () => {
        const { startEditTab, cancelEditTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab Name');
        cancelEditTab();

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBeNull();
        expect(state.tabEditName).toBe('');
      });

      it('should work even if not editing', () => {
        const { cancelEditTab } = useUIEditStore.getState();

        expect(() => cancelEditTab()).not.toThrow();

        const state = useUIEditStore.getState();
        expect(state.editingTabId).toBeNull();
      });
    });
  });

  describe('Helper Methods', () => {
    describe('isEditingSession', () => {
      it('should return true when editing specified session', () => {
        const { startEditSession, isEditingSession } = useUIEditStore.getState();

        startEditSession('session-1', 'Session');

        expect(isEditingSession('session-1')).toBe(true);
      });

      it('should return false when editing different session', () => {
        const { startEditSession, isEditingSession } = useUIEditStore.getState();

        startEditSession('session-1', 'Session');

        expect(isEditingSession('session-2')).toBe(false);
      });

      it('should return false when not editing any session', () => {
        const { isEditingSession } = useUIEditStore.getState();

        expect(isEditingSession('session-1')).toBe(false);
      });
    });

    describe('isEditingTab', () => {
      it('should return true when editing specified tab', () => {
        const { startEditTab, isEditingTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');

        expect(isEditingTab('tab-1')).toBe(true);
      });

      it('should return false when editing different tab', () => {
        const { startEditTab, isEditingTab } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');

        expect(isEditingTab('tab-2')).toBe(false);
      });

      it('should return false when not editing any tab', () => {
        const { isEditingTab } = useUIEditStore.getState();

        expect(isEditingTab('tab-1')).toBe(false);
      });
    });

    describe('isEditingAnything', () => {
      it('should return false initially', () => {
        const { isEditingAnything } = useUIEditStore.getState();

        expect(isEditingAnything()).toBe(false);
      });

      it('should return true when editing session', () => {
        const { startEditSession, isEditingAnything } = useUIEditStore.getState();

        startEditSession('session-1', 'Session');

        expect(isEditingAnything()).toBe(true);
      });

      it('should return true when editing tab', () => {
        const { startEditTab, isEditingAnything } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');

        expect(isEditingAnything()).toBe(true);
      });

      it('should return false when canceling session edit', () => {
        const { startEditSession, cancelEditSession, isEditingAnything } =
          useUIEditStore.getState();

        startEditSession('session-1', 'Session');
        cancelEditSession();

        expect(isEditingAnything()).toBe(false);
      });

      it('should return false when canceling tab edit', () => {
        const { startEditTab, cancelEditTab, isEditingAnything } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');
        cancelEditTab();

        expect(isEditingAnything()).toBe(false);
      });

      it('should return false when finishing session edit', () => {
        const { startEditSession, finishEditSession, isEditingAnything } =
          useUIEditStore.getState();

        startEditSession('session-1', 'Session');
        finishEditSession();

        expect(isEditingAnything()).toBe(false);
      });

      it('should return false when finishing tab edit', () => {
        const { startEditTab, finishEditTab, isEditingAnything } = useUIEditStore.getState();

        startEditTab('tab-1', 'Tab');
        finishEditTab();

        expect(isEditingAnything()).toBe(false);
      });
    });
  });

  describe('Session and Tab Edit Isolation', () => {
    it('should keep session and tab edits isolated', () => {
      const { startEditSession, startEditTab } = useUIEditStore.getState();

      startEditSession('session-1', 'My Session');
      startEditTab('tab-1', 'My Tab');

      const state = useUIEditStore.getState();
      expect(state.editingSessionId).toBe('session-1');
      expect(state.sessionEditName).toBe('My Session');
      expect(state.editingTabId).toBe('tab-1');
      expect(state.tabEditName).toBe('My Tab');
    });

    it('should not affect session edit when changing tab edit', () => {
      const { startEditSession, startEditTab, updateTabEditName } = useUIEditStore.getState();

      startEditSession('session-1', 'My Session');
      startEditTab('tab-1', 'My Tab');
      updateTabEditName('Updated Tab');

      const state = useUIEditStore.getState();
      expect(state.sessionEditName).toBe('My Session');
      expect(state.tabEditName).toBe('Updated Tab');
    });

    it('should not affect tab edit when changing session edit', () => {
      const { startEditSession, startEditTab, updateSessionEditName } =
        useUIEditStore.getState();

      startEditSession('session-1', 'My Session');
      startEditTab('tab-1', 'My Tab');
      updateSessionEditName('Updated Session');

      const state = useUIEditStore.getState();
      expect(state.sessionEditName).toBe('Updated Session');
      expect(state.tabEditName).toBe('My Tab');
    });

    it('should cancel session edit independently from tab edit', () => {
      const { startEditSession, startEditTab, cancelEditSession } =
        useUIEditStore.getState();

      startEditSession('session-1', 'My Session');
      startEditTab('tab-1', 'My Tab');
      cancelEditSession();

      const state = useUIEditStore.getState();
      expect(state.editingSessionId).toBeNull();
      expect(state.sessionEditName).toBe('');
      expect(state.editingTabId).toBe('tab-1');
      expect(state.tabEditName).toBe('My Tab');
    });

    it('should cancel tab edit independently from session edit', () => {
      const { startEditSession, startEditTab, cancelEditTab } = useUIEditStore.getState();

      startEditSession('session-1', 'My Session');
      startEditTab('tab-1', 'My Tab');
      cancelEditTab();

      const state = useUIEditStore.getState();
      expect(state.editingSessionId).toBe('session-1');
      expect(state.sessionEditName).toBe('My Session');
      expect(state.editingTabId).toBeNull();
      expect(state.tabEditName).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty name in finishEditSession with onSave callback', () => {
      const { startEditSession, finishEditSession } = useUIEditStore.getState();
      const onSave = jest.fn();

      startEditSession('session-1', '');
      finishEditSession(onSave as any);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should handle empty name in finishEditTab with onSave callback', () => {
      const { startEditTab, finishEditTab } = useUIEditStore.getState();
      const onSave = jest.fn();

      startEditTab('tab-1', '');
      finishEditTab(onSave as any);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should trim whitespace before calling onSave in finishEditSession', () => {
      const { startEditSession, finishEditSession } = useUIEditStore.getState();
      let savedName = '';

      startEditSession('session-1', '\t\n  Test  \n\t');
      finishEditSession((name: string) => {
        savedName = name;
      });

      expect(savedName).toBe('Test');
    });

    it('should trim whitespace before calling onSave in finishEditTab', () => {
      const { startEditTab, finishEditTab } = useUIEditStore.getState();
      let savedName = '';

      startEditTab('tab-1', '\t\n  Test  \n\t');
      finishEditTab((name: string) => {
        savedName = name;
      });

      expect(savedName).toBe('Test');
    });

    it('should handle switching between session and tab edits', () => {
      const {
        startEditSession,
        startEditTab,
        isEditingSession,
        isEditingTab,
        isEditingAnything,
      } = useUIEditStore.getState();

      startEditSession('session-1', 'Session');
      expect(isEditingSession('session-1')).toBe(true);
      expect(isEditingTab('tab-1')).toBe(false);
      expect(isEditingAnything()).toBe(true);

      startEditTab('tab-1', 'Tab');
      expect(isEditingSession('session-1')).toBe(true);
      expect(isEditingTab('tab-1')).toBe(true);
      expect(isEditingAnything()).toBe(true);

      startEditSession('session-2', 'Session 2');
      expect(isEditingSession('session-2')).toBe(true);
      expect(isEditingSession('session-1')).toBe(false);
      expect(isEditingTab('tab-1')).toBe(true);
      expect(isEditingAnything()).toBe(true);
    });
  });
});
