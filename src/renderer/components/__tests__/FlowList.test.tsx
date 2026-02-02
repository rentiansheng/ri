import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlowList from '../FlowList';
import { useTerminalStore } from '../../store/terminalStore';
import { Flow } from '../../types/global.d';

const mockFlows: Flow[] = [
  {
    id: 'flow-1',
    name: 'Build Project',
    mode: 'template',
    commands: ['npm install', 'npm run build'],
    enabled: true,
    path: '',
  },
  {
    id: 'flow-2',
    name: 'Deploy',
    mode: 'cron',
    commands: ['./deploy.sh'],
    cron: '0 0 * * *',
    enabled: true,
    path: 'devops',
  },
  {
    id: 'flow-3',
    name: 'Test Suite',
    mode: 'template',
    commands: ['npm test'],
    enabled: true,
    path: 'devops/testing',
  },
];

const mockConfigGet = vi.fn();
const mockConfigUpdate = vi.fn();
const mockCreateSession = vi.fn();
const mockOpenFlowTab = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  
  mockConfigGet.mockResolvedValue({ flows: mockFlows });
  mockConfigUpdate.mockResolvedValue({ success: true });
  
  (window as any).config = {
    get: mockConfigGet,
    update: mockConfigUpdate,
  };

  useTerminalStore.setState({
    sessions: [],
    tabs: [],
    activeTabId: null,
    visibleSessionIds: [],
    activeSessionId: null,
  });

  vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(mockCreateSession);
  vi.spyOn(useTerminalStore.getState(), 'openFlowTab').mockImplementation(mockOpenFlowTab);
});

