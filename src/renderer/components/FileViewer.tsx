import React, { useState, useEffect, useRef, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import './FileViewer.css';

interface FileViewerProps {
  filePath: string;
  onClose?: () => void;
}

const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'markdown': 'markdown',
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'css': 'css',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
  };
  return langMap[ext] || 'plaintext';
};

const FileViewer: React.FC<FileViewerProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const codeRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const originalContentRef = useRef<string>('');

  const language = getLanguageFromPath(filePath);
  const fileName = filePath.split('/').pop() || filePath;

  useEffect(() => {
    loadFile();
  }, [filePath]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.file.read(filePath);
      if (result.success && result.content !== undefined) {
        setContent(result.content);
        originalContentRef.current = result.content;
      } else {
        setError(result.error || 'Failed to read file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeRef.current && content && !loading && !isEditing) {
      Prism.highlightElement(codeRef.current);
    }
  }, [content, loading, language, isEditing]);

  const enterEditMode = () => {
    setIsEditing(true);
    setSaveStatus(null);
  };

  const handleCancel = () => {
    setContent(originalContentRef.current);
    setIsEditing(false);
    setError(null);
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setError(null);
    try {
      const result = await window.file.write(filePath, content);
      if (result.success) {
        setSaveStatus('saved');
        originalContentRef.current = content;
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        setError(result.error || 'Failed to save');
      }
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (isEditing) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, content]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(0);
      return;
    }

    const lines = content.split('\n');
    const results: number[] = [];
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentResultIndex(0);

    if (results.length > 0) {
      scrollToLine(results[0]);
    }
  }, [content]);

  const scrollToLine = (lineIndex: number) => {
    if (contentRef.current) {
      const lineHeight = 20;
      contentRef.current.scrollTop = lineIndex * lineHeight - 100;
    }
  };

  const goToNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    scrollToLine(searchResults[nextIndex]);
  };

  const goToPrevResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(prevIndex);
    scrollToLine(searchResults[prevIndex]);
  };

  const highlightSearchMatches = (text: string): string => {
    if (!searchQuery.trim()) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  const renderContent = () => {
    if (loading) {
      return <div className="file-viewer-loading">Loading...</div>;
    }

    if (error && !content) {
      return <div className="file-viewer-error">{error}</div>;
    }

    if (isEditing) {
      return (
        <div className="file-viewer-editor-wrapper">
           <textarea
             className="file-viewer-editor"
             value={content}
             onChange={(e) => setContent(e.target.value)}
             spellCheck={false}
           />
        </div>
      );
    }

    const lines = content.split('\n');

    return (
      <div className="file-viewer-code-wrapper" ref={contentRef}>
        <div className="file-viewer-line-numbers">
          {lines.map((_, i) => (
            <span 
              key={i} 
              className={`line-number ${searchResults.includes(i) ? 'has-match' : ''} ${searchResults[currentResultIndex] === i ? 'current-match' : ''}`}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <pre className="file-viewer-pre">
          {searchQuery ? (
            <code 
              ref={codeRef} 
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ 
                __html: highlightSearchMatches(Prism.highlight(content, Prism.languages[language] || Prism.languages.plaintext, language))
              }}
            />
          ) : (
            <code 
              ref={codeRef} 
              className={`language-${language}`}
            >
              {content}
            </code>
          )}
        </pre>
      </div>
    );
  };

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <div className="file-viewer-title">
          <span className="file-viewer-icon">📄</span>
          <span className="file-viewer-name" title={filePath}>{fileName}</span>
          <span className="file-viewer-lang">{language}</span>
        </div>
        <div className="file-viewer-actions">
          {isEditing ? (
            <>
              {saveStatus && (
                <span className={`save-status ${saveStatus}`}>
                  {saveStatus === 'saved' && 'Saved'}
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'error' && 'Error!'}
                </span>
              )}
              <button className="file-viewer-btn primary" onClick={handleSave} title="Save (Cmd+S)">Save</button>
              <button className="file-viewer-btn" onClick={handleCancel}>Cancel</button>
            </>
          ) : (
            <button className="file-viewer-btn icon-only" onClick={enterEditMode} title="Edit">✏️</button>
          )}
        </div>
        <div className="file-viewer-search">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="file-viewer-search-input"
          />
          {searchResults.length > 0 && (
            <>
              <span className="file-viewer-search-count">
                {currentResultIndex + 1}/{searchResults.length}
              </span>
              <button className="file-viewer-search-btn" onClick={goToPrevResult}>↑</button>
              <button className="file-viewer-search-btn" onClick={goToNextResult}>↓</button>
            </>
          )}
        </div>
        {onClose && (
          <button className="file-viewer-close" onClick={onClose}>✕</button>
        )}
      </div>
      <div className="file-viewer-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default FileViewer;
