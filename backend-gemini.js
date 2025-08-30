// backend-gemini.js - Free Google Gemini backend
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini AI with error handling
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  console.log('💡 Create a .env file with: GEMINI_API_KEY=your_key_here');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the free Gemini 1.5 Flash model
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  }
});

app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { type, problem, approach, code, message, history } = req.body;
    
    console.log(`🤖 Processing ${type} request for problem: ${problem?.title || 'Unknown'}`);
    
    let prompt = '';
    
    if (type === 'approach_analysis') {
      prompt = `You are an expert Data Structures & Algorithms coach helping a student learn problem-solving.

🎯 PROBLEM: "${problem.title}"

📝 STUDENT'S APPROACH: 
"${approach}"

🎓 YOUR COACHING TASK:
Analyze their approach and provide educational guidance WITHOUT giving away the solution.

Please provide:

📊 COMPLEXITY ANALYSIS:
- Time Complexity: [Provide O notation]
- Space Complexity: [Provide O notation]

✅ APPROACH EVALUATION:
- What's good about this approach?
- What potential issues do you see?
- Are there any edge cases they should consider?

💡 GUIDING QUESTIONS (Don't give solutions!):
Ask 2-3 thought-provoking questions that will help them:
- Think deeper about the problem
- Consider optimizations
- Spot potential issues

Keep it encouraging, educational, and focused on building their problem-solving skills!`;

    } else if (type === 'code_analysis') {
      // Truncate very long code
      const truncatedCode = code.length > 2000 ? code.substring(0, 2000) + '\n// ... (code truncated)' : code;
      
      prompt = `You are a DSA coding mentor reviewing a student's solution.

🎯 PROBLEM: "${problem.title}"

💻 STUDENT'S CODE:
\`\`\`
${truncatedCode}
\`\`\`

🎓 YOUR REVIEW TASK:
Provide constructive code review focused on learning, not just giving answers.

Please analyze:

📊 COMPLEXITY ANALYSIS:
- Time Complexity: [Provide O notation with brief explanation]
- Space Complexity: [Provide O notation with brief explanation]

🔍 CODE REVIEW:
- Correctness: Does the logic look sound?
- Edge cases: What scenarios might break this?
- Code quality: Any style or clarity improvements?

🚫 ISSUES SPOTTED:
- Potential bugs or logical errors
- Performance concerns
- Missing edge case handling

❓ COACHING QUESTIONS:
Ask specific questions about their code to help them:
- Identify issues themselves
- Think about optimizations
- Consider alternative approaches

Remember: Guide them to discover improvements, don't just tell them what to fix!`;

    } else if (type === 'chat_followup') {
      // Build conversation context
      const recentMessages = history.slice(-6).map(h => 
        `${h.sender === 'user' ? '🎓 Student' : '🤖 Coach'}: ${h.message.substring(0, 200)}${h.message.length > 200 ? '...' : ''}`
      ).join('\n\n');
      
      prompt = `You are continuing a DSA coaching conversation about: "${problem.title}"

📚 RECENT CONVERSATION:
${recentMessages}

🎓 STUDENT'S NEW MESSAGE:
"${message}"

🤖 YOUR RESPONSE:
Continue coaching them thoughtfully. Ask probing questions, provide hints, but avoid giving direct solutions. Help them think through the problem step by step.

Focus on:
- Understanding their current thinking
- Identifying gaps in their logic
- Guiding them toward insights
- Building their confidence

Keep it conversational and supportive!`;
    }

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text();
    
    console.log(`✅ Generated response (${aiResponse.length} chars)`);
    
    // Enhanced complexity extraction
    const extractComplexity = (text) => {
      // Multiple patterns to catch complexity mentions
      const timePatterns = [
        /time\s+complexity[:\s]*([O]\([^)]+\))/gi,
        /time[:\s]*([O]\([^)]+\))/gi,
        /([O]\([^)]+\))\s+time/gi
      ];
      
      const spacePatterns = [
        /space\s+complexity[:\s]*([O]\([^)]+\))/gi,
        /space[:\s]*([O]\([^)]+\))/gi,
        /([O]\([^)]+\))\s+space/gi
      ];
      
      let timeComplexity = 'O(?)';
      let spaceComplexity = 'O(?)';
      
      // Try each pattern
      for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match) {
          // Extract the O(...) part
          const oNotation = match[0].match(/O\([^)]+\)/i);
          if (oNotation) {
            timeComplexity = oNotation[0];
            break;
          }
        }
      }
      
      for (const pattern of spacePatterns) {
        const match = text.match(pattern);
        if (match) {
          const oNotation = match[0].match(/O\([^)]+\)/i);
          if (oNotation) {
            spaceComplexity = oNotation[0];
            break;
          }
        }
      }
      
      return { time: timeComplexity, space: spaceComplexity };
    };
    
    const complexity = extractComplexity(aiResponse);
    
    res.json({
      response: aiResponse,
      complexity: complexity,
      model: 'gemini-1.5-flash',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    
    // Check for specific API errors
    if (error.message?.includes('API key')) {
      res.status(401).json({
        error: 'Invalid API key',
        message: 'Please check your GEMINI_API_KEY in the .env file'
      });
    } else if (error.message?.includes('quota')) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Free tier: 15 requests/minute. Please wait a moment.',
        fallback: "I'm temporarily unavailable due to rate limits. Can you describe your approach step by step while we wait?"
      });
    } else {
      res.status(500).json({
        error: 'AI service error',
        message: error.message,
        fallback: "I'm having technical difficulties. Try describing your approach in more detail - what data structure are you considering?"
      });
    }
  }
});

// Test endpoint to verify API key
app.get('/api/test', async (req, res) => {
  try {
    const testResult = await model.generateContent('Say hello in one sentence.');
    const response = await testResult.response;
    
    res.json({
      status: 'success',
      message: 'Gemini API is working!',
      testResponse: response.text(),
      model: 'gemini-1.5-flash'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Gemini API test failed',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    model: 'gemini-1.5-flash', 
    free: true,
    timestamp: new Date().toISOString()
  });
});

// Rate limiting info
app.get('/api/limits', (req, res) => {
  res.json({
    model: 'gemini-1.5-flash',
    freetier: {
      requestsPerMinute: 15,
      requestsPerDay: 1500,
      cost: 'FREE'
    },
    tips: [
      'Be specific in your questions to get better responses',
      'Combine multiple questions in one request to save API calls',
      'The AI is designed to guide, not give direct solutions'
    ]
  });
});

app.listen(port, () => {
  console.log(`\n🚀 DSA Coach Backend Server Started!`);
  console.log(`📡 Running on: http://localhost:${port}`);
  console.log(`🤖 Model: Gemini 1.5 Flash (FREE tier)`);
  console.log(`📊 Rate Limits: 15 req/min, 1,500 req/day`);
  console.log(`\n🔗 Test endpoints:`);
  console.log(`   Health: http://localhost:${port}/api/health`);
  console.log(`   Test AI: http://localhost:${port}/api/test`);
  console.log(`   Limits: http://localhost:${port}/api/limits`);
  console.log(`\n💡 Ready to help students learn DSA! 🎓\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 DSA Coach Backend shutting down...');
  process.exit(0);
});

module.exports = app;