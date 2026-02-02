import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markup'; // For XML
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import YAML from 'yaml';
import { useConfigStore } from '../store/configStore';
import './RIView.css';
import './FileViewer.css'; // Reuse markdown styles

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

interface RIViewProps {
  filePath: string;
  onClose?: () => void;
}

type ViewMode = 'code' | 'tree' | 'split' | 'preview';
type StatusType = 'info' | 'success' | 'warning' | 'error';

interface UndoEntry {
  content: string;
  cursorStart: number;
  cursorEnd: number;
  scrollTop: number;
  scrollLeft: number;
}

const BRACKET_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};

const CLOSING_BRACKETS = new Set([')', ']', '}', '"', "'", '`']);

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
    'xml': 'markup',
    'html': 'markup',
    'svg': 'markup',
  };
  return langMap[ext] || 'plaintext';
};

const formatXml = (xml: string): string => {
  try {
    const PADDING = '  ';
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;
    
    // basic crude formatting
    let formatted = xml.replace(reg, '$1\r\n$2$3');
    
    return formatted.split('\r\n').map((node) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        } else if (node.match(/^<\/\w/)) {
            if (pad !== 0) {
                pad -= 1;
            }
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        } else {
            indent = 0;
        }

        const padding = new Array(pad + 1).join(PADDING);
        pad += indent;

        return padding + node;
    }).join('\r\n');
  } catch (e) {
    return xml;
  }
};

