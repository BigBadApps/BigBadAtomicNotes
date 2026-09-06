import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Folder, 
  AlertCircle, 
  Lock, 
  ShieldCheck, 
  Menu, 
  X, 
  ChevronDown, 
  FolderCheck,
  RefreshCw,
  LogIn
} from "lucide-react";
import { parseMarkdownNotes, filterOutIndexNotes, ParsedNote } from "./types";
import { GoogleAuth, GoogleUser, promptGoogleSignIn, GOOGLE_CLIENT_ID } from "./GoogleAuth";
import { getStoredDirectoryHandle, storeDirectoryHandle } from "./idb";

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
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    badge: "Flagship",
    desc: "Fastest next-gen flagship with high-density reasoning",
    requiresGoogleAuth: true,
    isPaid: false
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    badge: "Versatile",
    desc: "Speed-optimized synthesis with rich context",
    requiresGoogleAuth: true,
    isPaid: false
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    badge: "Pro Preview",
    desc: "Deep analytical synthesis for complex documents",
    requiresGoogleAuth: true,
    isPaid: true
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    badge: "Ultra Fast",
    desc: "Lowest latency lightweight atomic extraction",
    requiresGoogleAuth: true,
    isPaid: false
  },
  {
    id: "byok",
    name: "Custom OpenAI Provider (BYOK)",
    badge: "BYOK",
    desc: "Connect your custom OpenAI-compatible endpoint",
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

  const systemInstruction = `You are an expert knowledge manager. Analyze the provided text and distill its core ideas into single-concept atomic notes in Markdown format separated by thematic dividers (---). Ensure each note begins with YAML frontmatter, and all notes are tagged with atomicnote in the frontmatter tags list (e.g. tags: [atomicnote, ...]).`;

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

  const handleGoogleSignIn = useCallback((user: GoogleUser) => {
    setGoogleUser(user);
    localStorage.setItem("atomic_notes_google_user", JSON.stringify(user));
  }, []);

  const handleGoogleSignOut = useCallback(() => {
    setGoogleUser(null);
    localStorage.removeItem("atomic_notes_google_user");
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
  }, []);

  // Restore Google Signon Prompt function when user is not already signed-on
  useEffect(() => {
    if (!googleUser) {
      promptGoogleSignIn(GOOGLE_CLIENT_ID, handleGoogleSignIn);
    }
  }, [googleUser, handleGoogleSignIn]);

  // Navigation & View tab states
  const [ingestionMode, setIngestionMode] = useState<"url" | "text">("url");
  const [mobileTab, setMobileTab] = useState<"input" | "output">("input");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Input states
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("atomic_notes_selected_model") || "gemini-3.8-flash";
  });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
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
  const [byokTestStatus, setByokTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [byokTestError, setByokTestError] = useState<string | null>(null);

  // Action/API states
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Sync editableNotes with parsedNotes when parsedNotes updates
  useEffect(() => {
    setEditableNotes(parsedNotes);
  }, [parsedNotes]);

  // Click outside to close model dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Restore directory handle from IndexedDB if available
  useEffect(() => {
    async function restoreDirectory() {
      if ((window as any).showDirectoryPicker) {
        try {
          const stored = await getStoredDirectoryHandle();
          if (stored) {
            setLocalDirectoryHandle(stored);
            setLocalFolderName(stored.name);
          }
        } catch (e) {
          console.warn("Failed to restore directory handle from IndexedDB:", e);
        }
      }
    }
    restoreDirectory();
  }, []);

  // Folder selection helper
  const handleSelectFolder = async () => {
    setFolderErrorMsg(null);
    if ((window as any).showDirectoryPicker) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        setLocalDirectoryHandle(handle);
        setLocalFolderName(handle.name);
        localStorage.setItem("atomic_notes_local_folder_name", handle.name);
        await storeDirectoryHandle(handle);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn("Directory picker error:", err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setFolderErrorMsg("Please type your target folder path directly.");
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

  const getFormattedDatePrefix = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    return `${yyyy}:${mm}:${dd}:${hh}`;
  };

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

  const handleCancelConfirmYes = () => {
    setParsedNotes([]);
    setEditableNotes([]);
    setRawMarkdown("");
    setShowCancelConfirmation(false);
    setMobileTab("input");
  };

  const handleSaveAllToLocalFolder = async () => {
    if (editableNotes.length === 0) return;

    const validNotes = filterOutIndexNotes(editableNotes);
    if (validNotes.length === 0) return;

    const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    let dirHandle = localDirectoryHandle;

    // 1. If we don't have an active directory handle, try to restore from IndexedDB
    if (!dirHandle && (window as any).showDirectoryPicker) {
      try {
        const stored = await getStoredDirectoryHandle();
        if (stored) {
          dirHandle = stored;
          setLocalDirectoryHandle(stored);
          setLocalFolderName(stored.name);
        }
      } catch (err) {
        console.warn("Error reading stored directory handle:", err);
      }
    }

    // 2. On remote hosts (Cloud Run / GitHub Pages), direct browser File System Access is required
    // If we still don't have a directory handle, prompt the user to choose their vault folder
    if (!dirHandle && !isLocalHost && (window as any).showDirectoryPicker) {
      try {
        dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
        setLocalDirectoryHandle(dirHandle);
        setLocalFolderName(dirHandle.name);
        localStorage.setItem("atomic_notes_local_folder_name", dirHandle.name);
        await storeDirectoryHandle(dirHandle);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // User cancelled the folder picker
        }
        console.warn("showDirectoryPicker failed or was rejected:", err);
      }
    }

    // Helper to record history after successful save
    const recordHistory = (notesToSave: ParsedNote[]) => {
      const timestampStr = `${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: notesToSave[0]?.title || "Saved Notes",
        timestamp: timestampStr,
        rawMarkdown: notesToSave.map(n => n.content).join("\n\n---\n\n"),
        notes: [...notesToSave],
        sourceInput: rawText || sourceUrl,
        isUrl: ingestionMode === "url"
      };

      setHistory(prev => {
        const updated = [newHistoryItem, ...prev.slice(0, 19)];
        localStorage.setItem("atomic_notes_history", JSON.stringify(updated));
        return updated;
      });

      setTimeout(() => setSaveStatus(null), 4000);
    };

    // 3. If we have a directory handle (in Brave/Chrome), check/request readwrite permission
    if (dirHandle) {
      try {
        let hasPermission = false;
        if ((dirHandle as any).queryPermission) {
          const status = await (dirHandle as any).queryPermission({ mode: "readwrite" });
          if (status === "granted") {
            hasPermission = true;
          } else if ((dirHandle as any).requestPermission) {
            const reqStatus = await (dirHandle as any).requestPermission({ mode: "readwrite" });
            hasPermission = reqStatus === "granted";
          }
        } else {
          hasPermission = true;
        }

        if (!hasPermission) {
          dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
          setLocalDirectoryHandle(dirHandle);
          setLocalFolderName(dirHandle.name);
          localStorage.setItem("atomic_notes_local_folder_name", dirHandle.name);
          await storeDirectoryHandle(dirHandle);
        }

        let savedCount = 0;
        for (const note of validNotes) {
          let baseName = note.fileName ? note.fileName.replace(/\.md$/i, "") : note.title;
          baseName = baseName.trim().replace(/[\\/:*?"<>|]/g, "").substring(0, 60).trim() || "Note";
          const fileName = `${baseName}.md`;

          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(note.content);
          await writable.close();
          savedCount++;
        }

        setSaveStatus({
          success: true,
          message: `Saved ${savedCount} file(s) directly to "${dirHandle.name}".`
        });

        recordHistory(validNotes);
        return;
      } catch (err: any) {
        console.error("File System Access API save error:", err);
        if (err.name === "AbortError") return;
      }
    }

    // 4. If running locally on localhost/127.0.0.1, the local Node.js server can write directly to disk
    if (isLocalHost) {
      const targetFolder = localFolderName || vaultName;
      if (targetFolder) {
        try {
          const response = await fetch("/api/save-files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetPath: targetFolder,
              notes: validNotes
            })
          });
          const data = await response.json();
          if (response.ok && data.success) {
            setSaveStatus({ success: true, message: data.message });
            recordHistory(validNotes);
            return;
          }
        } catch (err) {
          console.warn("Direct local server save error:", err);
        }
      }
    }

    // 5. Fallback if File System Access API is not supported (e.g. Safari / Firefox)
    let downloadedCount = 0;
    for (const note of validNotes) {
      let baseName = note.fileName ? note.fileName.replace(/\.md$/i, "") : note.title;
      baseName = baseName.trim().replace(/[\\/:*?"<>|]/g, "").substring(0, 60).trim() || "Note";
      const fileName = `${baseName}.md`;

      const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      downloadedCount++;
    }

    setSaveStatus({
      success: true,
      message: `Downloaded ${downloadedCount} file(s) to your Downloads folder.`
    });
    recordHistory(validNotes);
  };

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

  useEffect(() => {
    localStorage.setItem("obsidian_vault_name", vaultName);
  }, [vaultName]);

  useEffect(() => {
    localStorage.setItem("atomic_notes_selected_model", selectedModel);
  }, [selectedModel]);

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
      setByokTestError("All BYOK fields (Base URL, API Key, Model) are required.");
      return;
    }

    setByokTestStatus("testing");
    setByokTestError(null);

    try {
      const response = await fetch("/api/byok/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setByokTestError(err.message || "Network error. Verify server and URL.");
    }
  };

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
      setError(ingestionMode === "url" ? "Please enter a valid source URL." : "Please paste source text content.");
      setLoading(false);
      return;
    }

    if (ingestionMode === "url" && !input.startsWith("http://") && !input.startsWith("https://")) {
      setError("Please ensure URL begins with http:// or https://");
      setLoading(false);
      return;
    }

    const selectedModelObj = MODELS.find(m => m.id === selectedModel) || MODELS[0];
    if (selectedModelObj.requiresGoogleAuth && !googleUser) {
      setError("Google Sign-In is required to use Gemini models. Please sign in with your Google Account.");
      promptGoogleSignIn(GOOGLE_CLIENT_ID, handleGoogleSignIn);
      setLoading(false);
      setMobileTab("input");
      return;
    }

    if (selectedModel === "byok" && (!byokBaseUrl || !byokApiKey || !byokModel)) {
      setError("Please configure your Custom OpenAI Provider (BYOK) settings in Settings.");
      setLoading(false);
      setShowSettings(true);
      return;
    }

    setLoadingStep(ingestionMode === "url" ? "Fetching web article..." : "Analyzing source text...");
    setMobileTab("output");

    try {
      const activeModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];
      setTimeout(() => {
        setLoadingStep(`Synthesizing with ${activeModel.name}...`);
      }, 600);

      let generatedMarkdown = "";
      const isStaticHost = 
        window.location.hostname.includes("github.io") || 
        window.location.hostname.includes("pages.dev") || 
        window.location.protocol === "file:";

      if (isStaticHost) {
        if (selectedModel === "byok") {
          setLoadingStep("Calling Custom Provider from browser...");
          generatedMarkdown = await executeByokClientSynthesis(input, ingestionMode === "url", byokBaseUrl, byokApiKey, byokModel);
        } else {
          throw new Error("Static Host Mode: For Gemini models, run locally at http://localhost:3003 (npm run dev) or select BYOK.");
        }
      } else {
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

        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("application/json")) {
          const data = await response.json();
          generatedMarkdown = data.markdown;
        } else {
          if (selectedModel === "byok") {
            setLoadingStep("Calling Custom Provider from browser...");
            generatedMarkdown = await executeByokClientSynthesis(input, ingestionMode === "url", byokBaseUrl, byokApiKey, byokModel);
          } else {
            throw new Error("Backend API returned an invalid response. Ensure local server is running.");
          }
        }
      }

      const notes = parseMarkdownNotes(generatedMarkdown);
      const cleanRawMarkdown = notes.length > 0
        ? notes.map(n => n.content).join("\n\n---\n\n")
        : generatedMarkdown.replace(/^```(?:markdown)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

      setRawMarkdown(cleanRawMarkdown);
      setParsedNotes(notes);

      let displayTitle = "Text Synthesis";
      if (ingestionMode === "url") {
        try {
          const urlObj = new URL(input);
          displayTitle = urlObj.hostname + urlObj.pathname.substring(0, 18);
        } catch (_) {
          displayTitle = "URL Synthesis";
        }
      } else {
        displayTitle = input.substring(0, 28).trim() + "...";
      }
      setCurrentTitle(displayTitle);

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: displayTitle,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " • " + new Date().toLocaleDateString(),
        rawMarkdown: cleanRawMarkdown,
        notes,
        sourceInput: input,
        isUrl: ingestionMode === "url"
      };

      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      localStorage.setItem("atomic_notes_history", JSON.stringify(updatedHistory));
    } catch (err: any) {
      setError(err.message || "Synthesis failed. Please check your network connection.");
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
    setMobileTab("output");
    setSidebarOpen(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("atomic_notes_history", JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    if (window.confirm("Clear all synthesis history?")) {
      setHistory([]);
      localStorage.removeItem("atomic_notes_history");
    }
  };

  const startNewSession = () => {
    setSourceUrl("");
    setRawText("");
    setRawMarkdown("");
    setParsedNotes([]);
    setCurrentTitle("");
    setError(null);
    setMobileTab("input");
    setSidebarOpen(false);
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
      message: `Downloaded ${notesToDownload.length} note files.`
    });
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const getObsidianUri = (note: ParsedNote) => {
    const encodedName = encodeURIComponent(note.title);
    const encodedContent = encodeURIComponent(note.content);
    const encodedVault = encodeURIComponent(vaultName.trim());
    return `obsidian://new?vault=${encodedVault}&name=${encodedName}&content=${encodedContent}`;
  };

  const renderWikilinksText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\[\[.*?\]\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const linkLabel = part.substring(2, part.length - 2);
        return (
          <span 
            key={i} 
            className="text-indigo-400 font-semibold px-0.5 rounded cursor-pointer hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
            title={`Create Note Link: ${linkLabel}`}
            onClick={() => {
              const targetNote: ParsedNote = {
                title: linkLabel,
                fileName: `${linkLabel}.md`,
                content: `---\ntags: [placeholder, atomicnote]\nsource: Referencing BigBadAtomicNotes\ndate: ${new Date().toISOString().split('T')[0]}\n---\n# ${linkLabel}\n\nPlaceholder generated for [[${currentTitle || "Synthesis"}]]`,
                frontmatter: { aliases: "", tags: "placeholder, atomicnote", source: currentTitle, date: new Date().toISOString().split("T")[0] }
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

  const renderHistoryList = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <button 
        onClick={startNewSession}
        className="w-full py-2.5 px-3 mb-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 btn-press"
      >
        <Plus size={14} />
        New Synthesis
      </button>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
          Recent Syntheses
        </span>
        {history.length > 0 && (
          <button 
            onClick={clearAllHistory}
            className="text-gray-500 hover:text-red-400 p-1 transition-colors btn-press"
            title="Clear history"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        {history.length === 0 ? (
          <div className="text-center py-6 px-3 border border-dashed border-white/5 rounded-lg">
            <History size={18} className="mx-auto text-gray-600 mb-1.5 opacity-60" />
            <p className="text-[11px] text-gray-500">No recent notes. Syntheses will appear here.</p>
          </div>
        ) : (
          history.map((item) => (
            <div 
              key={item.id}
              onClick={() => loadHistoryItem(item)}
              className={`group p-2.5 rounded-lg border text-left cursor-pointer transition-colors relative ${
                rawMarkdown === item.rawMarkdown 
                  ? 'bg-indigo-500/10 border-indigo-500/30' 
                  : 'border-white/5 bg-[#16181f]/40 hover:bg-[#16181f]/80'
              }`}
            >
              <div className="flex justify-between items-start">
                <p className={`text-xs font-medium truncate pr-6 ${
                  rawMarkdown === item.rawMarkdown ? 'text-indigo-200' : 'text-gray-300'
                }`}>
                  {item.title}
                </p>
                <button 
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 absolute right-1 top-1.5 transition-opacity"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                <span>{item.notes.length} notes</span>
                <span className="font-mono">{item.timestamp.split(' • ')[0]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div id="atomic-notes-root" className="flex flex-col h-screen w-full bg-[#0d0e12] text-gray-200 font-sans overflow-hidden antialiased selection:bg-indigo-500/30">
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

      {/* Top Navbar: Clean & Uncluttered */}
      <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-white/[0.08] bg-[#12141a]/95 backdrop-blur-sm z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 border border-white/10 btn-press"
            title="Open History"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0d0e12] border border-indigo-500/30 p-1 flex items-center justify-center shrink-0">
              <img src="./favicon.svg" alt="BigBadAtomicNotes" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">
                BigBadAtomicNotes
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Node :3003
              </span>
            </div>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="md:hidden flex bg-[#0d0e12] rounded-lg p-0.5 border border-white/10">
          <button 
            onClick={() => setMobileTab("input")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              mobileTab === "input" ? 'bg-indigo-600 text-white' : 'text-gray-400'
            }`}
          >
            Input
          </button>
          <button 
            onClick={() => setMobileTab("output")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors relative ${
              mobileTab === "output" ? 'bg-indigo-600 text-white' : 'text-gray-400'
            }`}
          >
            Output
            {parsedNotes.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-2.5">
          <GoogleAuth 
            user={googleUser} 
            onSignIn={handleGoogleSignIn} 
            onSignOut={handleGoogleSignOut} 
            buttonId="nav-google-signin" 
            compact 
          />

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 border border-white/10 btn-press transition-colors"
            title="Vault & Model Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Main App Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Desktop History Sidebar */}
        <aside className="hidden md:flex w-64 bg-[#12141a]/60 border-r border-white/[0.08] p-4 flex-col justify-between shrink-0">
          {renderHistoryList()}
          
          <div className="mt-3 pt-3 border-t border-white/[0.06] text-[10px] text-gray-500 flex items-center justify-between">
            <span>BigBadAtomicNotes</span>
            <span className="font-mono">{vaultName}</span>
          </div>
        </aside>

        {/* Mobile History Drawer */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div 
              className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative flex flex-col w-72 max-w-[85vw] h-full bg-[#12141a] border-r border-white/10 p-4 z-50 animate-drawer-in">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.08]">
                <span className="text-xs font-semibold text-white">Recent Sessions</span>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded btn-press"
                >
                  <X size={16} />
                </button>
              </div>
              {renderHistoryList()}
            </div>
          </div>
        )}

        {/* Workspace Panels */}
        <main className="flex-1 flex overflow-hidden w-full relative">
          
          {/* LEFT PANEL: Source Ingestion */}
          <section className={`absolute inset-0 md:relative md:inset-auto w-full md:w-1/2 flex flex-col p-5 md:p-6 bg-[#14161f] border-r border-white/[0.08] overflow-y-auto ${
            mobileTab === "input" ? "translate-x-0 z-10" : "translate-x-full md:translate-x-0 z-0"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu size={15} className="text-indigo-400" />
                Source Content
              </h2>
              
              {/* Segmented Mode Selector */}
              <div className="flex bg-[#0d0e12] rounded-lg p-0.5 border border-white/10 text-xs">
                <button 
                  type="button"
                  onClick={() => setIngestionMode("url")}
                  className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors btn-press ${
                    ingestionMode === "url" ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Link2 size={12} />
                  URL
                </button>
                <button 
                  type="button"
                  onClick={() => setIngestionMode("text")}
                  className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors btn-press ${
                    ingestionMode === "text" ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText size={12} />
                  Text
                </button>
              </div>
            </div>

            <form onSubmit={handleSynthesize} className="flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                {ingestionMode === "url" ? (
                  <div>
                    <label className="text-[11px] font-medium text-gray-400 mb-1.5 block">
                      Article or Page URL
                    </label>
                    <div className="relative">
                      <input 
                        type="url" 
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://example.com/article..." 
                        className="w-full bg-[#0d0e12] border border-white/10 rounded-lg p-3 pl-9 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans placeholder:text-gray-500"
                      />
                      <span className="absolute left-3 top-3.5 text-gray-500">
                        <Link2 size={14} />
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1.5 block">
                      Scrapes public web pages. For paywalled or PDF content, switch to Text mode.
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-medium text-gray-400">
                        Raw Article Text
                      </label>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {rawText.length} chars
                      </span>
                    </div>
                    <textarea 
                      value={rawText}
                      onChange={handleTextChange}
                      rows={12}
                      className="w-full bg-[#0d0e12] border border-white/10 rounded-lg p-3.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans leading-relaxed placeholder:text-gray-500 custom-scrollbar resize-y"
                      placeholder="Paste article text, notes, transcripts, or reference materials here..."
                    />
                  </div>
                )}

                {/* Streamlined Model Picker */}
                <div ref={modelPickerRef} className="relative">
                  <label className="text-[11px] font-medium text-gray-400 mb-1.5 flex items-center justify-between">
                    <span>AI Model</span>
                    {selectedModel === "byok" && (
                      <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Configure BYOK →
                      </button>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="w-full bg-[#0d0e12] border border-white/10 hover:border-white/20 rounded-lg p-2.5 text-left flex items-center justify-between btn-press"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-400" />
                      <span className="text-xs font-semibold text-white">
                        {selectedModelObj.name}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                        {selectedModelObj.badge}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {modelDropdownOpen && (
                    <div className="absolute bottom-full mb-1.5 left-0 right-0 bg-[#161822] border border-white/15 rounded-xl shadow-2xl p-1.5 space-y-1 z-40 animate-scale-in">
                      {MODELS.map((model) => {
                        const isSelected = selectedModel === model.id;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.id);
                              setModelDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors btn-press ${
                              isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-white/5 text-gray-300'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium">{model.name}</span>
                                <span className="text-[8px] uppercase tracking-wider bg-white/5 px-1 py-0.2 rounded text-gray-400">
                                  {model.badge}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-500">{model.desc}</span>
                            </div>
                            {isSelected && <Check size={14} className="text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs text-red-300 leading-normal flex items-start gap-2 animate-fade-in">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google Sign-in Prompt if Needed */}
              {selectedModelObj.requiresGoogleAuth && !googleUser && (
                <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-2.5 text-left animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-xs">
                      <Lock size={13} className="text-amber-400 shrink-0" />
                      <span>Google Sign-In Required</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => promptGoogleSignIn(GOOGLE_CLIENT_ID, handleGoogleSignIn, true)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      Show Prompt
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    To use {selectedModelObj.name}, sign in with your Google Account.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2.5">
                    <GoogleAuth 
                      user={googleUser} 
                      onSignIn={handleGoogleSignIn} 
                      onSignOut={handleGoogleSignOut} 
                      buttonId="form-google-signin" 
                    />
                    <button
                      type="button"
                      onClick={() => promptGoogleSignIn(GOOGLE_CLIENT_ID, handleGoogleSignIn, true)}
                      className="text-xs px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/30 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                    >
                      <LogIn size={13} />
                      <span>Sign In with Google</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Synthesize CTA */}
              {selectedModelObj.requiresGoogleAuth && !googleUser ? (
                <button 
                  type="button" 
                  onClick={() => promptGoogleSignIn(GOOGLE_CLIENT_ID, handleGoogleSignIn, true)}
                  className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 btn-press cursor-pointer shadow-lg shadow-indigo-950/30 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97]"
                >
                  <Lock size={14} className="text-amber-300" />
                  <span>Sign in with Google to Synthesize</span>
                </button>
              ) : (
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 btn-press cursor-pointer shadow-lg shadow-indigo-950/30 ${
                    loading 
                      ? "bg-indigo-800/40 text-indigo-300 cursor-not-allowed" 
                      : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97]"
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin text-indigo-300" size={15} />
                      <span>{loadingStep || "Synthesizing..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} className="text-indigo-200" />
                      <span>Synthesize Atomic Notes</span>
                    </>
                  )}
                </button>
              )}
            </form>
          </section>

          {/* RIGHT PANEL: Output & Previews */}
          <section className={`absolute inset-0 md:relative md:inset-auto w-full md:w-1/2 flex flex-col p-5 md:p-6 bg-[#0d0e12] overflow-hidden ${
            mobileTab === "output" ? "translate-x-0 z-10" : "translate-x-full md:translate-x-0 z-0"
          }`}>
            
            {/* Output Header Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">
                  Atomic Notes
                </h2>
                {parsedNotes.length > 0 && (
                  <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    {parsedNotes.length}
                  </span>
                )}
              </div>

              {parsedNotes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => copyToClipboard(rawMarkdown, "all")}
                    className="p-1.5 px-2 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-gray-300 rounded border border-white/10 flex items-center gap-1 btn-press"
                    title="Copy all markdown notes"
                  >
                    {copiedAll ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
                    <span className="hidden sm:inline">{copiedAll ? "Copied" : "Copy All"}</span>
                  </button>

                  <button 
                    onClick={handleSaveAllToLocalFolder}
                    className="p-1.5 px-2 text-[11px] font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded border border-indigo-500/30 flex items-center gap-1 btn-press"
                    title="Save to folder"
                  >
                    <FolderCheck size={12} />
                    <span className="hidden sm:inline">Save Vault</span>
                  </button>

                  <button 
                    onClick={downloadAllAsFiles}
                    className="p-1.5 px-2 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-gray-300 rounded border border-white/10 flex items-center gap-1 btn-press"
                    title="Download .md files"
                  >
                    <Download size={12} />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  <button 
                    onClick={() => setShowCancelConfirmation(true)}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-white/5 btn-press"
                    title="Clear Session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Save status notification */}
            {saveStatus && (
              <div className={`p-2.5 rounded-lg text-xs mb-3 flex items-center gap-2 animate-fade-in border ${
                saveStatus.success 
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" 
                  : "bg-red-950/20 border-red-500/30 text-red-300"
              }`}>
                {saveStatus.success ? <Check size={13} /> : <AlertCircle size={13} />}
                <span>{saveStatus.message}</span>
              </div>
            )}

            {/* Empty State */}
            {parsedNotes.length === 0 && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/[0.06] rounded-xl">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-xs font-semibold text-white mb-1">No Active Notes</h3>
                <p className="text-[11px] text-gray-500 max-w-xs mb-4">
                  Enter a URL or text to generate Obsidian-compatible atomic cards.
                </p>
                <button 
                  onClick={() => {
                    setIngestionMode("text");
                    setRawText(`# Cognitive Load Theory in User Experience\n\nCognitive Load Theory (CLT) shows that working memory is strictly limited: it holds only 4 to 7 discrete items at once.\n\nIn user interface design, extraneous cognitive load—such as arbitrary visual noise, cluttered navigation, and inconsistent hierarchy—drains mental resources away from primary tasks.\n\nBy following [[Atomic Knowledge]] principles, we deconstruct complex ideas into minimal, reusable components. Contextual [[Wikilinks]] connect these modules into an organic graph.`);
                    setMobileTab("input");
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-medium btn-press"
                >
                  Load Sample Text
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                <h3 className="text-xs font-semibold text-white">Synthesizing Notes</h3>
                <p className="text-[11px] text-gray-400 mt-1 font-mono">
                  {loadingStep || "Processing..."}
                </p>
              </div>
            )}

            {/* Populated Note Cards */}
            {parsedNotes.length > 0 && !loading && (
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
                {editableNotes.map((note, idx) => {
                  const mode = cardViewModes[idx] || "preview";

                  return (
                    <article 
                      key={idx} 
                      className="p-4 rounded-xl bg-[#12141a]/80 border border-white/[0.08] hover:border-white/15 transition-colors flex flex-col"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-gray-500 truncate">
                            {note.fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCardViewModes(prev => ({
                              ...prev,
                              [idx]: mode === "preview" ? "markdown" : "preview"
                            }))}
                            className="text-[9px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/15 font-medium btn-press"
                          >
                            {mode === "preview" ? "Edit Markdown" : "View Preview"}
                          </button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a 
                            href={getObsidianUri(note)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-semibold btn-press"
                            title="Open in Obsidian"
                          >
                            <ExternalLink size={10} />
                            Obsidian
                          </a>
                          <button 
                            onClick={() => copyToClipboard(note.content, idx)}
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 btn-press"
                            title="Copy Markdown"
                          >
                            {copiedNoteIndex === idx ? <Check size={11} className="text-emerald-400" /> : <Clipboard size={11} />}
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      {mode === "markdown" ? (
                        <div className="space-y-2 mt-1">
                          <input 
                            type="text"
                            value={note.title}
                            onChange={(e) => handleNoteTitleChange(idx, e.target.value)}
                            className="w-full bg-[#0d0e12] border border-white/10 rounded px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-indigo-500/80"
                            placeholder="Note Title"
                          />
                          <textarea
                            value={note.content}
                            onChange={(e) => handleNoteContentChange(idx, e.target.value)}
                            rows={7}
                            className="w-full bg-[#0d0e12] border border-white/10 rounded p-2.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-indigo-500/80 leading-relaxed resize-y custom-scrollbar"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h3 className="text-xs md:text-sm font-semibold text-white">
                            {note.title}
                          </h3>

                          <div className="text-xs text-gray-300 leading-relaxed space-y-1.5">
                            {note.content.split(/\r?\n/).map((line, lIdx) => {
                              if (line.startsWith("---") || line.startsWith("aliases:") || line.startsWith("tags:") || line.startsWith("source:") || line.startsWith("date:")) return null;
                              if (line.startsWith("# ") || line.startsWith(">") || line.startsWith("## Context") || line.startsWith("## Related") || line.startsWith("- [[")) return null;
                              return line.trim() ? (
                                <p key={lIdx}>{renderWikilinksText(line)}</p>
                              ) : null;
                            })}
                          </div>

                          {note.content.includes(">") && (
                            <div className="border-l-2 border-indigo-500/40 pl-2.5 py-0.5 text-gray-400 text-[11px] italic bg-white/[0.01] rounded-r">
                              {note.content.split(/\r?\n/).map((line, lIdx) => {
                                if (line.startsWith(">")) {
                                  return <span key={lIdx}>{line.replace(/^>\s*['"]?|['"]?$/g, "").trim()}</span>;
                                }
                                return null;
                              })}
                            </div>
                          )}

                          {note.content.includes("## Context") && (
                            <div className="bg-white/[0.02] p-2 rounded border border-white/[0.05] text-[11px]">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                                Application
                              </span>
                              <p className="text-gray-300">
                                {note.content.split("## Context / Application")[1]?.split("## Related")[0]?.trim()}
                              </p>
                            </div>
                          )}

                          {note.frontmatter.tags && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {note.frontmatter.tags.split(',').map((tag, tIdx) => (
                                <span key={tIdx} className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/15">
                                  #{tag.trim().replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

        </main>
      </div>

      {/* Settings Modal (Emil Kowalski Scale-In) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-[#161822] border border-white/15 rounded-2xl p-5 md:p-6 max-w-md w-full shadow-2xl z-50 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Application Settings</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 btn-press"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Obsidian Vault */}
              <div>
                <label className="text-[11px] font-medium text-gray-400 mb-1 block">
                  Target Obsidian Vault Name
                </label>
                <input 
                  type="text" 
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  placeholder="e.g. PersonalVault"
                  className="w-full bg-[#0d0e12] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Used by the "Obsidian" button to construct direct obsidian://new URLs.
                </span>
              </div>

              {/* Local Folder Path */}
              <div>
                <label className="text-[11px] font-medium text-gray-400 mb-1 block">
                  Local Save Folder
                </label>
                <div className="flex gap-2 mb-1.5">
                  <input 
                    type="text" 
                    value={localFolderName}
                    onChange={(e) => {
                      setLocalFolderName(e.target.value);
                      localStorage.setItem("atomic_notes_local_folder_name", e.target.value);
                    }}
                    placeholder="e.g. /Users/name/ObsidianVault/Notes"
                    className="flex-1 bg-[#0d0e12] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold btn-press flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Folder size={13} />
                    Browse
                  </button>
                </div>
                {folderErrorMsg && (
                  <span className="text-[10px] text-amber-400 block">{folderErrorMsg}</span>
                )}
                <span className="text-[10px] text-gray-500 block">
                  {localDirectoryHandle 
                    ? `Active vault folder: "${localDirectoryHandle.name}" (Direct local File System save)`
                    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                      ? "Server writes notes directly to this path when running locally."
                      : "Click 'Browse' to select your vault folder on your machine."}
                </span>
              </div>

              {/* BYOK Section */}
              <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                <span className="text-xs font-semibold text-white block">
                  Custom OpenAI Provider (BYOK)
                </span>
                <div>
                  <label className="text-[10px] font-medium text-gray-400 mb-1 block">
                    Base URL
                  </label>
                  <input 
                    type="url" 
                    value={byokBaseUrl}
                    onChange={(e) => setByokBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-[#0d0e12] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-400 mb-1 block">
                    API Key
                  </label>
                  <input 
                    type="password" 
                    value={byokApiKey}
                    onChange={(e) => setByokApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[#0d0e12] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-400 mb-1 block">
                    Model Name
                  </label>
                  <input 
                    type="text" 
                    value={byokModel}
                    onChange={(e) => setByokModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="w-full bg-[#0d0e12] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTestBYOKConnection}
                    disabled={byokTestStatus === "testing"}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-semibold btn-press flex items-center justify-center gap-1.5"
                  >
                    {byokTestStatus === "testing" ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test BYOK Connection"
                    )}
                  </button>
                  {byokTestStatus === "success" && (
                    <span className="text-[10px] text-emerald-400 font-medium block mt-1.5 text-center">
                      ✓ Connection verified successfully!
                    </span>
                  )}
                  {byokTestStatus === "error" && byokTestError && (
                    <span className="text-[10px] text-rose-400 font-mono block mt-1.5 text-center">
                      {byokTestError}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/[0.08] flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold btn-press"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowCancelConfirmation(false)}
          />
          <div className="relative bg-[#161822] border border-white/15 rounded-2xl p-5 max-w-xs w-full shadow-2xl z-50 animate-scale-in text-center">
            <h3 className="text-sm font-semibold text-white mb-1.5">Discard Notes?</h3>
            <p className="text-xs text-gray-400 mb-4">
              All notes in this active session will be cleared.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelConfirmYes}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold btn-press"
              >
                Discard
              </button>
              <button
                onClick={() => setShowCancelConfirmation(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-semibold btn-press"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
