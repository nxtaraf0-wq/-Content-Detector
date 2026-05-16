import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Image as ImageIcon, Mic, ShieldCheck, ShieldAlert, UploadCloud, Loader2, History, X, Trash2 } from 'lucide-react';

type Tab = 'text' | 'image' | 'audio';

interface DetectionResult {
  isAiGenerated: boolean;
  confidence: number;
  reasoning: string;
}

interface AnalysisRecord {
  id: number;
  date: string;
  type: Tab;
  snippet: string;
  result: DetectionResult;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<{ step: string; progress: number } | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AnalysisRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ai-detector-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    localStorage.setItem('ai-detector-history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (!loading) {
      setLoadingSteps(null);
      return;
    }

    let currentProgress = 0;
    const stages = activeTab === 'text' 
      ? ["Analyzing text patterns...", "Evaluating perplexity...", "Checking AI signatures..."]
      : activeTab === 'image'
        ? ["Uploading image...", "Scanning for artifacts...", "Analyzing pixel consistency...", "Evaluating AI signatures..."]
        : ["Uploading audio...", "Analyzing frequencies...", "Checking acoustic models...", "Evaluating AI signatures..."];
    
    let stageIndex = 0;
    setLoadingSteps({ step: stages[0], progress: 5 });

    const interval = setInterval(() => {
      currentProgress += Math.random() * 4 + 1;
      if (currentProgress > 95) currentProgress = 95;
      
      const newStageIndex = Math.min(
        Math.floor((currentProgress / 100) * stages.length),
        stages.length - 1
      );
      
      setLoadingSteps({ step: stages[newStageIndex], progress: currentProgress });
    }, 500);

