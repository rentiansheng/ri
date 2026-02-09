import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlowEditor from '../FlowEditor';
import { useTerminalStore } from '../../store/terminalStore';
import { Flow } from '../../types/global.d';

const mockFlow: Flow = {
  id: 'flow-1',
  name: 'Build Project',
  description: 'Build the project for production',
  icon: '🔨',
  mode: 'template',
  commands: ['npm install', 'npm run build', 'npm run test'],
  cwd: '/home/user/project',
  enabled: true,
  path: '',
};

const mockConfigGet = vi.fn();
const mockConfigUpdate = vi.fn();
const mockCreateSession = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  
  mockConfigGet.mockResolvedValue({ flows: [mockFlow] });
  mockConfigUpdate.mockResolvedValue({ success: true });
  
  (window as any).config = {
    get: mockConfigGet,
    update: mockConfigUpdate,
  };

  useTerminalStore.setState({
    sessions: [],
    tabs: [{ id: 'tab-1', type: 'flow', flowId: 'flow-1', title: '⚡ Build Project' }],
    activeTabId: 'tab-1',
    visibleSessionIds: [],
    activeSessionId: null,
  });

  vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(mockCreateSession);
});

describe('FlowEditor', () => {
  describe('Rendering', () => {
    it('should render loading state initially', () => {
      render(<FlowEditor flowId="flow-1" />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render flow name after loading', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
    });

    it('should render flow icon', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('🔨')).toBeInTheDocument();
      });
    });

    it('should render flow mode badge', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('TEMPLATE')).toBeInTheDocument();
      });
    });

    it('should render flow description', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Build the project for production')).toBeInTheDocument();
      });
    });

    it('should render working directory', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('/home/user/project')).toBeInTheDocument();
      });
    });

    it('should render all commands', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText('Enter command...');
        expect(inputs).toHaveLength(3);
        expect(inputs[0]).toHaveValue('npm install');
        expect(inputs[1]).toHaveValue('npm run build');
        expect(inputs[2]).toHaveValue('npm run test');
      });
    });

    it('should render command line numbers', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should render Run and Save buttons', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('▶ Run')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('should render error when flow not found', async () => {
      mockConfigGet.mockResolvedValue({ flows: [] });
      
      render(<FlowEditor flowId="non-existent" />);
      
      await waitFor(() => {
        expect(screen.getByText('Flow not found')).toBeInTheDocument();
      });
    });
  });

  describe('Command Editing', () => {
    it('should update command on input change', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[0], { target: { value: 'yarn install' } });
      
      expect(inputs[0]).toHaveValue('yarn install');
    });

    it('should show dirty indicator when modified', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[0], { target: { value: 'yarn install' } });
      
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should add new command on Enter', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.keyDown(inputs[0], { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(4);
      });
    });

    it('should remove empty command on Backspace', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[1], { target: { value: '' } });
      fireEvent.keyDown(inputs[1], { key: 'Backspace' });
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(2);
      });
    });

    it('should add command via + button', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const addButton = screen.getByTitle('Add Command');
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(4);
      });
    });

    it('should move command up', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const moveUpButtons = screen.getAllByTitle('Move Up');
      fireEvent.click(moveUpButtons[1]);
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      expect(inputs[0]).toHaveValue('npm run build');
      expect(inputs[1]).toHaveValue('npm install');
    });

    it('should move command down', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const moveDownButtons = screen.getAllByTitle('Move Down');
      fireEvent.click(moveDownButtons[0]);
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      expect(inputs[0]).toHaveValue('npm run build');
      expect(inputs[1]).toHaveValue('npm install');
    });

    it('should remove command via × button', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const removeButtons = screen.getAllByTitle('Remove');
      fireEvent.click(removeButtons[1]);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(2);
      });
    });

    it('should navigate with arrow keys', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      inputs[0].focus();
      
      fireEvent.keyDown(inputs[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(inputs[1]);
      
      fireEvent.keyDown(inputs[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(inputs[0]);
    });
  });

  describe('Save', () => {
    it('should save commands on Save button click', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[0], { target: { value: 'yarn install' } });
      
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });

    it('should show saving status', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });

    it('should filter empty commands when saving', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[1], { target: { value: '   ' } });
      
      fireEvent.click(screen.getByText('Save'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
        const updateCall = mockConfigUpdate.mock.calls[0][0];
        const savedFlow = updateCall.flows.find((f: Flow) => f.id === 'flow-1');
        expect(savedFlow.commands).toHaveLength(2);
      });
    });
  });

  describe('Run', () => {
    it('should create session with commands on Run click', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('▶ Run')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('▶ Run'));
      
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith('Build Project', {
          cwd: '/home/user/project',
          commands: ['npm install', 'npm run build', 'npm run test'],
        });
      });
    });

    it('should save before running if dirty', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Enter command...')).toHaveLength(3);
      });
      
      const inputs = screen.getAllByPlaceholderText('Enter command...');
      fireEvent.change(inputs[0], { target: { value: 'yarn install' } });
      
      fireEvent.click(screen.getByText('▶ Run'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
        expect(mockCreateSession).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save on Cmd+S', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(window, { key: 's', metaKey: true });
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });

    it('should save on Ctrl+S', async () => {
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Empty Flow', () => {
    it('should render single empty command input for new flow', async () => {
      mockConfigGet.mockResolvedValue({
        flows: [{
          ...mockFlow,
          commands: [],
        }],
      });
      
      render(<FlowEditor flowId="flow-1" />);
      
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText('Enter command...');
        expect(inputs).toHaveLength(1);
        expect(inputs[0]).toHaveValue('');
      });
    });
  });
});
