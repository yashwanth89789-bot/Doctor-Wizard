/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Bot, Loader2, ClipboardList, AlertCircle, History, ChevronLeft, Stethoscope } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let ai: GoogleGenAI;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.error("VITE_GEMINI_API_KEY is not set. Please ensure it is configured in your deployment environment (e.g., Vercel).");
  // Fallback for development/error handling
  ai = new GoogleGenAI({ apiKey: 'MISSING_API_KEY' });
}
const model = "gemini-3-flash-preview";

type DiagnosticResult = {
  explanation: string;
  biologicalInsights: string;
  geneticAnalysis: string;
  advice: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
};

type HistoryItem = {
  id: string;
  symptoms: string;
  duration: string;
  severity: string;
  result: DiagnosticResult;
  timestamp: number;
};

export default function App() {
  const [step, setStep] = useState<'landing' | 'input' | 'analyzing' | 'result' | 'history'>('landing');
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState(5);
  const [dnaData, setDnaData] = useState('');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const wellnessTips = [
    "Stay hydrated: Aim for 8 glasses of water a day.",
    "Get enough sleep: 7-9 hours of quality sleep is essential for health.",
    "Eat a balanced diet: Incorporate plenty of fruits, vegetables, and whole grains.",
    "Stay active: Aim for at least 30 minutes of moderate exercise most days.",
    "Manage stress: Practice mindfulness, meditation, or deep breathing exercises."
  ];

  useEffect(() => {
    const savedHistory = localStorage.getItem('ai-doctor-history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (item: HistoryItem) => {
    const newHistory = [item, ...history];
    setHistory(newHistory);
    localStorage.setItem('ai-doctor-history', JSON.stringify(newHistory));
  };

  const handleSubmit = async () => {
    if (!symptoms.trim() || !duration.trim()) return;

    setStep('analyzing');

    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Analyze the following symptoms and provide preliminary health guidance.
        Symptoms: ${symptoms}
        DNA/Genetic Data: ${dnaData || 'Not provided'}
        Duration: ${duration}
        Self-assessed Severity: ${severity}/10`,
        config: {
          systemInstruction: "You are an AI Doctor. Analyze symptoms and provide preliminary health guidance, incorporating provided DNA/genetic marker insight if available. Return the result as a JSON object with 'explanation' (string), 'biologicalInsights' (string, general biological context), 'geneticAnalysis' (string, specific interpretation of the provided DNA markers, or 'None' if not provided), 'advice' (string), and 'riskLevel' ('Low', 'Moderate', 'High'). Prioritize safety, avoid definitive diagnoses, and never prescribe medications.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING, description: "Possible explanations for the symptoms." },
              biologicalInsights: { type: Type.STRING, description: "General biological mechanisms related to the symptoms." },
              geneticAnalysis: { type: Type.STRING, description: "Specific interpretation of the provided DNA markers, or 'None' if not provided." },
              advice: { type: Type.STRING, description: "General guidance, precautions, or lifestyle advice." },
              riskLevel: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'], description: "Assessed risk level." },
            },
            required: ['explanation', 'biologicalInsights', 'geneticAnalysis', 'advice', 'riskLevel'],
          },
        }
      });
      
      const data = JSON.parse(response.text || '{}') as DiagnosticResult;
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        symptoms,
        duration,
        severity: severity.toString(),
        result: data,
        timestamp: Date.now(),
      };
      saveToHistory(newItem);
      setResult(data);
      setChatMessages([]);
      setStep('result');
    } catch (error) {
      console.error(error);
      setStep('input');
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Context: 
Symptoms: ${symptoms}
Analysis: ${result?.explanation}
Advice: ${result?.advice}

Follow-up User Question: ${userMessage}
Please provide a helpful, safe, and professional follow-up answer in a conversational tone.`,
      });
      setChatMessages(prev => [...prev, { role: 'assistant', text: response.text || 'Sorry, I could not process your question.' }]);
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error answering your question.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8 font-sans text-stone-900">
      <header className="max-w-3xl mx-auto mb-10 flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-stone-900 rounded-2xl text-white">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tighter">Doctor Wizard</h1>
            <p className="text-stone-500">Preliminary symptom analysis</p>
          </div>
        </div>
        <button onClick={() => setStep('history')} className="p-3 bg-white rounded-xl shadow-sm hover:bg-stone-50 transition-colors">
          <History className="w-6 h-6 text-stone-600" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8">
        {step === 'landing' && (
          <div className="text-center space-y-6">
            <div className="p-6 bg-stone-100 rounded-full inline-block">
              <Stethoscope className="w-16 h-16 text-stone-900" />
            </div>
            <h2 className="text-4xl font-semibold tracking-tighter">Welcome to Doctor Wizard</h2>
            <p className="text-stone-600 text-lg leading-relaxed max-w-lg mx-auto">Get preliminary health insights and guidance based on your symptoms. Please remember this is for informational purposes only and not a substitute for professional medical advice.</p>
            <button onClick={() => setStep('input')} className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/20 text-lg">Start Symptom Analysis</button>
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-10">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">Diagnostic Wizard</h2>
              <div className="space-y-4">
                <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Describe your symptoms in detail..." className="w-full p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all" rows={4} />
                <textarea value={dnaData} onChange={(e) => setDnaData(e.target.value)} placeholder="Optional: Enter or paste your DNA/Genetic marker data here..." className="w-full p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all" rows={3} />
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (e.g., 2 days)" className="w-full p-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-stone-900 transition-all" />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-700">Severity (1-10): {severity}</label>
                  <input type="range" min="1" max="10" value={severity} onChange={(e) => setSeverity(parseInt(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900" />
                </div>
              </div>
              <button onClick={handleSubmit} className="w-full p-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/20">Analyze Symptoms</button>
            </div>
            
            <div className="border-t border-stone-200 pt-8">
              <h3 className="text-xl font-semibold tracking-tight mb-4">Proactive Wellness Tips</h3>
              <ul className="space-y-3">
                {wellnessTips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3 text-stone-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-2 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-12 h-12 text-stone-900 animate-spin" />
            <p className="text-stone-500 font-medium">Analyzing your symptoms...</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-stone-900" />
              <h2 className="text-2xl font-semibold tracking-tight">Diagnostic Report</h2>
            </div>
            <div className={`p-6 rounded-2xl border ${
              result.riskLevel === 'High' ? 'bg-red-50 border-red-200 text-red-900' : 
              result.riskLevel === 'Moderate' ? 'bg-amber-50 border-amber-200 text-amber-900' : 
              'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center gap-2 font-semibold text-lg">
                <AlertCircle className="w-6 h-6" />
                Risk Level: {result.riskLevel}
              </div>
              <p className="mt-3 leading-relaxed">{result.explanation}</p>
            </div>
            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
              <h3 className="font-semibold text-lg text-stone-900">Biological Insights</h3>
              <p className="mt-3 text-stone-700 leading-relaxed">{result.biologicalInsights}</p>
            </div>
            {result.geneticAnalysis !== 'None' && (
              <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-200">
                <h3 className="font-semibold text-lg text-indigo-900">Genetic Analysis Insight</h3>
                <p className="mt-3 text-indigo-800 leading-relaxed">{result.geneticAnalysis}</p>
              </div>
            )}
            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
              <h3 className="font-semibold text-lg text-stone-900">Recommended Advice</h3>
              <p className="mt-3 text-stone-700 leading-relaxed">{result.advice}</p>
            </div>
            <button onClick={() => setStep('input')} className="w-full p-4 border border-stone-900 rounded-2xl font-medium hover:bg-stone-100 transition-colors">Start New Analysis</button>

            {/* Follow-up Chat */}
            <div className="border-t border-stone-200 pt-8 mt-8 space-y-4">
              <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
                <Bot className="w-5 h-5" aria-hidden="true" /> Follow-up Questions
              </h3>
              <div className="space-y-4" role="log" aria-live="polite" aria-atomic="true" aria-label="Chat messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-stone-900 text-white ml-auto max-w-[80%]' : 'bg-stone-100 text-stone-800 mr-auto max-w-[80%]'}`}>
                    <span className="sr-only">{msg.role === 'user' ? 'You:' : 'Doctor Wizard:'}</span>
                    {msg.text}
                  </div>
                ))}
                {isChatLoading && (
                  <div 
                    className="p-4 rounded-2xl bg-stone-100 text-stone-500 mr-auto"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    Typing...
                  </div>
                )}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleChat(); }}>
                <label htmlFor="chat-input" className="sr-only">Ask a follow-up question</label>
                <input 
                  id="chat-input"
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Ask a follow-up question..." 
                  className="flex-grow p-4 rounded-2xl border border-stone-200" 
                  aria-required="true"
                />
                <button 
                  type="submit" 
                  disabled={isChatLoading} 
                  className="p-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 disabled:opacity-50"
                  aria-label="Send follow-up question"
                >
                  Ask
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'history' && (
          <div className="space-y-6">
            <button onClick={() => setStep('input')} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-medium transition-colors">
              <ChevronLeft className="w-5 h-5" /> Back to Wizard
            </button>
            <h2 className="text-2xl font-semibold tracking-tight">Consultation History</h2>
            
            {history.length > 0 && (
              <div className="p-6 bg-white border border-stone-200 rounded-3xl space-y-4">
                <h3 className="font-semibold text-lg text-stone-900">Severity Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...history].reverse().map(h => ({ date: new Date(h.timestamp).toLocaleDateString(), severity: parseInt(h.severity) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="date" stroke="#78716c" fontSize={12} />
                      <YAxis domain={[0, 10]} stroke="#78716c" fontSize={12} />
                      <Tooltip />
                      <Line type="monotone" dataKey="severity" stroke="#1c1917" strokeWidth={3} dot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {history.length === 0 ? (
              <p className="text-stone-500">No past consultations found.</p>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="p-5 rounded-2xl border border-stone-200 cursor-pointer hover:border-stone-400 hover:bg-stone-50 transition-all" onClick={() => { setResult(item.result); setStep('result'); }}>
                    <p className="font-medium text-stone-900">{item.symptoms.substring(0, 60)}...</p>
                    <p className="text-sm text-stone-500 mt-1">{new Date(item.timestamp).toLocaleDateString()} • Severity: {isNaN(parseInt(item.severity)) ? 'N/A' : item.severity}/10</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
