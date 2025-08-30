// popup.js - Main logic for DSA Coach AI extension
class DSACoachPopup {
    constructor() {
        this.currentMode = 'discussion';
        this.problemData = null;
        this.conversationHistory = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProblemData();
        this.loadConversationHistory();
    }

    setupEventListeners() {
        // Mode toggle
        document.getElementById('discussionMode').addEventListener('click', () => this.switchMode('discussion'));
        document.getElementById('codeMode').addEventListener('click', () => this.switchMode('code'));

        // Discussion mode
        document.getElementById('analyzeApproach').addEventListener('click', () => this.analyzeApproach());

        // Code mode
        document.getElementById('autoDetectCode').addEventListener('click', () => this.autoDetectCode());
        document.getElementById('analyzeCode').addEventListener('click', () => this.analyzeCode());

        // Chat functionality
        document.getElementById('sendChatMessage').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Clear chat
        document.getElementById('clearChat').addEventListener('click', () => this.clearConversation());

        // Auto-resize chat input
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
        });
    }

    async loadProblemData() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('leetcode.com/problems/')) {
                document.getElementById('problemTitle').textContent = 'Please navigate to a LeetCode problem';
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProblemData' });
            
            if (response && response.problemData) {
                this.problemData = response.problemData;
                document.getElementById('problemTitle').textContent = this.problemData.title;
                
                // Pre-fill code input if code is detected
                if (response.userCode && response.userCode.trim() && !response.userCode.includes('No code detected')) {
                    document.getElementById('codeInput').value = response.userCode;
                }
            }
        } catch (error) {
            console.error('Error loading problem data:', error);
            document.getElementById('problemTitle').textContent = 'Error loading problem data';
        }
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Mode').classList.add('active');
        
        // Update toggle switch position
        const toggleSwitch = document.getElementById('toggleSwitch');
        if (mode === 'code') {
            toggleSwitch.classList.add('code-mode');
        } else {
            toggleSwitch.classList.remove('code-mode');
        }
        
        // Show/hide content sections
        document.querySelectorAll('.mode-content').forEach(content => content.classList.remove('active'));
        document.getElementById(mode + 'Content').classList.add('active');
    }

    async autoDetectCode() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentCode' });
            
            if (response && response.userCode) {
                document.getElementById('codeInput').value = response.userCode;
                this.showMessage('Code auto-detected from LeetCode editor', 'success');
            } else {
                this.showMessage('No code detected. Please paste your code manually.', 'warning');
            }
        } catch (error) {
            console.error('Error auto-detecting code:', error);
            this.showMessage('Error detecting code. Please paste manually.', 'error');
        }
    }

    async analyzeApproach() {
        const approachText = document.getElementById('approachInput').value.trim();
        
        if (!approachText) {
            this.showMessage('Please describe your approach first', 'warning');
            return;
        }

        if (!this.problemData) {
            this.showMessage('Problem data not loaded. Please refresh the page.', 'error');
            return;
        }

        this.setLoading('analyzeApproach', true);
        
        try {
            const analysis = await this.callAI({
                type: 'approach_analysis',
                problem: this.problemData,
                approach: approachText,
                history: this.conversationHistory
            });

            this.addChatMessage(approachText, 'user');
            this.addChatMessage(analysis.response, 'ai', analysis.complexity);
            this.showComplexityInfo(analysis.complexity);
            this.showChatInput();
            
            // Clear the approach input
            document.getElementById('approachInput').value = '';
            
        } catch (error) {
            console.error('Error analyzing approach:', error);
            this.showMessage('Error analyzing approach. Please try again.', 'error');
        } finally {
            this.setLoading('analyzeApproach', false);
        }
    }

    async analyzeCode() {
        const codeText = document.getElementById('codeInput').value.trim();
        
        if (!codeText) {
            this.showMessage('Please provide code to analyze', 'warning');
            return;
        }

        if (!this.problemData) {
            this.showMessage('Problem data not loaded. Please refresh the page.', 'error');
            return;
        }

        this.setLoading('analyzeCode', true);
        
        try {
            const analysis = await this.callAI({
                type: 'code_analysis',
                problem: this.problemData,
                code: codeText,
                history: this.conversationHistory
            });

            this.addChatMessage('Code analysis requested', 'user');
            this.addChatMessage(analysis.response, 'ai', analysis.complexity);
            this.showComplexityInfo(analysis.complexity);
            this.showChatInput();
            
        } catch (error) {
            console.error('Error analyzing code:', error);
            this.showMessage('Error analyzing code. Please try again.', 'error');
        } finally {
            this.setLoading('analyzeCode', false);
        }
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        if (!this.problemData) {
            this.showMessage('Problem data not loaded. Please refresh the page.', 'error');
            return;
        }

        // Add user message
        this.addChatMessage(message, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto';

        try {
            const response = await this.callAI({
                type: 'chat_followup',
                problem: this.problemData,
                message: message,
                history: this.conversationHistory
            });

            this.addChatMessage(response.response, 'ai', response.complexity);
            
            if (response.complexity) {
                this.showComplexityInfo(response.complexity);
            }
            
        } catch (error) {
            console.error('Error sending chat message:', error);
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }

    async callAI(payload) {
        // Simulate AI API call - In a real implementation, this would call your backend
        // For demo purposes, we'll return mock responses
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
        
        if (payload.type === 'approach_analysis') {
            return this.generateMockApproachAnalysis(payload);
        } else if (payload.type === 'code_analysis') {
            return this.generateMockCodeAnalysis(payload);
        } else {
            return this.generateMockChatResponse(payload);
        }
    }

    generateMockApproachAnalysis(payload) {
        const approach = payload.approach.toLowerCase();
        let response = '';
        let timeComplexity = 'O(?)';
        let spaceComplexity = 'O(?)';

        if (approach.includes('hash') || approach.includes('map') || approach.includes('dictionary')) {
            response = `Great thinking! Using a hash map is indeed a solid approach for this problem.

**Analysis of your approach:**
- ✅ **Correctness**: Your hash map approach should work correctly
- ⚡ **Efficiency**: This gives us much better time complexity than brute force
- 💾 **Space trade-off**: We use extra space for the hash map

**Potential considerations:**
- What happens with duplicate values?
- Have you thought about the one-pass vs two-pass implementation?

**Question for you**: Can you walk me through what exactly you'd store as keys and values in your hash map?`;
            
            timeComplexity = 'O(n)';
            spaceComplexity = 'O(n)';
            
        } else if (approach.includes('sort') || approach.includes('sorted')) {
            response = `Interesting approach with sorting! Let's think through this together.

**Analysis:**
- ✅ **Correctness**: Sorting can work for some problems, but consider the requirements
- ⏰ **Time impact**: Sorting typically adds O(n log n) complexity
- 💾 **Space**: Depends on whether you sort in-place

**Things to consider:**
- Does sorting change the original indices? (This matters for some problems!)
- Could there be a more efficient approach?

**Question**: What specific advantage does sorting give you for this particular problem?`;
            
            timeComplexity = 'O(n log n)';
            spaceComplexity = 'O(1)';
            
        } else if (approach.includes('two pointer') || approach.includes('pointer')) {
            response = `Excellent! Two pointers can be very efficient when applicable.

**Your approach analysis:**
- ✅ **Efficiency**: Two pointers often give us O(n) time complexity
- 💾 **Space**: Usually O(1) space complexity - great!
- 🎯 **Elegance**: Clean and intuitive when it works

**Key considerations:**
- Does this problem have the right structure for two pointers?
- Do you need the array to be sorted first?

**Challenge question**: Can you describe how you'd move the pointers and what condition would make you move each one?`;
            
            timeComplexity = 'O(n)';
            spaceComplexity = 'O(1)';
            
        } else {
            response = `Thanks for sharing your approach! Let me help you think through it.

**Let's analyze together:**
- First, let's make sure we understand the problem correctly
- Then we can evaluate the efficiency of your approach
- Finally, we'll see if there are ways to optimize it

**Questions to guide you:**
1. What's the main operation you need to perform repeatedly?
2. How many times might you need to do this operation?
3. What data structure would make this operation fastest?

Can you elaborate on the specific steps in your approach?`;
            
            timeComplexity = 'O(?)';
            spaceComplexity = 'O(?)';
        }

        return {
            response,
            complexity: {
                time: timeComplexity,
                space: spaceComplexity
            }
        };
    }

    generateMockCodeAnalysis(payload) {
        const code = payload.code.toLowerCase();
        let response = '';
        let timeComplexity = 'O(?)';
        let spaceComplexity = 'O(?)';

        if (code.includes('for') && code.includes('for')) {
            response = `I see you're using nested loops! Let's analyze this together.

**Code Review:**
- 🔍 **Structure**: Nested loops detected - this often means O(n²) complexity
- ⚠️ **Efficiency concern**: This might be slower than needed for large inputs

**Questions to help you optimize:**
1. Are you checking every pair of elements?
2. Is there information from previous iterations you could reuse?
3. Could a data structure help you avoid the inner loop?

**Syntactic notes:** Your code structure looks good! Let's focus on the algorithmic efficiency.

**Next step**: Can you think of a way to eliminate one of the loops?`;
            
            timeComplexity = 'O(n²)';
            spaceComplexity = 'O(1)';
            
        } else if (code.includes('{}') || code.includes('dict') || code.includes('hashmap')) {
            response = `Nice! I can see you're using a hash-based approach.

**Code Analysis:**
- ✅ **Good choice**: Hash maps are excellent for lookup-heavy problems
- ⚡ **Efficiency**: This should give you O(n) time complexity
- 💾 **Space trade-off**: Using O(n) space for better time complexity

**Code review points:**
- Make sure to handle the case where the complement doesn't exist
- Consider edge cases like duplicate values
- Your overall structure looks promising!

**Guiding question**: How are you handling the case where you find the target complement? Are you making sure not to use the same element twice?`;
            
            timeComplexity = 'O(n)';
            spaceComplexity = 'O(n)';
            
        } else {
            response = `Thanks for sharing your code! Let me help you review it.

**Initial observations:**
- I can see the basic structure of your solution
- Let's work together to identify any issues and optimizations

**Let's check a few things:**
1. **Logic flow**: Does your code handle all the required cases?
2. **Edge cases**: What happens with empty inputs or single elements?
3. **Efficiency**: Can we make this faster or use less memory?

**Debugging together**: Can you walk me through what your code does step by step? This will help us spot any issues!`;
            
            timeComplexity = 'O(?)';
            spaceComplexity = 'O(?)';
        }

        return {
            response,
            complexity: {
                time: timeComplexity,
                space: spaceComplexity
            }
        };
    }

    generateMockChatResponse(payload) {
        const message = payload.message.toLowerCase();
        const responses = [
            "That's a great question! Let's think about it step by step. What do you think would happen if...?",
            "You're on the right track! Can you tell me more about how you'd handle the edge case where...?",
            "Interesting point! Have you considered what the time complexity would be if you tried...?",
            "Good thinking! What if we tried a different approach? What data structure might help us here?",
            "That makes sense! Now, what do you think would be the trade-offs between time and space complexity?",
            "Excellent observation! How would you modify your approach to handle larger input sizes?",
            "You're getting closer! Can you think of a way to optimize the part where you...?",
            "Great progress! What would be your next step to implement this idea?"
        ];

        return {
            response: responses[Math.floor(Math.random() * responses.length)],
            complexity: null
        };
    }

    addChatMessage(message, sender, complexity = null) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        if (sender === 'ai' && complexity) {
            messageDiv.innerHTML = `
                <div class="message-content">${message}</div>
                ${complexity.time !== 'O(?)' ? `<span class="complexity-badge">Time: ${complexity.time}</span>` : ''}
                ${complexity.space !== 'O(?)' ? `<span class="complexity-badge">Space: ${complexity.space}</span>` : ''}
            `;
        } else {
            messageDiv.textContent = message;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Update conversation history
        this.conversationHistory.push({
            message,
            sender,
            complexity,
            timestamp: Date.now()
        });
        
        this.saveConversationHistory();
    }

    showComplexityInfo(complexity) {
        if (!complexity || (complexity.time === 'O(?)' && complexity.space === 'O(?)')) {
            return;
        }
        
        const complexityInfo = document.getElementById('complexityInfo');
        const timeComplexity = document.getElementById('timeComplexity');
        const spaceComplexity = document.getElementById('spaceComplexity');
        
        timeComplexity.textContent = complexity.time || 'O(?)';
        spaceComplexity.textContent = complexity.space || 'O(?)';
        
        complexityInfo.classList.remove('hidden');
    }

    showChatInput() {
        document.getElementById('chatInputSection').classList.remove('hidden');
        document.getElementById('aiResponseSection').classList.remove('hidden');
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.loading-spinner');
        
        if (isLoading) {
            btnText.style.opacity = '0';
            spinner.classList.remove('hidden');
            button.disabled = true;
        } else {
            btnText.style.opacity = '1';
            spinner.classList.add('hidden');
            button.disabled = false;
        }
    }

    showMessage(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    clearConversation() {
        this.conversationHistory = [];
        document.getElementById('chatContainer').innerHTML = '';
        document.getElementById('complexityInfo').classList.add('hidden');
        document.getElementById('chatInputSection').classList.add('hidden');
        document.getElementById('aiResponseSection').classList.add('hidden');
        
        // Clear inputs
        document.getElementById('approachInput').value = '';
        document.getElementById('chatInput').value = '';
        
        this.saveConversationHistory();
        this.showMessage('Conversation cleared', 'info');
    }

    saveConversationHistory() {
        try {
            chrome.storage.local.set({
                conversationHistory: this.conversationHistory,
                problemUrl: this.problemData?.url
            });
        } catch (error) {
            console.error('Error saving conversation history:', error);
        }
    }

    async loadConversationHistory() {
        try {
            const result = await chrome.storage.local.get(['conversationHistory', 'problemUrl']);
            
            // Only load history if we're on the same problem
            if (result.problemUrl === this.problemData?.url && result.conversationHistory) {
                this.conversationHistory = result.conversationHistory;
                
                // Restore chat messages
                result.conversationHistory.forEach(item => {
                    if (item.sender && item.message) {
                        this.addChatMessage(item.message, item.sender, item.complexity);
                    }
                });
                
                if (this.conversationHistory.length > 0) {
                    this.showChatInput();
                    
                    // Show last complexity info if available
                    const lastComplexity = [...this.conversationHistory].reverse()
                        .find(item => item.complexity)?.complexity;
                    if (lastComplexity) {
                        this.showComplexityInfo(lastComplexity);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading conversation history:', error);
        }
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DSACoachPopup();
});