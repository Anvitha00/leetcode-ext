// content.js - Extracts LeetCode problem data and creates inline coaching panel
class LeetCodeExtractor {
  constructor() {
    this.problemData = null;
    this.userCode = '';
    this.conversationHistory = [];
    this.backendUrl = 'http://localhost:3000';
    this.codeObserver = null;
    this.requestTimeout = 15000; // 15 seconds
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
    try {
      // Extract problem data immediately
      this.extractProblemData();
      
      // Set up code monitoring
      this.setupCodeMonitoring();
      
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
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
        } catch (error) {
          console.error('DSA Coach: Message handler error:', error);
          sendResponse({ error: 'Failed to process request' });
        }
      });

      // Create DSA Coach button
      this.createCoachButton();
      
      // Test backend connection
      this.testBackendConnection();
      
      // Add styles
      this.addStyles();
      
    } catch (error) {
      console.error('DSA Coach: Setup failed:', error);
    }
  }

  async testBackendConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.backendUrl}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      console.log('DSA Coach: Backend connected', data);
    } catch (error) {
      console.warn('DSA Coach: Backend not available, using mock responses');
      this.backendUrl = null;
    }
  }

  extractProblemData() {
    try {
      // Extract problem title with multiple fallbacks
      const titleSelectors = [
        '[data-cy="question-title"]',
        'h1[data-cy="question-title"]',
        '.css-v3d350',
        'h1',
        '.question-title'
      ];
      
      let titleElement = null;
      for (const selector of titleSelectors) {
        titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) break;
      }
      
      // Extract problem description
      const descSelectors = [
        '[data-key="description-content"]',
        '.content__u3I1',
        '.question-content',
        '[data-track-load="description_content"]'
      ];
      
      let descriptionElement = null;
      for (const selector of descSelectors) {
        descriptionElement = document.querySelector(selector);
        if (descriptionElement && descriptionElement.textContent.trim()) break;
      }
      
      // Extract examples more intelligently
      const examples = [];
      const exampleElements = document.querySelectorAll('pre, .example');
      exampleElements.forEach((example, index) => {
        const text = example.textContent.trim();
        if ((text.includes('Input:') || text.includes('Example') || text.includes('Output:')) 
            && text.length > 10 && text.length < 500) {
          examples.push(this.sanitizeText(text));
        }
      });

      // Extract constraints more precisely
      const constraints = [];
      const constraintElements = document.querySelectorAll('ul li, .content__u3I1 p, .constraint');
      constraintElements.forEach(el => {
        const text = el.textContent.trim();
        if ((text.includes('≤') || text.includes('<=') || text.includes('constraints') || 
            text.match(/\d+.*\d+/) || text.includes('length')) && 
            text.length < 200 && !text.includes('Example')) {
          constraints.push(this.sanitizeText(text));
        }
      });

      this.problemData = {
        title: titleElement ? this.sanitizeText(titleElement.textContent.trim()) : 'Unknown Problem',
        description: descriptionElement ? this.sanitizeText(descriptionElement.textContent.trim().substring(0, 500)) : '',
        examples: examples.slice(0, 3),
        constraints: constraints.slice(0, 5),
        url: window.location.href,
        timestamp: Date.now()
      };

      console.log('DSA Coach: Problem data extracted', this.problemData);
    } catch (error) {
      console.error('DSA Coach: Error extracting problem data:', error);
      this.problemData = {
        title: 'Error extracting problem',
        description: 'Could not extract problem details',
        examples: [],
        constraints: [],
        url: window.location.href,
        timestamp: Date.now()
      };
    }
  }

  setupCodeMonitoring() {
    this.codeSelectors = [
      '.monaco-editor textarea',
      '.monaco-editor .view-lines',
      '.CodeMirror-code',
      '.CodeMirror textarea',
      '.ace_text-input',
      '.ace_content',
      '[data-key="code-input"]',
      'textarea[autocomplete="off"]',
      '.editor textarea'
    ];

    // Use MutationObserver instead of setInterval for better performance
    this.codeObserver = new MutationObserver(() => {
      const newCode = this.getUserCode();
      if (newCode !== this.userCode) {
        this.userCode = newCode;
      }
    });

    this.codeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value']
    });

    // Initial code detection
    this.userCode = this.getUserCode();
  }

  getUserCode() {
    try {
      // Strategy 1: Monaco Editor API
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getModels();
        if (editors.length > 0) {
          const code = editors[0].getValue();
          if (code && code.trim()) return code;
        }
      }

      // Strategy 2: Monaco editor DOM traversal
      const monacoElements = document.querySelectorAll('.monaco-editor');
      for (let element of monacoElements) {
        const viewLines = element.querySelector('.view-lines');
        if (viewLines) {
          const lines = viewLines.querySelectorAll('.view-line');
          let code = '';
          lines.forEach(line => {
            const spans = line.querySelectorAll('span');
            spans.forEach(span => {
              code += span.textContent;
            });
            code += '\n';
          });
          if (code.trim()) return code.trim();
        }
      }

      // Strategy 3: Standard input elements
      for (let selector of this.codeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const content = element.value || element.textContent;
          if (content && content.trim()) {
            return content.trim();
          }
        }
      }

      // Strategy 4: Any textarea with code patterns
      const textareas = document.querySelectorAll('textarea');
      for (let textarea of textareas) {
        const content = textarea.value || textarea.textContent;
        if (content && this.looksLikeCode(content)) {
          return content;
        }
      }

      return this.userCode || '// No code detected. Please ensure your code is in the LeetCode editor.';
    } catch (error) {
      console.error('DSA Coach: Error getting user code:', error);
      return '// Error detecting code.';
    }
  }

  looksLikeCode(text) {
    const codePatterns = [
      /def\s+\w+/,
      /function\s+\w+/,
      /class\s+\w+/,
      /public\s+\w+/,
      /(var|let|const)\s+\w+/,
      /return\s+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/
    ];
    
    return codePatterns.some(pattern => pattern.test(text)) && text.length > 20;
  }

  createCoachButton() {
    // Remove existing button if present
    const existingButton = document.getElementById('dsa-coach-button');
    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement('div');
    button.id = 'dsa-coach-button';
    button.className = 'dsa-coach-floating-button';
    
    // Create SVG icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '24');
    icon.setAttribute('height', '24');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V9M15 9L15 21L13 21V11L11 11V21L9 21V9C9 7.9 9.9 7 11 7H13C14.1 7 15 7.9 15 9Z');
    path.setAttribute('fill', 'currentColor');
    
    icon.appendChild(path);
    
    const span = document.createElement('span');
    span.textContent = 'DSA Coach';
    
    button.appendChild(icon);
    button.appendChild(span);
    
    button.addEventListener('click', () => {
      this.toggleCoachPanel();
    });

    document.body.appendChild(button);
  }

  toggleCoachPanel() {
    let panel = document.getElementById('dsa-coach-panel');
    
    if (panel) {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.animation = 'dsaCoachSlideIn 0.3s ease-out';
      } else {
        panel.style.animation = 'dsaCoachSlideOut 0.3s ease-out';
        setTimeout(() => {
          panel.style.display = 'none';
        }, 300);
      }
    } else {
      this.createCoachPanel();
    }
  }

  createCoachPanel() {
    // Remove existing panel
    const existingPanel = document.getElementById('dsa-coach-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'dsa-coach-panel';
    panel.className = 'dsa-coach-panel';
    
    // Create header
    const header = this.createElement('div', 'dsa-coach-header');
    const title = this.createElement('h3', '', '🤖 DSA Coach AI');
    const closeBtn = this.createElement('button', 'dsa-coach-close', '×');
    closeBtn.onclick = () => panel.style.display = 'none';
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Problem info
    const problemInfo = this.createElement('div', 'dsa-coach-problem-info');
    problemInfo.innerHTML = `<strong>Problem:</strong> ${this.sanitizeText(this.problemData?.title || 'Loading...')}`;
    
    // Mode toggle
    const modeToggle = this.createElement('div', 'dsa-coach-mode-toggle');
    const discussionBtn = this.createElement('button', 'dsa-coach-mode-btn active', 'Discussion');
    discussionBtn.dataset.mode = 'discussion';
    const codeBtn = this.createElement('button', 'dsa-coach-mode-btn', 'Code Analysis');
    codeBtn.dataset.mode = 'code';
    modeToggle.appendChild(discussionBtn);
    modeToggle.appendChild(codeBtn);
    
    // Content container
    const content = this.createElement('div', 'dsa-coach-content');
    
    // Discussion mode
    const discussionMode = this.createElement('div', 'dsa-coach-mode-content active');
    discussionMode.id = 'discussion-mode';
    const discussionSection = this.createInputSection(
      'Describe your approach:',
      'dsa-approach-input',
      'e.g., I\'m thinking of using a hash map to store numbers...',
      3,
      'Analyze Approach',
      'analyzeApproach'
    );
    discussionMode.appendChild(discussionSection);
    
    // Code mode
    const codeMode = this.createElement('div', 'dsa-coach-mode-content');
    codeMode.id = 'code-mode';
    const codeSection = this.createCodeSection();
    codeMode.appendChild(codeSection);
    
    content.appendChild(discussionMode);
    content.appendChild(codeMode);
    
    // Response area
    const responseArea = this.createResponseArea();
    
    // Footer
    const footer = this.createFooter();
    
    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(problemInfo);
    panel.appendChild(modeToggle);
    panel.appendChild(content);
    panel.appendChild(responseArea);
    panel.appendChild(footer);
    
    document.body.appendChild(panel);
    
    this.setupModeToggle();
    this.setupChatInput();
    this.autoDetectCode();
    
    // Store reference for event handlers
    window.dsaCoachInstance = this;
  }

  createElement(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  createInputSection(label, inputId, placeholder, rows, buttonText, buttonAction) {
    const section = this.createElement('div', 'dsa-coach-input-section');
    
    const labelEl = this.createElement('label', '', label);
    const textarea = this.createElement('textarea');
    textarea.id = inputId;
    textarea.placeholder = placeholder;
    textarea.rows = rows;
    
    const button = this.createElement('button', 'dsa-coach-btn-primary');
    const buttonSpan = this.createElement('span', '', buttonText);
    const spinner = this.createElement('div', 'dsa-coach-spinner hidden');
    button.appendChild(buttonSpan);
    button.appendChild(spinner);
    button.onclick = () => this[buttonAction]();
    
    section.appendChild(labelEl);
    section.appendChild(textarea);
    section.appendChild(button);
    
    return section;
  }

  createCodeSection() {
    const section = this.createElement('div', 'dsa-coach-input-section');
    
    const label = this.createElement('label', '', 'Your code:');
    const textarea = this.createElement('textarea');
    textarea.id = 'dsa-code-input';
    textarea.placeholder = 'Your solution code...';
    textarea.rows = 4;
    
    const actions = this.createElement('div', 'dsa-coach-code-actions');
    
    const autoBtn = this.createElement('button', 'dsa-coach-btn-secondary', 'Auto-detect');
    autoBtn.onclick = () => this.autoDetectCode();
    
    const analyzeBtn = this.createElement('button', 'dsa-coach-btn-primary');
    const analyzeSpan = this.createElement('span', '', 'Analyze Code');
    const analyzeSpinner = this.createElement('div', 'dsa-coach-spinner hidden');
    analyzeBtn.appendChild(analyzeSpan);
    analyzeBtn.appendChild(analyzeSpinner);
    analyzeBtn.onclick = () => this.analyzeCode();
    
    actions.appendChild(autoBtn);
    actions.appendChild(analyzeBtn);
    
    section.appendChild(label);
    section.appendChild(textarea);
    section.appendChild(actions);
    
    return section;
  }

  createResponseArea() {
    const responseArea = this.createElement('div', 'dsa-coach-response-area');
    responseArea.id = 'dsa-response-area';
    responseArea.style.display = 'none';
    
    // Complexity info
    const complexityInfo = this.createElement('div', 'dsa-coach-complexity-info');
    complexityInfo.id = 'dsa-complexity-info';
    complexityInfo.style.display = 'none';
    
    const timeComplexity = this.createElement('div', 'complexity-item');
    timeComplexity.innerHTML = '<span>Time:</span><span id="dsa-time-complexity">O(?)</span>';
    
    const spaceComplexity = this.createElement('div', 'complexity-item');
    spaceComplexity.innerHTML = '<span>Space:</span><span id="dsa-space-complexity">O(?)</span>';
    
    complexityInfo.appendChild(timeComplexity);
    complexityInfo.appendChild(spaceComplexity);
    
    // Chat container
    const chatContainer = this.createElement('div', 'dsa-coach-chat-container');
    chatContainer.id = 'dsa-chat-container';
    
    // Chat input
    const chatInputSection = this.createElement('div', 'dsa-coach-chat-input');
    chatInputSection.id = 'dsa-chat-input-section';
    chatInputSection.style.display = 'none';
    
    const chatInputContainer = this.createElement('div', 'dsa-chat-input-container');
    const chatTextarea = this.createElement('textarea');
    chatTextarea.id = 'dsa-chat-input';
    chatTextarea.placeholder = 'Ask a follow-up question...';
    chatTextarea.rows = 2;
    
    const sendBtn = this.createElement('button', 'dsa-coach-send-btn');
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/></svg>';
    sendBtn.onclick = () => this.sendChatMessage();
    
    chatInputContainer.appendChild(chatTextarea);
    chatInputContainer.appendChild(sendBtn);
    chatInputSection.appendChild(chatInputContainer);
    
    responseArea.appendChild(complexityInfo);
    responseArea.appendChild(chatContainer);
    responseArea.appendChild(chatInputSection);
    
    return responseArea;
  }

  createFooter() {
    const footer = this.createElement('div', 'dsa-coach-footer');
    
    const clearBtn = this.createElement('button', 'dsa-coach-clear-btn', 'Clear Chat');
    clearBtn.onclick = () => this.clearConversation();
    
    const powered = this.createElement('span', 'dsa-coach-powered', 'Powered by Gemini AI');
    
    footer.appendChild(clearBtn);
    footer.appendChild(powered);
    
    return footer;
  }

  setupChatInput() {
    const chatInput = document.getElementById('dsa-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
      
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
      });
    }
  }

  setupModeToggle() {
    const modeButtons = document.querySelectorAll('.dsa-coach-mode-btn');
    const modeContents = document.querySelectorAll('.dsa-coach-mode-content');
    
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        modeContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${mode}-mode`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  async analyzeApproach() {
    const input = document.getElementById('dsa-approach-input');
    if (!input) return;
    
    const approach = input.value.trim();
    
    if (!approach) {
      this.showToast('Please describe your approach first', 'warning');
      return;
    }

    this.setLoading('analyzeApproach', true);
    
    try {
      const response = await this.callAI({
        type: 'approach_analysis',
        problem: this.problemData,
        approach: approach,
        history: this.conversationHistory
      });

      this.addChatMessage(approach, 'user');
      this.addChatMessage(response.response, 'ai', response.complexity);
      
      if (response.complexity) {
        this.showComplexityInfo(response.complexity);
      }
      
      this.showResponseArea();
      input.value = '';
      
    } catch (error) {
      console.error('DSA Coach: Error analyzing approach:', error);
      this.showToast('Error analyzing approach. Please try again.', 'error');
    } finally {
      this.setLoading('analyzeApproach', false);
    }
  }

  async analyzeCode() {
    const input = document.getElementById('dsa-code-input');
    if (!input) return;
    
    const code = input.value.trim();
    
    if (!code) {
      this.showToast('Please provide code to analyze', 'warning');
      return;
    }

    this.setLoading('analyzeCode', true);
    
    try {
      const response = await this.callAI({
        type: 'code_analysis',
        problem: this.problemData,
        code: code,
        history: this.conversationHistory
      });

      this.addChatMessage('Code analysis requested', 'user');
      this.addChatMessage(response.response, 'ai', response.complexity);
      
      if (response.complexity) {
        this.showComplexityInfo(response.complexity);
      }
      
      this.showResponseArea();
      
    } catch (error) {
      console.error('DSA Coach: Error analyzing code:', error);
      this.showToast('Error analyzing code. Please try again.', 'error');
    } finally {
      this.setLoading('analyzeCode', false);
    }
  }

  autoDetectCode() {
    const currentCode = this.getUserCode();
    const codeInput = document.getElementById('dsa-code-input');
    
    if (codeInput && currentCode && !currentCode.includes('No code detected')) {
      codeInput.value = currentCode;
      this.showToast('Code auto-detected!', 'success');
    } else {
      this.showToast('No code detected. Please paste manually.', 'warning');
    }
  }

  async sendChatMessage() {
    const input = document.getElementById('dsa-chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (!message) return;

    this.addChatMessage(message, 'user');
    input.value = '';
    input.style.height = 'auto';

    try {
      const response = await this.callAI({
        type: 'chat_followup',
        problem: this.problemData,
        message: message,
        history: this.conversationHistory
      });

      this.addChatMessage(response.response, 'ai', response.complexity);
      
    } catch (error) {
      console.error('DSA Coach: Error sending chat message:', error);
      this.addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
    }
  }

  async callAI(payload) {
    if (this.backendUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        
        const response = await fetch(`${this.backendUrl}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Backend error: ${response.status}`);
        }
      } catch (error) {
        console.warn('Backend request failed, using mock:', error.message);
        this.backendUrl = null;
      }
    }
    
    return this.getMockResponse(payload);
  }

  getMockResponse(payload) {
    return new Promise(resolve => {
      setTimeout(() => {
        try {
          if (payload.type === 'approach_analysis') {
            resolve(this.generateMockApproachAnalysis(payload));
          } else if (payload.type === 'code_analysis') {
            resolve(this.generateMockCodeAnalysis(payload));
          } else {
            resolve(this.generateMockChatResponse());
          }
        } catch (error) {
          resolve({
            response: 'Sorry, I encountered an error processing your request.',
            complexity: null
          });
        }
      }, 1000 + Math.random() * 1000);
    });
  }

  generateMockApproachAnalysis(payload) {
    const approach = payload.approach.toLowerCase();
    
    if (approach.includes('hash') || approach.includes('map')) {
      return {
        response: `Great thinking! Using a hash map is an excellent approach for this problem.

**Analysis:**
✅ **Correctness**: Hash map approach should work well
⚡ **Efficiency**: Much better than brute force O(n²)
💾 **Space trade-off**: Uses O(n) extra space for faster lookups

**Questions to consider:**
- What will you store as keys vs values?
- How will you handle duplicate elements?
- Can you solve it in a single pass through the data?

Would you like to discuss the implementation details?`,
        complexity: { time: 'O(n)', space: 'O(n)' }
      };
    }
    
    if (approach.includes('sort') || approach.includes('sorted')) {
      return {
        response: `Sorting is a solid approach! Let's analyze this strategy.

**Analysis:**
✅ **Correctness**: Sorting often simplifies many problems
⚡ **Time Complexity**: Usually O(n log n) due to sorting
💾 **Space**: Can be O(1) if sorting in-place

**Consider:**
- Does the problem allow modifying the input?
- Are there faster alternatives without sorting?
- What happens after sorting - how do you find the answer?`,
        complexity: { time: 'O(n log n)', space: 'O(1)' }
      };
    }

    return {
      response: `Interesting approach! Let's think through this step by step.

**Let's analyze:**
- What's the main operation you need to repeat?
- How many times will you perform this operation?
- What data structure makes this operation fastest?

Can you walk me through your specific algorithmic steps? I'd love to help you optimize it!`,
      complexity: { time: 'O(?)', space: 'O(?)' }
    };
  }

  generateMockCodeAnalysis(payload) {
    const code = payload.code.toLowerCase();
    
    if (code.includes('for') && code.match(/for.*for/s)) {
      return {
        response: `I see nested loops! Let's work on optimizing this.

**Code Review:**
🔍 **Structure**: Nested loops typically indicate O(n²) complexity
⚠️ **Performance**: Could be slow for large inputs (n > 10⁴)

**Optimization strategies:**
- Can you eliminate the inner loop with a hash map?
- Are you doing redundant calculations?
- Could sorting help reduce complexity?

**Next steps:**
What specific operation is the inner loop performing? There might be a more efficient way to achieve the same result.`,
        complexity: { time: 'O(n²)', space: 'O(1)' }
      };
    }
    
    if (code.includes('recursive') || code.includes('def') && code.includes('return') && code.includes('(')) {
      return {
        response: `Nice recursive solution! Let's check the efficiency.

**Recursion Analysis:**
🔄 **Structure**: Recursive approach detected
💭 **Consider**: Stack space and potential exponential time
⚡ **Optimization**: Might benefit from memoization

**Questions:**
- Are you solving overlapping subproblems?
- What's your base case?
- Could dynamic programming help?`,
        complexity: { time: 'O(?)', space: 'O(?)' }
      };
    }

    return {
      response: `Let me review your code structure.

**Initial Analysis:**
✅ **Logic flow**: Appears to follow a reasonable structure
🔍 **Edge cases**: Let's make sure all scenarios are handled
⚡ **Optimization**: Always room for improvement!

**Questions:**
- How does your solution handle edge cases (empty input, single element)?
- What's the bottleneck operation in your algorithm?
- Are there any unnecessary operations we can eliminate?

Feel free to walk me through your logic!`,
      complexity: { time: 'O(?)', space: 'O(?)' }
    };
  }

  generateMockChatResponse() {
    const responses = [
      "Great question! What edge cases are you considering?",
      "You're thinking in the right direction! How would you handle the worst-case scenario?",
      "Interesting point! What's the trade-off between time and space complexity here?",
      "Good observation! Can you think of a way to optimize this further?",
      "That's a smart approach! Have you considered what happens with duplicate values?",
      "Excellent thinking! How would this scale with very large inputs?"
    ];
    
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      complexity: null
    };
  }

  addChatMessage(message, sender, complexity = null) {
    const container = document.getElementById('dsa-chat-container');
    if (!container) return;
    
    const messageDiv = this.createElement('div', `dsa-chat-message ${sender}`);
    
    if (sender === 'ai' && complexity) {
      const messageText = this.createElement('div', 'message-text');
      messageText.textContent = message;
      messageDiv.appendChild(messageText);
      
      if (complexity.time && complexity.time !== 'O(?)') {
        const timeTag = this.createElement('span', 'complexity-tag', `Time: ${complexity.time}`);
        messageDiv.appendChild(timeTag);
      }
      
      if (complexity.space && complexity.space !== 'O(?)') {
        const spaceTag = this.createElement('span', 'complexity-tag', `Space: ${complexity.space}`);
        messageDiv.appendChild(spaceTag);
      }
    } else {
      messageDiv.textContent = this.sanitizeText(message);
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // Add to conversation history
    this.conversationHistory.push({ 
      message: this.sanitizeText(message), 
      sender, 
      complexity, 
      timestamp: Date.now() 
    });
    
    // Limit history size
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-40);
    }
  }

  showComplexityInfo(complexity) {
    if (!complexity || (complexity.time === 'O(?)' && complexity.space === 'O(?)')) return;
    
    const timeEl = document.getElementById('dsa-time-complexity');
    const spaceEl = document.getElementById('dsa-space-complexity');
    const complexityInfo = document.getElementById('dsa-complexity-info');
    
    if (timeEl) timeEl.textContent = complexity.time || 'O(?)';
    if (spaceEl) spaceEl.textContent = complexity.space || 'O(?)';
    if (complexityInfo) complexityInfo.style.display = 'flex';
  }

  showResponseArea() {
    const responseArea = document.getElementById('dsa-response-area');
    const chatInputSection = document.getElementById('dsa-chat-input-section');
    
    if (responseArea) responseArea.style.display = 'block';
    if (chatInputSection) chatInputSection.style.display = 'block';
  }

  setLoading(action, isLoading) {
    const button = document.querySelector(`button[onclick*="${action}"], .dsa-coach-btn-primary`);
    if (!button) return;
    
    const span = button.querySelector('span');
    const spinner = button.querySelector('.dsa-coach-spinner');
    
    if (span && spinner) {
      if (isLoading) {
        span.style.opacity = '0.5';
        spinner.classList.remove('hidden');
        button.disabled = true;
      } else {
        span.style.opacity = '1';
        spinner.classList.add('hidden');
        button.disabled = false;
      }
    }
  }

  showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.dsa-coach-toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = this.createElement('div', 'dsa-coach-toast', this.sanitizeText(message));
    
    const colors = {
      error: '#f44336',
      warning: '#ff9800',
      success: '#4caf50',
      info: '#2196f3'
    };
    
    toast.style.cssText = `
      position: fixed !important;
      top: 80px !important;
      right: 20px !important;
      background: ${colors[type] || colors.info} !important;
      color: white !important;
      padding: 12px 16px !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      z-index: 1000001 !important;
      animation: dsaCoachFadeIn 0.3s ease-out !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      max-width: 300px !important;
      word-wrap: break-word !important;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'dsaCoachFadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  }

  clearConversation() {
    this.conversationHistory = [];
    
    const chatContainer = document.getElementById('dsa-chat-container');
    const complexityInfo = document.getElementById('dsa-complexity-info');
    const responseArea = document.getElementById('dsa-response-area');
    const approachInput = document.getElementById('dsa-approach-input');
    const chatInput = document.getElementById('dsa-chat-input');
    
    if (chatContainer) chatContainer.innerHTML = '';
    if (complexityInfo) complexityInfo.style.display = 'none';
    if (responseArea) responseArea.style.display = 'none';
    if (approachInput) approachInput.value = '';
    if (chatInput) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
    }
    
    this.showToast('Conversation cleared', 'success');
  }

  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Basic HTML entity encoding to prevent XSS
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
  }

  addStyles() {
    // Remove existing styles
    const existingStyles = document.querySelectorAll('style[data-dsa-coach]');
    existingStyles.forEach(style => style.remove());
    
    const style = document.createElement('style');
    style.setAttribute('data-dsa-coach', 'true');
    style.textContent = `
      /* DSA Coach Extension Styles */
      
      /* Floating Button */
      .dsa-coach-floating-button {
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 25px !important;
        cursor: pointer !important;
        z-index: 999999 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;
        transition: all 0.3s ease !important;
        border: none !important;
        user-select: none !important;
      }
      
      .dsa-coach-floating-button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
      }

      /* Main Panel */
      .dsa-coach-panel {
        position: fixed !important;
        top: 120px !important;
        right: 20px !important;
        width: 400px !important;
        max-height: 70vh !important;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%) !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
        z-index: 999998 !important;
        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        animation: dsaCoachSlideIn 0.3s ease-out !important;
      }

      .dsa-coach-header {
        padding: 16px 20px !important;
        border-bottom: 1px solid rgba(255,255,255,0.1) !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        background: rgba(255,255,255,0.05) !important;
      }

      .dsa-coach-header h3 {
        margin: 0 !important;
        font-size: 16px !important;
        font-weight: 600 !important;
      }

      .dsa-coach-close {
        background: none !important;
        border: none !important;
        color: white !important;
        font-size: 24px !important;
        cursor: pointer !important;
        padding: 0 !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: background 0.3s ease !important;
      }

      .dsa-coach-close:hover {
        background: rgba(255,255,255,0.1) !important;
      }

      .dsa-coach-problem-info {
        padding: 12px 20px !important;
        background: rgba(255,255,255,0.1) !important;
        font-size: 14px !important;
        border-bottom: 1px solid rgba(255,255,255,0.1) !important;
      }

      .dsa-coach-mode-toggle {
        display: flex !important;
        padding: 16px 20px 0 !important;
        gap: 8px !important;
      }

      .dsa-coach-mode-btn {
        flex: 1 !important;
        padding: 8px 12px !important;
        background: rgba(255,255,255,0.1) !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        color: white !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        transition: all 0.3s ease !important;
      }

      .dsa-coach-mode-btn.active {
        background: rgba(255,255,255,0.2) !important;
        border-color: rgba(255,255,255,0.4) !important;
        transform: translateY(-1px) !important;
      }

      .dsa-coach-content {
        padding: 16px 20px !important;
        flex: 1 !important;
        overflow-y: auto !important;
      }

      .dsa-coach-mode-content {
        display: none !important;
      }

      .dsa-coach-mode-content.active {
        display: block !important;
      }

      .dsa-coach-input-section {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }

      .dsa-coach-input-section label {
        font-size: 14px !important;
        font-weight: 500 !important;
        opacity: 0.9 !important;
      }

      .dsa-coach-input-section textarea {
        background: rgba(255,255,255,0.1) !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        border-radius: 6px !important;
        padding: 10px !important;
        color: white !important;
        font-family: inherit !important;
        font-size: 14px !important;
        resize: vertical !important;
        min-height: 60px !important;
        transition: border-color 0.3s ease !important;
      }

      .dsa-coach-input-section textarea::placeholder {
        color: rgba(255,255,255,0.6) !important;
      }

      .dsa-coach-input-section textarea:focus {
        outline: none !important;
        border-color: #64b5f6 !important;
        box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.2) !important;
      }

      /* Buttons */
      .dsa-coach-btn-primary, .dsa-coach-btn-secondary {
        padding: 10px 16px !important;
        border: none !important;
        border-radius: 6px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        font-size: 14px !important;
        transition: all 0.3s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        position: relative !important;
      }

      .dsa-coach-btn-primary {
        background: linear-gradient(135deg, #64b5f6, #42a5f5) !important;
        color: white !important;
      }

      .dsa-coach-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(100, 181, 246, 0.3) !important;
      }

      .dsa-coach-btn-primary:disabled {
        opacity: 0.7 !important;
        cursor: not-allowed !important;
      }

      .dsa-coach-btn-secondary {
        background: rgba(255,255,255,0.1) !important;
        color: white !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
      }

      .dsa-coach-btn-secondary:hover {
        background: rgba(255,255,255,0.2) !important;
      }

      .dsa-coach-code-actions {
        display: flex !important;
        gap: 8px !important;
      }

      .dsa-coach-code-actions .dsa-coach-btn-secondary {
        flex: 1 !important;
      }

      .dsa-coach-code-actions .dsa-coach-btn-primary {
        flex: 2 !important;
      }

      /* Loading Spinner */
      .dsa-coach-spinner {
        width: 16px !important;
        height: 16px !important;
        border: 2px solid rgba(255,255,255,0.3) !important;
        border-top: 2px solid white !important;
        border-radius: 50% !important;
        animation: dsaCoachSpin 1s linear infinite !important;
      }

      .dsa-coach-spinner.hidden {
        display: none !important;
      }

      @keyframes dsaCoachSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Response Area */
      .dsa-coach-response-area {
        border-top: 1px solid rgba(255,255,255,0.1) !important;
        margin-top: 16px !important;
        padding-top: 16px !important;
      }

      .dsa-coach-complexity-info {
        display: flex !important;
        justify-content: space-around !important;
        background: rgba(255,255,255,0.1) !important;
        padding: 12px !important;
        border-radius: 6px !important;
        margin-bottom: 16px !important;
      }

      .complexity-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 4px !important;
      }

      .complexity-item span:first-child {
        font-size: 12px !important;
        opacity: 0.8 !important;
      }

      .complexity-item span:last-child {
        font-weight: 600 !important;
        color: #64b5f6 !important;
      }

      /* Chat Container */
      .dsa-coach-chat-container {
        max-height: 200px !important;
        overflow-y: auto !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        margin-bottom: 12px !important;
      }

      .dsa-chat-message {
        padding: 10px 12px !important;
        border-radius: 12px !important;
        max-width: 85% !important;
        word-wrap: break-word !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
      }

      .dsa-chat-message.user {
        background: rgba(100, 181, 246, 0.2) !important;
        align-self: flex-end !important;
        border-bottom-right-radius: 4px !important;
      }

      .dsa-chat-message.ai {
        background: rgba(255,255,255,0.1) !important;
        align-self: flex-start !important;
        border-bottom-left-radius: 4px !important;
      }

      .dsa-chat-message.ai .message-text {
        margin-bottom: 8px !important;
      }

      .complexity-tag {
        display: inline-block !important;
        background: rgba(100, 181, 246, 0.3) !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        font-size: 11px !important;
        margin-right: 4px !important;
      }

      /* Chat Input */
      .dsa-chat-input-container {
        display: flex !important;
        gap: 8px !important;
        align-items: flex-end !important;
      }

      .dsa-chat-input-container textarea {
        flex: 1 !important;
        min-height: 36px !important;
        max-height: 80px !important;
        border-radius: 18px !important;
        padding: 8px 12px !important;
        resize: none !important;
      }

      .dsa-coach-send-btn {
        background: linear-gradient(135deg, #64b5f6, #42a5f5) !important;
        border: none !important;
        border-radius: 50% !important;
        width: 36px !important;
        height: 36px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
      }

      .dsa-coach-send-btn:hover {
        transform: scale(1.05) !important;
      }

      /* Footer */
      .dsa-coach-footer {
        padding: 12px 20px !important;
        border-top: 1px solid rgba(255,255,255,0.1) !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        background: rgba(255,255,255,0.02) !important;
      }

      .dsa-coach-clear-btn {
        background: none !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        color: white !important;
        padding: 6px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
      }

      .dsa-coach-clear-btn:hover {
        background: rgba(255,255,255,0.1) !important;
      }

      .dsa-coach-powered {
        font-size: 11px !important;
        opacity: 0.6 !important;
      }

      /* Animations */
      @keyframes dsaCoachSlideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes dsaCoachSlideOut {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      @keyframes dsaCoachFadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes dsaCoachFadeOut {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(10px);
        }
      }

      /* Scrollbar Styling */
      .dsa-coach-chat-container::-webkit-scrollbar,
      .dsa-coach-content::-webkit-scrollbar {
        width: 4px !important;
      }

      .dsa-coach-chat-container::-webkit-scrollbar-track,
      .dsa-coach-content::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.1) !important;
        border-radius: 4px !important;
      }

      .dsa-coach-chat-container::-webkit-scrollbar-thumb,
      .dsa-coach-content::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.3) !important;
        border-radius: 4px !important;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .dsa-coach-panel {
          width: 350px !important;
          right: 10px !important;
          max-height: 60vh !important;
        }
        
        .dsa-coach-floating-button {
          right: 10px !important;
          padding: 10px 14px !important;
          font-size: 13px !important;
        }
      }

      @media (max-width: 480px) {
        .dsa-coach-panel {
          width: 300px !important;
          right: 10px !important;
        }
      }

      /* High Z-index for all components */
      .dsa-coach-floating-button,
      .dsa-coach-panel,
      .dsa-coach-toast {
        z-index: 2147483647 !important;
      }

      /* Ensure panel appears above everything */
      .dsa-coach-panel * {
        box-sizing: border-box !important;
      }
      
      /* Prevent interference with LeetCode styles */
      .dsa-coach-panel *:not(svg):not(path) {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
    `;

    document.head.appendChild(style);
  }

  // Cleanup method
  destroy() {
    if (this.codeObserver) {
      this.codeObserver.disconnect();
    }
    
    const button = document.getElementById('dsa-coach-button');
    const panel = document.getElementById('dsa-coach-panel');
    const styles = document.querySelectorAll('style[data-dsa-coach]');
    
    if (button) button.remove();
    if (panel) panel.remove();
    styles.forEach(style => style.remove());
    
    if (window.dsaCoachInstance === this) {
      delete window.dsaCoachInstance;
    }
  }
}

// Initialize the extractor when script loads
const dsaCoachExtractor = new LeetCodeExtractor();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (dsaCoachExtractor) {
    dsaCoachExtractor.destroy();
  }
});