import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Link2, 
  Cpu, 
  Layers, 
  Settings, 
  Clipboard, 
  Check, 
  ExternalLink, 
  History, 
  Sparkles, 
  Plus, 
  Trash2, 
  Download, 
  BookOpen, 
  Info, 
  FileCode, 
  RefreshCw,
  Menu,
  X,
  Folder,
  AlertCircle,
  Lock,
  LogIn,
  ShieldCheck
} from "lucide-react";
import { parseMarkdownNotes, filterOutIndexNotes, ParsedNote } from "./types";
import { GoogleAuth, GoogleUser } from "./GoogleAuth";

interface HistoryItem {
  id: string;
  title: string;
  timestamp: string;
  rawMarkdown: string;
  notes: ParsedNote[];
  sourceInput: string;
  isUrl: boolean;
}

const MODELS = [
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    badge: "Recommended",
    desc: "Speed-optimized, high quality",
    requiresGoogleAuth: true,
    isPaid: false
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    badge: "Pro Preview",
    desc: "Deep analytical synthesis",
    requiresGoogleAuth: true,
    isPaid: true
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    badge: "Fastest",
    desc: "Low-latency atomic splits",
    requiresGoogleAuth: true,
    isPaid: false
  },
  {
    id: "byok",
    name: "Custom OpenAI Provider (BYOK)",
    badge: "BYOK",
    desc: "Use your own custom OpenAI-compatible API",
    requiresGoogleAuth: false,
    isPaid: false
  }
];

async function fetchArticleTextClient(url: string): Promise<string> {
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const scripts = doc.querySelectorAll("script, style, svg, nav, footer, iframe");
    scripts.forEach(s => s.remove());
    const text = doc.body ? doc.body.textContent || "" : html;
    return text.replace(/\s+/g, " ").trim().substring(0, 150000);
  } catch (err: any) {
    throw new Error(`Client-side URL fetch failed: ${err.message || err}. Please copy and paste the article text directly.`);
  }
}

