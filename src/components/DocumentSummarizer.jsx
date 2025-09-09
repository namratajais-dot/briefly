import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  Download,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Brain,
  Eye,
  Zap,
} from "lucide-react";

const DocumentSummarizer = () => {
  // Use environment variable for API key (Vite format)
  const GEMINI_API_KEY =
    import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/bmp",
      "image/tiff",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please upload a PDF or image file (JPEG, PNG, BMP, TIFF)");
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size must be less than 50MB");
      return;
    }

    setFile(selectedFile);
    setError("");
    setExtractedText("");
    setSummary("");
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  // PDF text extraction using Gemini API (for PDFs that can't be parsed client-side)
  const extractTextFromPDF = async (file) => {
    try {
      const base64PDF = await fileToBase64(file);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract all text from this PDF document with high accuracy. Maintain the original formatting, structure, and layout as much as possible. Please:\n- Preserve paragraph breaks and spacing\n- Maintain table structures if present\n- Keep headers and subheaders distinct\n- Preserve any list formatting (bullets, numbers)\n- Include page breaks where appropriate\n\nReturn only the extracted text without any additional commentary.`,
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64PDF,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "PDF text extraction failed"
        );
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      console.error("PDF extraction error:", error);
      throw new Error(
        "Failed to extract text from PDF. Please ensure the file is valid."
      );
    }
  };

  // Convert file (image or pdf) to base64 (without prefix)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // OCR using Gemini Vision API
  const performOCR = async (file) => {
    try {
      const base64Image = await fileToBase64(file);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract all text from this image with high accuracy. Maintain the original formatting, structure, and layout as much as possible. If there are:\n- Tables: Preserve tabular format with proper spacing\n- Lists: Maintain bullet points or numbering\n- Headers: Keep hierarchical structure\n- Paragraphs: Preserve paragraph breaks\n\nReturn only the extracted text without any additional commentary or explanations.`,
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OCR processing failed");
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      console.error("OCR error:", error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  };

  // Extract text based on file type
  const extractText = async () => {
    if (!file) return;

    setIsExtracting(true);
    setError("");

    try {
      let text = "";

      if (file.type === "application/pdf") {
        text = await extractTextFromPDF(file);
      } else {
        text = await performOCR(file);
      }

      if (!text.trim()) {
        throw new Error("No text found in the document");
      }

      setExtractedText(text);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  // Generate summary with different lengths
  const generateSummary = async () => {
    if (!extractedText) {
      setError("Please extract text first");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const lengthPrompts = {
        short: {
          instruction:
            "Create a concise summary in 2-3 sentences highlighting only the most critical points and key takeaways.",
          maxTokens: 200,
        },
        medium: {
          instruction:
            "Create a comprehensive summary in 1-2 paragraphs covering the main ideas, key details, and important conclusions.",
          maxTokens: 500,
        },
        long: {
          instruction:
            "Create a detailed summary in 3-4 paragraphs that thoroughly covers all important aspects, key points, supporting details, and conclusions.",
          maxTokens: 1000,
        },
      };

      const selectedLength = lengthPrompts[summaryLength];

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze the following document and provide a ${summaryLength} summary. ${selectedLength.instruction}\n\nFocus on:\n- Main themes and key ideas\n- Important facts, figures, and data points\n- Significant conclusions or findings\n- Action items or recommendations (if any)\n- Critical insights or implications\n\nDocument Content:\n${extractedText}\n\nSummary:`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: selectedLength.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Summary generation failed"
        );
      }

      const data = await response.json();
      setSummary(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
    } catch (error) {
      setError(`Summary generation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download summary as text file
  const downloadSummary = () => {
    if (!summary) return;

    const element = document.createElement("a");
    const fileContent = `Document Summary (${summaryLength.toUpperCase()})\nGenerated on: ${new Date().toLocaleString()}\n\n${summary}`;
    const outputFile = new Blob([fileContent], { type: "text/plain" });
    element.href = URL.createObjectURL(outputFile);
    element.download = `${summaryLength}_summary_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 relative overflow-hidden">
      {/* Subtle pastel blobs (no animation) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200/40 rounded-full blur-3xl" />
        <div className="absolute top-40 -left-40 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-1/4 w-60 h-60 bg-pink-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-2 py-2">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-7xl md:text-8xl font-extrabold font-brand bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2 leading-normal tracking-wide drop-shadow-sm"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Briefly
          </h1>

          <p className="text-lg text-gray-700/80 font-medium max-w-2xl mx-auto leading-relaxed">
            Transform your documents into intelligent insights with gentle,
            pastel UI — extract text and summarize with ease.
          </p>
          <div className="flex items-center justify-center mt-6 gap-6 text-gray-600">
            <div className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">OCR Vision</span>
            </div>
            <div className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Fast Processing</span>
            </div>
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Smart Analysis</span>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="backdrop-blur-sm bg-white/80 rounded-3xl border border-purple-200 p-8 mb-8 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <Upload className="h-6 w-6 mr-3 text-purple-500" />
            Upload Your Document
          </h3>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center ${
              isDragging
                ? "border-purple-400 bg-purple-100/70"
                : "border-purple-300/60 bg-purple-50/40"
            }`}
          >
            <div className="flex justify-center mb-5">
              <div className="bg-gradient-to-r from-pink-200 to-purple-200 p-5 rounded-full">
                {/* No animation on icon */}
                <Upload className="h-10 w-10 text-gray-700" />
              </div>
            </div>
            <h4 className="text-xl font-bold text-gray-800 mb-2">
              Drop your files here
            </h4>
            <p className="text-gray-600 mb-6">
              or click to browse from your device
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-pink-300 to-purple-300 text-gray-900 px-8 py-4 rounded-xl font-semibold shadow-md ring-2 ring-purple-200"
            >
              Choose File
            </button>
            <div className="mt-6 flex justify-center gap-3 text-gray-700/70">
              <span className="bg-purple-200/50 px-3 py-1 rounded-full text-xs font-medium">
                PDF
              </span>
              <span className="bg-purple-200/50 px-3 py-1 rounded-full text-xs font-medium">
                JPEG
              </span>
              <span className="bg-purple-200/50 px-3 py-1 rounded-full text-xs font-medium">
                PNG
              </span>
              <span className="bg-purple-200/50 px-3 py-1 rounded-full text-xs font-medium">
                TIFF
              </span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="hidden"
          />

          {/* Selected File Display */}
          {file && (
            <div className="mt-8 bg-gradient-to-r from-purple-100/80 to-pink-100/80 rounded-2xl p-6 border border-purple-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-r from-purple-300 to-pink-300 p-3 rounded-xl">
                  {file.type === "application/pdf" ? (
                    <FileText className="h-8 w-8 text-gray-800" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-800" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base md:text-lg break-all">
                    {file.name}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                    {file.type.includes("pdf") ? "PDF Document" : "Image File"}
                  </p>
                </div>
              </div>

              {/* Extract button centered */}
              <button
                onClick={extractText}
                disabled={isExtracting}
                className="mx-auto block bg-gradient-to-r from-teal-200 to-emerald-200 text-gray-900 px-8 py-3 rounded-xl font-semibold shadow-md disabled:opacity-60"
              >
                {isExtracting ? (
                  <div className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>
                      {file.type === "application/pdf"
                        ? "Extracting PDF Content..."
                        : "Processing with OCR..."}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center">
                    <Sparkles className="h-5 w-5" />
                    <span>
                      {file.type === "application/pdf"
                        ? "Extract PDF Text"
                        : "Extract Text (OCR)"}
                    </span>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-r from-red-100 to-pink-100 backdrop-blur-sm border border-red-200 rounded-2xl p-6 mb-8 flex items-start gap-4 shadow-md">
            <AlertCircle className="h-6 w-6 text-red-500 mt-1 flex-shrink-0" />
            <p className="text-red-700 font-medium text-base">{error}</p>
          </div>
        )}

        {/* Extracted Text Display */}
        {extractedText && (
          <div className="backdrop-blur-sm bg-white/80 rounded-3xl border border-purple-200 p-8 mb-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                <CheckCircle className="h-6 w-6 mr-3 text-emerald-500" />
                Extracted Text
              </h3>
              <div className="bg-emerald-200/60 px-4 py-2 rounded-full">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 max-h-80 overflow-y-auto border border-purple-200">
              <pre className="whitespace-pre-wrap text-gray-800 font-mono leading-relaxed text-sm">
                {extractedText}
              </pre>
            </div>
            <div className="mt-4 flex gap-4 text-gray-700/80">
              <span className="bg-purple-200/60 px-3 py-1 rounded-full text-xs font-medium">
                {extractedText.length} characters
              </span>
              <span className="bg-purple-200/60 px-3 py-1 rounded-full text-xs font-medium">
                {extractedText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>
        )}

        {/* Summary Generation */}
        {extractedText && (
          <div className="backdrop-blur-sm bg-white/80 rounded-3xl border border-purple-200 p-8 mb-8 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <Brain className="h-6 w-6 mr-3 text-purple-500" />
              Generate AI Summary
            </h3>

            <div className="mb-8">
              <label className="block text-base font-bold text-gray-800 mb-4">
                Choose Summary Style
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    value: "short",
                    label: "Concise",
                    desc: "Quick 2-3 sentence overview",
                    icon: Zap,
                    badge: "bg-yellow-200/70",
                  },
                  {
                    value: "medium",
                    label: "Balanced",
                    desc: "Comprehensive 1-2 paragraphs",
                    icon: Eye,
                    badge: "bg-blue-200/70",
                  },
                  {
                    value: "long",
                    label: "Detailed",
                    desc: "In-depth 3-4 paragraph analysis",
                    icon: Brain,
                    badge: "bg-pink-200/70",
                  },
                ].map((option) => {
                  const IconComponent = option.icon;
                  const isActive = summaryLength === option.value;
                  return (
                    <div key={option.value} className="relative">
                      <input
                        type="radio"
                        id={option.value}
                        name="summaryLength"
                        value={option.value}
                        checked={isActive}
                        onChange={(e) => setSummaryLength(e.target.value)}
                        className="sr-only"
                      />
                      <label
                        htmlFor={option.value}
                        className={`block p-6 rounded-2xl border ${
                          isActive
                            ? "border-purple-400 bg-purple-100/70 shadow-md"
                            : "border-purple-200 bg-purple-50/40"
                        }`}
                      >
                        <div
                          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${option.badge} mb-4`}
                        >
                          <IconComponent className="h-6 w-6 text-gray-800" />
                        </div>
                        <div className="font-bold text-gray-900 text-lg mb-1">
                          {option.label}
                        </div>
                        <div className="text-gray-700/80 text-sm leading-relaxed">
                          {option.desc}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={generateSummary}
              disabled={isProcessing}
              className="mx-auto block bg-gradient-to-r from-indigo-200 to-purple-200 text-gray-900 px-10 py-4 rounded-xl font-semibold shadow-md disabled:opacity-60"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Generating {summaryLength} summary...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <Sparkles className="h-6 w-6" />
                  <span>
                    Generate{" "}
                    {summaryLength.charAt(0).toUpperCase() +
                      summaryLength.slice(1)}{" "}
                    Summary
                  </span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Summary Display */}
        {summary && (
          <div className="backdrop-blur-sm bg-white/80 rounded-3xl border border-purple-200 p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                <Sparkles className="h-6 w-6 mr-3 text-purple-500" />
                {summaryLength.charAt(0).toUpperCase() +
                  summaryLength.slice(1)}{" "}
                Summary
              </h3>
              <button
                onClick={downloadSummary}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-200 to-teal-200 text-gray-900 px-6 py-3 rounded-xl font-semibold shadow-md"
              >
                <Download className="h-5 w-5" />
                <span>Download</span>
              </button>
            </div>

            <div className="bg-gradient-to-br from-purple-100/70 via-pink-100/70 to-blue-100/70 rounded-2xl p-8 border border-purple-200">
              <div className="text-gray-800 leading-relaxed text-lg">
                <div className="whitespace-pre-wrap font-medium">{summary}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 backdrop-blur-sm border border-purple-200 rounded-2xl p-6 inline-block shadow-md">
            <p className="text-gray-700 font-medium flex items-center justify-center">
              <Sparkles className="h-5 w-5 mr-2" />
              Powered by Google Gemini AI • Advanced PDF parsing & OCR
              technology
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSummarizer;
