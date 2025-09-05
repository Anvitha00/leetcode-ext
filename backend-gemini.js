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

app.get('/', (req, res) => {
  res.json({
    service: 'DSA Coach AI Backend',
    version: '1.0.0',
    status: 'running',
    model: 'gemini-1.5-flash',
    endpoints: {
      health: '/api/health',
      analyze: '/api/analyze (POST)',
      test: '/api/test',
      limits: '/api/limits'
    },
    usage: {
      extension: 'Use with DSA Coach Chrome extension',
      direct: 'POST to /api/analyze with problem data'
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { type, problem, approach, code, message, history } = req.body;
    
    console.log(`🤖 Processing ${type} request for problem: ${problem?.title || 'Unknown'}`);
    
    let prompt = '';
    
    if (type === 'approach_analysis') {
      const description = problem?.description || '';
      prompt = `You are an expert DSA coach. Analyze the user's approach for the following problem.

Problem Title:
${problem.title}

Problem Description (truncated as provided by the client):
${description}

User Approach:
${approach}

Output a structured, concise response WITHOUT any markdown bullets or asterisks. Use clear section headings and short paragraphs. Include:
1) Logic Flow: Summarize the exact approach the user is following and whether the reasoning is correct.
2) Complexity: Time and Space complexities in O-notation with a brief rationale.
3) Edge Cases: List relevant edge cases for this specific problem and whether the approach passes each; if it fails, state precisely which scenarios fail and why.
4) Optimization: Concrete, problem-relevant improvements to make the code more efficient (algorithmic ideas, data structures, pruning, or memory reductions). Give actionable next steps.
5) Next Questions: 2-3 guiding questions tailored to this problem that nudge the user to think deeper without giving a full solution.

Be specific to the problem and the approach, avoid generic advice, and do not reveal the full solution.`;

    } else if (type === 'code_analysis') {
      const truncatedCode = code.length > 2000 ? code.substring(0, 2000) + '\n// ... (code truncated)' : code;
      const description = problem?.description || '';
      
      prompt = `You are a senior DSA mentor. Review the user's code for the given problem and produce a well-structured response with no markdown bullets or asterisks.

Problem Title:
${problem.title}

Problem Description (truncated as provided by the client):
${description}

User Code (may be truncated):
${truncatedCode}

Your response must be concise and structured with these sections:
1) Logic Flow: Describe the current logical approach the code implements. Assess correctness for this problem.
2) Complexity: Provide Time and Space complexities in O-notation with a one-sentence justification.
3) Edge Cases: Enumerate edge cases relevant to this problem and state whether the code currently handles each. If it fails, explain exactly how and why.
4) Optimization: Provide concrete, problem-specific ways to make the code more efficient or clearer. Include specific data structures or algorithmic changes and a brief rationale.
5) Next Questions: Ask 2-3 targeted questions to guide the user toward improvements without giving a complete solution.

Tailor everything to the provided problem and code. Avoid generic advice and do not use bullet characters.`;

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