describe('FlowList', () => {
  describe('Rendering', () => {
    it('should render header with title', async () => {
      render(<FlowList />);
      
      expect(screen.getByText('WORKFLOWS')).toBeInTheDocument();
    });

    it('should render + button for new flow', async () => {
      render(<FlowList />);
      
      const addButton = screen.getByTitle('New Flow');
      expect(addButton).toBeInTheDocument();
    });

    it('should render empty state when no flows', async () => {
      mockConfigGet.mockResolvedValue({ flows: [] });
      
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('No workflows yet')).toBeInTheDocument();
        expect(screen.getByText('Right-click to create')).toBeInTheDocument();
      });
    });

    it('should render flow items after loading', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
    });

    it('should render folder structure', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
    });

    it('should show flow mode badge', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        const badges = screen.getAllByText('T');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should show cron badge for cron flows', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      const devopsFolder = screen.getByText('devops');
      fireEvent.click(devopsFolder);
      
      await waitFor(() => {
        const cronBadges = screen.getAllByText('C');
        expect(cronBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Folder Collapse/Expand', () => {
    it('should expand folder on click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      const devopsFolder = screen.getByText('devops');
      fireEvent.click(devopsFolder);
      
      await waitFor(() => {
        expect(screen.getByText('Deploy')).toBeInTheDocument();
      });
    });

    it('should collapse folder on second click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      const devopsFolder = screen.getByText('devops');
      fireEvent.click(devopsFolder);
      
      await waitFor(() => {
        expect(screen.getByText('Deploy')).toBeInTheDocument();
      });
      
      fireEvent.click(devopsFolder);
      
      await waitFor(() => {
        expect(screen.queryByText('Deploy')).not.toBeInTheDocument();
      });
    });

    it('should show nested folders', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('devops'));
      
      await waitFor(() => {
        expect(screen.getByText('testing')).toBeInTheDocument();
      });
    });
  });

  describe('Flow Selection', () => {
    it('should call onFlowSelect when clicking a flow', async () => {
      const onFlowSelect = vi.fn();
      render(<FlowList onFlowSelect={onFlowSelect} />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Build Project'));
      
      expect(onFlowSelect).toHaveBeenCalledWith(mockFlows[0]);
    });

    it('should open flow tab when clicking a flow', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Build Project'));
      
      expect(mockOpenFlowTab).toHaveBeenCalledWith('flow-1', 'Build Project');
    });

    it('should call onFolderSelect when clicking a folder', async () => {
      const onFolderSelect = vi.fn();
      render(<FlowList onFolderSelect={onFolderSelect} />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('devops'));
      
      expect(onFolderSelect).toHaveBeenCalledWith('devops');
    });
  });

  describe('Double Click to Run', () => {
    it('should create session with commands on double click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.doubleClick(screen.getByText('Build Project'));
      
      expect(mockCreateSession).toHaveBeenCalledWith('Build Project', {
        cwd: undefined,
        commands: ['npm install', 'npm run build'],
      });
    });
  });

  describe('Context Menu', () => {
    it('should show context menu on right click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      
      expect(screen.getByText('📁 New Folder')).toBeInTheDocument();
      expect(screen.getByText('⚡ New Flow')).toBeInTheDocument();
      expect(screen.getByText('✏️ Rename')).toBeInTheDocument();
      expect(screen.getByText('🗑️ Delete')).toBeInTheDocument();
    });

    it('should show context menu on empty area right click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('WORKFLOWS')).toBeInTheDocument();
      });
      
      const flowList = document.querySelector('.flow-list');
      fireEvent.contextMenu(flowList!);
      
      expect(screen.getByText('📁 New Folder')).toBeInTheDocument();
      expect(screen.getByText('⚡ New Flow')).toBeInTheDocument();
    });

    it('should hide context menu on click outside', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      expect(screen.getByText('📁 New Folder')).toBeInTheDocument();
      
      fireEvent.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByText('📁 New Folder')).not.toBeInTheDocument();
      });
    });
  });

  describe('Create New Flow', () => {
    it('should create new flow via context menu', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('WORKFLOWS')).toBeInTheDocument();
      });
      
      const flowList = document.querySelector('.flow-list');
      fireEvent.contextMenu(flowList!);
      
      fireEvent.click(screen.getByText('⚡ New Flow'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });

    it('should create new flow via + button', async () => {
      render(<FlowList />);
      
      const addButton = screen.getByTitle('New Flow');
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Create New Folder', () => {
    it('should create new folder via context menu', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('WORKFLOWS')).toBeInTheDocument();
      });
      
      const flowList = document.querySelector('.flow-list');
      fireEvent.contextMenu(flowList!);
      
      fireEvent.click(screen.getByText('📁 New Folder'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Rename', () => {
    it('should enter edit mode on rename click', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      fireEvent.click(screen.getByText('✏️ Rename'));
      
      await waitFor(() => {
        const input = document.querySelector('.flow-tree-edit-input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('Build Project');
      });
    });

    it('should save rename on Enter', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      fireEvent.click(screen.getByText('✏️ Rename'));
      
      await waitFor(() => {
        const input = document.querySelector('.flow-tree-edit-input') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      });
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });

    it('should cancel rename on Escape', async () => {
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      fireEvent.click(screen.getByText('✏️ Rename'));
      
      await waitFor(() => {
        const input = document.querySelector('.flow-tree-edit-input') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        
        fireEvent.keyDown(input, { key: 'Escape' });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
        expect(document.querySelector('.flow-tree-edit-input')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete', () => {
    it('should delete flow on confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      fireEvent.click(screen.getByText('🗑️ Delete'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });

    it('should not delete flow on cancel', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('Build Project'));
      fireEvent.click(screen.getByText('🗑️ Delete'));
      
      expect(mockConfigUpdate).not.toHaveBeenCalled();
    });

    it('should not allow deleting folder with contents', async () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('devops'));
      fireEvent.click(screen.getByText('🗑️ Delete'));
      
      expect(window.alert).toHaveBeenCalledWith(
        'Cannot delete folder with contents. Please delete or move items first.'
      );
      expect(mockConfigUpdate).not.toHaveBeenCalled();
    });

    it('should allow deleting empty folder', async () => {
      const flowsWithEmptyFolder: Flow[] = [
        ...mockFlows,
        {
          id: 'placeholder',
          name: '.folder-placeholder',
          mode: 'template',
          commands: [],
          enabled: false,
          path: 'empty-folder',
        },
      ];
      mockConfigGet.mockResolvedValue({ flows: flowsWithEmptyFolder });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<FlowList />);
      
      await waitFor(() => {
        expect(screen.getByText('empty-folder')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('empty-folder'));
      fireEvent.click(screen.getByText('🗑️ Delete'));
      
      await waitFor(() => {
        expect(mockConfigUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Selected State', () => {
    it('should highlight selected flow', async () => {
      render(<FlowList selectedFlowId="flow-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Build Project')).toBeInTheDocument();
      });
      
      const flowItem = screen.getByText('Build Project').closest('.flow-tree-item');
      expect(flowItem).toHaveClass('selected');
    });
  });
});
