
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

function App() {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [fileName, setFileName] = useState("");

  // Summary length
  const [summaryLength, setSummaryLength] = useState("medium");

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  // History
  const [history, setHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem("summaryHistory");
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch {
      return [];
    }
  });

  const [showHistory, setShowHistory] = useState(false);

  // =========================
  // SAVE DARK MODE
  // =========================

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // =========================
  // SAVE HISTORY
  // =========================

  useEffect(() => {
    localStorage.setItem("summaryHistory", JSON.stringify(history));
  }, [history]);

  // =========================
  // FILE UPLOAD
  // =========================

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const fileNameLower = file.name.toLowerCase();

    const allowed =
      fileNameLower.endsWith(".txt") ||
      fileNameLower.endsWith(".pdf") ||
      fileNameLower.endsWith(".docx");

    if (!allowed) {
      setError("Please upload a TXT, PDF or DOCX file.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setError("");
    setSummary("");
    setCopied(false);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setText(data.original_text || "");
      } else {
        setText(data.original_text || "");
        setSummary(data.summary || "");
        setSummaryLength("medium");

        // Save uploaded document summary to history
        if (data.summary) {
          const newHistoryItem = {
            id: Date.now(),
            originalText: data.original_text || "",
            summary: data.summary,
            length: "medium",
            date: new Date().toLocaleString(),
          };

          setHistory((prevHistory) => [
            newHistoryItem,
            ...prevHistory,
          ]);
        }
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the AI server. Please make sure the backend is running."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // =========================
  // TEXT SUMMARIZATION
  // =========================

  const summarizeText = async () => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }

    const wordCount = text.trim().split(/\s+/).length;

    if (wordCount < 30) {
      setError("Please enter at least 30 words.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary("");
    setCopied(false);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/summarize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            length: summaryLength,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        const generatedSummary = data.summary || "";

        setSummary(generatedSummary);

        // Save summary to history
        if (generatedSummary) {
          const newHistoryItem = {
            id: Date.now(),
            originalText: text,
            summary: generatedSummary,
            length: summaryLength,
            date: new Date().toLocaleString(),
          };

          setHistory((prevHistory) => [
            newHistoryItem,
            ...prevHistory,
          ]);
        }
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the AI server. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // CLEAR CURRENT
  // =========================

  const clearText = () => {
    setText("");
    setSummary("");
    setError("");
    setCopied(false);
    setFileName("");
    setSummaryLength("medium");
  };

  // =========================
  // COPY SUMMARY
  // =========================

  const copySummary = async () => {
    if (!summary) return;

    try {
      await navigator.clipboard.writeText(summary);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Unable to copy the summary.");
    }
  };

  // =========================
  // LOAD HISTORY ITEM
  // =========================

  const loadHistoryItem = (item) => {
    setText(item.originalText || "");
    setSummary(item.summary || "");
    setSummaryLength(item.length || "medium");
    setError("");
    setCopied(false);
    setFileName("");
    setShowHistory(false);
  };

  // =========================
  // DELETE HISTORY ITEM
  // =========================

  const deleteHistoryItem = (id) => {
    setHistory((prevHistory) =>
      prevHistory.filter((item) => item.id !== id)
    );
  };

  // =========================
  // CLEAR ALL HISTORY
  // =========================

  const clearHistory = () => {
    if (history.length === 0) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all summary history?"
    );

    if (confirmed) {
      setHistory([]);
    }
  };

  // =========================
  // WORD COUNTS
  // =========================

  const originalWordCount = text.trim()
    ? text.trim().split(/\s+/).length
    : 0;

  const summaryWordCount = summary.trim()
    ? summary.trim().split(/\s+/).length
    : 0;

  const compressionPercentage =
    originalWordCount > 0 && summaryWordCount > 0
      ? Math.max(
          0,
          Math.round(
            ((originalWordCount - summaryWordCount) /
              originalWordCount) *
              100
          )
        )
      : 0;

  // =========================
  // DOWNLOAD PDF
  // =========================

  const downloadPDF = () => {
    if (!summary) {
      setError("Please generate a summary first.");
      return;
    }

    try {
      const pdf = new jsPDF();

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 20;
      const usableWidth = pageWidth - margin * 2;

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);

      pdf.text(
        "AI Text Summarizer",
        margin,
        25
      );

      // Subtitle
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      pdf.text(
        `AI-generated ${summaryLength} summary`,
        margin,
        33
      );

      // Line
      pdf.line(
        margin,
        38,
        pageWidth - margin,
        38
      );

      // Summary heading
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);

      pdf.text(
        "Summary",
        margin,
        52
      );

      // Summary text
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      const lines = pdf.splitTextToSize(
        summary,
        usableWidth
      );

      let y = 63;
      const lineHeight = 6;

      lines.forEach((line) => {
        if (y > pageHeight - 30) {
          pdf.addPage();
          y = 20;
        }

        pdf.text(line, margin, y);
        y += lineHeight;
      });

      // Statistics
      if (y > pageHeight - 60) {
        pdf.addPage();
        y = 25;
      }

      y += 10;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);

      pdf.text(
        "Statistics",
        margin,
        y
      );

      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      pdf.text(
        `Summary type: ${summaryLength}`,
        margin,
        y
      );

      y += 6;

      pdf.text(
        `Original words: ${originalWordCount}`,
        margin,
        y
      );

      y += 6;

      pdf.text(
        `Summary words: ${summaryWordCount}`,
        margin,
        y
      );

      y += 6;

      pdf.text(
        `Reduced: ${compressionPercentage}%`,
        margin,
        y
      );

      // Footer
      pdf.setFontSize(9);

      pdf.text(
        "Built with React, FastAPI & Hugging Face",
        margin,
        pageHeight - 15
      );

      pdf.text(
        "Built by Zunaira Tariq",
        pageWidth - margin,
        pageHeight - 15,
        {
          align: "right",
        }
      );

      // Save PDF
      pdf.save(
        `AI-${summaryLength}-Summary.pdf`
      );
    } catch (err) {
      console.error(err);

      setError("Unable to generate PDF.");
    }
  };

  // =========================
  // UI
  // =========================

  return (
    <div
      className={
        darkMode
          ? "app dark-mode"
          : "app"
      }
    >

      {/* HEADER */}

      <header className="header">

        <div className="logo">
          AI Summarizer
        </div>

        <div className="header-right">

          {/* HISTORY BUTTON */}

          <button
            className="history-toggle"
            onClick={() =>
              setShowHistory(!showHistory)
            }
          >
            <span className="history-icon">
              🕘
            </span>

            <span>
              History
            </span>

            {history.length > 0 && (
              <span className="history-count">
                {history.length}
              </span>
            )}
          </button>

          {/* THEME BUTTON */}

          <button
            className="theme-toggle"
            onClick={() =>
              setDarkMode(!darkMode)
            }
            title={
              darkMode
                ? "Switch to Light Mode"
                : "Switch to Dark Mode"
            }
          >
            <span className="theme-icon">
              {darkMode ? "☀️" : "🌙"}
            </span>

            <span className="theme-text">
              {darkMode
                ? "Light"
                : "Dark"}
            </span>
          </button>

          {/* AI BADGE */}

          <div className="badge">
            AI Powered
          </div>

        </div>

      </header>

      {/* HISTORY PANEL */}

      {showHistory && (
        <div className="history-panel">

          <div className="history-header">

            <div>
              <h2>
                Summary History
              </h2>

              <p>
                Your previous summaries
              </p>
            </div>

            <div className="history-header-actions">

              {history.length > 0 && (
                <button
                  className="clear-history-btn"
                  onClick={clearHistory}
                >
                  Clear All
                </button>
              )}

              <button
                className="close-history-btn"
                onClick={() =>
                  setShowHistory(false)
                }
              >
                ✕
              </button>

            </div>

          </div>

          {history.length === 0 ? (

            <div className="empty-history">

              <div className="empty-history-icon">
                🕘
              </div>

              <h3>
                No History Yet
              </h3>

              <p>
                Your generated summaries will
                appear here.
              </p>

            </div>

          ) : (

            <div className="history-list">

              {history.map((item) => (

                <div
                  className="history-item"
                  key={item.id}
                >

                  <div
                    className="history-item-main"
                    onClick={() =>
                      loadHistoryItem(item)
                    }
                  >

                    <div className="history-item-top">

                      <span className="history-type">
                        {item.length
                          ? item.length
                              .charAt(0)
                              .toUpperCase() +
                            item.length.slice(1)
                          : "Medium"}
                      </span>

                      <span className="history-date">
                        {item.date}
                      </span>

                    </div>

                    <p className="history-preview">
                      {item.summary &&
                      item.summary.length > 180
                        ? item.summary.substring(
                            0,
                            180
                          ) + "..."
                        : item.summary}
                    </p>

                  </div>

                  <button
                    className="delete-history-btn"
                    onClick={() =>
                      deleteHistoryItem(item.id)
                    }
                    title="Delete"
                  >
                    🗑️
                  </button>

                </div>

              ))}

            </div>

          )}

        </div>
      )}

      {/* MAIN */}

      <main className="container">

        {/* HERO */}

        <section className="hero">

          <h1>
            AI Text Summarizer
          </h1>

          <p>
            Transform long text into clear,
            concise summaries using artificial
            intelligence.
          </p>

        </section>

        {/* INPUT CARD */}

        <section className="card">

          <div className="section-header">

            <h2>
              Enter Your Text
            </h2>

            <span>
              {originalWordCount} words
            </span>

          </div>

          {/* TEXTAREA */}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSummary("");
              setError("");
              setFileName("");
            }}
            placeholder="Paste your text here... (minimum 30 words)"
          />

          {/* SUMMARY LENGTH */}

          <div className="length-section">

            <h3>
              Summary Length
            </h3>

            <div className="length-options">

              {/* SHORT */}

              <button
                type="button"
                className={
                  summaryLength === "short"
                    ? "length-btn active"
                    : "length-btn"
                }
                onClick={() =>
                  setSummaryLength("short")
                }
                disabled={
                  loading || uploading
                }
              >
                <strong>
                  Short
                </strong>

                <span>
                  Quick & concise
                </span>
              </button>

              {/* MEDIUM */}

              <button
                type="button"
                className={
                  summaryLength === "medium"
                    ? "length-btn active"
                    : "length-btn"
                }
                onClick={() =>
                  setSummaryLength("medium")
                }
                disabled={
                  loading || uploading
                }
              >
                <strong>
                  Medium
                </strong>

                <span>
                  Balanced summary
                </span>
              </button>

              {/* DETAILED */}

              <button
                type="button"
                className={
                  summaryLength === "detailed"
                    ? "length-btn active"
                    : "length-btn"
                }
                onClick={() =>
                  setSummaryLength("detailed")
                }
                disabled={
                  loading || uploading
                }
              >
                <strong>
                  Detailed
                </strong>

                <span>
                  More information
                </span>
              </button>

            </div>

          </div>

          {/* FILE UPLOAD */}

          <div className="upload-section">

            <label className="upload-btn">

              📄{" "}

              {uploading
                ? "Processing..."
                : "Upload TXT / PDF / DOCX"}

              <input
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={
                  handleFileUpload
                }
                disabled={
                  uploading || loading
                }
              />

            </label>

            <span className="upload-info">

              {fileName
                ? "Selected: " + fileName
                : "Supported files: TXT, PDF and DOCX"}

            </span>

          </div>

          {/* ERROR */}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {/* BUTTONS */}

          <div className="button-row">

            <button
              className="summarize-btn"
              onClick={
                summarizeText
              }
              disabled={
                loading ||
                uploading
              }
            >
              {loading
                ? "Summarizing..."
                : "✦ Summarize Text"}
            </button>

            <button
              className="clear-btn"
              onClick={clearText}
              disabled={
                loading ||
                uploading
              }
            >
              Clear
            </button>

          </div>

        </section>

        {/* FILE LOADING */}

        {uploading && (

          <div className="loading-box">

            <div className="spinner"></div>

            <p>
              Reading your document and
              generating summary...
            </p>

          </div>

        )}

        {/* TEXT LOADING */}

        {loading && (

          <div className="loading-box">

            <div className="spinner"></div>

            <p>
              AI is generating your{" "}
              {summaryLength} summary...
            </p>

          </div>

        )}

        {/* RESULT */}

        {summary &&
          !loading &&
          !uploading && (

            <section className="card result-card">

              <div className="section-header">

                <div>

                  <h2>
                    Summary
                  </h2>

                  <span>
                    {summaryLength
                      .charAt(0)
                      .toUpperCase() +
                      summaryLength.slice(1)}
                  </span>

                </div>

                <div className="result-actions">

                  <button
                    className="copy-btn"
                    onClick={
                      copySummary
                    }
                  >
                    {copied
                      ? "✓ Copied"
                      : "📋 Copy"}
                  </button>

                  <button
                    className="download-btn"
                    onClick={
                      downloadPDF
                    }
                  >
                    📥 Download PDF
                  </button>

                </div>

              </div>

              {/* SUMMARY */}

              <div className="summary-box">
                {summary}
              </div>

              {/* STATISTICS */}

              <div className="stats">

                <div className="stat">

                  <span>
                    Original
                  </span>

                  <strong>
                    {originalWordCount}
                  </strong>

                  <small>
                    words
                  </small>

                </div>

                <div className="stat">

                  <span>
                    Summary
                  </span>

                  <strong>
                    {summaryWordCount}
                  </strong>

                  <small>
                    words
                  </small>

                </div>

                <div className="stat">

                  <span>
                    Reduced
                  </span>

                  <strong>
                    {compressionPercentage}%
                  </strong>

                  <small>
                    shorter
                  </small>

                </div>

              </div>

            </section>

          )}

      </main>

      {/* FOOTER */}

      <footer>

        <p>
          AI Text Summarizer • Built with
          React, FastAPI & Hugging Face
        </p>

        <p className="creator">

          Built with ❤️ by{" "}

          <strong>
            Zunaira Tariq
          </strong>

        </p>

      </footer>

    </div>
  );
}

export default App;

