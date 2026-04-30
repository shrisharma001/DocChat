import { useState, useRef, useEffect } from "react";

const API = "http://localhost:8000";
const SESSION_ID = "default";

export default function DocChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (file) => {
    if (!file || !file.name.endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("session_id", SESSION_ID);
    try {
      const res = await fetch(`${API}/upload?session_id=${SESSION_ID}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadedFiles((prev) => [...prev, file.name]);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `📄 "${file.name}" uploaded — ${data.chunks_stored} chunks indexed.`,
        },
      ]);
    } catch {
      alert("Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || asking) return;
    if (uploadedFiles.length === 0) {
      alert("Please upload a PDF first.");
      return;
    }
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setAsking(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID, question: q }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error reaching backend.", sources: [] },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>DocChat</div>
        <div style={styles.sideLabel}>Documents</div>

        <div
          style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files[0]);
          }}
        >
          {uploading ? "Uploading..." : "+ Drop PDF or click"}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => handleUpload(e.target.files[0])}
        />

        {uploadedFiles.map((f, i) => (
          <div key={i} style={styles.fileChip}>📄 {f}</div>
        ))}
      </div>

      <div style={styles.main}>
        <div style={styles.chatArea}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              Upload a PDF and start asking questions.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.bubble, ...styles[m.role] }}>
              <div>{m.text}</div>
              {m.sources?.length > 0 && (
                <div style={styles.sources}>
                  {m.sources.map((s, j) => (
                    <span key={j} style={styles.sourceTag}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {asking && (
            <div style={{ ...styles.bubble, ...styles.assistant }}>
              <span style={styles.typing}>Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={styles.inputRow}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about your documents…"
          />
          <button style={styles.btn} onClick={handleAsk} disabled={asking}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    height: "100vh",
    fontFamily: "'IBM Plex Mono', monospace",
    background: "#0f0f0f",
    color: "#e8e8e8",
  },
  sidebar: {
    width: 240,
    background: "#161616",
    borderRight: "1px solid #2a2a2a",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.5px",
    color: "#7effa0",
    marginBottom: 16,
  },
  sideLabel: {
    fontSize: 11,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  dropzone: {
    border: "1px dashed #333",
    borderRadius: 6,
    padding: "14px 10px",
    textAlign: "center",
    fontSize: 12,
    color: "#666",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  dropzoneActive: {
    borderColor: "#7effa0",
    color: "#7effa0",
    background: "#0d1f13",
  },
  fileChip: {
    fontSize: 11,
    color: "#aaa",
    background: "#1e1e1e",
    borderRadius: 4,
    padding: "6px 10px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  empty: {
    margin: "auto",
    color: "#444",
    fontSize: 14,
    textAlign: "center",
  },
  bubble: {
    maxWidth: 680,
    padding: "14px 18px",
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 1.7,
  },
  user: {
    alignSelf: "flex-end",
    background: "#1a2e1f",
    border: "1px solid #2a4a30",
    color: "#c8ffd4",
  },
  assistant: {
    alignSelf: "flex-start",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#e8e8e8",
  },
  system: {
    alignSelf: "center",
    background: "transparent",
    border: "none",
    color: "#555",
    fontSize: 12,
  },
  sources: {
    marginTop: 10,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  sourceTag: {
    fontSize: 11,
    background: "#222",
    border: "1px solid #333",
    borderRadius: 4,
    padding: "3px 8px",
    color: "#7effa0",
  },
  typing: {
    color: "#555",
    fontStyle: "italic",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    padding: "16px 40px 24px",
    borderTop: "1px solid #1e1e1e",
  },
  input: {
    flex: 1,
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    color: "#e8e8e8",
    padding: "12px 16px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  btn: {
    background: "#7effa0",
    color: "#0a1a0f",
    border: "none",
    borderRadius: 6,
    padding: "12px 24px",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
};
