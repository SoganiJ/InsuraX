import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" 
    });

    // Create a system prompt for insurance assistance
    const systemPrompt = `You are an AI insurance assistant for InsuraX, a comprehensive insurance platform. Your role is to help users with:

1. **Policy Questions**: Explain different types of insurance policies, coverage options, terms and conditions
2. **Claim Guidance**: Help users understand the claim process, required documents, and timelines
3. **Premium & Payments**: Assist with payment questions, due dates, and payment methods
4. **General Insurance**: Provide information about insurance concepts, benefits, and best practices
5. **Technical Support**: Help with account-related issues and platform navigation

Guidelines:
- Be helpful, professional, and empathetic
- Provide accurate, up-to-date information
- If you don't know something specific about InsuraX, say so and suggest contacting support
- Keep responses concise but comprehensive
- Use a friendly, conversational tone
- Focus on practical, actionable advice

Current user question: ${message}`;

    // Generate content
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      message: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to get AI response. Please try again later.' 
    }, { status: 500 });
  }
}



