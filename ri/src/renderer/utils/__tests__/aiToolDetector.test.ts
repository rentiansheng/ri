import { describe, it, expect, beforeEach } from 'vitest';
import {
  AI_TOOLS,
  OUTPUT_PATTERNS,
  detectAIToolFromProcess,
  detectStatusFromOutput,
  extractPrompt,
  findAIToolProcess,
} from '../aiToolDetector';

describe('aiToolDetector', () => {
  describe('AI_TOOLS constant', () => {
    it('should have all required tools defined', () => {
      expect(AI_TOOLS).toHaveProperty('opencode');
      expect(AI_TOOLS).toHaveProperty('gh-copilot');
      expect(AI_TOOLS).toHaveProperty('aider');
      expect(AI_TOOLS).toHaveProperty('cursor');
      expect(AI_TOOLS).toHaveProperty('cline');
    });

    it('should have pattern arrays for each tool', () => {
      Object.values(AI_TOOLS).forEach((patterns) => {
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        patterns.forEach((pattern) => {
          expect(typeof pattern).toBe('string');
        });
      });
    });

    it('should contain expected patterns for opencode', () => {
      expect(AI_TOOLS.opencode).toContain('opencode');
      expect(AI_TOOLS.opencode).toContain('ocode');
      expect(AI_TOOLS.opencode).toContain('oc');
    });

    it('should contain expected patterns for gh-copilot', () => {
      expect(AI_TOOLS['gh-copilot']).toContain('gh');
      expect(AI_TOOLS['gh-copilot']).toContain('copilot');
      expect(AI_TOOLS['gh-copilot']).toContain('github-copilot-cli');
    });

    it('should contain expected patterns for aider', () => {
      expect(AI_TOOLS.aider).toContain('aider');
    });

    it('should contain expected patterns for cursor', () => {
      expect(AI_TOOLS.cursor).toContain('cursor');
    });

    it('should contain expected patterns for cline', () => {
      expect(AI_TOOLS.cline).toContain('cline');
    });
  });

  describe('OUTPUT_PATTERNS constant', () => {
    it('should have all required pattern categories', () => {
      expect(OUTPUT_PATTERNS).toHaveProperty('thinking');
      expect(OUTPUT_PATTERNS).toHaveProperty('waiting');
      expect(OUTPUT_PATTERNS).toHaveProperty('executing');
      expect(OUTPUT_PATTERNS).toHaveProperty('completed');
    });

    it('should have regex patterns for each category', () => {
      Object.values(OUTPUT_PATTERNS).forEach((patterns) => {
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        patterns.forEach((pattern) => {
          expect(pattern instanceof RegExp).toBe(true);
        });
      });
    });
  });

  describe('detectAIToolFromProcess', () => {
    it('should detect opencode from "opencode" process name', () => {
      expect(detectAIToolFromProcess('opencode')).toBe('opencode');
    });

    it('should detect opencode from "ocode" process name', () => {
      expect(detectAIToolFromProcess('ocode')).toBe('opencode');
    });

    it('should detect opencode from "oc" process name', () => {
      expect(detectAIToolFromProcess('oc')).toBe('opencode');
    });

    it('should detect opencode with mixed case', () => {
      expect(detectAIToolFromProcess('OpenCode')).toBe('opencode');
      expect(detectAIToolFromProcess('OPENCODE')).toBe('opencode');
      expect(detectAIToolFromProcess('OCode')).toBe('opencode');
    });

    it('should detect opencode when embedded in path', () => {
      expect(detectAIToolFromProcess('/usr/bin/opencode')).toBe('opencode');
      expect(detectAIToolFromProcess('/usr/local/bin/ocode')).toBe('opencode');
    });

    it('should detect gh-copilot from "gh" process name', () => {
      expect(detectAIToolFromProcess('gh')).toBe('gh-copilot');
    });

    it('should detect gh-copilot from "copilot" process name', () => {
      expect(detectAIToolFromProcess('copilot')).toBe('gh-copilot');
    });

    it('should detect gh-copilot from "github-copilot-cli" process name', () => {
      expect(detectAIToolFromProcess('github-copilot-cli')).toBe('gh-copilot');
    });

    it('should detect gh-copilot with mixed case', () => {
      expect(detectAIToolFromProcess('GH')).toBe('gh-copilot');
      expect(detectAIToolFromProcess('Copilot')).toBe('gh-copilot');
    });

    it('should detect aider from "aider" process name', () => {
      expect(detectAIToolFromProcess('aider')).toBe('aider');
    });

    it('should detect aider with mixed case', () => {
      expect(detectAIToolFromProcess('AIDER')).toBe('aider');
      expect(detectAIToolFromProcess('Aider')).toBe('aider');
    });

    it('should detect cursor from "cursor" process name', () => {
      expect(detectAIToolFromProcess('cursor')).toBe('cursor');
    });

    it('should detect cursor with mixed case', () => {
      expect(detectAIToolFromProcess('CURSOR')).toBe('cursor');
      expect(detectAIToolFromProcess('Cursor')).toBe('cursor');
    });

    it('should detect cline from "cline" process name', () => {
      expect(detectAIToolFromProcess('cline')).toBe('cline');
    });

    it('should detect cline with mixed case', () => {
      expect(detectAIToolFromProcess('CLINE')).toBe('cline');
      expect(detectAIToolFromProcess('Cline')).toBe('cline');
    });

    it('should return null for unknown process names', () => {
      expect(detectAIToolFromProcess('unknown')).toBeNull();
      expect(detectAIToolFromProcess('bash')).toBeNull();
      expect(detectAIToolFromProcess('zsh')).toBeNull();
      expect(detectAIToolFromProcess('node')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(detectAIToolFromProcess('')).toBeNull();
    });
  });

  describe('detectStatusFromOutput', () => {
    describe('thinking status', () => {
      it('should detect thinking from triple dots animation', () => {
        expect(detectStatusFromOutput('●●●')).toBe('thinking');
      });

      it('should detect thinking from spinner characters', () => {
        expect(detectStatusFromOutput('⠋')).toBe('thinking');
        expect(detectStatusFromOutput('⠙')).toBe('thinking');
        expect(detectStatusFromOutput('⠹')).toBe('thinking');
        expect(detectStatusFromOutput('⠸')).toBe('thinking');
        expect(detectStatusFromOutput('⠼')).toBe('thinking');
      });

      it('should detect thinking from "Thinking..." text', () => {
        expect(detectStatusFromOutput('Thinking...')).toBe('thinking');
        expect(detectStatusFromOutput('thinking...')).toBe('thinking');
        expect(detectStatusFromOutput('THINKING...')).toBe('thinking');
      });

      it('should detect thinking from "Processing..." text', () => {
        expect(detectStatusFromOutput('Processing...')).toBe('thinking');
        expect(detectStatusFromOutput('processing...')).toBe('thinking');
      });

      it('should detect thinking from "Analyzing..." text', () => {
        expect(detectStatusFromOutput('Analyzing...')).toBe('thinking');
      });

      it('should detect thinking from "Generating..." text', () => {
        expect(detectStatusFromOutput('Generating...')).toBe('thinking');
      });

      it('should detect thinking from "Loading..." text', () => {
        expect(detectStatusFromOutput('Loading...')).toBe('thinking');
      });

      it('should detect thinking from "Working..." text', () => {
        expect(detectStatusFromOutput('Working...')).toBe('thinking');
      });

      it('should detect thinking from progress bar', () => {
        expect(detectStatusFromOutput('[━━━   ]')).toBe('thinking');
        expect(detectStatusFromOutput('[━━━━━━]')).toBe('thinking');
      });
    });

    describe('waiting status', () => {
      it('should detect waiting from question prompt with "?"', () => {
        expect(detectStatusFromOutput('? Select an option:')).toBe('waiting');
        expect(detectStatusFromOutput('? Enter your name:')).toBe('waiting');
      });

      it('should detect waiting from (Y/n) prompt', () => {
        expect(detectStatusFromOutput('Continue? (Y/n)')).toBe('waiting');
        expect(detectStatusFromOutput('(Y/n)')).toBe('waiting');
      });

      it('should detect waiting from [y/N] prompt', () => {
        expect(detectStatusFromOutput('Continue? [y/N]')).toBe('waiting');
        expect(detectStatusFromOutput('[y/N]')).toBe('waiting');
      });

      it('should detect waiting from (y/N) prompt', () => {
        expect(detectStatusFromOutput('Continue? (y/N)')).toBe('waiting');
      });

      it('should detect waiting from "Press any key" prompt', () => {
        expect(detectStatusFromOutput('Press any key')).toBe('waiting');
      });

      it('should detect waiting from "Enter" prompt', () => {
        expect(detectStatusFromOutput('Enter your name:')).toBe('waiting');
        expect(detectStatusFromOutput('Enter password:')).toBe('waiting');
      });

      it('should detect waiting from "Type" prompt', () => {
        expect(detectStatusFromOutput('Type something:')).toBe('waiting');
      });

      it('should detect waiting from "Input" prompt', () => {
        expect(detectStatusFromOutput('Input something:')).toBe('waiting');
      });

      it('should detect waiting from "Choose an option" prompt', () => {
        expect(detectStatusFromOutput('Choose an option')).toBe('waiting');
      });

      it('should detect waiting from "Select" prompt', () => {
        expect(detectStatusFromOutput('Select a file')).toBe('waiting');
        expect(detectStatusFromOutput('Select an option')).toBe('waiting');
      });

      it('should detect waiting from shell prompt ">"', () => {
        expect(detectStatusFromOutput('> ')).toBe('waiting');
      });
    });

    describe('executing status', () => {
      it('should detect executing from "Writing to file"', () => {
        expect(detectStatusFromOutput('Writing to file')).toBe('executing');
        expect(detectStatusFromOutput('writing to file')).toBe('executing');
      });

      it('should detect executing from "Editing" message', () => {
        expect(detectStatusFromOutput('Editing main.ts')).toBe('executing');
        expect(detectStatusFromOutput('Editing file.tsx')).toBe('executing');
      });

      it('should detect executing from "Running command"', () => {
        expect(detectStatusFromOutput('Running command')).toBe('executing');
      });

      it('should detect executing from "Executing..."', () => {
        expect(detectStatusFromOutput('Executing...')).toBe('executing');
      });

      it('should detect executing from "Applying changes"', () => {
        expect(detectStatusFromOutput('Applying changes')).toBe('executing');
      });

      it('should detect executing from "Creating file"', () => {
        expect(detectStatusFromOutput('Creating file')).toBe('executing');
      });

      it('should detect executing from "Deleting file"', () => {
        expect(detectStatusFromOutput('Deleting file')).toBe('executing');
      });

      it('should detect executing from "Moving file"', () => {
        expect(detectStatusFromOutput('Moving file')).toBe('executing');
      });

      it('should detect executing from "Copying file"', () => {
        expect(detectStatusFromOutput('Copying file')).toBe('executing');
      });
    });

    describe('completed status', () => {
      it('should detect completed from "Done"', () => {
        expect(detectStatusFromOutput('Done')).toBe('completed');
        expect(detectStatusFromOutput('Done.')).toBe('completed');
      });

      it('should detect completed from "Completed"', () => {
        expect(detectStatusFromOutput('Completed')).toBe('completed');
      });

      it('should detect completed from "Success"', () => {
        expect(detectStatusFromOutput('Success')).toBe('completed');
      });

      it('should detect completed from "Finished"', () => {
        expect(detectStatusFromOutput('Finished')).toBe('completed');
      });

      it('should detect completed from checkmark ✓', () => {
        expect(detectStatusFromOutput('✓')).toBe('completed');
        expect(detectStatusFromOutput('✔')).toBe('completed');
      });

      it('should detect completed from shell prompt on own line', () => {
        expect(detectStatusFromOutput('\n$\n')).toBe('completed');
        expect(detectStatusFromOutput('\n#\n')).toBe('completed');
      });
    });

    describe('priority order', () => {
      it('should prioritize waiting over thinking', () => {
        expect(detectStatusFromOutput('? Question (Y/n) Thinking...')).toBe('waiting');
      });

      it('should prioritize waiting over executing', () => {
        expect(detectStatusFromOutput('Writing to file? (Y/n)')).toBe('waiting');
      });

      it('should prioritize thinking over executing', () => {
        expect(detectStatusFromOutput('Thinking... Writing to file')).toBe('thinking');
      });

      it('should prioritize executing over completed', () => {
        expect(detectStatusFromOutput('Writing to file. Done')).toBe('executing');
      });
    });

    describe('idle status', () => {
      it('should return idle for empty string', () => {
        expect(detectStatusFromOutput('')).toBe('idle');
      });

      it('should return idle for unrecognized output', () => {
        expect(detectStatusFromOutput('Some random text')).toBe('idle');
        expect(detectStatusFromOutput('Hello world')).toBe('idle');
      });

      it('should return idle for whitespace only', () => {
        expect(detectStatusFromOutput('   ')).toBe('idle');
        expect(detectStatusFromOutput('\n\n')).toBe('idle');
      });
    });
  });

  describe('extractPrompt', () => {
    it('should extract question format "? question"', () => {
      expect(extractPrompt('? Select an option:')).toBe('Select an option:');
      expect(extractPrompt('? Enter your name:')).toBe('Enter your name:');
    });

    it('should extract "Enter something:" format', () => {
      expect(extractPrompt('Enter your name:')).toBe('Enter your name:');
      expect(extractPrompt('Enter password:')).toBe('Enter password:');
    });

    it('should extract "Type something:" format', () => {
      expect(extractPrompt('Type your command:')).toBe('Type your command:');
    });

    it('should extract "Input something:" format', () => {
      expect(extractPrompt('Input directory:')).toBe('Input directory:');
    });

    it('should extract Y/n confirmation prompt', () => {
        const result = extractPrompt('Continue? (Y/n)');
        expect(result).toBe('(Y/n)');
      });

    it('should extract [y/N] confirmation prompt', () => {
      const result = extractPrompt('Are you sure? [y/N]');
      expect(result).toBe('Are you sure? [y/N]');
    });

    it('should trim whitespace in extraction', () => {
      expect(extractPrompt('?  Select an option:  ')).toBe('Select an option:');
    });

    it('should return undefined for no prompt', () => {
      expect(extractPrompt('Some output text')).toBeUndefined();
      expect(extractPrompt('Processing...')).toBeUndefined();
      expect(extractPrompt('Done')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(extractPrompt('')).toBeUndefined();
    });

    it('should handle multiline output and extract first prompt', () => {
      const multiline = 'Some output\n? First prompt:\n? Second prompt:';
      const result = extractPrompt(multiline);
      expect(result).toBe('First prompt:');
    });
  });

  describe('findAIToolProcess', () => {
    it('should find AI tool in process list', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'opencode', state: 'running' },
        { pid: 102, ppid: 100, comm: 'node', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result).not.toBeNull();
      expect(result?.tool).toBe('opencode');
      expect(result?.process.comm).toBe('opencode');
    });

    it('should find copilot process', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'copilot', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result).not.toBeNull();
      expect(result?.tool).toBe('gh-copilot');
    });

    it('should find aider process', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'aider', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result?.tool).toBe('aider');
    });

    it('should find cursor process', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'cursor', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result?.tool).toBe('cursor');
    });

    it('should find cline process', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'cline', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result?.tool).toBe('cline');
    });

    it('should return null if no AI tool found', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'node', state: 'running' },
        { pid: 102, ppid: 100, comm: 'npm', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result).toBeNull();
    });

    it('should return null for empty process list', () => {
      const result = findAIToolProcess([]);
      expect(result).toBeNull();
    });

    it('should return first AI tool found when multiple exist', () => {
      const processes = [
        { pid: 100, ppid: 1, comm: 'bash', state: 'running' },
        { pid: 101, ppid: 100, comm: 'opencode', state: 'running' },
        { pid: 102, ppid: 100, comm: 'aider', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result?.tool).toBe('opencode');
      expect(result?.process.pid).toBe(101);
    });

    it('should return process object with all properties', () => {
      const processes = [
        { pid: 123, ppid: 456, comm: 'copilot', state: 'running' },
      ];

      const result = findAIToolProcess(processes);
      expect(result?.process).toEqual(processes[0]);
      expect(result?.process.pid).toBe(123);
      expect(result?.process.ppid).toBe(456);
      expect(result?.process.comm).toBe('copilot');
      expect(result?.process.state).toBe('running');
    });
  });
});
