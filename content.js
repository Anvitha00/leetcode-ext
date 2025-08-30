// content.js - Extracts LeetCode problem data and user code
class LeetCodeExtractor {
  constructor() {
    this.problemData = null;
    this.userCode = '';
    this.init();
  }

  init() {
    // Wait for page to load completely
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtractor());
    } else {
      this.setupExtractor();
    }
  }

  setupExtractor() {
    // Extract problem data immediately
    this.extractProblemData();
    
    // Set up code monitoring
    this.setupCodeMonitoring();
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getProblemData') {
        sendResponse({
          problemData: this.problemData,
          userCode: this.getUserCode()
        });
      } else if (request.action === 'getCurrentCode') {
        sendResponse({
          userCode: this.getUserCode()
        });
      }
    });

    // Create DSA Coach button
    this.createCoachButton();
  }

  extractProblemData() {
    try {
      // Extract problem title
      const titleElement = document.querySelector('[data-cy="question-title"]') || 
                          document.querySelector('h1') ||
                          document.querySelector('.css-v3d350');
      
      // Extract problem description
      const descriptionElement = document.querySelector('[data-key="description-content"]') || 
                                document.querySelector('.content__u3I1') ||
                                document.querySelector('.question-content');
      
      // Extract examples
      const examples = [];
      const exampleElements = document.querySelectorAll('pre') || [];
      exampleElements.forEach((example, index) => {
        if (example.textContent.includes('Input:') || example.textContent.includes('Example')) {
          examples.push(example.textContent.trim());
        }
      });

      // Extract constraints
      const constraintElements = document.querySelectorAll('ul li, .content__u3I1 p') || [];
      const constraints = [];
      constraintElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('≤') || text.includes('<=') || text.includes('constraints') || 
            text.match(/\d+.*\d+/) || text.includes('length')) {
          constraints.push(text);
        }
      });

      this.problemData = {
        title: titleElement ? titleElement.textContent.trim() : 'Unknown Problem',
        description: descriptionElement ? descriptionElement.textContent.trim() : '',
        examples: examples.slice(0, 3), // Limit to first 3 examples
        constraints: constraints.slice(0, 5), // Limit to first 5 constraints
        url: window.location.href
      };

      console.log('DSA Coach: Problem data extracted', this.problemData);
    } catch (error) {
      console.error('DSA Coach: Error extracting problem data:', error);
      this.problemData = {
        title: 'Error extracting problem',
        description: 'Could not extract problem details',
        examples: [],
        constraints: [],
        url: window.location.href
      };
    }
  }

  setupCodeMonitoring() {
    // Multiple strategies to get user code from different editor types
    this.codeSelectors = [
      // Monaco Editor (most common)
      '.monaco-editor textarea',
      '.monaco-editor .view-lines',
      // CodeMirror
      '.CodeMirror-code',
      '.CodeMirror textarea',
      // ACE Editor
      '.ace_text-input',
      '.ace_content',
      // Fallback selectors
      '[data-key="code-input"]',
      'textarea[autocomplete="off"]',
      '.editor textarea'
    ];

    // Monitor for code changes
    setInterval(() => {
      this.userCode = this.getUserCode();
    }, 1000);
  }

  getUserCode() {
    // Try multiple strategies to extract code
    
    // Strategy 1: Monaco Editor API
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getModels();
      if (editors.length > 0) {
        return editors[0].getValue();
      }
    }

    // Strategy 2: Try to find Monaco editor instance
    const monacoElements = document.querySelectorAll('.monaco-editor');
    for (let element of monacoElements) {
      if (element.querySelector('.view-lines')) {
        const lines = element.querySelectorAll('.view-line');
        let code = '';
        lines.forEach(line => {
          // Extract text content, handling spans
          const spans = line.querySelectorAll('span');
          spans.forEach(span => {
            code += span.textContent;
          });
          code += '\n';
        });
        if (code.trim()) return code.trim();
      }
    }

    // Strategy 3: Look for textarea or input elements
    for (let selector of this.codeSelectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value;
      }
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Strategy 4: Try to find any textarea with code-like content
    const textareas = document.querySelectorAll('textarea');
    for (let textarea of textareas) {
      const content = textarea.value || textarea.textContent;
      if (content && (content.includes('def ') || content.includes('function') || 
                     content.includes('class ') || content.includes('public ') ||
                     content.includes('var ') || content.includes('let ') ||
                     content.includes('return'))) {
        return content;
      }
    }

    return this.userCode || '// No code detected. Please ensure your code is in the LeetCode editor.';
  }

  createCoachButton() {
    // Create floating DSA Coach button
    const button = document.createElement('div');
    button.id = 'dsa-coach-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V9M15 9L15 21L13 21V11L11 11V21L9 21V9C9 7.9 9.9 7 11 7H13C14.1 7 15 7.9 15 9Z" fill="currentColor"/>
      </svg>
      <span>DSA Coach</span>
    `;
    button.className = 'dsa-coach-floating-button';
    
    button.addEventListener('click', () => {
      // Send message to open extension popup
      chrome.runtime.sendMessage({action: 'openCoach'});
    });

    document.body.appendChild(button);
  }
}

// Initialize the extractor
new LeetCodeExtractor();

// Add some basic styles for the coach button
const style = document.createElement('style');
style.textContent = `
  .dsa-coach-floating-button {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 25px;
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
  }
  
  .dsa-coach-floating-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
  
  .dsa-coach-floating-button svg {
    width: 20px;
    height: 20px;
  }
`;
document.head.appendChild(style);