const RIView: React.FC<RIViewProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [splitRatio, setSplitRatio] = useState(50);
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{line: number; startCol: number; endCol: number}[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready');
  const [statusType, setStatusType] = useState<StatusType>('info');
  const [parsedData, setParsedData] = useState<object | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [fileChangedExternally, setFileChangedExternally] = useState(false);
  const [lastMtime, setLastMtime] = useState<number>(0);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [externalContent, setExternalContent] = useState<string>('');
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const codeDisplayRef = useRef<HTMLElement>(null);
  const codeWrapperRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const lastScrollSource = useRef<'editor' | 'preview' | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = useConfigStore(state => state.config);
  const editorConfig = config?.editor;
  const autoSaveEnabled = editorConfig?.autoSave ?? false;
  const autoSaveDelay = (editorConfig?.autoSaveDelay ?? 2) * 1000;

  const fileName = filePath.split('/').pop() || filePath;
  const language = useMemo(() => getLanguageFromPath(filePath), [filePath]);
  
  const isMarkdown = language === 'markdown';
  const isDataFile = language === 'json' || language === 'yaml';
  const isXml = language === 'markup';

  const pushUndo = useCallback((cursorStart: number, cursorEnd: number) => {
    const scrollTop = editorRef.current?.scrollTop || 0;
    const scrollLeft = editorRef.current?.scrollLeft || 0;
    setUndoStack(prev => [...prev.slice(-99), { content, cursorStart, cursorEnd, scrollTop, scrollLeft }]);
    setRedoStack([]);
  }, [content]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const scrollTop = editorRef.current?.scrollTop || 0;
    const scrollLeft = editorRef.current?.scrollLeft || 0;
    setRedoStack(r => [...r, { 
      content, 
      cursorStart: editorRef.current?.selectionStart || 0, 
      cursorEnd: editorRef.current?.selectionEnd || 0,
      scrollTop,
      scrollLeft
    }]);
    setUndoStack(u => u.slice(0, -1));
    setContent(prev.content);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.selectionStart = prev.cursorStart;
        editorRef.current.selectionEnd = prev.cursorEnd;
        editorRef.current.scrollTop = prev.scrollTop;
        editorRef.current.scrollLeft = prev.scrollLeft;
        editorRef.current.focus();
      }
    });
  }, [undoStack, content]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const scrollTop = editorRef.current?.scrollTop || 0;
    const scrollLeft = editorRef.current?.scrollLeft || 0;
    setUndoStack(u => [...u, { 
      content, 
      cursorStart: editorRef.current?.selectionStart || 0, 
      cursorEnd: editorRef.current?.selectionEnd || 0,
      scrollTop,
      scrollLeft
    }]);
    setRedoStack(r => r.slice(0, -1));
    setContent(next.content);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.selectionStart = next.cursorStart;
        editorRef.current.selectionEnd = next.cursorEnd;
        editorRef.current.scrollTop = next.scrollTop;
        editorRef.current.scrollLeft = next.scrollLeft;
        editorRef.current.focus();
      }
    });
  }, [redoStack, content]);

  const insertMarkdownFormat = useCallback((prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);
    const textToInsert = selectedText || placeholder;
    const newText = prefix + textToInsert + suffix;
    
    pushUndo(selectionStart, selectionEnd);
    const newContent = value.substring(0, selectionStart) + newText + value.substring(selectionEnd);
    setContent(newContent);
    
    requestAnimationFrame(() => {
      textarea.focus();
      if (selectedText) {
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionStart + newText.length;
      } else {
        textarea.selectionStart = selectionStart + prefix.length;
        textarea.selectionEnd = selectionStart + prefix.length + placeholder.length;
      }
    });
  }, [pushUndo]);

  const insertMarkdownLink = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);
    
    pushUndo(selectionStart, selectionEnd);
    const linkText = selectedText || 'link text';
    const newText = `[${linkText}](url)`;
    const newContent = value.substring(0, selectionStart) + newText + value.substring(selectionEnd);
    setContent(newContent);
    
    requestAnimationFrame(() => {
      textarea.focus();
      const urlStart = selectionStart + linkText.length + 3;
      textarea.selectionStart = urlStart;
      textarea.selectionEnd = urlStart + 3;
    });
  }, [pushUndo]);

  const insertMarkdownImage = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd);
    
    pushUndo(selectionStart, selectionEnd);
    const altText = selectedText || 'alt text';
    const newText = `![${altText}](image-url)`;
    const newContent = value.substring(0, selectionStart) + newText + value.substring(selectionEnd);
    setContent(newContent);
    
    requestAnimationFrame(() => {
      textarea.focus();
      const urlStart = selectionStart + altText.length + 4;
      textarea.selectionStart = urlStart;
      textarea.selectionEnd = urlStart + 9;
    });
  }, [pushUndo]);

  const insertMarkdownTable = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const { selectionStart, value } = textarea;
    pushUndo(selectionStart, selectionStart);
    
    const table = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`;
    const newContent = value.substring(0, selectionStart) + table + value.substring(selectionStart);
    setContent(newContent);
    
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = selectionStart + 2;
      textarea.selectionEnd = selectionStart + 10;
    });
  }, [pushUndo]);

  const getIndent = (line: string): string => {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  };

  // Load File
  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      setStatusMsg('Loading...');
      setStatusType('info');
      setFileChangedExternally(false);
      try {
        const [readResult, statResult] = await Promise.all([
          window.file.read(filePath),
          window.file.stat(filePath)
        ]);
        
        if (readResult.success && readResult.content !== undefined) {
          setContent(readResult.content);
          setOriginalContent(readResult.content);
          setUndoStack([]);
          setRedoStack([]);
          setStatusMsg('Ready');
          
          if (statResult.success && statResult.stat) {
            setLastMtime(statResult.stat.mtime);
          }
          
          if (getLanguageFromPath(filePath) === 'markdown') {
            setViewMode('split');
          } else {
            setViewMode('code');
          }
        } else {
          setStatusMsg(readResult.error || 'Failed to read file');
          setStatusType('error');
        }
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : 'Unknown error');
        setStatusType('error');
      } finally {
        setLoading(false);
      }
    };
    loadFile();
  }, [filePath]);

  // Sync scroll between editor and preview
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft, scrollHeight, clientHeight } = e.currentTarget;
    if (codeWrapperRef.current) {
      codeWrapperRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    
    if (isMarkdown && viewMode === 'split' && previewRef.current && lastScrollSource.current !== 'preview') {
      lastScrollSource.current = 'editor';
      const scrollRatio = scrollTop / (scrollHeight - clientHeight || 1);
      const previewScrollHeight = previewRef.current.scrollHeight - previewRef.current.clientHeight;
      previewRef.current.scrollTop = scrollRatio * previewScrollHeight;
      setTimeout(() => { lastScrollSource.current = null; }, 50);
    }
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isMarkdown || viewMode !== 'split' || !editorRef.current || lastScrollSource.current === 'editor') return;
    
    lastScrollSource.current = 'preview';
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight || 1);
    const editorScrollHeight = editorRef.current.scrollHeight - editorRef.current.clientHeight;
    editorRef.current.scrollTop = scrollRatio * editorScrollHeight;
    setTimeout(() => { lastScrollSource.current = null; }, 50);
  };

  // Actions
  const handleSave = async () => {
    setStatusMsg('Saving...');
    try {
      const result = await window.file.write(filePath, content);
      if (result.success) {
        setOriginalContent(content);
        setFileChangedExternally(false);
        setStatusMsg('Saved');
        setStatusType('success');
        
        const statResult = await window.file.stat(filePath);
        if (statResult.success && statResult.stat) {
          setLastMtime(statResult.stat.mtime);
        }
        
        setTimeout(() => setStatusMsg('Ready'), 2000);
      } else {
        setStatusMsg(result.error || 'Failed to save');
        setStatusType('error');
      }
    } catch (err) {
      setStatusMsg('Save error');
      setStatusType('error');
    }
  };

  const handleReload = async () => {
    setFileChangedExternally(false);
    setShowConflictResolver(false);
    try {
      const [readResult, statResult] = await Promise.all([
        window.file.read(filePath),
        window.file.stat(filePath)
      ]);
      
      if (readResult.success && readResult.content !== undefined) {
        setContent(readResult.content);
        setOriginalContent(readResult.content);
        setUndoStack([]);
        setRedoStack([]);
        setStatusMsg('Reloaded');
        setStatusType('success');
        
        if (statResult.success && statResult.stat) {
          setLastMtime(statResult.stat.mtime);
        }
        
        setTimeout(() => setStatusMsg('Ready'), 2000);
      }
    } catch (err) {
      setStatusMsg('Reload failed');
      setStatusType('error');
    }
  };

  const handleKeepLocal = async () => {
    setShowConflictResolver(false);
    setFileChangedExternally(false);
    await handleSave();
  };

  const handleKeepExternal = () => {
    setContent(externalContent);
    setOriginalContent(externalContent);
    setShowConflictResolver(false);
    setFileChangedExternally(false);
    setUndoStack([]);
    setRedoStack([]);
    window.file.stat(filePath).then(result => {
      if (result.success && result.stat) {
        setLastMtime(result.stat.mtime);
      }
    });
    setStatusMsg('Loaded external version');
    setStatusType('success');
    setTimeout(() => setStatusMsg('Ready'), 2000);
  };

  useEffect(() => {
    if (!lastMtime || loading) return;
    
    const checkFileChange = async () => {
      try {
        const statResult = await window.file.stat(filePath);
        if (statResult.success && statResult.stat && statResult.stat.mtime > lastMtime) {
          const readResult = await window.file.read(filePath);
          if (readResult.success && readResult.content !== undefined) {
            setExternalContent(readResult.content);
            const hasLocalChanges = content !== originalContent;
            if (hasLocalChanges) {
              setShowConflictResolver(true);
            } else {
              setContent(readResult.content);
              setOriginalContent(readResult.content);
              setLastMtime(statResult.stat.mtime);
            }
            setFileChangedExternally(true);
          }
        }
      } catch {
      }
    };
    
    const interval = setInterval(checkFileChange, 2000);
    return () => clearInterval(interval);
  }, [filePath, lastMtime, loading, content, originalContent]);

  const handleFormat = () => {
    try {
      let formatted = content;
      if (language === 'json') {
        const obj = JSON.parse(content);
        formatted = JSON.stringify(obj, null, 2);
      } else if (language === 'yaml') {
        const obj = YAML.parse(content);
        formatted = YAML.stringify(obj);
      } else if (isXml) {
        formatted = formatXml(content);
      } else {
        setStatusMsg('Format not supported for this file');
        setStatusType('warning');
        return;
      }
      pushUndo(0, 0);
      setContent(formatted);
      setStatusMsg('Formatted');
      setStatusType('success');
    } catch (e) {
      setStatusMsg('Format failed: Invalid syntax');
      setStatusType('error');
    }
  };

  const handleValidate = () => {
    try {
      if (language === 'json') {
        JSON.parse(content);
      } else if (language === 'yaml') {
        YAML.parse(content);
      } else if (isXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'application/xml');
        const errorNode = doc.querySelector('parsererror');
        if (errorNode) throw new Error('Invalid XML');
      } else {
        setStatusMsg('Validation not supported');
        setStatusType('warning');
        return;
      }
      setStatusMsg('Valid');
      setStatusType('success');
    } catch (e) {
      setStatusMsg('Invalid Syntax');
      setStatusType('error');
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (editorRef.current) {
          const { selectionStart, selectionEnd, value } = editorRef.current;
          const selectedText = value.substring(selectionStart, selectionEnd);
          if (selectedText) {
            setSearchQuery(selectedText);
            setSearchExecuted(false);
          }
        }
        setShowSearch(true);
        setShowReplace(false);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        if (editorRef.current) {
          const { selectionStart, selectionEnd, value } = editorRef.current;
          const selectedText = value.substring(selectionStart, selectionEnd);
          if (selectedText) {
            setSearchQuery(selectedText);
            setSearchExecuted(false);
          }
        }
        setShowSearch(true);
        setShowReplace(true);
        setTimeout(() => replaceInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    
    const isDirty = content !== originalContent;
    if (!isDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, originalContent, autoSaveEnabled, autoSaveDelay]);

  const setContentAndRestoreScroll = useCallback((newContent: string, cursorStart: number, cursorEnd: number) => {
    const scrollTop = editorRef.current?.scrollTop || 0;
    const scrollLeft = editorRef.current?.scrollLeft || 0;
    setContent(newContent);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.scrollTop = scrollTop;
        editorRef.current.scrollLeft = scrollLeft;
        editorRef.current.selectionStart = cursorStart;
        editorRef.current.selectionEnd = cursorEnd;
      }
    });
  }, []);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = editorRef.current;
    if (!textarea || isComposing.current) return;
    
    const { selectionStart, selectionEnd, value, scrollTop, scrollLeft } = textarea;
    const hasSelection = selectionStart !== selectionEnd;

    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault();
      const indent = '  ';
      
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineContent = value.substring(lineStart, selectionEnd);
        const lines = lineContent.split('\n');
        const unindented = lines.map(line => line.startsWith(indent) ? line.slice(indent.length) : line.replace(/^\t/, '')).join('\n');
        const diff = lineContent.length - unindented.length;
        
        pushUndo(selectionStart, selectionEnd);
        const newContent = value.substring(0, lineStart) + unindented + value.substring(selectionEnd);
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.scrollTop = scrollTop;
          textarea.scrollLeft = scrollLeft;
          textarea.selectionStart = Math.max(lineStart, selectionStart - indent.length);
          textarea.selectionEnd = selectionEnd - diff;
        });
      } else {
        if (hasSelection) {
          const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
          const lineContent = value.substring(lineStart, selectionEnd);
          const indented = lineContent.split('\n').map(line => indent + line).join('\n');
          
          pushUndo(selectionStart, selectionEnd);
          const newContent = value.substring(0, lineStart) + indented + value.substring(selectionEnd);
          setContent(newContent);
          requestAnimationFrame(() => {
            textarea.scrollTop = scrollTop;
            textarea.scrollLeft = scrollLeft;
            textarea.selectionStart = selectionStart + indent.length;
            textarea.selectionEnd = selectionEnd + (indented.length - lineContent.length);
          });
        } else {
          pushUndo(selectionStart, selectionEnd);
          const newContent = value.substring(0, selectionStart) + indent + value.substring(selectionEnd);
          setContent(newContent);
          requestAnimationFrame(() => {
            textarea.scrollTop = scrollTop;
            textarea.scrollLeft = scrollLeft;
            textarea.selectionStart = textarea.selectionEnd = selectionStart + indent.length;
          });
        }
      }
      return;
    }

    // Enter with auto-indent
    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);
      const indent = getIndent(currentLine);
      const lastChar = currentLine.trim().slice(-1);
      let extraIndent = '';
      
      if (lastChar === '{' || lastChar === '[' || lastChar === '(') {
        extraIndent = '  ';
      }
      
      pushUndo(selectionStart, selectionEnd);
      const newContent = value.substring(0, selectionStart) + '\n' + indent + extraIndent + value.substring(selectionEnd);
      setContent(newContent);
      requestAnimationFrame(() => {
        const newPos = selectionStart + 1 + indent.length + extraIndent.length;
        textarea.scrollTop = scrollTop;
        textarea.scrollLeft = scrollLeft;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      });
      return;
    }

    // Auto bracket pairing
    if (BRACKET_PAIRS[e.key] && !hasSelection) {
      e.preventDefault();
      const closing = BRACKET_PAIRS[e.key];
      pushUndo(selectionStart, selectionEnd);
      const newContent = value.substring(0, selectionStart) + e.key + closing + value.substring(selectionEnd);
      setContent(newContent);
      requestAnimationFrame(() => {
        textarea.scrollTop = scrollTop;
        textarea.scrollLeft = scrollLeft;
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
      });
      return;
    }

    // Skip over closing bracket
    if (CLOSING_BRACKETS.has(e.key) && value[selectionStart] === e.key) {
      e.preventDefault();
      requestAnimationFrame(() => {
        textarea.scrollTop = scrollTop;
        textarea.scrollLeft = scrollLeft;
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
      });
      return;
    }

    // Delete bracket pair
    if (e.key === 'Backspace' && !hasSelection) {
      const charBefore = value[selectionStart - 1];
      const charAfter = value[selectionStart];
      if (BRACKET_PAIRS[charBefore] === charAfter) {
        e.preventDefault();
        pushUndo(selectionStart, selectionEnd);
        const newContent = value.substring(0, selectionStart - 1) + value.substring(selectionStart + 1);
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.scrollTop = scrollTop;
          textarea.scrollLeft = scrollLeft;
          textarea.selectionStart = textarea.selectionEnd = selectionStart - 1;
        });
        return;
      }
    }

    // Cmd+D: Select word / next occurrence
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      if (!hasSelection) {
        const wordMatch = value.substring(0, selectionStart).match(/\w+$/);
        const wordMatchAfter = value.substring(selectionStart).match(/^\w+/);
        if (wordMatch || wordMatchAfter) {
          const start = selectionStart - (wordMatch ? wordMatch[0].length : 0);
          const end = selectionStart + (wordMatchAfter ? wordMatchAfter[0].length : 0);
          requestAnimationFrame(() => {
            textarea.scrollTop = scrollTop;
            textarea.scrollLeft = scrollLeft;
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
          });
        }
      }
      return;
    }

    // Cmd+/: Toggle comment
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = value.indexOf('\n', selectionEnd);
      const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
      const lineContent = value.substring(lineStart, actualLineEnd);
      const lines = lineContent.split('\n');
      
      const allCommented = lines.every(line => line.trim().startsWith('//'));
      const toggled = lines.map(line => {
        if (allCommented) {
          return line.replace(/^(\s*)\/\/\s?/, '$1');
        } else {
          return line.replace(/^(\s*)/, '$1// ');
        }
      }).join('\n');
      
      pushUndo(selectionStart, selectionEnd);
      const newContent = value.substring(0, lineStart) + toggled + value.substring(actualLineEnd);
      setContent(newContent);
      requestAnimationFrame(() => {
        textarea.scrollTop = scrollTop;
        textarea.scrollLeft = scrollLeft;
      });
      return;
    }

    // Cmd+Z: Undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    // Cmd+Y: Redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
  };

  const lastUndoPushTime = useRef<number>(0);
  const lastUndoContent = useRef<string>('');

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;
    
    if (isComposing.current) {
      setContent(textarea.value);
      return;
    }
    const newContent = textarea.value;
    const cursorStart = textarea.selectionStart;
    const cursorEnd = textarea.selectionEnd;
    
    const now = Date.now();
    const timeSinceLastUndo = now - lastUndoPushTime.current;
    const isPaste = Math.abs(newContent.length - content.length) > 1;
    const isNewWord = content[cursorStart - 2] === ' ' || content[cursorStart - 2] === '\n';
    
    if (isPaste || (timeSinceLastUndo > 1000 && lastUndoContent.current !== content) || isNewWord) {
      pushUndo(cursorStart, cursorEnd);
      lastUndoPushTime.current = now;
      lastUndoContent.current = content;
    }
    setContent(newContent);
    
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.scrollTop = scrollTop;
        editorRef.current.scrollLeft = scrollLeft;
      }
    });
  };

  const updateCursorPosition = () => {
    if (!editorRef.current) return;
    const { selectionStart, value } = editorRef.current;
    const textBefore = value.substring(0, selectionStart);
    const lines = textBefore.split('\n');
    setCursorLine(lines.length);
    setCursorCol(lines[lines.length - 1].length + 1);
  };

  // Syntax Highlight Update
  useEffect(() => {
    if (codeDisplayRef.current) {
      Prism.highlightElement(codeDisplayRef.current);
    }
  }, [content, viewMode, loading]);

  // Tree View Data Update
  useEffect(() => {
    if (viewMode === 'tree') {
      try {
        if (language === 'json') setParsedData(JSON.parse(content));
        else if (language === 'yaml') setParsedData(YAML.parse(content));
      } catch (e) {
        setParsedData(null);
      }
    }
  }, [content, viewMode, language]);

  // Split Pane Resizing
  const startResizing = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (splitContainerRef.current) {
        const containerRect = splitContainerRef.current.getBoundingClientRect();
        const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        // Min width constraints (approx 200px equivalent in %)
        const minPercent = (200 / containerRect.width) * 100;
        if (newRatio > minPercent && newRatio < (100 - minPercent)) {
          setSplitRatio(newRatio);
        }
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, []);

  // Search Logic
  const performSearch = useCallback((query: string, caseS: boolean, whole: boolean, regex: boolean) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    
    const lines = content.split('\n');
    const results: {line: number; startCol: number; endCol: number}[] = [];
    
    let searchPattern: RegExp;
    try {
      if (regex) {
        searchPattern = new RegExp(query, caseS ? 'g' : 'gi');
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = whole ? `\\b${escaped}\\b` : escaped;
        searchPattern = new RegExp(pattern, caseS ? 'g' : 'gi');
      }
    } catch {
      // Invalid regex - no results
      setSearchResults([]);
      return;
    }
    
    lines.forEach((line, lineIndex) => {
      let match;
      while ((match = searchPattern.exec(line)) !== null) {
        results.push({
          line: lineIndex,
          startCol: match.index,
          endCol: match.index + match[0].length
        });
        // Prevent infinite loop for zero-width matches
        if (match[0].length === 0) break;
      }
    });
    
    setSearchResults(results);
    setCurrentResultIndex(0);
    
    if (results.length > 0 && editorRef.current) {
      const lineHeight = 20;
      editorRef.current.scrollTop = results[0].line * lineHeight - 100;
      // Select the first match
      selectMatch(results[0]);
    }
  }, [content]);

  const selectMatch = (match: {line: number; startCol: number; endCol: number}) => {
    if (!editorRef.current) return;
    const lines = content.split('\n');
    let charIndex = 0;
    for (let i = 0; i < match.line; i++) {
      charIndex += lines[i].length + 1; // +1 for newline
    }
    const start = charIndex + match.startCol;
    const end = charIndex + match.endCol;
    editorRef.current.focus();
    editorRef.current.setSelectionRange(start, end);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSearchExecuted(false); // Reset when query changes
  };

  const executeSearch = () => {
    if (searchQuery) {
      performSearch(searchQuery, caseSensitive, wholeWord, useRegex);
      setSearchExecuted(true);
    }
  };

  useEffect(() => {
    if (!searchQuery || !searchExecuted || !showSearch) return;
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      performSearch(searchQuery, caseSensitive, wholeWord, useRegex);
    }, 1000);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [content, searchQuery, searchExecuted, showSearch, caseSensitive, wholeWord, useRegex, performSearch]);

  const goToNextMatch = () => {
    if (searchResults.length === 0) return;
    const next = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(next);
    if (editorRef.current) {
      editorRef.current.scrollTop = searchResults[next].line * 20 - 100;
      selectMatch(searchResults[next]);
    }
  };

  const goToPrevMatch = () => {
    if (searchResults.length === 0) return;
    const prev = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(prev);
    if (editorRef.current) {
      editorRef.current.scrollTop = searchResults[prev].line * 20 - 100;
      selectMatch(searchResults[prev]);
    }
  };

  const handleReplace = () => {
    if (searchResults.length === 0) return;
    const match = searchResults[currentResultIndex];
    const lines = content.split('\n');
    
    let charIndex = 0;
    for (let i = 0; i < match.line; i++) {
      charIndex += lines[i].length + 1;
    }
    const start = charIndex + match.startCol;
    const end = charIndex + match.endCol;
    
    pushUndo(start, end);
    const newContent = content.substring(0, start) + replaceQuery + content.substring(end);
    setContent(newContent);
    
    // Re-search after replace
    setTimeout(() => {
      performSearch(searchQuery, caseSensitive, wholeWord, useRegex);
    }, 0);
  };

  const handleReplaceAll = () => {
    if (searchResults.length === 0) return;
    
    pushUndo(0, 0);
    
    let searchPattern: RegExp;
    try {
      if (useRegex) {
        searchPattern = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
        searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      }
    } catch {
      return;
    }
    
    const newContent = content.replace(searchPattern, replaceQuery);
    setContent(newContent);
    
    setStatusMsg(`Replaced ${searchResults.length} occurrences`);
    setStatusType('success');
    setTimeout(() => setStatusMsg('Ready'), 2000);
    
    setSearchResults([]);
  };

  const isDirty = content !== originalContent;

  const handleClose = useCallback(async () => {
    if (!onClose) return;
    
    if (isDirty) {
      const result = window.confirm('You have unsaved changes. Do you want to save before closing?');
      if (result) {
        await handleSave();
      }
    }
    onClose();
  }, [isDirty, onClose, handleSave]);

  const matchedLines = useMemo(() => new Set(searchResults.map(r => r.line)), [searchResults]);

  const shortcutsPanel = showShortcuts ? (
    <div className="riview-shortcuts-panel">
      <div className="riview-shortcuts-header">
        <span>Keyboard Shortcuts</span>
        <button onClick={() => setShowShortcuts(false)}>✕</button>
      </div>
      <div className="riview-shortcuts-content">
        <div className="riview-shortcut-group">
          <h4>Editing</h4>
          <div className="riview-shortcut"><kbd>Tab</kbd> Indent</div>
          <div className="riview-shortcut"><kbd>Shift+Tab</kbd> Outdent</div>
          <div className="riview-shortcut"><kbd>Cmd+/</kbd> Toggle comment</div>
          <div className="riview-shortcut"><kbd>Cmd+D</kbd> Select word</div>
          <div className="riview-shortcut"><kbd>Cmd+Z</kbd> Undo</div>
          <div className="riview-shortcut"><kbd>Cmd+Shift+Z</kbd> Redo</div>
        </div>
        <div className="riview-shortcut-group">
          <h4>Search</h4>
          <div className="riview-shortcut"><kbd>Cmd+F</kbd> Find</div>
          <div className="riview-shortcut"><kbd>Cmd+R</kbd> Find and Replace</div>
          <div className="riview-shortcut"><kbd>Enter</kbd> Next match</div>
          <div className="riview-shortcut"><kbd>Shift+Enter</kbd> Previous match</div>
          <div className="riview-shortcut"><kbd>Escape</kbd> Close search</div>
        </div>
        <div className="riview-shortcut-group">
          <h4>Auto Complete</h4>
          <div className="riview-shortcut"><kbd>(</kbd> <kbd>[</kbd> <kbd>{'{'}</kbd> Auto close brackets</div>
          <div className="riview-shortcut"><kbd>"</kbd> <kbd>'</kbd> <kbd>`</kbd> Auto close quotes</div>
        </div>
        <div className="riview-shortcut-group">
          <h4>File</h4>
          <div className="riview-shortcut"><kbd>Cmd+S</kbd> Save</div>
          <div className="riview-shortcut"><kbd>Cmd+K</kbd> Toggle shortcuts</div>
        </div>
      </div>
    </div>
  ) : null;

  const editorView = (
    <div className="riview-editor-container">
      <div className="riview-line-numbers" ref={lineNumbersRef}>
        {content.split('\n').map((_, i) => (
          <div 
            key={i} 
            className={`riview-line-number ${matchedLines.has(i) ? 'active' : ''} ${cursorLine === i + 1 ? 'current' : ''}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="riview-editor-scroll">
        <div className="riview-code-wrapper" ref={codeWrapperRef}>
          <pre className="riview-code-display">
            <code ref={codeDisplayRef} className={`language-${language}`}>
              {content}
            </code>
          </pre>
        </div>
        <textarea
          ref={editorRef}
          className="riview-textarea"
          value={content}
          onChange={handleEditorChange}
          onKeyDown={handleEditorKeyDown}
          onScroll={handleScroll}
          onSelect={updateCursorPosition}
          onClick={updateCursorPosition}
          onCompositionStart={() => { isComposing.current = true; }}
          onCompositionEnd={() => { isComposing.current = false; }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
      {showSearch && (
        <div className={`riview-search-panel ${showReplace ? 'expanded' : ''}`}>
          <div className="riview-search-toggle" onClick={() => setShowReplace(!showReplace)} title={showReplace ? 'Hide Replace' : 'Show Replace'}>
            <svg width="16" height="16" viewBox="0 0 16 16" className={showReplace ? 'expanded' : ''}>
              <path fill="currentColor" d="M6 4l4 4-4 4V4z"/>
            </svg>
          </div>
          <div className="riview-search-fields">
            <div className="riview-search-row">
              <input
                ref={searchInputRef}
                className="riview-search-input"
                placeholder="Search"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (!searchExecuted || searchResults.length === 0) {
                      executeSearch();
                    } else {
                      e.shiftKey ? goToPrevMatch() : goToNextMatch();
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchExecuted(false);
                  }
                }}
                autoFocus
              />
              <div className="riview-search-options-inline">
                <button 
                  className={`riview-option-btn-small ${caseSensitive ? 'active' : ''}`} 
                  onClick={() => setCaseSensitive(!caseSensitive)}
                  title="Match Case (Aa)"
                >
                  Aa
                </button>
                <button 
                  className={`riview-option-btn-small ${wholeWord ? 'active' : ''}`} 
                  onClick={() => setWholeWord(!wholeWord)}
                  title="Match Whole Word"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M1 3h1v10H1V3zm13 0h1v10h-1V3zM4.5 7h2l.5 1.5L8 7h2l-1.5 3L10 13H8l-.5-1.5L7 13H5l1.5-3L5 7h-.5z"/></svg>
                </button>
                <button 
                  className={`riview-option-btn-small ${useRegex ? 'active' : ''}`} 
                  onClick={() => setUseRegex(!useRegex)}
                  title="Use Regular Expression"
                >
                  .*
                </button>
              </div>
              <span className="riview-search-count">
                {searchResults.length > 0 ? `${currentResultIndex + 1} of ${searchResults.length}` : 'No results'}
              </span>
              <div className="riview-search-actions">
                <button 
                  className="riview-search-btn" 
                  onClick={goToPrevMatch} 
                  disabled={searchResults.length === 0}
                  title="Previous Match (Shift+Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M8 3.5l-5 5h3v4h4v-4h3l-5-5z"/></svg>
                </button>
                <button 
                  className="riview-search-btn" 
                  onClick={goToNextMatch} 
                  disabled={searchResults.length === 0}
                  title="Next Match (Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M8 12.5l5-5h-3v-4H6v4H3l5 5z"/></svg>
                </button>
                <button 
                  className="riview-search-btn" 
                  onClick={() => { setShowSearch(false); setSearchQuery(''); setReplaceQuery(''); setSearchExecuted(false); }}
                  title="Close (Escape)"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M8 8.7l3.3 3.3.7-.7L8.7 8 12 4.7l-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7z"/></svg>
                </button>
              </div>
            </div>
            {showReplace && (
              <div className="riview-search-row">
                <input
                  ref={replaceInputRef}
                  className="riview-search-input"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={e => setReplaceQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleReplace();
                    if (e.key === 'Escape') {
                      setShowSearch(false);
                      setSearchQuery('');
                      setSearchExecuted(false);
                    }
                  }}
                />
                <div className="riview-search-actions">
                  <button 
                    className="riview-search-btn" 
                    onClick={handleReplace} 
                    disabled={searchResults.length === 0}
                    title="Replace"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M3.5 3h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm8-8h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zM7 7h2v2H7V7z"/></svg>
                  </button>
                  <button 
                    className="riview-search-btn" 
                    onClick={handleReplaceAll} 
                    disabled={searchResults.length === 0}
                    title="Replace All"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M3 3h2v2H3V3zm0 4h2v2H3V7zm0 4h2v2H3v-2zm4-8h2v2H7V3zm0 4h2v2H7V7zm0 4h2v2H7v-2zm4-8h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2z"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const markdownPreview = useMemo(() => (
    <div className="riview-preview" ref={previewRef} onScroll={handlePreviewScroll}>
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
                        return <code className={className} dangerouslySetInnerHTML={{ __html: Prism.highlight(codeString, Prism.languages[lang], lang) }} {...props} />;
                    } catch { return <code className={className} {...props}>{children}</code>; }
                }
                return <code className={className} {...props}>{children}</code>;
              }
            }}
        >
            {content}
        </ReactMarkdown>
       </div>
    </div>
  ), [content, handlePreviewScroll]);

  const treeView = (
    <div className="riview-tree">
        {parsedData ? (
            <React.Suspense fallback={<div>Loading tree...</div>}>
                <JsonView
                    src={parsedData}
                    theme="monokai"
                    collapsed={2}
                    displayDataTypes={false}
                    displayObjectSize={true}
                    enableClipboard={true}
                    style={{ backgroundColor: 'transparent', fontSize: '13px', fontFamily: "'Consolas', monospace" }}
                />
            </React.Suspense>
        ) : (
            <div style={{color: '#f44747', padding: 20}}>
                Invalid {language.toUpperCase()} - Fix syntax to view tree
            </div>
        )}
    </div>
  );

  return (
    <div className="riview">
      <div className="riview-toolbar">
        <div className="riview-toolbar-left">
          <div className="riview-title">
            <span className="riview-icon">📄</span>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{fileName}</span>
            {isDirty && <span style={{ color: '#d4d4d4', marginLeft: 4 }}>●</span>}
          </div>
        </div>
        <div className="riview-toolbar-right">
          <button className="riview-btn" onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 0); }} title="Find (Cmd+F)">🔍</button>
          <button className="riview-btn" onClick={undo} title="Undo (Cmd+Z)" disabled={undoStack.length === 0}>↶</button>
          <button className="riview-btn" onClick={redo} title="Redo (Cmd+Shift+Z)" disabled={redoStack.length === 0}>↷</button>
          <button className="riview-btn" onClick={handleSave} title="Save (Cmd+S)">💾</button>
          
          {(isDataFile || isXml) && (
             <div className="riview-btn-group">
                <button className="riview-btn" onClick={handleFormat} title="Format">📐</button>
                <button className="riview-btn" onClick={handleValidate} title="Validate">✓</button>
             </div>
          )}

          {isMarkdown && (
             <>
               <div className="riview-btn-group">
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('**', '**', 'bold')} title="Bold (Cmd+B)"><b>B</b></button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('*', '*', 'italic')} title="Italic (Cmd+I)"><i>I</i></button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('~~', '~~', 'strikethrough')} title="Strikethrough"><s>S</s></button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('`', '`', 'code')} title="Inline Code">&lt;/&gt;</button>
               </div>
               <div className="riview-btn-group">
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('# ', '', 'heading')} title="Heading">H</button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('- ', '', 'list item')} title="List">☰</button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('> ', '', 'quote')} title="Quote">❝</button>
               </div>
               <div className="riview-btn-group">
                 <button className="riview-btn" onClick={insertMarkdownLink} title="Link">🔗</button>
                 <button className="riview-btn" onClick={insertMarkdownImage} title="Image">🖼</button>
                 <button className="riview-btn" onClick={insertMarkdownTable} title="Table">▦</button>
                 <button className="riview-btn" onClick={() => insertMarkdownFormat('```\n', '\n```', 'code')} title="Code Block">⌸</button>
               </div>
               <button 
                  className={`riview-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => setViewMode(viewMode === 'split' ? 'code' : 'split')}
                  title="Toggle Split Preview"
               >
                  👁️
               </button>
             </>
          )}

          {isDataFile && (
              <button 
                className={`riview-btn ${viewMode === 'tree' ? 'active' : ''}`} 
                onClick={() => setViewMode(viewMode === 'tree' ? 'code' : 'tree')}
                title="Toggle Tree View"
              >
                🌳
              </button>
          )}
          
          <button className="riview-btn" onClick={() => setShowShortcuts(!showShortcuts)} title="Shortcuts (Cmd+K)">⌨️</button>
          
          {onClose && <button className="riview-btn" onClick={handleClose} title="Close">✕</button>}
        </div>
      </div>

      <div className="riview-content">
        {showConflictResolver && (
          <div className="riview-conflict-resolver">
            <div className="riview-conflict-header">
              <span className="riview-conflict-icon">⚠️</span>
              <span className="riview-conflict-title">Conflict Detected</span>
              <span className="riview-conflict-desc">File has been modified externally while you have unsaved changes</span>
            </div>
            <div className="riview-conflict-content">
              <div className="riview-conflict-pane">
                <div className="riview-conflict-pane-header">
                  <span className="riview-conflict-pane-title">Your Changes (Local)</span>
                  <button className="riview-conflict-btn primary" onClick={handleKeepLocal}>Keep Local & Save</button>
                </div>
                <div className="riview-conflict-pane-content">
                  <pre>{content}</pre>
                </div>
              </div>
              <div className="riview-conflict-divider">
                <span>VS</span>
              </div>
              <div className="riview-conflict-pane">
                <div className="riview-conflict-pane-header">
                  <span className="riview-conflict-pane-title">External Changes (Disk)</span>
                  <button className="riview-conflict-btn" onClick={handleKeepExternal}>Use External</button>
                </div>
                <div className="riview-conflict-pane-content">
                  <pre>{externalContent}</pre>
                </div>
              </div>
            </div>
            <div className="riview-conflict-footer">
              <button className="riview-conflict-btn secondary" onClick={() => setShowConflictResolver(false)}>Cancel</button>
            </div>
          </div>
        )}
        {fileChangedExternally && !showConflictResolver && (
          <div className="riview-file-changed-banner">
            <span>File has been changed externally.</span>
            <button onClick={handleReload}>Reload</button>
            <button onClick={() => setFileChangedExternally(false)}>Dismiss</button>
          </div>
        )}
        {loading ? (
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#888'}}>Loading...</div>
        ) : (
            <>
                {viewMode === 'tree' && treeView}
                {viewMode === 'code' && editorView}
                {viewMode === 'preview' && markdownPreview}
                {viewMode === 'split' && (
                    <div className="riview-split-container" ref={splitContainerRef}>
                        <div className="riview-pane" style={{ width: `${splitRatio}%` }}>
                            {editorView}
                        </div>
                        <div 
                            className="riview-resizer" 
                            onMouseDown={startResizing}
                        />
                        <div className="riview-pane" style={{ width: `${100 - splitRatio}%` }}>
                            {markdownPreview}
                        </div>
                    </div>
                )}
            </>
        )}
        {shortcutsPanel}
      </div>

      <div className="riview-statusbar">
        <div className="riview-statusbar-item">
            <span className={`riview-status-msg ${statusType}`}>{statusMsg}</span>
        </div>
        <div className="riview-statusbar-item" style={{gap: 16}}>
            <span>Ln {cursorLine}, Col {cursorCol}</span>
            <span>UTF-8</span>
            <span>{language.toUpperCase()}</span>
            {viewMode !== 'code' && <span>{viewMode.toUpperCase()}</span>}
            {undoStack.length > 0 && <span>↶{undoStack.length}</span>}
        </div>
      </div>
    </div>
  );
};

export default RIView;