async function executeByokClientSynthesis(
  input: string,
  isUrl: boolean,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  let contentToAnalyze = input;
  if (isUrl) {
    contentToAnalyze = await fetchArticleTextClient(input);
  }

  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;

  const systemInstruction = `You are an expert knowledge manager. Analyze the provided text and distill its core ideas into single-concept atomic notes in Markdown format separated by thematic dividers (---). Ensure each note begins with YAML frontmatter.`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: contentToAnalyze }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Custom Provider returned error ${res.status}: ${errText.substring(0, 120)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export default function App() {
  useEffect(() => {
    document.title = "BigBadAtomicNotes";
  }, []);

  // Google User Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => {
    try {
      const saved = localStorage.getItem("atomic_notes_google_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleGoogleSignIn = (user: GoogleUser) => {
    setGoogleUser(user);
    localStorage.setItem("atomic_notes_google_user", JSON.stringify(user));
  };

  const handleGoogleSignOut = () => {
    setGoogleUser(null);
    localStorage.removeItem("atomic_notes_google_user");
  };

  // Navigation & View tab states
  const [activeTab, setActiveTab] = useState<"cards" | "raw" | "help">("cards");
  const [ingestionMode, setIngestionMode] = useState<"url" | "text">("url");

  // Mobile navigation states
  const [mobileTab, setMobileTab] = useState<"input" | "output">("input");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Input states
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("atomic_notes_selected_model") || "gemini-3.5-flash";
  });
  const selectedModelObj = MODELS.find(m => m.id === selectedModel) || MODELS[0];
  const [vaultName, setVaultName] = useState(() => {
    return localStorage.getItem("obsidian_vault_name") || "PersonalVault";
  });

  // BYOK Settings States
  const [byokBaseUrl, setByokBaseUrl] = useState(() => {
    return localStorage.getItem("byok_base_url") || "";
  });
  const [byokApiKey, setByokApiKey] = useState(() => {
    return localStorage.getItem("byok_api_key") || "";
  });
  const [byokModel, setByokModel] = useState(() => {
    return localStorage.getItem("byok_model") || "";
  });

  // BYOK connection status: "idle" | "testing" | "success" | "error"
  const [byokTestStatus, setByokTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [byokTestError, setByokTestError] = useState<string | null>(null);

  // Action/API states
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Result states
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [parsedNotes, setParsedNotes] = useState<ParsedNote[]>([]);
  const [currentTitle, setCurrentTitle] = useState("");

  // History states
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // UI state feedback
  const [copiedNoteIndex, setCopiedNoteIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [globalCardView, setGlobalCardView] = useState<"markdown" | "preview">("markdown");
  const [cardViewModes, setCardViewModes] = useState<Record<number, "markdown" | "preview">>({});

  // Local File System / Editing states
  const [localDirectoryHandle, setLocalDirectoryHandle] = useState<any | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string>(() => {
    return localStorage.getItem("atomic_notes_local_folder_name") || "";
  });
  const [folderErrorMsg, setFolderErrorMsg] = useState<string | null>(null);
  const [editableNotes, setEditableNotes] = useState<ParsedNote[]>([]);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSavedFolderPath, setLastSavedFolderPath] = useState<string>("");

  // Sync editableNotes with parsedNotes when parsedNotes is loaded/generated
  useEffect(() => {
    setEditableNotes(parsedNotes);
  }, [parsedNotes]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to choose a local folder (Universal macOS, iOS, Windows, Linux)
  const handleSelectFolder = async () => {
    setFolderErrorMsg(null);

    // 1. Try File System Access API first (Chrome/Edge on Desktop)
    if ((window as any).showDirectoryPicker) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        setLocalDirectoryHandle(handle);
        setLocalFolderName(handle.name);
        localStorage.setItem("atomic_notes_local_folder_name", handle.name);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled dialog
        console.warn("Directory picker fallback to HTML5 file input:", err);
      }
    }

    // 2. Universal Fallback for macOS Safari, iOS Files app, Firefox & Mobile
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setFolderErrorMsg("Please type your target folder path directly in the text field.");
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relPath = (firstFile as any).webkitRelativePath || "";
      const folderName = relPath ? relPath.split("/")[0] : firstFile.name;
      if (folderName) {
        setLocalFolderName(folderName);
        localStorage.setItem("atomic_notes_local_folder_name", folderName);
        setFolderErrorMsg(null);
      }
    }
  };

  // Helper to format date prefix: YYYY:mm:dd:hh
  const getFormattedDatePrefix = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    return `${yyyy}:${mm}:${dd}:${hh}`;
  };

  // Change handlers for editing note content in the preview
  const handleNoteTitleChange = (index: number, newTitle: string) => {
    setEditableNotes(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        title: newTitle,
        fileName: `${newTitle.replace(/[\\/:*?"<>|]/g, "").trim()}.md`
      };
      return updated;
    });
  };

  const handleNoteContentChange = (index: number, newContent: string) => {
    setEditableNotes(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        content: newContent
      };
      return updated;
    });
  };

  // Cancel flow handlers
  const handleCancelConfirmYes = () => {
    setParsedNotes([]);
    setEditableNotes([]);
    setRawMarkdown("");
    setShowCancelConfirmation(false);
    setMobileTab("input");
  };

  const handleCancelConfirmNo = () => {
    setShowCancelConfirmation(false);
  };

  // Save flow handler
  const handleSaveAllToLocalFolder = async () => {
    if (editableNotes.length === 0) return;

    const targetFolder = localFolderName || vaultName;
    let savedDirectly = false;

    if (targetFolder && !localDirectoryHandle) {
      try {
        const response = await fetch("/api/save-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPath: targetFolder,
            notes: filterOutIndexNotes(editableNotes)
          })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          savedDirectly = true;
          if (data.folderPath) setLastSavedFolderPath(data.folderPath);
          setSaveStatus({ success: true, message: data.message });
        }
      } catch (err) {
        console.warn("Direct save error:", err);
      }
    }

    if (!savedDirectly) {
      let savedFilesCount = 0;
      const datePrefix = getFormattedDatePrefix();

      try {
        for (const note of editableNotes) {
          const briefName = note.title.trim().replace(/[\\/:*?"<>|]/g, "").substring(0, 50).trim() || "note";
          const customFileName = `${datePrefix} - ${briefName}.md`;

          if (localDirectoryHandle) {
            const fileHandle = await localDirectoryHandle.getFileHandle(customFileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(note.content);
            await writable.close();
            savedFilesCount++;
          } else {
            const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = customFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            savedFilesCount++;
          }
        }

        setSaveStatus({
          success: true,
          message: localDirectoryHandle 
            ? `Successfully created ${savedFilesCount} file(s) in your local folder: "${localFolderName}"!`
            : `Downloaded ${savedFilesCount} file(s) to your default browser downloads folder.`
        });
      } catch (err: any) {
        setSaveStatus({ success: false, message: `Failed to save files: ${err.message || err}` });
      }
    }

    // Save the edited notes to History too
    const timestampStr = `${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newHistoryItem: HistoryItem = {
      id: Date.now().toString(),
      title: editableNotes[0]?.title || "Saved Notes",
      timestamp: timestampStr,
      rawMarkdown: editableNotes.map(n => n.content).join("\n\n---\n\n"),
      notes: [...editableNotes],
      sourceInput: rawText || sourceUrl,
      isUrl: ingestionMode === "url"
    };

    setHistory(prev => {
      const updated = [newHistoryItem, ...prev.slice(0, 19)];
      localStorage.setItem("atomic_notes_history", JSON.stringify(updated));
      return updated;
    });

    setTimeout(() => setSaveStatus(null), 5000);
  };

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("atomic_notes_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save vault name to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("obsidian_vault_name", vaultName);
  }, [vaultName]);

  // Save selected model to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("atomic_notes_selected_model", selectedModel);
  }, [selectedModel]);

  // Persist BYOK settings
  useEffect(() => {
    localStorage.setItem("byok_base_url", byokBaseUrl);
  }, [byokBaseUrl]);

  useEffect(() => {
    localStorage.setItem("byok_api_key", byokApiKey);
  }, [byokApiKey]);

  useEffect(() => {
    localStorage.setItem("byok_model", byokModel);
  }, [byokModel]);

  const handleTestBYOKConnection = async () => {
    if (!byokBaseUrl || !byokApiKey || !byokModel) {
      setByokTestStatus("error");
      setByokTestError("All fields (Base URL, API Key, and Model) are required to test the connection.");
      return;
    }

    setByokTestStatus("testing");
    setByokTestError(null);

    try {
      const response = await fetch("/api/byok/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          baseUrl: byokBaseUrl,
          apiKey: byokApiKey,
          model: byokModel
        })
      });

      const data = await response.json();

      if (response.ok) {
        setByokTestStatus("success");
      } else {
        setByokTestStatus("error");
        setByokTestError(data.error || "Connection test failed.");
      }
    } catch (err: any) {
      setByokTestStatus("error");
      setByokTestError(err.message || "Network error. Make sure the server is running and the URL is correct.");
    }
  };

  // Trigger automatic URL mode toggle if pasting a URL in the textbox
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    if (!sourceUrl && val.trim().startsWith("http") && val.trim().split("\n")[0].length < 150) {
      setSourceUrl(val.trim());
      setIngestionMode("url");
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const input = ingestionMode === "url" ? sourceUrl.trim() : rawText.trim();
    if (!input) {
      setError(ingestionMode === "url" ? "Please enter a valid source URL." : "Please paste some source text content.");
      setLoading(false);
      return;
    }

    if (ingestionMode === "url" && !input.startsWith("http://") && !input.startsWith("https://")) {
      setError("Please ensure the URL starts with http:// or https://");
      setLoading(false);
      return;
    }

    const selectedModelObj = MODELS.find(m => m.id === selectedModel) || MODELS[0];
    if (selectedModelObj.requiresGoogleAuth && !googleUser) {
      setError("Google Sign-In is required to use Gemini synthesis models. Please sign in with your Google Account.");
      setLoading(false);
      setMobileTab("input");
      return;
    }

    if (selectedModel === "byok") {
      if (!byokBaseUrl || !byokApiKey || !byokModel) {
        setError("Please configure your Custom OpenAI Provider (BYOK) settings (Base URL, API Key, and Model) before synthesizing notes.");
        setLoading(false);
        // Switch back to input tab so they can see the settings configuration
        setMobileTab("input");
        return;
      }
    }

    setLoadingStep(ingestionMode === "url" ? "Fetching web article..." : "Analyzing source text...");
    
    // Switch to output tab so mobile users can immediately observe the loading steps/result
    setMobileTab("output");

    try {
      const activeModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];
      // Small artificial step for visual pacing
      setTimeout(() => {
        setLoadingStep(`Processing source content with ${activeModel.name}...`);
      }, 800);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          isUrl: ingestionMode === "url",
          model: selectedModel,
          byokConfig: selectedModel === "byok" ? {
            baseUrl: byokBaseUrl,
            apiKey: byokApiKey,
            model: byokModel
          } : undefined
        })
      });

      let generatedMarkdown = "";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Generation request failed");
        }
        generatedMarkdown = data.markdown;
      } else {
        // If host returns HTML or non-JSON (e.g. 404 on static GitHub Pages deployment)
        if (selectedModel === "byok") {
          setLoadingStep("Executing Custom Provider directly from browser...");
          generatedMarkdown = await executeByokClientSynthesis(input, ingestionMode === "url", byokBaseUrl, byokApiKey, byokModel);
        } else {
          throw new Error("Backend server API is not active on static GitHub Pages hosting. To synthesize URLs or text using Gemini models, please run the app locally (npm run dev) or switch to Custom Provider (BYOK).");
        }
      }
      const notes = parseMarkdownNotes(generatedMarkdown);

      if (notes.length === 0) {
        console.warn("No structured markdown notes could be parsed. Using raw block fallback.");
      }

      const cleanRawMarkdown = notes.length > 0
        ? notes.map(n => n.content).join("\n\n---\n\n")
        : generatedMarkdown.replace(/^```(?:markdown)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

      setRawMarkdown(cleanRawMarkdown);
      setParsedNotes(notes);

      // Determine a nice display title for this synthesis session
      let displayTitle = "Text Synthesis";
      if (ingestionMode === "url") {
        try {
          const urlObj = new URL(input);
          displayTitle = urlObj.hostname + urlObj.pathname.substring(0, 15);
        } catch (_) {
          displayTitle = "URL Synthesis";
        }
      } else {
        displayTitle = input.substring(0, 30).trim() + "...";
      }
      setCurrentTitle(displayTitle);

      // Save to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: displayTitle,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " • " + new Date().toLocaleDateString(),
        rawMarkdown: cleanRawMarkdown,
        notes,
        sourceInput: input,
        isUrl: ingestionMode === "url"
      };

      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)]; // Limit to 20 items
      setHistory(updatedHistory);
      localStorage.setItem("atomic_notes_history", JSON.stringify(updatedHistory));

      setActiveTab("cards");
    } catch (err: any) {
      setError(err.message || "Something went wrong during synthesis. Please check your internet connection and API key.");
      // On error, switch back to input so they can fix their settings or content
      setMobileTab("input");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setRawMarkdown(item.rawMarkdown);
    setParsedNotes(item.notes);
    setCurrentTitle(item.title);
    if (item.isUrl) {
      setSourceUrl(item.sourceInput);
      setIngestionMode("url");
    } else {
      setRawText(item.sourceInput);
      setIngestionMode("text");
    }
    setError(null);
    setMobileTab("output"); // Switch to output panel on mobile
    setSidebarOpen(false); // Close sidebar drawer on mobile
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("atomic_notes_history", JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear your local synthesis history?")) {
      setHistory([]);
      localStorage.removeItem("atomic_notes_history");
    }
  };

  // Fixed Reset Session logic that works flawlessly on Mobile & Desktop
  const startNewSession = () => {
    setSourceUrl("");
    setRawText("");
    setRawMarkdown("");
    setParsedNotes([]);
    setCurrentTitle("");
    setError(null);
    setMobileTab("input"); // ALWAYS bring mobile users back to input panel!
    setSidebarOpen(false); // Close mobile drawer if it was open
    setActiveTab("cards"); // Reset subtabs
  };

  const copyToClipboard = (text: string, index: number | "all") => {
    navigator.clipboard.writeText(text);
    if (index === "all") {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedNoteIndex(index);
      setTimeout(() => setCopiedNoteIndex(null), 2000);
    }
  };

  const downloadAllAsFiles = async () => {
    if (parsedNotes.length === 0) return;

    const notesToDownload = filterOutIndexNotes(parsedNotes);
    if (notesToDownload.length === 0) return;
    
    const targetFolder = localFolderName || vaultName;

    if (targetFolder) {
      try {
        const response = await fetch("/api/save-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPath: targetFolder,
            notes: notesToDownload
          })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          if (data.folderPath) setLastSavedFolderPath(data.folderPath);
          setSaveStatus({ success: true, message: data.message });
          setTimeout(() => setSaveStatus(null), 8000);
          return; // Direct save succeeded - do NOT trigger secondary browser downloads!
        }
      } catch (err) {
        console.warn("Direct file save error, falling back to browser download:", err);
      }
    }

    // Fallback ONLY: Trigger browser file downloads if direct server save is unavailable
    notesToDownload.forEach(note => {
      const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", note.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    setSaveStatus({
      success: true,
      message: `Downloaded ${notesToDownload.length} file(s) to your default browser downloads folder.`
    });
    setTimeout(() => setSaveStatus(null), 8000);
  };

  // Construct Obsidian local URI protocol for a specific note
  const getObsidianUri = (note: ParsedNote) => {
    const encodedName = encodeURIComponent(note.title);
    const encodedContent = encodeURIComponent(note.content);
    const encodedVault = encodeURIComponent(vaultName.trim());
    return `obsidian://new?vault=${encodedVault}&name=${encodedName}&content=${encodedContent}`;
  };

  // Helper to parse Wikilinks and render them with glowing effects in UI cards
  const renderWikilinksText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\[\[.*?\]\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const linkLabel = part.substring(2, part.length - 2);
        return (
          <span 
            key={i} 
            className="text-indigo-400 font-semibold border-b border-indigo-500/20 px-0.5 hover:bg-indigo-500/10 hover:text-indigo-300 rounded cursor-pointer transition-colors"
            title={`Create Note Link: ${linkLabel}`}
            onClick={() => {
              const targetNote: ParsedNote = {
                title: linkLabel,
                fileName: `${linkLabel}.md`,
                content: `---\ntags: [placeholder]\nsource: Referencing BigBadAtomicNotes\ndate: ${new Date().toISOString().split('T')[0]}\n---\n# ${linkLabel}\n\nThis note is created as a placeholder link from [[${currentTitle || "Synthesis"}]]`,
                frontmatter: { aliases: "", tags: "placeholder", source: currentTitle, date: new Date().toISOString().split("T")[0] }
              };
              window.open(getObsidianUri(targetNote));
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Helper to highlight markdown for beautiful display
  const highlightMarkdown = (text: string, currentNoteTitle: string) => {
    if (!text) return "";
    const lines = text.split(/\r?\n/);
    let inFrontmatter = false;

    return lines.map((line, idx) => {
      // Detect frontmatter boundaries
      if (idx === 0 && line.trim() === "---") {
        inFrontmatter = true;
        return <div key={idx} className="text-[#586069] font-semibold select-text">---</div>;
      }
      if (inFrontmatter && line.trim() === "---") {
        inFrontmatter = false;
        return <div key={idx} className="text-[#586069] font-semibold select-text">---</div>;
      }

      // Frontmatter fields
      if (inFrontmatter) {
        const match = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);
        if (match) {
          return (
            <div key={idx} className="select-text">
              <span className="text-[#6f42c1] font-medium">{match[1]}:</span>
              <span className="text-[#032f62] dark:text-[#9ecbff]">{match[2]}</span>
            </div>
          );
        }
        return <div key={idx} className="text-[#032f62] dark:text-[#9ecbff] select-text">{line}</div>;
      }

      // Markdown Headers
      if (line.startsWith("# ")) {
        return (
          <div key={idx} className="text-white font-bold text-sm md:text-base mt-2 mb-1 select-text">
            <span className="text-[#d73a49]">#</span> {line.substring(2)}
          </div>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <div key={idx} className="text-white font-semibold text-xs md:text-sm mt-2 mb-1 select-text">
            <span className="text-[#d73a49]">##</span> {line.substring(3)}
          </div>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <div key={idx} className="text-[#e1e4e8] font-semibold text-xs mt-2 mb-1 select-text">
            <span className="text-[#d73a49]">###</span> {line.substring(4)}
          </div>
        );
      }

      // Blockquote
      if (line.trim().startsWith(">")) {
        return (
          <div key={idx} className="border-l-2 border-indigo-500/40 pl-3 py-0.5 my-1 text-gray-400 italic bg-[#ffffff]/5 select-text">
            {line}
          </div>
        );
      }

      // List items & Wikilinks inside line
      const parts = line.split(/(\[\[.*?\]\])/g);
      const renderedLine = parts.map((part, pIdx) => {
        if (part.startsWith("[[") && part.endsWith("]]")) {
          const linkStr = part.replace(/^\[\[|\]\]$/g, "").trim();
          return (
            <span 
              key={pIdx} 
              onClick={() => {
                const tNote: ParsedNote = {
                  title: linkStr,
                  fileName: `${linkStr}.md`,
                  content: `---\ntags: [placeholder]\nsource: Referencing BigBadAtomicNotes\ndate: ${new Date().toISOString().split('T')[0]}\n---\n# ${linkStr}\n\nPlaceholder generated for relation from [[${currentNoteTitle}]]`,
                  frontmatter: { aliases: "", tags: "placeholder", source: currentNoteTitle, date: new Date().toISOString().split("T")[0] }
                };
                window.open(getObsidianUri(tNote));
              }}
              className="text-[#79b8ff] hover:text-[#c8e1ff] font-semibold border-b border-indigo-500/30 cursor-pointer transition-colors"
            >
              {part}
            </span>
          );
        }
        return part;
      });

      return (
        <div key={idx} className="text-[#e1e4e8] min-h-[1.2rem] select-text">
          {renderedLine}
        </div>
      );
    });
  };

  // Shared history content rendering block to avoid duplicating code
  const renderHistoryContent = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <button 
        onClick={startNewSession}
        className="w-full py-3 px-4 mb-6 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 min-h-[44px]"
      >
        <Plus size={14} />
        New Synthesis
      </button>

      <div className="flex items-center justify-between mb-3">
        <span className="uppercase text-[10px] font-bold tracking-[0.2em] text-gray-500">
          Recent Syntheses
        </span>
        {history.length > 0 && (
          <button 
            onClick={clearAllHistory}
            className="text-gray-500 hover:text-red-400 p-2 transition-colors"
            title="Clear history"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* History list container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {history.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-white/5 rounded-lg bg-white/2">
            <History size={24} className="mx-auto text-gray-600 mb-2 opacity-55" />
            <p className="text-[11px] text-gray-500 leading-normal">
              No generated notes found in cache. Once you synthesize, they will appear here.
            </p>
          </div>
        ) : (
          history.map((item) => (
            <div 
              key={item.id}
              onClick={() => loadHistoryItem(item)}
              className={`group p-3 rounded-lg border text-left cursor-pointer transition-all relative ${
                rawMarkdown === item.rawMarkdown 
                  ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm shadow-indigo-950/20' 
                  : 'border-white/5 bg-[#16181f]/40 hover:bg-[#16181f]/80 hover:border-white/10'
              }`}
            >
              <div className="flex justify-between items-start">
                <p className={`text-xs font-semibold truncate pr-6 ${
                  rawMarkdown === item.rawMarkdown ? 'text-indigo-200' : 'text-gray-300'
                }`}>
                  {item.title}
                </p>
                <button 
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="opacity-100 md:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-2 absolute right-1.5 top-1"
                  title="Delete from cache"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-500">{item.notes.length} atomic notes</span>
                <span className="text-[9px] text-gray-600 font-mono">{item.timestamp.split(' • ')[0]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div id="atomic-notes-root" className="flex flex-col h-screen w-full bg-[#0d0e12] text-gray-200 font-sans overflow-hidden">
      <input 
        ref={fileInputRef} 
        type="file" 
        // @ts-ignore
        webkitdirectory="true" 
        directory="true" 
        multiple 
        className="hidden" 
        onChange={handleFolderInputChange} 
      />
      
      {/* Navigation bar with mobile hamburger & tabs */}
      <nav id="atomic-notes-nav" className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/10 bg-[#12141a] z-30">
        <div className="flex items-center gap-2.5 md:gap-3">
          {/* Mobile Hamburg menu button */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Open History"
          >
            <Menu size={20} />
          </button>

          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-indigo-500/20 shrink-0">
            Ω
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              BigBadAtomicNotes
              <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest hidden sm:inline-block">
                v1.1
              </span>
            </h1>
          </div>
        </div>

        {/* Mobile Tab switcher - Beautiful segmented pill */}
        <div className="md:hidden flex bg-[#0d0e12] rounded-lg p-0.5 border border-white/5 max-w-[150px]">
          <button 
            onClick={() => setMobileTab("input")}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-semibold ${
              mobileTab === "input" 
                ? 'bg-indigo-600 text-white shadow' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Input
          </button>
          <button 
            onClick={() => setMobileTab("output")}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-semibold relative ${
              mobileTab === "output" 
                ? 'bg-indigo-600 text-white shadow' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Output
            {parsedNotes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border border-[#0d0e12] rounded-full"></span>
            )}
          </button>
        </div>

        {/* Vault settings and indicators (Desktop view) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-xs font-medium text-indigo-300">BigBadAtomicNotes Mode</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Obsidian Vault:</span>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-gray-500">
                <Settings size={12} />
              </span>
              <input 
                type="text" 
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder="Obsidian Vault Name"
                className="bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 pl-7 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 w-36 font-mono"
                title="Target Vault Name in your Obsidian local application"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Save Folder:</span>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-gray-500">
                <Folder size={12} />
              </span>
              <input 
                type="text" 
                value={localFolderName}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalFolderName(val);
                  localStorage.setItem("atomic_notes_local_folder_name", val);
                  if (localDirectoryHandle && val !== localDirectoryHandle.name) {
                    setLocalDirectoryHandle(null);
                  }
                }}
                placeholder="Path to folder..."
                className="bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 pl-7 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 w-44 font-mono"
                title="Target Folder Path on your computer (e.g. /Users/name/Vault or relative folder path)"
              />
            </div>
            <button
              type="button"
              onClick={handleSelectFolder}
              className="p-1.5 bg-[#0d0e12] hover:bg-white/5 border border-white/10 rounded text-xs text-indigo-300 transition-colors cursor-pointer flex items-center justify-center min-h-[30px]"
              title="Browse directory"
            >
              <Folder size={12} />
            </button>
          </div>

          <GoogleAuth user={googleUser} onSignIn={handleGoogleSignIn} onSignOut={handleGoogleSignOut} buttonId="nav-google-signin" compact />
        </div>
      </nav>

      {/* Main Framework body */}
      <div id="atomic-notes-container" className="flex flex-1 overflow-hidden relative">
        
        {/* Permanent Sidebar (Desktop view only) */}
        <aside id="atomic-notes-sidebar" className="hidden md:flex w-72 bg-[#12141a] border-r border-white/10 p-5 flex-col justify-between shrink-0">
          {renderHistoryContent()}
          
          {/* Quick Informational Bottom Section */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-white/5">
            <div className="flex gap-2 items-start">
              <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-200/85 leading-relaxed">
                Atomic notes are split using Obsidian-compatible code blocks. You can automatically push them directly to Obsidian using custom URIs.
              </p>
            </div>
          </div>
        </aside>

        {/* Slide-over Drawer (Mobile view only) */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            
            {/* Drawer container */}
            <div className="relative flex flex-col w-72 max-w-[80vw] h-full bg-[#12141a] border-r border-white/10 p-5 z-50 animate-slide-in">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Vault Archives</span>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/10 rounded-md min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>

              {renderHistoryContent()}

              <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                    Obsidian Vault Configuration:
                  </label>
                  <input 
                    type="text" 
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    placeholder="Vault Name"
                    className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                    Local Output Folder:
                  </label>
                  <div className="flex gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={handleSelectFolder}
                      className="flex-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[32px] cursor-pointer"
                    >
                      <Folder size={12} />
                      {localDirectoryHandle ? "Folder Linked ✓" : "Browse Folder"}
                    </button>
                    {localFolderName && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalDirectoryHandle(null);
                          setLocalFolderName("");
                          localStorage.removeItem("atomic_notes_local_folder_name");
                        }}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-1.5 rounded transition-colors cursor-pointer"
                        title="Clear Folder Selection"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={localFolderName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalFolderName(val);
                      localStorage.setItem("atomic_notes_local_folder_name", val);
                      if (localDirectoryHandle && val !== localDirectoryHandle.name) {
                        setLocalDirectoryHandle(null);
                      }
                    }}
                    placeholder="E.g. ObsidianVault/Notes"
                    className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-mono mb-1.5"
                  />

                  {folderErrorMsg && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded leading-normal flex items-start gap-1.5 mb-1.5 animate-fade-in">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>{folderErrorMsg}</span>
                    </div>
                  )}

                  <span className="text-[9px] text-gray-500 block leading-normal">
                    {localDirectoryHandle 
                      ? "✓ Browser API connected directly to local folder." 
                      : "Type your folder name above. Note: Directory browser is restricted inside iframe. We fallback to downloading files directly to your default browser downloads folder."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content body split into panels */}
        <main className="flex-1 flex overflow-hidden w-full relative">
          
          {/* LEFT MAIN PANEL: Ingestion Inputs */}
          <section className={`absolute inset-0 md:relative md:inset-auto w-full md:w-1/2 flex flex-col p-4 md:p-6 bg-[#16181f] border-r border-white/5 overflow-y-auto transition-transform duration-300 ${
            mobileTab === "input" ? "translate-x-0 z-10" : "translate-x-full md:translate-x-0 z-0"
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base md:text-lg font-medium text-white flex items-center gap-2">
                <Cpu size={16} className="text-indigo-400" />
                Source Ingestion
              </h2>
              <div className="flex bg-[#0d0e12] rounded-lg p-0.5 border border-white/5">
                <button 
                  type="button"
                  onClick={() => setIngestionMode("url")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 font-semibold min-h-[32px] ${
                    ingestionMode === "url" 
                      ? 'bg-indigo-600 text-white shadow' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Link2 size={12} />
                  Fetch URL
                </button>
                <button 
                  type="button"
                  onClick={() => setIngestionMode("text")}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 font-semibold min-h-[32px] ${
                    ingestionMode === "text" 
                      ? 'bg-indigo-600 text-white shadow' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText size={12} />
                  Paste Text
                </button>
              </div>
            </div>

            <form onSubmit={handleSynthesize} className="flex-1 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                {ingestionMode === "url" ? (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider flex flex-wrap items-center gap-1">
                      Source Web URL
                      <span className="text-[10px] text-indigo-400 font-normal normal-case ml-1">(We scrape & clean the article)</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="url" 
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://medium.com/pkm/atomic-notes-guide..." 
                        className="w-full bg-[#12141e] border border-indigo-500/60 rounded-lg p-3 pl-10 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-400 font-sans min-h-[44px] shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                      />
                      <span className="absolute left-3.5 top-3.5 text-indigo-400">
                        <Link2 size={16} />
                      </span>
                    </div>
                    <div className="mt-3 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-200/90 leading-relaxed">
                      💡 <strong>Note:</strong> Works on standard public web pages. For custom transcripts, paywalled pages, or PDFs, paste the plain text directly via <strong>Paste Text</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider flex justify-between">
                      <span>Raw Text Content</span>
                      <span className="text-gray-500 text-[10px] lowercase font-normal">{rawText.length} characters</span>
                    </label>
                    <textarea 
                      value={rawText}
                      onChange={handleTextChange}
                      className="bg-[#12141e] border border-indigo-500/60 rounded-lg p-3 md:p-4 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all h-[280px] md:h-[350px] resize-none leading-relaxed placeholder:text-gray-400 font-sans custom-scrollbar shadow-[0_0_15px_rgba(99,102,241,0.05)]" 
                      placeholder="Paste your source text, transcript, notes, or raw article contents here..."
                    />
                  </div>
                )}

                {/* Dynamic AI Model Selector */}
                <div className="bg-[#12141a]/60 border border-white/5 rounded-xl p-4 mt-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles size={12} className="text-indigo-400" />
                      AI Synthesis Engine
                    </label>
                    <span className="text-[9px] text-gray-500 bg-[#0d0e12] px-2 py-0.5 rounded border border-white/5 font-mono">
                      {MODELS.find(m => m.id === selectedModel)?.name}
                    </span>
                  </div>

                  {!showSettings ? (
                    <button
                      type="button"
                      onClick={() => setShowSettings(true)}
                      className="w-full mt-2 py-2.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Settings size={12} />
                      Settings
                    </button>
                  ) : (
                    <div className="animate-fade-in space-y-3 mt-3">
                      <div className="grid grid-cols-1 gap-2">
                        {MODELS.map((model) => {
                          const isSelected = selectedModel === model.id;
                          const requiresAuth = model.requiresGoogleAuth && !googleUser;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                setSelectedModel(model.id);
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-all relative flex flex-col gap-1 cursor-pointer select-none ${
                                isSelected 
                                  ? 'bg-indigo-600/10 border-indigo-500/40 shadow-inner' 
                                  : 'bg-[#0d0e12] border-white/5 hover:border-white/10 hover:bg-[#0d0e12]/80'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={`text-xs font-semibold flex items-center gap-1.5 ${isSelected ? 'text-indigo-200 font-bold' : 'text-gray-300'}`}>
                                  {model.requiresGoogleAuth && (
                                    googleUser ? (
                                      <ShieldCheck size={12} className="text-emerald-400 shrink-0" title="Unlocked with Google Account" />
                                    ) : (
                                      <Lock size={12} className="text-amber-400 shrink-0" title="Google Sign-In Required" />
                                    )
                                  )}
                                  {model.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  {requiresAuth && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Sign-In Req.
                                    </span>
                                  )}
                                  {model.badge && (
                                    <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                      isSelected 
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                        : model.isPaid
                                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          : 'bg-gray-800 text-gray-400'
                                    }`}>
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-500 leading-normal">
                                {model.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedModel === "byok" && (
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3.5 animate-fade-in">
                          <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                            BYOK Configuration
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                                Base URL:
                              </label>
                              <input 
                                type="url" 
                                value={byokBaseUrl}
                                onChange={(e) => {
                                  setByokBaseUrl(e.target.value);
                                  setByokTestStatus("idle");
                                }}
                                placeholder="e.g. https://api.openai.com/v1"
                                className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                                API Key:
                              </label>
                              <input 
                                type="password" 
                                value={byokApiKey}
                                onChange={(e) => {
                                  setByokApiKey(e.target.value);
                                  setByokTestStatus("idle");
                                }}
                                placeholder="sk-..."
                                className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                                Model:
                              </label>
                              <input 
                                type="text" 
                                value={byokModel}
                                onChange={(e) => {
                                  setByokModel(e.target.value);
                                  setByokTestStatus("idle");
                                }}
                                placeholder="e.g. gpt-4o"
                                className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>

                          <div className="pt-1.5 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={handleTestBYOKConnection}
                              disabled={byokTestStatus === "testing"}
                              className={`w-full py-2 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[32px] cursor-pointer ${
                                byokTestStatus === "testing"
                                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 cursor-not-allowed"
                                  : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30"
                              }`}
                            >
                              {byokTestStatus === "testing" ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  Testing Connection...
                                </>
                              ) : (
                                "Test Connection"
                              )}
                            </button>

                            {byokTestStatus === "success" && (
                              <div className="flex items-center gap-2 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs animate-fade-in">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                                <span className="font-medium">Connection works!</span>
                              </div>
                            )}

                            {byokTestStatus === "error" && byokTestError && (
                              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-normal space-y-1 animate-fade-in">
                                <div className="font-bold flex items-center gap-1">
                                  ⚠️ Connection Failed
                                </div>
                                <div className="text-[11px] font-mono break-words">
                                  {byokTestError}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="w-full mt-2 py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        Hide Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-300 leading-normal my-1">
                  ⚠️ {error}
                </div>
              )}

              {selectedModelObj.requiresGoogleAuth && !googleUser && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3 text-left my-2 shadow-lg shadow-indigo-950/30">
                  <div className="flex items-center gap-2 text-indigo-200 font-bold text-xs">
                    <Lock size={15} className="text-amber-400 shrink-0" />
                    <span>Google Account Sign-In Required</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Gemini models (<strong className="text-white">{selectedModelObj.name}</strong>) are exclusively available when signed in to your Google Account.
                  </p>
                  <div className="pt-1 flex items-center justify-start">
                    <GoogleAuth user={googleUser} onSignIn={handleGoogleSignIn} onSignOut={handleGoogleSignOut} buttonId="form-google-signin" />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || (selectedModelObj.requiresGoogleAuth && !googleUser)}
                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2.5 tracking-wide text-sm min-h-[48px] ${
                  loading 
                    ? "bg-indigo-800/50 cursor-not-allowed text-indigo-400" 
                    : selectedModelObj.requiresGoogleAuth && !googleUser
                      ? "bg-gray-800/80 text-gray-400 border border-white/5 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] hover:shadow-indigo-900/30 cursor-pointer"
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin text-indigo-400" size={18} />
                    <span>{loadingStep || "Synthesizing..."}</span>
                  </>
                ) : selectedModelObj.requiresGoogleAuth && !googleUser ? (
                  <>
                    <Lock size={16} className="text-amber-400" />
                    <span>Sign in with Google to Synthesize</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="text-indigo-200 animate-pulse" size={18} />
                    <span>Synthesize Atomic Notes</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* RIGHT MAIN PANEL: Output previews */}
          <section className={`absolute inset-0 md:relative md:inset-auto w-full md:w-1/2 flex flex-col p-4 md:p-6 bg-[#0d0e12] overflow-hidden transition-transform duration-300 ${
            mobileTab === "output" ? "translate-x-0 z-10" : "translate-x-full md:translate-x-0 z-0"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 border-b border-white/5 pb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base md:text-lg font-medium text-white flex items-center gap-1.5">
                  <Layers size={16} className="text-indigo-400" />
                  Output
                </h2>
                {parsedNotes.length > 0 && (
                  <>
                    <span className="text-[10px] md:text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {parsedNotes.length} Notes
                    </span>
                    <button 
                      onClick={startNewSession}
                      className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-400 border border-red-500/20 rounded text-[10px] font-bold transition-all ml-1 cursor-pointer min-h-[24px]"
                      title="Clear active output and start a new synthesis"
                    >
                      <Plus size={11} />
                      New Synthesis
                    </button>
                  </>
                )}
              </div>

              {/* Subtab selection views */}

            </div>

            {/* Inactive synthesis state placeholder */}
            {parsedNotes.length === 0 && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-2xl bg-[#12141a]/20">
                <div className="w-14 h-14 rounded-full bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-white mb-2">No Active Synthesis</h3>
                <p className="text-xs text-gray-500 max-w-sm leading-relaxed mb-5">
                  Provide a web URL or paste article text on the ingestion panel, then trigger synthesis to generate beautiful, Obsidian-compatible atomic cards.
                </p>
                <div className="flex gap-3 justify-center">
                  <button 
                    onClick={() => {
                      setIngestionMode("text");
                      setRawText(`# Sample Article: Cognitive Load Theory in Interface Design\n\nCognitive Load Theory (CLT), formulated by John Sweller in 1988, highlights the mental effort required to process information. Our working memory has extreme limitations: it can only process about 4 to 7 items concurrently. \n\nWhen designing interfaces, extraneous cognitive load (unnecessary design noise, confusing navigational structures, and poor text hierarchy) actively drains our mental capacity, leaving fewer cognitive resources for germane load (constructing schemas and understanding content). \n\nTo optimize user retention, software systems should minimize extraneous cognitive load by using standard design paradigms, generous whitespace, and contextual wiki-style [[Linkable Surfaces]].\n\nAnother fundamental principle is atomicity, particularly relevant in [[Knowledge Management]] workflows. By keeping information units minimal, we prevent overload and facilitate robust network connections.`);
                      setMobileTab("input");
                    }}
                    className="px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-semibold transition-all min-h-[40px] flex items-center"
                  >
                    Load Sample Text
                  </button>
                </div>
              </div>
            )}

            {/* Active Loading Pacing Screen */}
            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#12141a]/40 rounded-2xl border border-white/5">
                <div className="relative flex items-center justify-center mb-5">
                  <div className="absolute w-14 h-14 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                  <div className="absolute w-10 h-10 rounded-full border-2 border-purple-500/10 border-b-purple-500 animate-spin" style={{ animationDirection: 'reverse' }}></div>
                  <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                </div>
                <h3 className="text-xs md:text-sm font-semibold text-white tracking-wide">Deconstructing Material</h3>
                <p className="text-[11px] text-gray-400 mt-2 font-mono text-center max-w-xs leading-normal">
                  {loadingStep || "Initializing model query..."}
                </p>
              </div>
            )}

            {/* Render atomic notes outputs */}
            {parsedNotes.length > 0 && !loading && (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Global Batch control buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-[#12141a] p-3 rounded-lg border border-white/5 text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-400 flex items-center gap-1">
                      Export filepath: <strong className="text-indigo-300 font-mono">{lastSavedFolderPath || localFolderName || vaultName}</strong>
                    </span>

                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(rawMarkdown, "all")}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 font-bold transition-all min-h-[36px]"
                    >
                      {copiedAll ? <Check size={11} className="text-emerald-400" /> : <Clipboard size={11} />}
                      {copiedAll ? "Copied All!" : "Copy All"}
                    </button>
                    <button 
                      onClick={downloadAllAsFiles}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#16181f] hover:bg-[#1c1f28] text-gray-300 rounded border border-white/10 font-bold transition-all min-h-[36px]"
                      title="Download separate .md markdown files to your local files"
                    >
                      <Download size={11} />
                      Download Files
                    </button>
                  </div>
                </div>

                {/* Draft Status & Action Bar with Save and Cancel options */}
                <div className="bg-indigo-950/20 border border-indigo-500/20 p-3.5 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md shadow-indigo-950/5">
                  <div className="flex flex-col gap-0.5 text-center sm:text-left">
                    <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider flex items-center justify-center sm:justify-start gap-1">
                      <Sparkles size={11} className="animate-pulse" />
                      Active Synthesis Review Panel
                    </span>
                    <span className="text-xs text-gray-300">
                      Edit details below. Save writes notes to folder or auto-downloads.
                    </span>
                  </div>

                </div>

                {/* Save status message */}
                {saveStatus && (
                  <div className={`p-3 rounded-lg text-xs mb-4 border ${
                    saveStatus.success 
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                      : "bg-red-950/20 border-red-500/30 text-red-300"
                  } animate-fade-in`}>
                    {saveStatus.message}
                  </div>
                )}

                {/* Sub-tab views wrapper */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                  
                   {/* TAB 1: Visual Cards View */}
                   {activeTab === "cards" && (
                     <div className="space-y-4 pb-6">
                       {editableNotes.map((note, idx) => {
                         const currentMode = cardViewModes[idx] || globalCardView;

                         return (
                           <article 
                             key={idx} 
                             className="p-4 md:p-5 rounded-xl bg-[#12141a] border border-white/5 relative hover:border-white/10 transition-all flex flex-col shadow-lg"
                           >
                             {/* Note Header / Meta properties */}
                             <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                               <div className="flex flex-col min-w-0 flex-1 pr-2">
                                 <div className="flex flex-wrap items-center gap-2">
                                   <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold truncate">
                                     FILE: {note.fileName}
                                   </span>
                                   <button
                                     type="button"
                                     onClick={() => setCardViewModes(prev => ({
                                       ...prev,
                                       [idx]: currentMode === "markdown" ? "preview" : "markdown"
                                     }))}
                                     className="text-[9px] text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 px-1.5 py-0.5 rounded font-sans transition-colors"
                                     title="Toggle note display between styled markdown editor and visual HTML card preview"
                                   >
                                     Switch to {currentMode === "markdown" ? "Visual" : "Markdown"}
                                   </button>
                                 </div>
                                 {currentMode === "preview" && note.frontmatter.tags && (
                                   <div className="flex flex-wrap gap-1 mt-1">
                                     {note.frontmatter.tags.split(',').map((tag, tIdx) => (
                                       <span key={tIdx} className="text-[9px] bg-indigo-500/5 text-indigo-400 border border-indigo-500/15 px-1 py-0.5 rounded font-mono">
                                         #{tag.trim()}
                                       </span>
                                     ))}
                                   </div>
                                 )}
                               </div>
                               <div className="flex items-center gap-1.5 shrink-0">
                                 {/* Open local Obsidian URI direct link */}
                                 <a 
                                   href={getObsidianUri(note)}
                                   className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/25 text-[10px] font-bold transition-all min-h-[28px]"
                                   title="Create note instantly in Obsidian local vault"
                                 >
                                   <ExternalLink size={10} />
                                   Obsidian
                                 </a>
                                 {/* Copy Card icon button */}
                                 <button 
                                   onClick={() => copyToClipboard(note.content, idx)}
                                   className="p-1.5 bg-[#16181f] hover:bg-[#1c1f28] text-gray-400 hover:text-white rounded border border-white/5 transition-colors min-h-[28px]"
                                   title="Copy complete markdown note content"
                                 >
                                   {copiedNoteIndex === idx ? (
                                     <Check size={11} className="text-emerald-400" />
                                   ) : (
                                     <Clipboard size={11} />
                                   )}
                                 </button>
                                </div>
                              </div>

                              {/* CONDITIONAL RENDER: Raw highlighted Obsidian Markdown vs Visual Card Preview */}
                              {currentMode === "markdown" ? (
                                <div className="relative mt-1 space-y-3.5">
                                  {/* Note Title Input */}
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                      <FileText size={10} className="text-gray-500" />
                                      Note Title (Used for Filename)
                                    </label>
                                    <input 
                                      type="text"
                                      value={note.title}
                                      onChange={(e) => handleNoteTitleChange(idx, e.target.value)}
                                      className="w-full bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                                      placeholder="Note Title"
                                    />
                                  </div>

                                  {/* Note Content Textarea */}
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                      <FileCode size={10} className="text-gray-500" />
                                      Markdown Content
                                    </label>
                                    <textarea
                                      value={note.content}
                                      onChange={(e) => handleNoteContentChange(idx, e.target.value)}
                                      rows={8}
                                      className="w-full bg-[#0b0c10] border border-white/10 rounded-lg p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-y custom-scrollbar"
                                      placeholder="Markdown content..."
                                    />
                                  </div>

                                  <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 font-sans">
                                    <span>💡 Direct markdown text. Edit title or body to customize.</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(note.content, idx)}
                                      className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors flex items-center gap-1"
                                    >
                                      <Clipboard size={10} />
                                      {copiedNoteIndex === idx ? "✓ Copied!" : "Copy Note Markdown"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Declarative Title */}
                                  <h3 className="text-sm md:text-base font-bold text-white mb-2 leading-snug">
                                    {note.title}
                                  </h3>

                                  {/* Body Content with Wikilinks */}
                                  <div className="text-xs text-gray-300 leading-relaxed font-sans space-y-2 mb-3">
                                    {note.content.split(/\r?\n/).map((line, lIdx) => {
                                      // Filter out raw frontmatter elements from direct body render
                                      if (line.startsWith("---") || line.startsWith("aliases:") || line.startsWith("tags:") || line.startsWith("source:") || line.startsWith("date:")) {
                                        return null;
                                      }
                                      // Hide main title since we render it cleanly as h3
                                      if (line.startsWith("# ")) {
                                        return null;
                                      }
                                      // Hide headers & listings since we parse and render them in dedicated compartments
                                      if (line.startsWith(">") || line.startsWith("## Context") || line.startsWith("## Related")) {
                                        return null;
                                      }
                                      if (line.startsWith("- [[") || line.startsWith("-  [[")) {
                                        return null;
                                      }
                                      
                                      return line.trim() ? (
                                        <p key={lIdx}>
                                          {renderWikilinksText(line)}
                                        </p>
                                      ) : null;
                                    })}
                                  </div>

                                  {/* Blockquote element */}
                                  {note.content.includes(">") && (
                                    <div className="border-l-2 border-indigo-500/40 pl-3 py-1 text-gray-400 text-[11px] md:text-xs italic mb-3 bg-white/1 rounded-r">
                                      {note.content.split(/\r?\n/).map((line, lIdx) => {
                                        if (line.startsWith(">")) {
                                          return (
                                            <span key={lIdx}>
                                              {line.replace(/^>\s*['"]?|['"]?$/g, "").trim()}
                                            </span>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}

                                  {/* Context / Practical application box */}
                                  {note.content.includes("## Context") && (
                                    <div className="bg-white/1 p-3 rounded-lg border border-white/5 text-[11px] md:text-xs mb-3">
                                      <h4 className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                                        Context / Application
                                      </h4>
                                      <p className="text-gray-300 leading-relaxed font-sans">
                                        {note.content.split("## Context / Application")[1]?.split("## Related")[0]?.trim()}
                                      </p>
                                    </div>
                                  )}

                                  {/* Related links list */}
                                  <div className="mt-2 border-t border-white/5 pt-2">
                                    <span className="text-[9px] uppercase font-semibold text-gray-500 tracking-wider">
                                      Related Connections
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {note.content.split("## Related")[1]?.split("\n").map((line, lIdx) => {
                                        if (line.trim().startsWith("- [[") || line.trim().startsWith("-  [[")) {
                                          const linkStr = line.replace(/^-\s*\[\[|\]\]$/g, "").trim();
                                          return (
                                            <span 
                                              key={lIdx} 
                                              onClick={() => {
                                                const tNote: ParsedNote = {
                                                  title: linkStr,
                                                  fileName: `${linkStr}.md`,
                                                  content: `---\ntags: [placeholder]\nsource: Referencing BigBadAtomicNotes\ndate: ${new Date().toISOString().split('T')[0]}\n---\n# ${linkStr}\n\nPlaceholder generated for relation from [[${note.title}]]`,
                                                  frontmatter: { aliases: "", tags: "placeholder", source: note.title, date: new Date().toISOString().split("T")[0] }
                                                };
                                                window.open(getObsidianUri(tNote));
                                              }}
                                              className="text-[10px] md:text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/15 border border-indigo-500/10 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                                            >
                                              [[{linkStr}]]
                                            </span>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}

                            </article>
                          );
                        })}
                     </div>
                   )}

                  {/* TAB 2: Raw Code block Markdown View */}
                  {activeTab === "raw" && (
                    <div className="space-y-4 pb-6 font-mono text-[11px] text-gray-300">
                      <div className="bg-[#12141a] p-3 md:p-4 rounded-xl border border-white/5 relative">
                        <pre className="whitespace-pre-wrap select-all leading-relaxed custom-scrollbar">
                          {rawMarkdown}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Obsidian Setup & Clipper Guide */}
                  {activeTab === "help" && (
                    <div className="space-y-4 pb-6 text-xs text-gray-300 leading-relaxed bg-[#12141a]/50 p-4 rounded-xl border border-white/5">
                      <h3 className="text-sm font-semibold text-white mb-2">How to Use Your Atomic Notes</h3>
                      
                      <div className="space-y-3">
                        <div className="p-3 bg-white/2 rounded-lg border border-white/5">
                          <h4 className="font-bold text-indigo-400 flex items-center gap-1 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            Method 1: Direct Obsidian URI Link (Fastest)
                          </h4>
                          <p className="text-gray-400">
                            Configure your local vault name in the top-right text field (or in the drawer menu). Click the green <strong>"Obsidian"</strong> button on any card. Your browser will trigger Obsidian to automatically create a new note with all tags and frontmatter preconfigured!
                          </p>
                        </div>

                        <div className="p-3 bg-white/2 rounded-lg border border-white/5">
                          <h4 className="font-bold text-indigo-400 flex items-center gap-1 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                            Method 2: Multi-file Download
                          </h4>
                          <p className="text-gray-400">
                            Click <strong>"Download Files"</strong> in the Output header. Your browser will download a clean `.md` file for every single atomic concept note so you can drag-and-drop them into your vault.
                          </p>
                        </div>

                        <div className="p-3 bg-white/2 rounded-lg border border-white/5">
                          <h4 className="font-bold text-indigo-400 flex items-center gap-1 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            Method 3: Obsidian Web Clipper Compatibility
                          </h4>
                          <p className="text-gray-400">
                            Navigate to the <strong>"Raw"</strong> tab. The Obsidian Web Clipper extension can automatically scrape this formatted page, or you can click <strong>"Copy All"</strong> to save the entire BigBadAtomicNotes markdown structure to your clipboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </section>

        </main>
      </div>

      {/* Bottom informational footer bar */}
      <footer id="atomic-notes-footer" className="py-2.5 px-4 md:px-6 bg-[#0d0e12] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[9px] md:text-[10px] text-gray-500 gap-1.5 shrink-0 z-30">
        <div className="flex gap-4 uppercase tracking-widest font-semibold font-mono">
          <span>Model: Gemini 3.5 Flash</span>
          <span>Context: 1M Tokens</span>
        </div>
        <div className="font-mono text-center sm:text-right">
          Ready for ingestion. Integrated with Obsidian URI.
        </div>
      </footer>

      {showCancelConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shrink-0">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Are you sure?</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                This will discard all the generated atomic notes from this session and return you to the home screen. This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={handleCancelConfirmYes}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[38px] border-none"
                >
                  Yes, Discard
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirmNo}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-gray-300 border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[38px]"
                >
                  No, Keep Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
