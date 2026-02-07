import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileViewer from '../FileViewer';

const mockFileRead = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  
  (window as any).file = {
    read: mockFileRead,
  };
});

describe('FileViewer', () => {
  it('should render loading state initially', () => {
    mockFileRead.mockResolvedValue({ success: true, content: '' });
    
    render(<FileViewer filePath="/test/file.json" />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display file content after loading', async () => {
    const testContent = '{"key": "value"}';
    mockFileRead.mockResolvedValue({ success: true, content: testContent });
    
    render(<FileViewer filePath="/test/file.json" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    expect(mockFileRead).toHaveBeenCalledWith('/test/file.json');
  });

  it('should display error when file read fails', async () => {
    mockFileRead.mockResolvedValue({ success: false, error: 'File not found' });
    
    render(<FileViewer filePath="/test/nonexistent.json" />);
    
    await waitFor(() => {
      expect(screen.getByText('File not found')).toBeInTheDocument();
    });
  });

  it('should display file name in header', async () => {
    mockFileRead.mockResolvedValue({ success: true, content: 'test' });
    
    render(<FileViewer filePath="/path/to/myfile.json" />);
    
    expect(screen.getByText('myfile.json')).toBeInTheDocument();
  });

  it('should display language badge', async () => {
    mockFileRead.mockResolvedValue({ success: true, content: 'test' });
    
    render(<FileViewer filePath="/test/file.yaml" />);
    
    expect(screen.getByText('yaml')).toBeInTheDocument();
  });

  it('should handle search input', async () => {
    const testContent = 'line one\nline two\nline three';
    mockFileRead.mockResolvedValue({ success: true, content: testContent });
    
    render(<FileViewer filePath="/test/file.txt" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'two' } });
    
    expect(searchInput).toHaveValue('two');
  });

  it('should show search results count', async () => {
    const testContent = 'apple\nbanana\napple pie\napple juice';
    mockFileRead.mockResolvedValue({ success: true, content: testContent });
    
    render(<FileViewer filePath="/test/file.txt" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'apple' } });
    
    await waitFor(() => {
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    mockFileRead.mockResolvedValue({ success: true, content: 'test' });
    const onClose = vi.fn();
    
    render(<FileViewer filePath="/test/file.txt" onClose={onClose} />);
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should detect correct language from file extension', async () => {
    mockFileRead.mockResolvedValue({ success: true, content: '' });
    
    const { rerender } = render(<FileViewer filePath="/test/file.md" />);
    expect(screen.getByText('markdown')).toBeInTheDocument();
    
    rerender(<FileViewer filePath="/test/file.ts" />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
    
    rerender(<FileViewer filePath="/test/file.js" />);
    expect(screen.getByText('javascript')).toBeInTheDocument();
    
    rerender(<FileViewer filePath="/test/file.css" />);
    expect(screen.getByText('css')).toBeInTheDocument();
  });
});
