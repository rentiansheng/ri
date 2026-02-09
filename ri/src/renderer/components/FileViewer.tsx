import React, { useState, useEffect, useRef, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import YAML from 'yaml';
import './FileViewer.css';

interface JsonViewProps {
  src: object;
  theme?: string;
  collapsed?: boolean | number;
  displayDataTypes?: boolean;
  displayObjectSize?: boolean;
  enableClipboard?: boolean;
  name?: string | null;
  style?: React.CSSProperties;
}

const JsonView = React.lazy(() => import('@microlink/react-json-view').then(mod => ({ default: mod.default as React.ComponentType<JsonViewProps> })));

interface FileViewerProps {
  filePath: string;
  onClose?: () => void;
}

type ViewMode = 'code' | 'tree' | 'preview';

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

const canShowTree = (language: string): boolean => {
  return language === 'json' || language === 'yaml';
};

const canShowPreview = (language: string): boolean => {
  return language === 'markdown';
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
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [parsedData, setParsedData] = useState<object | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const originalContentRef = useRef<string>('');

  const language = getLanguageFromPath(filePath);
  const fileName = filePath.split('/').pop() || filePath;

  useEffect(() => {
    loadFile();
  }, [filePath]);

  useEffect(() => {
    if (!content) {
      setParsedData(null);
      setParseError(null);
      return;
    }

    if (language === 'json') {
      try {
        const parsed = JSON.parse(content);
        setParsedData(parsed);
        setParseError(null);
      } catch (e) {
        setParsedData(null);
        setParseError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    } else if (language === 'yaml') {
      try {
        const parsed = YAML.parse(content);
        setParsedData(parsed);
        setParseError(null);
      } catch (e) {
        setParsedData(null);
        setParseError(e instanceof Error ? e.message : 'Invalid YAML');
      }
    } else {
      setParsedData(null);
      setParseError(null);
    }
  }, [content, language]);

  useEffect(() => {
    if (canShowPreview(language)) {
      setViewMode('preview');
    } else if (canShowTree(language)) {
      setViewMode('tree');
    } else {
      setViewMode('code');
    }
  }, [language]);

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
    if (codeRef.current && content && !loading && !isEditing && viewMode === 'code') {
      Prism.highlightElement(codeRef.current);
    }
  }, [content, loading, language, isEditing, viewMode]);

  const enterEditMode = () => {
    setIsEditing(true);
    setViewMode('code');
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
        setIsEditing(false);
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

  const renderCodeView = () => {
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

  const renderTreeView = () => {
    if (parseError) {
      return (
        <div className="file-viewer-parse-error">
          <div className="parse-error-icon">⚠️</div>
          <div className="parse-error-title">Parse Error</div>
          <div className="parse-error-message">{parseError}</div>
          <button 
            className="file-viewer-btn" 
            onClick={() => setViewMode('code')}
          >
            View as Code
          </button>
        </div>
      );
    }

    if (!parsedData) {
      return <div className="file-viewer-loading">Parsing...</div>;
    }

    return (
      <div className="file-viewer-tree-wrapper" ref={contentRef}>
        <React.Suspense fallback={<div className="file-viewer-loading">Loading viewer...</div>}>
          <JsonView
            src={parsedData}
            theme="monokai"
            collapsed={2}
            displayDataTypes={false}
            displayObjectSize={true}
            enableClipboard={true}
            name={null}
            style={{
              backgroundColor: 'transparent',
              fontSize: '13px',
              fontFamily: "'Consolas', 'Monaco', monospace",
              padding: '12px',
            }}
          />
        </React.Suspense>
      </div>
    );
  };

  const renderMarkdownPreview = () => {
    return (
      <div className="file-viewer-markdown-wrapper" ref={contentRef}>
        <div className="markdown-content">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const lang = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');
                
                if (match && lang && Prism.languages[lang]) {
                  try {
                    const highlighted = Prism.highlight(codeString, Prism.languages[lang], lang);
                    return (
                      <code
                        className={className}
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                        {...props}
                      />
                    );
                  } catch {
                    return <code className={className} {...props}>{children}</code>;
                  }
                }
                return <code className={className} {...props}>{children}</code>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
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

    switch (viewMode) {
      case 'tree':
        return renderTreeView();
      case 'preview':
        return renderMarkdownPreview();
      case 'code':
      default:
        return renderCodeView();
    }
  };

  const renderViewModeButtons = () => {
    if (isEditing) return null;

    const modes: { mode: ViewMode; icon: string; title: string; available: boolean }[] = [
      { mode: 'code', icon: '📝', title: 'Code View', available: true },
      { mode: 'tree', icon: '🌳', title: 'Tree View', available: canShowTree(language) },
      { mode: 'preview', icon: '👁️', title: 'Preview', available: canShowPreview(language) },
    ];

    const availableModes = modes.filter(m => m.available);
    if (availableModes.length <= 1) return null;

    return (
      <div className="file-viewer-view-modes">
        {availableModes.map(({ mode, icon, title }) => (
          <button
            key={mode}
            className={`view-mode-btn ${viewMode === mode ? 'active' : ''}`}
            onClick={() => setViewMode(mode)}
            title={title}
          >
            {icon}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="file-viewer" data-testid="file-viewer">
      <div className="file-viewer-header">
        <div className="file-viewer-title">
          <span className="file-viewer-icon">📄</span>
          <span className="file-viewer-name" title={filePath}>{fileName}</span>
          <span className="file-viewer-lang">{language}</span>
        </div>
        {renderViewModeButtons()}
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
        {viewMode === 'code' && (
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
        )}
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