    return () => clearInterval(interval);
  }, [loading, activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);

      if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Basic validation
      if (activeTab === 'image' && !file.type.startsWith('image/')) {
        setError('Please drop an image file.');
        return;
      }
      if (activeTab === 'audio' && !file.type.startsWith('audio/')) {
        setError('Please drop an audio file.');
        return;
      }

      setSelectedFile(file);
      setError(null);

      if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleDetect = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      let payload = {};

      if (activeTab === 'text') {
        if (!textInput.trim()) {
          throw new Error('Please enter some text to analyze.');
        }
        payload = { type: 'text', data: textInput };
      } else {
        if (!selectedFile) {
          throw new Error('Please select a file to analyze.');
        }
        const base64Data = await fileToBase64(selectedFile);
        payload = {
          type: activeTab,
          data: base64Data,
          mimeType: selectedFile.type,
        };
      }

      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to analyze content.';
        try {
          const textError = await response.text();
          try {
            const errData = JSON.parse(textError);
            errorMessage = errData.error || errorMessage;
          } catch {
            errorMessage = textError.substring(0, 100) || errorMessage;
          }
        } catch (e) {
          // Fallback if reading text fails
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      let data: DetectionResult;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Invalid response from server: " + responseText.substring(0, 50));
      }

      setResult(data);

      const newRecord: AnalysisRecord = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: activeTab,
        snippet: activeTab === 'text' 
          ? textInput.substring(0, 60) + (textInput.length > 60 ? '...' : '') 
          : selectedFile?.name || 'File',
        result: data,
      };
      setHistory((prev) => [newRecord, ...prev]);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 font-sans p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="relative text-center space-y-3 pt-8 pb-4">
          <div className="absolute right-0 top-8">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700"
            >
              <History className="w-4 h-4" /> History
            </button>
          </div>
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl tracking-tight font-semibold">AI Content Detector</h1>
          <p className="text-gray-500 text-lg">Verify the authenticity of text, images, and audio with deep analysis.</p>
        </header>

        {/* Main Card */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={() => handleTabChange('text')}
              className={`flex-1 py-5 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'text' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <FileText className="w-4 h-4" /> Text
            </button>
            <button
              onClick={() => handleTabChange('image')}
              className={`flex-1 py-5 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'image' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Image
            </button>
            <button
              onClick={() => handleTabChange('audio')}
              className={`flex-1 py-5 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'audio' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <Mic className="w-4 h-4" /> Audio
            </button>
          </div>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Text Input */}
                {activeTab === 'text' && (
                  <div className="space-y-2">
                    <label htmlFor="text-input" className="block text-sm font-medium text-gray-700">Paste your text</label>
                    <textarea
                      id="text-input"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Start typing or paste text here to analyze..."
                      className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-base"
                    />
                  </div>
                )}

                {/* Image/Audio Input */}
                {(activeTab === 'image' || activeTab === 'audio') && (
                  <div 
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center transition-colors hover:border-gray-300 hover:bg-gray-50 bg-gray-50/30 cursor-pointer relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept={activeTab === 'image' ? 'image/*' : 'audio/*'}
                      className="hidden"
                    />
                    
                    {previewUrl && activeTab === 'image' ? (
                      <div className="space-y-4">
                        <img src={previewUrl} alt="Preview" className="max-h-64 object-contain rounded-lg shadow-sm block mx-auto" />
                        <p className="text-sm text-gray-500 truncate max-w-xs mx-auto">{selectedFile?.name}</p>
                      </div>
                    ) : selectedFile && activeTab === 'audio' ? (
                      <div className="space-y-4 w-full flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                          <Mic className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-xs mx-auto">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        {previewUrl && (
                          <div className="w-full max-w-sm mx-auto mt-4" onClick={(e) => e.stopPropagation()}>
                            <audio controls src={previewUrl} className="w-full rounded-md" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-2">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-gray-800">Click or drag & drop</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {activeTab === 'image' ? 'Supports JPG, PNG, WEBP' : 'Supports MP3, WAV, M4A'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="pt-4 text-center sm:text-right">
                  {loading && loadingSteps && (
                    <motion.div 
                      className="mb-6 text-left w-full sm:max-w-sm mx-auto sm:mr-0 sm:ml-auto"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                        <span className="animate-pulse">{loadingSteps.step}</span>
                        <span>{Math.round(loadingSteps.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 shadow-inner overflow-hidden">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                          style={{ width: `${loadingSteps.progress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1.5s_infinite]"></div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <button
                    onClick={handleDetect}
                    disabled={loading || (activeTab === 'text' ? !textInput.trim() : !selectedFile)}
                    className={`w-full sm:w-auto px-8 py-3.5 font-medium rounded-xl focus:ring-4 transition-all flex justify-center items-center gap-2 ${
                      loading 
                        ? 'bg-blue-50 text-blue-600 border border-blue-100 cursor-not-allowed cursor-wait' 
                        : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Analyzing...
                      </>
                    ) : (
                      'Analyze Content'
                    )}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Results Panel */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start transition-all">
                
                {/* Circular Progress Score */}
                <div className="flex-shrink-0 flex flex-col items-center gap-4">
                  <div className="relative w-32 h-32 md:w-40 md:h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                        stroke="#f3f4f6"
                        strokeWidth="8"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                        stroke={result.isAiGenerated ? '#ef4444' : '#10b981'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: result.confidence / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <motion.span 
                        className="text-3xl md:text-4xl font-light text-gray-900 tracking-tight"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        {Math.round(result.confidence)}%
                      </motion.span>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Confidence</span>
                    </div>
                  </div>

                  <div className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                    result.isAiGenerated 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {result.isAiGenerated ? 'Likely AI Generated' : 'Likely Human Mode'}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">Analysis Report</h3>
                  <div className="prose prose-sm md:prose-base text-gray-600 max-w-none">
                    {result.reasoning.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-2">{paragraph}</p>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-500" /> Analysis History
                </h2>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <button
                      onClick={() => setHistory([])}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Clear History"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No history yet. Analyze some content first.
                  </div>
                ) : (
                  history.map((record) => (
                    <div key={record.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {record.type === 'text' ? <FileText className="w-4 h-4 text-blue-500" /> : record.type === 'image' ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <Mic className="w-4 h-4 text-blue-500" />}
                          <span className="text-sm font-medium text-gray-800 capitalize">{record.type}</span>
                          <span className="text-xs text-gray-400">&bull; {new Date(record.date).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-600 text-sm truncate">{record.snippet}</p>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Confidence</div>
                          <div className="text-lg font-semibold text-gray-900">{Math.round(record.result.confidence)}%</div>
                        </div>
                        <div className={`px-3 py-1 text-xs font-medium rounded-full border ${record.result.isAiGenerated ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                          {record.result.isAiGenerated ? 'AI Generated' : 'Human Made'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
