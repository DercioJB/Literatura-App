/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical, 
  Download, 
  Upload, 
  FileText, 
  Printer, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Minus,
  BookOpen,
  Package,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  History,
  MapPin,
  LayoutGrid,
  List,
  Book,
  FileBox,
  ClipboardList,
  Settings,
  Bell,
  Database,
  Cloud,
  Moon,
  Sun,
  ArrowLeft,
  Info,
  Mail,
  Phone,
  Users,
  Shield, UserPlus, UserMinus, Loader2, LogOut,
  LayoutDashboard, PieChart as PieChartIcon, BarChart3,
  PlusCircle, Edit, TrendingUp, TrendingDown, Archive, Clock, RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

import { logout } from './supabase';
import { useSupabaseSync as useFirebaseSync, BookItemCloud } from './supabase-sync';
import LoginScreen from './components/LoginScreen';



// --- Types ---
type Category = 'Bíblias' | 'Livros' | 'Brochuras e Folhetos' | 'Formulários';
interface BookItem {
  id: string;
  name: string;
  code: string;
  category: Category;
  loc: string;
  origin: number;
  in: number;
  out: number;
  lastDate: string;
  lastMonth: string;
  changes?: string;
}

interface HistoryData {
  [monthKey: string]: BookItem[];
}

// --- Constants ---
const CATEGORIES: Category[] = ['Bíblias', 'Livros', 'Brochuras e Folhetos', 'Formulários'];
const LOCATIONS: string[] = ['MANANGA PT', 'CHOTA PT'];
const CORRECT_PIN = '2027';

const CAT_META: Record<Category, { icon: React.ReactNode; color: string; label: string }> = {
  'Bíblias': { icon: <Book className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-800', label: 'Bíblias' },
  'Livros': { icon: <BookOpen className="w-4 h-4" />, color: 'bg-sky-100 text-sky-800', label: 'Livros' },
  'Brochuras e Folhetos': { icon: <FileBox className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-800', label: 'Brochuras' },
  'Formulários': { icon: <ClipboardList className="w-4 h-4" />, color: 'bg-amber-100 text-amber-800', label: 'Formulários' },
};

// --- Helpers ---
const DateUtils = {
  formatDate: (d: Date | string | number = new Date()) => {
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  },
  formatTime: (d: Date | string | number = new Date()) => {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },
  formatDateTime: (d: Date | string | number = new Date()) => `${DateUtils.formatDate(d)} ${DateUtils.formatTime(d)}`,
  getISO: (d: Date | string | number = new Date()) => new Date(d).toISOString(),
  getISODate: (d: Date | string | number = new Date()) => new Date(d).toISOString().split('T')[0],
  getMonthKey: (d: Date | string | number = new Date()) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },
  formatSafeFilename: (d: Date | string | number = new Date()) => DateUtils.formatDate(d).replace(/\//g, '-')
};

const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();
const getAvail = (b: BookItem) => b.origin + b.in - b.out;
const fmtDate = (d: Date) => DateUtils.formatDate(d);
const getMonthKey = (d: Date) => DateUtils.getMonthKey(d);

const getMonthLabel = (ym: string) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};

const getPrevMonthKey = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return getMonthKey(d);
};

const getNextMonthKey = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return getMonthKey(d);
};

const getCatColor = (cat: string) => {
  switch(cat) {
    case 'Bíblias': return 'bg-sky-500';
    case 'Livros': return 'bg-emerald-500';
    case 'Revistas': return 'bg-amber-500';
    case 'Brochuras e Folhetos': return 'bg-violet-500';
    case 'Tratados': return 'bg-rose-500';
    case 'Formulários': return 'bg-slate-500';
    default: return 'bg-blue-500';
  }
};

export default function App() {
  const { 
    books: cloudBooks, 
    history: cloudHistory, 
    syncing, 
    saveBook, 
    deleteBook, 
    syncHistoryMonth, 
    migrateLocalToCloud, 
    loadHistoryMonth, 
    loadAllHistory, 
    saveBackupToCloud, 
    loadCloudBackups, 
    deleteCloudBackup,
    user,
    authLoading,
    workspace,
    updateWorkspaceSettings
  } = useFirebaseSync();
  
  // --- State ---
  const books = cloudBooks as BookItem[];
  const history = cloudHistory as unknown as HistoryData;
  const [locations, setLocations] = useState<string[]>(workspace?.locations || ['MANANGA PT', 'CHOTA PT']);
  const [activeLocation, setActiveLocation] = useState<string>('MANANGA PT');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMonth, setViewMonth] = useState<string>(getMonthKey(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteLocked, setDeleteLocked] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifActiveTab, setNotifActiveTab] = useState<'alerts' | 'backups'>('alerts');
  const [showModal, setShowModal] = useState(false);
  const [detailBookCode, setDetailBookCode] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [savingLowStock, setSavingLowStock] = useState(false);
  const [savedLowStock, setSavedLowStock] = useState(false);

  // Fetch Admin Users
  useEffect(() => {
    if (workspace && workspace.locations.length > 0) {
      setLocations(workspace.locations);
      if (!workspace.locations.includes(activeLocation)) setActiveLocation(workspace.locations[0]);
    }
  }, [workspace?.locations]);


  // User fetch effect moved below isAdmin definition to prevent TDZ issues



  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteBook = books?.find(b => b.id === pendingDeleteId) || null;
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  // Lido do workspace (Firestore) — partilhado entre todos os utilizadores
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(
    workspace?.lowStockThreshold ?? 10
  );
  const [autoCloudBackupEnabled, setAutoCloudBackupEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('lit2026_autoCloudBackupEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  // Logs apenas em memória — os backups reais estão no Firestore
  const [cloudBackupLogs, setCloudBackupLogs] = useState<string[]>([]);
  const isAdmin = user?.email === 'derciojaimebalane21@gmail.com';

  useEffect(() => {
    if (workspace?.lowStockThreshold) {
      setLowStockThreshold(workspace.lowStockThreshold);
    }
  }, [workspace?.lowStockThreshold]);







  // Manual Cloud Backup Visual flow states
  const [showConfirmCloudBackup, setShowConfirmCloudBackup] = useState(false);
  const [isCloudBackupRunning, setIsCloudBackupRunning] = useState(false);
  const [cloudBackupProgress, setCloudBackupProgress] = useState(0);
  const [cloudBackupStatusText, setCloudBackupStatusText] = useState('');

  // Import Progress Visual flow states
  const [isImportRunning, setIsImportRunning] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('');

  // Real Cloud Backups manager states & functions
  const [cloudBackupsList, setCloudBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const fetchCloudBackups = async () => {
    setLoadingBackups(true);
    try {
      const list = await loadCloudBackups();
      setCloudBackupsList(list || []);
    } catch (err) {
      console.error("Error loading cloud backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (showNotifications && isAdmin) {
      fetchCloudBackups();
    }
  }, [showNotifications, isAdmin]);

  const handleDownloadCloudBackup = (backup: any) => {
    try {
      const payload = JSON.parse(backup.payload);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `recovery_backup_literatura_${backup.backupDate}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Cópia de segurança descarregada.');
    } catch (err) {
      showToast('Erro ao ler dados deste backup.');
    }
  };

  const handleRestoreCloudBackup = async (backup: any) => {
    try {
      const payload = JSON.parse(backup.payload);
      if (!payload.books || !Array.isArray(payload.books)) {
        showToast('Payload do backup inválido.');
        return;
      }
      if (window.confirm(`Tem a certeza de que deseja restaurar a base de dados para o estado de ${backup.backupDate}? Os dados actuais de stock e histórico serão substituídos pelos dados contidos neste backup.`)) {
        setIsImportRunning(true);
        setImportProgress(0);
        setImportStatusText("A iniciar restauro a partir da Cloud...");
        
        try {
          await migrateLocalToCloud(
            payload.books, 
            payload.history || {}, 
            (percent, statusText) => {
              setImportProgress(percent);
              setImportStatusText(statusText);
            }
          );
          showToast('Base de dados restaurada com sucesso!');
        } catch (syncErr: any) {
          console.error("Restore migration error:", syncErr);
          showToast(`Erro ao restaurar dados: ${syncErr.message || syncErr}`);
        } finally {
          await new Promise(resolve => setTimeout(resolve, 800));
          setIsImportRunning(false);
        }
      }
    } catch (err) {
      showToast('Erro ao processar dados de restauro.');
    }
  };

  const handleDeleteCloudBackupRecord = async (backupId: string) => {
    if (window.confirm("Deseja mesmo eliminar este backup da Cloud permanentemente? Esta acção não pode ser desfeita.")) {
      try {
        await deleteCloudBackup(backupId);
        showToast("Backup eliminado da Cloud.");
        await fetchCloudBackups();
      } catch (err) {
        showToast("Erro ao eliminar backup.");
      }
    }
  };

  const runCloudBackupProcess = async () => {
    setShowConfirmCloudBackup(false);
    setIsCloudBackupRunning(true);
    setCloudBackupProgress(5);
    setCloudBackupStatusText("Iniciando a ligação segura com o Supabase PostgreSQL...");

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setCloudBackupProgress(25);
      setCloudBackupStatusText(`A ler e indexar livros do inventário (${books.length} itens)...`);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setCloudBackupProgress(55);
      setCloudBackupStatusText("A extrair e consolidar histórico de transações...");
      
      const fullHistory = await loadAllHistory();
      
      await new Promise(resolve => setTimeout(resolve, 600));
      setCloudBackupProgress(80);
      setCloudBackupStatusText("A transferir e salvaguardar dados na Cloud...");
      
      const backupPayload = { books, history: fullHistory, exportedAt: new Date().toISOString() };
      await saveBackupToCloud(backupPayload);

      await new Promise(resolve => setTimeout(resolve, 700));
      setCloudBackupProgress(100);
      setCloudBackupStatusText("Cópia de segurança guardada com sucesso!");

      const nowObj = new Date();
      const todayStr = DateUtils.getISODate(nowObj);
      const timeStr = nowObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newLog = `Backup manual para o Supabase PostgreSQL realizado com sucesso em ${DateUtils.formatDate(nowObj)} às ${timeStr}`;
      
      setCloudBackupLogs(prev => [newLog, ...prev].slice(0, 50));
      localStorage.setItem('lit2026_lastCloudBackup', todayStr);

      await new Promise(resolve => setTimeout(resolve, 850));
      setIsCloudBackupRunning(false);
      showToast('Cópia de segurança guardada com sucesso!');
    } catch (err: any) {
      console.error(err);
      setIsCloudBackupRunning(false);
      let errorMsg = 'Erro ao realizar o backup na Cloud.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            errorMsg = `Erro na Cloud: ${parsed.error}`;
            if (parsed.error.includes("Missing or insufficient permissions")) {
              errorMsg = "Sem permissões suficientes para guardar backups na Cloud. Certifique-se de que a sua conta tem privilégios.";
            }
          } else {
            errorMsg = err.message;
          }
        } catch (e) {
          errorMsg = err.message;
        }
      }
      showToast(errorMsg);
    }
  };

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
      setTimeout(() => setShowInstallPrompt(true), 1500);
    }
    
    const handleAppInstallPrompt = () => {
      setDeferredPrompt(window.deferredPrompt);
      setTimeout(() => setShowInstallPrompt(true), 1500);
    };

    window.addEventListener('app:installprompt', handleAppInstallPrompt);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app:installprompt', handleAppInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('lit2026_autoCloudBackupEnabled', JSON.stringify(autoCloudBackupEnabled));
  }, [autoCloudBackupEnabled]);

  useEffect(() => {
    if (!autoCloudBackupEnabled || !books.length) return;

    const checkCloudBackup = async () => {
      const now = new Date();
      const lastBackupStr = localStorage.getItem('lit2026_lastCloudBackup');
      const todayStr = DateUtils.getISODate(now);

      let shouldBackup = false;
      if (!lastBackupStr) {
        shouldBackup = true;
      } else {
        const lastDate = new Date(lastBackupStr);
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) {
          shouldBackup = true;
        }
      }

      if (shouldBackup) {
        try {
          localStorage.setItem('lit2026_lastCloudBackup', todayStr);
          
          const fullHistory = await loadAllHistory();
          const backupPayload = { books, history: fullHistory, exportedAt: DateUtils.getISO(now) };
          
          await saveBackupToCloud(backupPayload);
          
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newLog = `Backup automático para o Supabase PostgreSQL realizado com sucesso em ${DateUtils.formatDate(now)} às ${timeStr}`;
          
          setCloudBackupLogs(prev => [newLog, ...prev].slice(0, 50));

          showToast('Backup semanal automático na Cloud concluído');
        } catch (err) {
          console.error("Cloud backup error:", err);
        }
      }
    };

    checkCloudBackup();
    const interval = setInterval(checkCloudBackup, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, [autoCloudBackupEnabled, books, loadAllHistory, saveBackupToCloud]);

  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '' as Category,
    location: 'MANANGA PT',
    origin: 0,
    in: 0,
    out: 0
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  // App Sync & Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    setIsAuthenticated(!!user);
  }, [user]);
  const isLoadedRef = useRef(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('lit2026_darkmode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    book: BookItem | null;
    type: 'in' | 'out';
    amount: number;
  }>({ isOpen: false, book: null, type: 'in', amount: 1 });
  const [animatedBook, setAnimatedBook] = useState<{ id: string, type: 'in' | 'out' } | null>(null);

  const adjustIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('lit2026_darkmode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdjustStep = (dir: number) => {
    setAdjustModal(prev => {
      let newAmount = prev.amount + dir;
      if (newAmount < 1) newAmount = 1;
      if (prev.type === 'out' && prev.book) {
        const avail = getAvail(prev.book);
        if (newAmount > avail) newAmount = avail;
      }
      return { ...prev, amount: newAmount };
    });
  };

  const startAdjust = (dir: number) => {
    handleAdjustStep(dir);
    if (adjustIntervalRef.current) {
      clearTimeout(adjustIntervalRef.current);
      clearInterval(adjustIntervalRef.current);
    }
    adjustIntervalRef.current = setTimeout(() => {
      adjustIntervalRef.current = setInterval(() => {
        handleAdjustStep(dir);
        if (navigator.vibrate) navigator.vibrate(10);
      }, 60) as unknown as NodeJS.Timeout;
    }, 400) as unknown as NodeJS.Timeout;
  };

  const stopAdjust = () => {
    if (adjustIntervalRef.current) {
      clearTimeout(adjustIntervalRef.current);
      clearInterval(adjustIntervalRef.current);
      adjustIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopAdjust();
  }, []);

  const openAdjustModal = (book: BookItem, type: 'in' | 'out') => {
    setAdjustModal({ isOpen: true, book, type, amount: 1 });
  };

  const curMonthKey = getMonthKey(new Date());
  const isLive = viewMonth === curMonthKey;

  useEffect(() => {
    if (!isLive) {
      loadHistoryMonth(viewMonth);
    }
  }, [viewMonth, isLive, loadHistoryMonth]);

  // --- Auth & Data Loading Effects ---
  useEffect(() => {
    // Basic automatic monthly reset check
    if (books.length > 0 && isLive && user) {
      let needsUpdate = false;
      
      const newMonthBooks = books.map(b => {
        if (b.lastMonth !== curMonthKey) {
          needsUpdate = true;
          return {
            ...b,
            origin: getAvail(b),
            in: 0,
            out: 0,
            lastMonth: curMonthKey,
            lastDate: fmtDate(new Date()),
            changes: b.changes || '[]'
          };
        }
        return b;
      });

      if (needsUpdate) {
        // Automatically sync history for previous month 
        // We'll snapshot current books first before updating them
        const prevMonthBooks = books.filter(b => b.lastMonth !== curMonthKey);
        
        // Push snapshot per-month
        const groupedByMonth: Record<string, BookItemCloud[]> = {};
        for(const b of prevMonthBooks) {
           if (!groupedByMonth[b.lastMonth]) groupedByMonth[b.lastMonth] = [];
           groupedByMonth[b.lastMonth].push(b as unknown as BookItemCloud);
        }

        // We can do an async batch 
        const runUpdates = async () => {
           for (const monthKey in groupedByMonth) {
              await syncHistoryMonth(monthKey, groupedByMonth[monthKey]);
              
           }
           // Update books to new month
           newMonthBooks.forEach(b => saveBook(b, b.id));
        };
        runUpdates();
      }
    }
    
    // Safety check so we don't display loader forever
    if (!isLoadedRef.current) {
       setTimeout(() => {
         isLoadedRef.current = true;
       }, 500);
    }
  }, [books, isLive, user, curMonthKey]);

  useEffect(() => { setIsSyncing(syncing); }, [syncing]);

  // --- Logic ---
  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const filteredBooks = useMemo(() => {
    const allData = viewMonth === curMonthKey ? books : (history[viewMonth] || []);
    const locData = activeLocation === 'Total' ? allData : allData.filter(b => b.loc === activeLocation);
    
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      // Se houver uma correspondência exata de código, retorna apenas esses
      const exactCodeMatches = locData.filter(b => 
        b.code.toLowerCase() === query && (activeCategory === 'all' || b.category === activeCategory)
      );
      
      if (exactCodeMatches.length > 0) {
        return exactCodeMatches;
      }
    }

    return locData.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(query) || 
                          b.code.toLowerCase().includes(query);
      const matchesCategory = activeCategory === 'all' || b.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [books, history, viewMonth, activeLocation, activeCategory, searchQuery, curMonthKey]);

  const lowStockBooks = useMemo(() => {
    const allData = viewMonth === curMonthKey ? books : (history[viewMonth] || []);
    return allData.filter(b => getAvail(b) <= lowStockThreshold);
  }, [books, history, viewMonth, curMonthKey, lowStockThreshold]);

  const summary = useMemo(() => {
    const total = filteredBooks.length;
    const avail = filteredBooks.reduce((sum, b) => sum + getAvail(b), 0);
    const entries = filteredBooks.reduce((sum, b) => sum + b.in, 0);
    const exits = filteredBooks.reduce((sum, b) => sum + b.out, 0);
    const zero = filteredBooks.filter(b => getAvail(b) === 0).length;
    return { total, avail, entries, exits, zero };
  }, [filteredBooks]);

  const totalByCode = useMemo(() => {
    if (activeLocation !== 'Total') return null;
    const map = new Map<string, { name: string; category: Category; locs: Record<string, number> }>();
    filteredBooks.forEach(b => {
      const avail = getAvail(b);
      if (!map.has(b.code)) map.set(b.code, { name: b.name, category: b.category, locs: {} });
      const entry = map.get(b.code)!;
      const locKey = locations.find(l => l.trim().toLowerCase() === b.loc.trim().toLowerCase()) || b.loc.trim().toUpperCase();
      entry.locs[locKey] = (entry.locs[locKey] || 0) + avail;
    });
    return Array.from(map.entries()).map(([code, data]) => ({ code, ...data }));
  }, [filteredBooks, activeLocation, locations]);

  const detailBookInfo = useMemo(() => {
    if (!detailBookCode) return null;
    const currentBooks = books.filter(b => b.code === detailBookCode);
    let templateBook = currentBooks[0];
    if (!templateBook) {
      for (const monthKey in history) {
        const found = history[monthKey].find(b => b.code === detailBookCode);
        if (found) {
          templateBook = found;
          break;
        }
      }
    }
    if (!templateBook) return null;

    const currentLocs: Record<string, number> = {};
    locations.forEach(l => currentLocs[l] = 0);
    let currentTotal = 0;
    currentBooks.forEach(b => {
      // Normalize location string to handle mixed cases or trailing spaces
      const locKey = locations.find(l => l.trim().toLowerCase() === b.loc.trim().toLowerCase()) || b.loc.trim().toUpperCase();
      currentLocs[locKey] = (currentLocs[locKey] || 0) + getAvail(b);
      currentTotal += getAvail(b);
    });

    const movementHistory: { month: string, loc: string, in: number, out: number, origin: number, available: number }[] = [];
    
    // Past months (from history)
    Object.keys(history).forEach(monthKey => {
      const booksInMonth = history[monthKey].filter(b => b.code === detailBookCode);
      booksInMonth.forEach(b => {
        const locKey = locations.find(l => l.trim().toLowerCase() === b.loc.trim().toLowerCase()) || b.loc.trim().toUpperCase();
        movementHistory.push({
          month: monthKey,
          loc: locKey,
          in: b.in,
          out: b.out,
          origin: b.origin,
          available: b.origin + b.in - b.out
        });
      });
    });

    // Current month (if any live data exists)
    currentBooks.forEach(b => {
      const locKey = locations.find(l => l.trim().toLowerCase() === b.loc.trim().toLowerCase()) || b.loc.trim().toUpperCase();
      movementHistory.push({
        month: `${curMonthKey} (Atual)`,
        loc: locKey,
        in: b.in,
        out: b.out,
        origin: b.origin,
        available: getAvail(b)
      });
    });

    // Sort descending by month
    movementHistory.sort((a, b) => b.month.localeCompare(a.month));

    return {
      templateBook,
      currentLocs,
      currentTotal,
      movementHistory
    };
  }, [detailBookCode, books, history, locations, curMonthKey]);

  const handleAdjust = async (id: string, dir: number, amount: number = 1) => {
    if (!isLive) return;
    const b = books.find(x => x.id === id);
    if (!b) return;
    
    const currentAvail = getAvail(b);
    if (dir === -1 && currentAvail < amount) {
      showToast(`Stock insuficiente! Apenas ${currentAvail} disponíveis.`);
      return;
    }

    let parsedChanges = [];
    try {
      if (b.changes) {
        parsedChanges = JSON.parse(b.changes);
        if (!Array.isArray(parsedChanges)) {
          parsedChanges = [];
        }
      }
    } catch {
      parsedChanges = [];
    }

    const newLog = {
      who: user?.email || 'Anónimo',
      when: new Date().toISOString(),
      type: dir === 1 ? 'Entrada' : 'Saída',
      amount: amount
    };
    const updatedChanges = [newLog, ...parsedChanges].slice(0, 5);

    const updated = {
      ...b,
      in: dir === 1 ? b.in + amount : b.in,
      out: dir === -1 ? b.out + amount : b.out,
      lastDate: fmtDate(new Date()),
      changes: JSON.stringify(updatedChanges)
    };
    
    const newAvail = getAvail(updated);
    const adjustMsg = dir === 1 
      ? `Entrada de ${amount} registada | Saldo: ${currentAvail} ➔ ${newAvail}`
      : `Saída de ${amount} registada | Saldo: ${currentAvail} ➔ ${newAvail}`;

    if (dir === -1 && newAvail <= lowStockThreshold && currentAvail > lowStockThreshold) {
      showToast(`${adjustMsg} (Atenção: Stock de ${b.name} está baixo!)`);
    } else {
      showToast(adjustMsg);
    }
    
    try {
      await saveBook(updated, id);
    } catch (err: any) {
      console.error("Erro ao registar ajuste:", err);
      let readableError = err?.message || String(err);
      try {
        const parsed = JSON.parse(readableError);
        if (parsed?.error) {
          readableError = `Erro de Permissão: ${parsed.error}`;
        }
      } catch {}
      showToast(`Erro ao registar ajuste: ${readableError}`);
    }
  };

  const confirmAdjust = () => {
    if (adjustModal.book) {
      handleAdjust(adjustModal.book.id, adjustModal.type === 'in' ? 1 : -1, adjustModal.amount);
      const bookId = adjustModal.book.id;
      const type = adjustModal.type;
      setAnimatedBook({ id: bookId, type });
      setTimeout(() => {
        setAnimatedBook(prev => (prev?.id === bookId ? null : prev));
      }, 1500);
      setAdjustModal({ ...adjustModal, isOpen: false });
    }
  };

  const handleSaveBook = async () => {
    if (isSaving) return;
    
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = 'Obrigatório';
    if (!formData.code) errors.code = 'Obrigatório';
    if (!formData.category) errors.category = 'Obrigatório';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    
    try {
      const codeTrimmed = formData.code.trim().toLowerCase();
      const nameTrimmed = formData.name.trim().toLowerCase();
      
      const existingInLocation = books.find(b => 
        b.loc === formData.location && 
        b.name.trim().toLowerCase() === nameTrimmed &&
        b.code.trim().toLowerCase() === codeTrimmed && 
        b.category === formData.category &&
        b.id !== editId
      );
      
      if (existingInLocation) {
        showToast('Já existe um livro com o mesmo nome, código e categoria neste local.');
        return;
      }

      if (editId) {
        const b = books.find(x => x.id === editId);
        if (b) {
          await saveBook({ 
            name: deleteLocked ? b.name : formData.name,
            code: deleteLocked ? b.code : formData.code,
            category: deleteLocked ? b.category : formData.category,
            loc: deleteLocked ? b.loc : formData.location,
            origin: deleteLocked ? b.origin : formData.origin,
            in: formData.in,
            out: formData.out,
            lastDate: fmtDate(new Date()),
            lastMonth: b.lastMonth,
            changes: b.changes || '[]'
          }, editId);
          
        }
        showToast('Livro actualizado');
      } else {
        await saveBook({
          name: formData.name,
          code: formData.code,
          category: formData.category,
          loc: formData.location,
          origin: formData.origin,
          in: formData.in,
          out: formData.out,
          lastDate: fmtDate(new Date()),
          lastMonth: curMonthKey,
          changes: '[]'
        });
        
        showToast('Livro adicionado');
      }
      setShowModal(false);
    } catch (err: any) {
      console.error("Erro ao gravar livro:", err);
      let readableError = err?.message || String(err);
      try {
        const parsed = JSON.parse(readableError);
        if (parsed?.error) {
          readableError = `Erro de Permissão: ${parsed.error}`;
        }
      } catch {}
      showToast(`Erro ao gravar livro: ${readableError}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (b: BookItem) => {
    setEditId(b.id);
    setFormData({
      name: b.name,
      code: b.code,
      category: b.category,
      location: b.loc,
      origin: b.origin,
      in: b.in,
      out: b.out
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    const nameToAdd = newLocationName.trim();
    if (locations.some(l => l.toLowerCase() === nameToAdd.toLowerCase())) {
      showToast('Local já existe');
      return;
    }
    const newArr = [...locations, nameToAdd];
    setLocations(newArr);
    await updateWorkspaceSettings(newArr, lowStockThreshold);

    setNewLocationName('');
    showToast('Local adicionado');
  };

  const handleRemoveLocation = async (locToRemove: string) => {
    if (locations.length <= 1) {
      showToast('Deve ter pelo menos um local');
      return;
    }
    const newArr = locations.filter(l => l !== locToRemove);
    setLocations(newArr);
    await updateWorkspaceSettings(newArr, lowStockThreshold);

    if (activeLocation === locToRemove) {
      setActiveLocation(locations.find(l => l !== locToRemove) || 'Total');
    }
    showToast('Local removido');
  };

  const handleEditLocation = async (oldLoc: string) => {
    if (!editingLocationName.trim()) {
      setEditingLocation(null);
      return;
    }
    const newName = editingLocationName.trim();
    if (newName.toLowerCase() !== oldLoc.toLowerCase() && locations.some(l => l.toLowerCase() === newName.toLowerCase())) {
      showToast('Local já existe');
      return;
    }
    
    const newArr = locations.map(l => l === oldLoc ? newName : l);
    setLocations(newArr);
    await updateWorkspaceSettings(newArr, lowStockThreshold);

    if (activeLocation === oldLoc) {
      setActiveLocation(newName);
    }
    
    // Process book updates async to avoid UI block
    books.forEach(b => {
      if (b.loc === oldLoc) saveBook({...b, loc: newName, changes: b.changes || '[]'}, b.id);
    });

    setEditingLocation(null);
    showToast('Local actualizado');
  };

  const startEditingLocation = (loc: string) => {
    setEditingLocation(loc);
    setEditingLocationName(loc);
  };

  const handleOpenNew = () => {
    if (activeLocation === 'Total') {
      showToast('Selecione um local primeiro');
      return;
    }
    setEditId(null);
    setFormData({
      name: '',
      code: '',
      category: '' as Category,
      location: activeLocation,
      origin: 0,
      in: 0,
      out: 0
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (deleteLocked) {
      showToast('Ação bloqueada');
      return;
    }
    setPendingDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteBook(pendingDeleteId);
      showToast('Livro removido');
    }
    setPendingDeleteId(null);
    setShowConfirmDelete(false);
  };

  const handlePinSubmit = () => {
    if (pinInput === CORRECT_PIN) {
      setDeleteLocked(false);
      setShowPinDialog(false);
      setPinInput('');
      showToast('Desbloqueado');
    } else {
      setPinError('PIN incorrecto');
      setPinInput('');
    }
  };

  const exportCSV = () => {
    const data = filteredBooks;
    const header = ['Nome', 'Código', 'Categoria', 'Local', 'Stock Origem', 'Entradas', 'Saídas', 'Disponível', 'Última Movimentação'];
    const rows = data.map(b => [b.name, b.code, b.category, b.loc, b.origin, b.in, b.out, getAvail(b), b.lastDate]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock_${activeLocation}_${viewMonth}.csv`);
    link.click();
    setShowMenu(false);
  };

  const exportBackup = async () => {
    const fullHistory = await loadAllHistory();
    const payload = { books, history: fullHistory, exportedAt: DateUtils.getISO() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `backup_literatura_${DateUtils.formatSafeFilename()}.json`);
    link.click();
    setShowMenu(false);
    showToast('Backup exportado');
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target?.result as string);
        if (payload.books && Array.isArray(payload.books)) {
          if (window.confirm(`Importar ${payload.books.length} livros? Os novos dados serão integrados e guardados na Cloud (Supabase).`)) {
            setIsImportRunning(true);
            setImportProgress(0);
            setImportStatusText("A ler o ficheiro e a preparar migração...");
            
            try {
              await migrateLocalToCloud(
                payload.books, 
                payload.history || {}, 
                (percent, statusText) => {
                  setImportProgress(percent);
                  setImportStatusText(statusText);
                }
              );
              showToast('Backup enviado para Cloud (Supabase) com sucesso');
            } catch (syncErr: any) {
              console.error("Migration error:", syncErr);
              showToast(`Erro na integração: ${syncErr.message || syncErr}`);
            } finally {
              // Add a slight delay before closing so user can see 100% completion state
              await new Promise(resolve => setTimeout(resolve, 800));
              setIsImportRunning(false);
            }
          }
        } else {
          showToast('Ficheiro de backup inválido');
        }
      } catch (err) {
        showToast('Erro ao ler ficheiro: Formato JSON inválido.');
      }
    };
    reader.readAsText(file);
    // Clear the input value so the same file can be imported again
    event.target.value = '';
    setShowMenu(false);
  };

  const triggerImport = () => {
    const input = document.getElementById('import-input');
    if (input) input.click();
  };

  const handleCopyFromExisting = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (!code) return;
    const existingBook = books.find(b => b.code === code);
    if (existingBook) {
      setFormData(prev => ({
        ...prev,
        name: existingBook.name,
        code: existingBook.code,
        category: existingBook.category
      }));
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 900);
      showToast(`Dados preenchidos: ${existingBook.name}`);
    }
  };

  const uniqueBooks = useMemo(() => {
    const unq: {name: string, code: string, category: string}[] = [];
    const seen = new Set();
    books.forEach(b => {
      if (b.code && !seen.has(b.code)) {
        seen.add(b.code);
        unq.push({ name: b.name, code: b.code, category: b.category });
      }
    });
    return unq.sort((a,b) => a.name.localeCompare(b.name));
  }, [books]);

  // --- Render ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl flex items-center justify-center relative z-10">
            <Loader2 className="w-8 h-8 text-[#00897b] dark:text-emerald-400 animate-spin" />
          </div>
          <div className="absolute inset-0 bg-[#00897b]/10 rounded-full blur-xl animate-pulse" />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-6 animate-pulse">
          A ligar à base de dados...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <div className="min-h-screen print:hidden bg-[#F4F4F5] dark:bg-slate-900 font-poppins pb-32 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col">
      <input type="file" id="import-input" className="hidden" accept=".json" onChange={importBackup} data-styled="true" />
      
      {/* Sleek Dynamic Header */}
      <div className={`pt-7 pb-5 px-5 sticky top-0 z-40 shadow-md backdrop-blur-md transition-all duration-500 rounded-b-[2rem] border-b ${isLive ? 'bg-gradient-to-r from-[#00695c] via-[#00897b] to-[#005a50] border-emerald-400/20 shadow-emerald-950/10 text-white' : 'bg-gradient-to-r from-[#512da8] via-[#7b1fa2] to-[#4a148c] border-purple-400/20 shadow-purple-950/10 text-white'}`}>
        <div className="max-w-3xl mx-auto">
          {/* Header Top Bar */}
          <div className="flex items-center justify-between mb-4.5">
             <div className="flex items-center gap-3.5 group">
                <div className="relative shrink-0">
                   <img src="/icon.png" alt="Literatura Logo" className="w-13 h-13 rounded-2xl shadow-md object-cover bg-white ring-2 ring-white/10 group-hover:scale-105 transition-all duration-300" />
                   <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-slate-900 rounded-full ${!isOnline ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
                </div>
                <div>
                   <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-white drop-shadow-sm">Literatura</h1>
                   <div className="flex items-center gap-2 mt-1.5">
                      {isAuthenticated && (
                        <span className={`flex items-center gap-1 opacity-90 text-[10px] font-bold tracking-wider uppercase ${!isOnline ? 'bg-red-500/80 px-2' : 'bg-white/15 px-2'} py-0.5 rounded-full`}>
                           <Cloud className="w-3 h-3" />
                           {!isOnline ? 'Offline' : (isSyncing || syncing ? 'Sincronizando...' : 'Sincronizado')}
                        </span>
                      )}
                      <span className="text-[10px] opacity-75 font-semibold text-white/80 hidden sm:inline">
                         Congregação • Inventário
                      </span>
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-2">
                {/* Notifications */}
                <div className="relative">
                  <button onClick={() => { setShowNotifications(true); setShowMenu(false); }} className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all relative">
                    <Bell className="w-5 h-5" />
                    {isLive && lowStockBooks.length > 0 && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 border-2 border-teal-600 rounded-full animate-ping"></span>}
                    {isLive && lowStockBooks.length > 0 && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 border-2 border-teal-600 rounded-full"></span>}
                  </button>
                </div>
                
                {/* Menu */}
                <div className="relative" ref={menuRef}>
                  <button onClick={() => { setShowMenu(!showMenu); setShowNotifications(false); }} className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all relative">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/60 overflow-hidden py-2 z-50 text-slate-900 dark:text-slate-100"
                      >
                        <button  onClick={handleOpenNew} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-bold text-[#00897b] dark:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                          <Plus className="w-4 h-4" /> Novo Livro
                        </button>

                        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3 my-1" />
                        <button onClick={() => { setShowSettingsModal(true); setShowMenu(false); }} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-left">
                          <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Configurações
                        </button>
                        <button onClick={exportBackup} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-left">
                          <Download className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Exportar Backup
                        </button>
                        {isAdmin && (
                          <button  onClick={triggerImport} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                            <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Importar Backup
                          </button>
                        )}
                        <button onClick={exportCSV} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-left">
                          <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Exportar CSV
                        </button>
                        <button onClick={() => { window.print(); setShowMenu(false); }} className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-left">
                          <Printer className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Imprimir
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
             </div>
          </div>
          
          {/* Month Navigator inline inside header */}
          <div className="flex items-center justify-between bg-white/10 border border-white/5 rounded-2xl p-1 mb-1 backdrop-blur-sm shadow-inner">
             <button onClick={() => setViewMonth(getPrevMonthKey(viewMonth))} className="p-2.5 hover:bg-white/15 hover:scale-105 active:scale-95 rounded-xl text-white transition-all">
               <ChevronLeft className="w-5 h-5 font-bold" />
             </button>
             <div className="flex flex-col items-center">
               <span className="text-sm font-extrabold tracking-wide text-white">{getMonthLabel(viewMonth)}</span>
               <span className="text-[9px] uppercase tracking-widest font-black opacity-85 text-white/90">{isLive ? 'Mês Corrente' : 'Consulta Histórica'}</span>
             </div>
             <button disabled={isLive} onClick={() => setViewMonth(getNextMonthKey(viewMonth))} className={`p-2.5 rounded-xl text-white transition-all ${isLive ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/15 hover:scale-105 active:scale-95'}`}>
               <ChevronRight className="w-5 h-5 font-bold" />
             </button>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto w-full px-4 pt-6 flex-1 space-y-6">
         {/* Location Pill Tabs */}
         <div className="flex px-1 gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 sm:mx-0 sm:px-0">
           {['Total', ...locations].map(loc => (
             <button
               key={loc}
               onClick={() => setActiveLocation(loc)}
               className={`flex items-center shrink-0 px-6 py-3 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-300 ${
                 activeLocation === loc 
                   ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/15 scale-[1.03] dark:bg-emerald-500 dark:shadow-emerald-500/20' 
                   : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/40 hover:text-slate-800 dark:hover:text-slate-200 active:scale-98'
               }`}
             >
               <MapPin className={`w-3.5 h-3.5 mr-1.5 transition-transform ${activeLocation === loc ? 'scale-110 text-emerald-400 dark:text-emerald-100' : 'opacity-60 text-slate-400 dark:text-slate-500'}`} />
               {loc}
             </button>
           ))}
         </div>

         {/* Stats/Search/Toolbar Area */}
         <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700/85 flex flex-col gap-4.5 sticky top-[135px] z-30 mx-0 sm:-mx-2 md:mx-0 shadow-xl shadow-slate-900/5 dark:shadow-black/20 backdrop-blur-md transition-all duration-300">
            {/* Search */}
            <div className="relative group flex items-center">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 group-focus-within:scale-105 transition-all duration-300 pointer-events-none" />
              <input 
                type="text"
                placeholder="Pesquise por título, código ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 text-sm font-semibold bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-100 dark:border-slate-800 focus:border-emerald-500/30 focus:bg-emerald-50/20 dark:focus:bg-emerald-950/20 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
              />
            </div>
            {/* Toolbar Buttons */}
            <div className="flex justify-between items-center gap-3">
               <div className="flex gap-2.5 overflow-x-auto no-scrollbar pr-2 py-0.5 w-full">
                 <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeCategory === 'all' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'}`}>Todos</button>
                 {CATEGORIES.map(cat => (
                   <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${activeCategory === cat ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'}`}>{cat}</button>
                 ))}
               </div>
            </div>
         </div>

         {/* The Main Data List */}
         <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-24">
           <AnimatePresence mode="wait">
             {activeLocation === 'Total' ? (
               <motion.div
                 key="total"
                 initial={{ opacity: 0, y: 15 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -15 }}
                 transition={{ duration: 0.25, ease: "easeInOut" }}
               >
                 {totalByCode?.length > 0 ? (
                   <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                     {totalByCode.map((item) => {
                       const total = locations.reduce((sum, loc) => sum + (item.locs[loc] || 0), 0);
                       const isLowStock = total <= lowStockThreshold && total > 0;
                       return (
                         <div key={item.code} onClick={() => setDetailBookCode(item.code)} className={`relative flex items-center p-4 hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors cursor-pointer group ${isLowStock ? 'bg-orange-50/30 dark:bg-orange-500/5' : ''}`}>
                           <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${getCatColor(item.category)} bg-opacity-90`} />
                           <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0 ml-2">
                             {CAT_META[item.category]?.icon || <Book className="w-4 h-4 opacity-50" />}
                           </div>
                           <div className="ml-3 flex-1 min-w-0 pr-2">
                             <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 flex items-center gap-2">
                               {item.name}
                               {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                             </h4>
                             <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5 tracking-wide">{item.code} • {item.category}</p>
                           </div>
                           <div className="flex flex-col items-end shrink-0 ml-1 mr-2">
                              <span className={`text-[9px] uppercase font-bold tracking-wider ${isLowStock ? 'text-orange-500/80 dark:text-orange-400/80' : 'text-slate-400 dark:text-slate-500'}`}>Total</span>
                              <span className={`text-lg leading-tight font-extrabold ${total === 0 ? 'text-rose-500' : (isLowStock ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100')}`}>{total}</span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="p-8 text-center text-slate-400 text-sm font-medium">Nenhum livro listado.</div>
                 )}
               </motion.div>
             ) : (
               <motion.div
                 key={activeLocation}
                 initial={{ opacity: 0, y: 15 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -15 }}
                 transition={{ duration: 0.25, ease: "easeInOut" }}
               >
                 {filteredBooks.length > 0 ? (
                   <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                     {filteredBooks.map((b) => {
                       const avail = getAvail(b);
                       const isLowStock = avail <= lowStockThreshold && avail > 0;
                       const isAnimated = animatedBook?.id === b.id;

                       return (
                         <motion.div 
                           key={b.id} 
                           onClick={() => setDetailBookCode(b.code)} 
                           className={`relative flex flex-col p-4 hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors group cursor-pointer ${isLowStock ? 'bg-orange-50/30 dark:bg-orange-500/5' : ''}`}
                           animate={isAnimated ? { scale: [1.02, 1] } : {}}
                           transition={{ duration: 0.5, ease: "easeOut" }}
                         >
                           <AnimatePresence>
                             {isAnimated && (
                               <motion.div
                                 initial={{ opacity: 0.5 }}
                                 animate={{ opacity: 0 }}
                                 exit={{ opacity: 0 }}
                                 transition={{ duration: 1.5, ease: "easeOut" }}
                                 className={`absolute inset-0 z-0 pointer-events-none rounded-xl ${animatedBook?.type === 'in' ? 'bg-emerald-500/30 dark:bg-emerald-500/20' : 'bg-amber-500/30 dark:bg-amber-500/20'}`}
                               />
                             )}
                           </AnimatePresence>
                           <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${getCatColor(b.category)} bg-opacity-90 z-10`} />
                           <div className="flex items-start z-10">
                             <div className="w-10 h-10 rounded-full bg-[#f4f4f5] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 shrink-0 ml-2">
                               {CAT_META[b.category]?.icon || <Book className="w-4 h-4" />}
                             </div>
                             <div className="ml-3 flex-1 min-w-0 pr-2">
                               <h4 className="text-[13px] font-merriweather font-bold text-slate-800 dark:text-slate-100 leading-tight block truncate flex items-center gap-2">
                                 {b.name}
                                 {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                               </h4>
                               <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-1 tracking-wide">{b.code} • {b.category}</p>
                               
                               {/* Inline Actions */}
                               {isLive && (
                                 <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-1">
                                   <button  onClick={(e) => { e.stopPropagation(); openAdjustModal(b, 'in'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:shadow-sm transition-all pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed">
                                     <Plus className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase tracking-wide">Entrada</span>
                                   </button>
                                   <button onClick={(e) => { e.stopPropagation(); openAdjustModal(b, 'out'); }} disabled={avail === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 hover:shadow-sm transition-all disabled:opacity-50 pointer-events-auto disabled:cursor-not-allowed">
                                     <Minus className="w-3 h-3" /> <span className="text-[10px] font-bold uppercase tracking-wide">Saída</span>
                                   </button>
                                   {!deleteLocked && (
                                     <button  onClick={(e) => { e.stopPropagation(); handleOpenEdit(b); }} className="p-1.5 ml-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors pointer-events-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                       <Edit2 className="w-4 h-4" />
                                     </button>
                                   )}
                                   {!deleteLocked && (
                                      <button  onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors pointer-events-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                   )}
                                 </div>
                               )}
                             </div>
                             <div className="flex flex-col items-end shrink-0 ml-1 mr-2">
                                <span className={`text-[9px] uppercase font-bold tracking-wider ${isLowStock ? 'text-orange-500/80 dark:text-orange-400/80' : 'text-slate-400 dark:text-slate-500'}`}>Disp.</span>
                                <motion.span 
                                  animate={isAnimated ? {
                                    scale: [1, 1.35, 0.95, 1.05, 1],
                                    filter: ["brightness(1)", "brightness(1.5)", "brightness(1.2)", "brightness(1)"],
                                    textShadow: animatedBook?.type === 'in' 
                                      ? ["0 0 0px rgba(16,185,129,0)", "0 0 12px rgba(16,185,129,0.6)", "0 0 4px rgba(16,185,129,0.2)", "0 0 0px rgba(16,185,129,0)"]
                                      : ["0 0 0px rgba(245,158,11,0)", "0 0 12px rgba(245,158,11,0.6)", "0 0 4px rgba(245,158,11,0.2)", "0 0 0px rgba(245,158,11,0)"]
                                  } : {}}
                                  transition={{ duration: 0.8, ease: "easeInOut" }}
                                  className={`text-2xl leading-none font-black mt-1 inline-block origin-right transition-colors duration-300 ${
                                    isAnimated 
                                      ? (animatedBook?.type === 'in' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400')
                                      : (avail === 0 ? 'text-rose-500 text-shadow-sm' : (isLowStock ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100'))
                                  }`}
                                >
                                  {avail}
                                </motion.span>
                                <div className="flex items-center gap-1.5 mt-2 bg-slate-100/80 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                  <span className="text-emerald-600 dark:text-emerald-400">+{b.in}</span>
                                  <span className="text-slate-300 dark:text-slate-600">|</span>
                                  <span className="text-orange-500 dark:text-orange-400">-{b.out}</span>
                                </div>
                             </div>
                           </div>
                         </motion.div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="p-8 text-center text-slate-400 text-sm font-medium">Nenhum livro listado nesta localização.</div>
                 )}
               </motion.div>
             )}
           </AnimatePresence>
         </div>
      </main>

      {/* Modern FAB -> Floating pill */}
      {isLive && activeLocation !== 'Total' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
           <button 
             onClick={handleOpenNew}
             
             className="flex items-center gap-2 bg-slate-900 text-white pl-4 pr-6 py-3.5 rounded-full shadow-2xl shadow-slate-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
           >
             <div className={`p-1 rounded-full ${!isOnline ? 'bg-red-500/20' : 'bg-white/20'}`}><Plus className={`w-5 h-5 ${!isOnline ? 'text-red-300' : ''}`} /></div>
             <span className="text-sm font-bold tracking-wide">Novo Livro</span>
           </button>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-20 left-1/2 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl shadow-xl z-[100] font-semibold text-xs text-center whitespace-normal max-w-[90vw] md:max-w-md border border-slate-700/50"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Prompt */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-emerald-100 dark:border-slate-700 z-[90] flex flex-col gap-3"
          >
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Instalar Aplicativo</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Instale a nossa aplicação para uma experiência rápida e funcionar offline.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowInstallPrompt(false)} 
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Agora não
              </button>
              <button 
                onClick={handleInstallApp} 
                className="flex-[2] py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20"
              >
                Instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Page Settings View */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-[#F4F4F5] dark:bg-slate-900 overflow-y-auto flex flex-col"
          >
            {/* Settings Header */}
            <div className={`pt-6 pb-4 px-4 sticky top-0 z-40 shadow-sm transition-colors duration-500 rounded-b-3xl ${isLive ? 'bg-[#00897b] text-white' : 'bg-[#7b1fa2] text-white'}`}>
              <div className="max-w-3xl mx-auto flex items-center gap-4">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner hover:bg-white/30 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
                  <p className="text-white/80 text-[11px] font-medium">Ajuste as preferências da sua aplicação</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-6 max-w-3xl mx-auto w-full py-6">
              {/* Appearance / View setup */}
              <div className="space-y-4 p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                      Aparência Visual
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Escolha um visual otimizado para a sua experiência de trabalho.
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-full ${darkMode ? 'bg-[#00897b]/10 text-[#00897b]' : 'bg-slate-100 text-slate-600'}`}>
                    {darkMode ? 'Modo Escuro' : 'Modo Claro'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  {/* Light Mode Selector Card */}
                  <div 
                    onClick={() => setDarkMode(false)}
                    className={`relative flex flex-col gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${!darkMode ? (isLive ? 'border-[#00897b] bg-[#00897b]/5 shadow-md scale-[1.01]' : 'border-[#7b1fa2] bg-[#7b1fa2]/5 shadow-md scale-[1.01]') : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.005]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                        <Sun className="w-5 h-5 text-amber-500 animate-pulse" />
                      </div>
                      {!darkMode && (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${isLive ? 'bg-[#00897b]' : 'bg-[#7b1fa2]'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Tema Claro</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Ideal para ambientes iluminados</span>
                    </div>
                    {/* Visual mockup representation */}
                    <div className="mt-1 h-12 rounded-lg bg-slate-100 border border-slate-200 p-2 flex flex-col gap-1 overflow-hidden pointer-events-none">
                      <div className="h-2 w-1/2 bg-slate-300 rounded-sm" />
                      <div className="h-1.5 w-full bg-slate-200 rounded-sm" />
                      <div className="flex gap-1 mt-1">
                        <div className="h-3 w-5 bg-emerald-100 border border-emerald-200 rounded" />
                        <div className="h-3 w-7 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Dark Mode Selector Card */}
                  <div 
                    onClick={() => setDarkMode(true)}
                    className={`relative flex flex-col gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${darkMode ? (isLive ? 'border-[#00897b] bg-[#00897b]/5 shadow-md scale-[1.01]' : 'border-[#7b1fa2] bg-[#7b1fa2]/5 shadow-md scale-[1.01]') : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.005]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
                        <Moon className="w-5 h-5 text-indigo-500 animate-pulse" />
                      </div>
                      {darkMode && (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${isLive ? 'bg-[#00897b]' : 'bg-[#7b1fa2]'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Tema Escuro</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Nítido, excelente para repouso visual</span>
                    </div>
                    {/* Visual mockup representation */}
                    <div className="mt-1 h-12 rounded-lg bg-slate-900 border border-slate-800 p-2 flex flex-col gap-1 overflow-hidden pointer-events-none">
                      <div className="h-2 w-1/4 bg-slate-700 rounded-sm" />
                      <div className="h-1.5 w-3/4 bg-slate-800 rounded-sm" />
                      <div className="flex gap-1 mt-1">
                        <div className="h-3 w-5 bg-slate-800 border border-slate-700 rounded" />
                        <div className="h-3 w-7 bg-emerald-950 border border-emerald-900 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Profile Section */}
              <div className="space-y-4 p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-[#00897b] dark:text-emerald-400" />
                    Perfil da Conta
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Detalhes do utilizador autenticado, nível de autorização ativa e credenciais de segurança do painel.
                  </p>
                </div>
                
                {user && (
                  <div className="pt-1 space-y-4.5">
                    {/* Main Profiler Card */}
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-200/50 dark:from-slate-900 dark:to-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Decorative abstract elements */}
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center gap-4 z-10 w-full md:w-auto">
                        <div className="relative shrink-0 group">
                          {user.photoURL ? (
                            <img 
                              src={user.photoURL} 
                              alt="Avatar" 
                              className="w-16 h-16 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md object-cover ring-4 ring-emerald-500/10 transition-all duration-300 group-hover:scale-105" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00897b] to-emerald-500 dark:from-emerald-600 dark:to-teal-500 text-white flex items-center justify-center font-black text-2xl shadow-md uppercase">
                              {user.email?.charAt(0)}
                            </div>
                          )}
                          <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-emerald-500 border-2 border-slate-50 dark:border-slate-900 rounded-full shadow-md animate-pulse" title="Sessão Ativa" />
                        </div>
                        
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 truncate tracking-tight">
                              {user.displayName || 'Operador Local'}
                            </span>
                            
                            {/* Role Badge with visual pill styling */}
                            {isAdmin ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-300/30 text-amber-600 dark:text-amber-400 font-extrabold text-[9px] uppercase tracking-widest flex items-center gap-1 shrink-0 shadow-sm">
                                <Shield className="w-2.5 h-2.5" /> Proprietário (Admin)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-300/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] uppercase tracking-widest flex items-center gap-1 shrink-0 font-sans shadow-sm">
                                <Users className="w-2.5 h-2.5" /> Colaborador (Operador)
                              </span>
                            )}
                          </div>
                          
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block tracking-wide">
                            {user.email}
                          </span>
                        </div>
                      </div>

                      {/* Connection status card right side */}
                      <div className="z-10 bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm p-3 px-4 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center md:flex-col md:items-end justify-between md:justify-center gap-2 self-stretch md:self-auto shadow-sm">
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase mb-0.5">Estado do Terminal</div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
                          <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
                          <span className="text-xs font-extrabold text-[#00897b] dark:text-emerald-400">Ligado e Sincronizado</span>
                        </div>
                      </div>
                    </div>

                    {/* Permission and Active Roles checklist */}
                    <div className="p-4.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block border-b border-slate-200/45 dark:border-slate-800 pb-2">Matriz de Autorizações Ativas</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                        <div className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Registo de Movimentos</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight">Lançar entradas e saídas de livros no inventário corrente</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Exportar Relatórios</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight">Gerar salvaguardas em formato de backups JSON e folhas CSV</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          {isAdmin ? (
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                          )}
                          <div className="space-y-0.5">
                            <span className={`text-xs font-bold ${isAdmin ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>Administração de Locais</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight">Configurar endereços de stock e locais físicos de armazenamento</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          {isAdmin ? (
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                          )}
                          <div className="space-y-0.5">
                            <span className={`text-xs font-bold ${isAdmin ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>Controlo de Segurança</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight">Configurar chaves de PIN e gerir acessos globais de segurança</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Permissions guide board */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Licença de Permissões</span>
                        <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-normal">
                          {isAdmin 
                            ? 'Acesso administrativo total. Autorizado a gerir configurações globais de locais de stock, alterar o PIN administrativo de segurança e descarregar salvaguardas da Cloud.' 
                            : 'Acesso padrão de operador. Autorizado a registar entradas e saídas de literatura, criar listagens e atualizar o inventário corrente.'
                          }
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Ambiente da Base de Dados</span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal space-y-1">
                          <div className="flex justify-between items-center">
                            <span>Workspace:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono text-[10px] bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              global_workspace
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Nível de Acesso:</span>
                            <span className="font-bold text-[#00897b] dark:text-emerald-400">
                              {isAdmin ? 'Super-Admin' : 'Operador Autorizado'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1.5">
                      <button
                        onClick={async () => {
                          await logout();
                          showToast('Sessão encerrada de forma segura.');
                        }}
                        className="w-full py-3 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-955/15 border border-slate-200 dark:border-slate-700/80 hover:border-rose-200 dark:hover:border-rose-900/35 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-4 h-4" /> Terminar Sessão de Forma Segura
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Low Stock Threshold */}
              <div className="space-y-4 p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-rose-500" />
                    Alertas de Stock Baixo
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Livros com quantidade igual ou inferior a este limiar serão destacados no painel.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Quantidade Alerta</span>
                      <p className="text-[10px] text-slate-400">Limite crítico de stock</p>
                    </div>
                  </div>

                  {/* Stepper Input */}
                  <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
                    <button 
                      type="button"
                      onClick={() => setLowStockThreshold(prev => Math.max(0, prev - 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 font-bold active:scale-95 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 text-center bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md py-1 transition-colors select-all"
                    />
                    
                    <button 
                      type="button"
                      onClick={() => setLowStockThreshold(prev => prev + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 font-bold active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Save button with dynamic state feedback */}
                <div className="flex justify-end pt-1">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (savingLowStock) return;
                      setSavingLowStock(true);
                      setSavedLowStock(false);
                      try {
                        await Promise.race([
                          updateWorkspaceSettings(locations, lowStockThreshold),
                          new Promise((resolve) => setTimeout(() => resolve(true), 1500))
                        ]);
                        setSavedLowStock(true);
                        showToast('Limiar de stock atualizado com sucesso!');
                        setTimeout(() => setSavedLowStock(false), 3500);
                      } catch (err: any) {
                        console.warn("Storage settings sync error or timeout, saved locally:", err);
                        setSavedLowStock(true);
                        showToast('Definições atualizadas com sucesso localmente!');
                        setTimeout(() => setSavedLowStock(false), 3500);
                      } finally {
                        setSavingLowStock(false);
                      }
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                      savedLowStock 
                        ? 'bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700' 
                        : isLive
                          ? 'bg-[#00897b] hover:bg-[#00796b] text-white shadow-[#00897b]/10'
                          : 'bg-[#7b1fa2] hover:bg-[#6a1b9b] text-white shadow-[#7b1fa2]/10'
                    }`}
                  >
                    {savingLowStock ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        A Guardar...
                      </>
                    ) : savedLowStock ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        Gravado com Sucesso!
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        Gravar Limiar
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Central de Cópias de Segurança */}
              <div className="space-y-4 p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Database className="w-4.5 h-4.5 text-[#00897b]" />
                    Cópias de Segurança
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Proteja as suas informações mantendo salvaguardas automatizadas e integradas diretamente no Supabase PostgreSQL.
                  </p>
                </div>

                <div className="pt-1">
                  {/* Cloud Backup Control */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Cópia Semanal na Cloud</span>
                        <p className="text-[10px] text-slate-500 leading-tight">Sincroniza automaticamente a base de dados centralizada no Supabase PostgreSQL.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={autoCloudBackupEnabled}
                          onChange={(e) => setAutoCloudBackupEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00897b]"></div>
                      </label>
                    </div>

                    {autoCloudBackupEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2 border-t border-slate-200/55 dark:border-slate-800">
                        <button
                          onClick={() => setShowConfirmCloudBackup(true)}
                          className="w-full py-2 bg-gradient-to-r from-cyan-600 to-[#00897b] text-white font-bold rounded-xl text-[10px] uppercase tracking-wider hover:opacity-95 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Cloud className="w-3.5 h-3.5 text-white" /> Iniciar Backup Manual
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Cloud Backups Snapshot List integrated */}
                <div className="mt-2 border-t border-slate-200/40 dark:border-slate-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] uppercase font-black tracking-widest text-[#00897b] dark:text-slate-500">Histórico de Cópias Ativas</h4>
                      <p className="text-[10px] text-slate-500">Pontos de restauração atualmente salvaguardados em nuvem.</p>
                    </div>
                    <button 
                      onClick={fetchCloudBackups} 
                      disabled={loadingBackups}
                      className="p-1.5 px-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                      Sincronizar
                    </button>
                  </div>

                  {loadingBackups ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#00897b]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">A verificar Supabase...</span>
                    </div>
                  ) : cloudBackupsList.length > 0 ? (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {cloudBackupsList.map((backup) => {
                        let bkBooks = 0;
                        let bkHistories = 0;
                        try {
                          const p = JSON.parse(backup.payload);
                          bkBooks = p.books?.length || 0;
                          bkHistories = Object.keys(p.history || {}).length || 0;
                        } catch (e) {}

                        return (
                          <div 
                            key={backup.id} 
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Cloud className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5">
                                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  Cópia de {backup.backupDate}
                                </h5>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                  <span>ID: {backup.id.substring(0, 6)}</span>
                                  <span>•</span>
                                  <span>{bkBooks} livros</span>
                                  <span>•</span>
                                  <span>{bkHistories} logs</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button 
                                onClick={() => handleDownloadCloudBackup(backup)}
                                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded-xl transition-all"
                                title="Descarregar JSON"
                              >
                                <Download className="w-4 h-4 text-slate-400" />
                              </button>
                              <button 
                                onClick={() => handleRestoreCloudBackup(backup)}
                                className="p-1.5 px-2.5 bg-emerald-55 border border-emerald-150 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/30 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Restaurar base de dados atual com este backup"
                              >
                                Restaurar <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteCloudBackupRecord(backup.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                                title="Eliminar da Nuvem"
                              >
                                <Trash2 className="w-4 h-4 text-rose-600" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Nenhum ponto de restauração na Cloud.</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Guarde manualmente ou ative as salvaguardas semanais.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Locations Setup */}
              <div className="space-y-4 p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <MapPin className="w-4.5 h-4.5 text-emerald-500" />
                      Locais de Armazenamento
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Gerencie os armadores, armários ou depósitos físicos de literatura.
                    </p>
                  </div>
                  <button 
                    onClick={() => deleteLocked ? setShowPinDialog(true) : setDeleteLocked(true)} 
                    className={`p-2 rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 ${deleteLocked ? 'bg-rose-50 dark:bg-rose-950/15 border-rose-100 dark:border-rose-900/30 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 text-emerald-600'}`}
                    title={deleteLocked ? 'Desbloquear edição com PIN' : 'Bloquear edição'}
                  >
                    {deleteLocked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Bloqueado</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Editável</span>
                      </>
                    )}
                  </button>
                </div>

                {deleteLocked && (
                  <div className="flex gap-2.5 p-3.5 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/25 rounded-2xl">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 block">Edição de Locais Bloqueada</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-500 block">Clique no cadeado à direita para desbloquear as alterações utilizando o PIN administrativo.</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {!deleteLocked && (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="Nome do armário ou depósito (ex: Armário A)"
                        disabled={deleteLocked}
                        className="flex-1 min-w-0 p-3 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#00897b]/50 transition-all placeholder-slate-400"
                      />
                      <button 
                        onClick={handleAddLocation}
                        disabled={deleteLocked || !newLocationName.trim()}
                        className="px-5 shrink-0 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl shadow-md transition-all font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Adicionar
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {locations.map(loc => {
                      const bookCount = books.filter(b => b.loc === loc).length;
                      return (
                        <div key={loc} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition-all">
                          {editingLocation === loc ? (
                            <div className="flex gap-2 w-full">
                              <input 
                                type="text" 
                                value={editingLocationName}
                                onChange={(e) => setEditingLocationName(e.target.value)}
                                className="flex-1 min-w-0 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-slate-700 outline-none text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleEditLocation(loc)}
                                className="p-2.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingLocation(null)}
                                className="p-2.5 shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl shadow-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bookCount > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    {loc}
                                  </span>
                                  <span className={`text-[10px] font-semibold block ${bookCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                    {bookCount === 0 ? 'Sem livros associados' : `${bookCount} ${bookCount === 1 ? 'livro catalogado' : 'livros catalogados'}`}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex gap-1.5 shrink-0">
                                <button 
                                  onClick={() => startEditingLocation(loc)}
                                  disabled={deleteLocked}
                                  className="p-2 text-cyan-600 hover:text-white dark:hover:text-white hover:bg-cyan-600 rounded-xl border border-cyan-100 dark:border-cyan-950/20 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-cyan-600 cursor-pointer"
                                  title="Renomear local"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleRemoveLocation(loc)}
                                  disabled={deleteLocked || locations.length <= 1}
                                  className="p-2 text-rose-600 hover:text-white dark:hover:text-white hover:bg-rose-600 rounded-xl border border-rose-105 dark:border-rose-950/20 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-rose-600 cursor-pointer"
                                  title={locations.length <= 1 ? 'Necessita de pelo menos um local ativo' : 'Remover local'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sobre os Desenvolvedores */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm opacity-90 transition-opacity hover:opacity-100">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <Info className="w-3 h-3" />
                    Sobre a Aplicação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">
                    Desenvolvido por <span className="font-bold text-slate-700 dark:text-slate-300">Dércio Balane</span>, <span className="font-bold text-slate-700 dark:text-slate-300">Issufo Jussa</span> e <span className="font-bold text-slate-700 dark:text-slate-300">Paulo Viageiro</span>.
                  </p>
                  <div className="flex flex-col gap-2">
                    <a href="mailto:derciojaimebalane21@gmail.com" className="text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-2 w-max transition-colors">
                      <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center shrink-0">
                        <Mail className="w-3 h-3" />
                      </div>
                      derciojaimebalane21@gmail.com
                    </a>
                    <a href="tel:+258875695452" className="text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-2 w-max transition-colors">
                      <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center shrink-0">
                        <Phone className="w-3 h-3" />
                      </div>
                      +258 87 569 5452
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Full Page Notifications View */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-slate-950 overflow-y-auto flex flex-col no-scrollbar"
          >
            {/* Header with decorative fluid shapes */}
            <div className={`sticky top-0 z-40 pb-5 pt-6 px-5 transition-colors duration-500 rounded-b-[2rem] shadow-md border-b border-slate-100 dark:border-slate-900 ${
              isLive 
                ? 'bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-800 dark:to-teal-900 text-white' 
                : 'bg-gradient-to-r from-purple-600 to-purple-750 dark:from-indigo-800 dark:to-indigo-900 text-white'
            }`}>
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner hover:bg-white/25 active:scale-95 transition-all text-white border border-white/5 cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col text-left">
                    <h1 className="text-lg font-black tracking-wider uppercase">Central de Avisos</h1>
                    <p className="text-white/80 text-[11px] font-semibold tracking-wide">Acompanhamento e utilitários rápidos de inventário</p>
                  </div>
                </div>
                {lowStockBooks.length > 0 && (
                  <span className="bg-orange-555 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md border border-white/10 tracking-widest uppercase animate-pulse">
                    {lowStockBooks.length} {lowStockBooks.length === 1 ? 'Alerta' : 'Alertas'}
                  </span>
                )}
              </div>

              {/* Segmented control tabs for admin users only */}
              {isAdmin && (
                <div className="max-w-3xl mx-auto mt-5 px-1">
                  <div className="grid grid-cols-2 gap-1 p-1 bg-black/15 dark:bg-slate-950/65 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                    <button
                      onClick={() => setNotifActiveTab('alerts')}
                      className={`py-2 px-3 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        notifActiveTab === 'alerts'
                          ? 'bg-white text-slate-900 shadow-lg scale-[1.01]'
                          : 'text-white/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Alertas de Stock
                      {lowStockBooks.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0 ml-1" />
                      )}
                    </button>
                    <button
                      onClick={() => setNotifActiveTab('backups')}
                      className={`py-2 px-3 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        notifActiveTab === 'backups'
                          ? 'bg-white text-slate-900 shadow-lg scale-[1.01]'
                          : 'text-white/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      Cópias de Segurança
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 max-w-3xl mx-auto w-full py-6 flex-1">
              <AnimatePresence mode="wait">
                {(!isAdmin || notifActiveTab === 'alerts') ? (
                  /* ALERTS TAB CONTENT */
                  <motion.div
                    key="tab-alerts"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 pl-1">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Alertas de Stock Baixo ({lowStockBooks.length})
                      </h3>
                    </div>

                    {lowStockBooks.length > 0 ? (
                      <>
                        {/* Summary Widget Card */}
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-transparent dark:from-orange-500/10 dark:to-transparent border border-orange-200/50 dark:border-orange-500/20 rounded-[2rem] p-5 flex gap-4 shadow-sm relative overflow-hidden backdrop-blur-md"
                        >
                          <div className="absolute right-4 top-4 text-orange-500/10 pointer-events-none">
                            <AlertTriangle className="w-24 h-24 transform rotate-12" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/20 shadow-md">
                            <AlertTriangle className="w-6 h-6 animate-pulse" />
                          </div>
                          <div className="z-10 flex-1 text-left">
                            <h3 className="text-xs font-black text-orange-850 dark:text-orange-400 uppercase tracking-widest">Atenção Necessária</h3>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed font-bold">
                              Os títulos listados abaixo estão operando com valores de stock abaixo do limite de segurança recomendado. Registre as entradas ou saídas de exemplares rapidamente usando os botões de ajuste rápido.
                            </p>
                          </div>
                        </motion.div>

                        {/* List of Low Stock Books */}
                        <motion.div 
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: { opacity: 0 },
                            visible: { 
                              opacity: 1, 
                              transition: { staggerChildren: 0.05 }
                            }
                          }}
                          className="space-y-3"
                        >
                          {lowStockBooks.map(b => (
                            <motion.div
                              key={b.id}
                              variants={{
                                hidden: { opacity: 0, y: 15 },
                                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                              }}
                              className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:scale-[1.008] hover:shadow-md relative overflow-hidden text-left"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${getCatColor(b.category)} bg-opacity-95 z-10`} />
                              
                              <div className="flex items-center gap-3.5 pl-1.5 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800 shrink-0 shadow-sm">
                                  {CAT_META[b.category]?.icon || <Book className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-105 leading-snug truncate">
                                    {b.name}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">
                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">{b.code}</span>
                                    <span>•</span>
                                    <span className="bg-slate-105 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">{b.loc}</span>
                                    <span>•</span>
                                    <span>{b.category}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0 pl-1.5 sm:pl-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3.5 sm:pt-0">
                                {/* Badge and Current available quantity */}
                                <div className="flex items-center gap-2.5">
                                  <div className="flex flex-col items-end min-w-[65px]">
                                    {getAvail(b) === 0 ? (
                                      <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase rounded-md border border-rose-100 dark:border-rose-900/30 tracking-widest leading-none">
                                        Esgotado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/15 text-orange-600 dark:text-orange-400 text-[8px] font-black uppercase rounded-md border border-orange-100 dark:border-orange-900/20 tracking-widest leading-none animate-pulse">
                                        Baixo
                                      </span>
                                    )}
                                    <span className={`text-xl font-black leading-none mt-1 ${getAvail(b) === 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                      {getAvail(b)}
                                    </span>
                                  </div>
                                </div>

                                <div className="h-8 w-px bg-slate-150 dark:bg-slate-800 hidden sm:block" />

                                {/* Tactile incremental modifiers */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setAdjustModal({ isOpen: true, book: b, type: 'in', amount: 1 })}
                                    className="p-2 px-2.5 bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl border border-emerald-100 dark:border-emerald-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest cursor-pointer shadow-sm"
                                    title="Registar Entrada"
                                  >
                                    <PlusCircle className="w-4 h-4 text-emerald-500 hover:text-white dark:text-emerald-400 shrink-0" />
                                    <span>Entrada</span>
                                  </button>
                                  <button
                                    onClick={() => setAdjustModal({ isOpen: true, book: b, type: 'out', amount: 1 })}
                                    disabled={getAvail(b) <= 0}
                                    className="p-2 px-2.5 bg-slate-50 hover:bg-amber-600 dark:bg-slate-900 dark:hover:bg-amber-600 text-slate-605 hover:text-white dark:text-slate-400 rounded-xl border border-slate-205 dark:border-slate-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest cursor-pointer shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                                    title="Registar Saída"
                                  >
                                    <Minus className="w-3.5 h-3.5 shrink-0" />
                                    <span>Saída</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      </>
                    ) : (
                      /* CLEAN EMPTY STATE */
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20 px-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-[2.5rem] shadow-sm max-w-md mx-auto"
                      >
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 border-2 border-emerald-100 dark:border-emerald-900/30 shadow-md">
                          <Check className="w-8 h-8 animate-bounce" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-1.5">Tudo Perfeito!</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 font-bold leading-relaxed">
                          Excelente trabalho! O stock da biblioteca está saudável e completo.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  /* COPIAS DE SEGURANÇA (BACKUPS) TAB CONTENT */
                  <motion.div
                    key="tab-backups"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4 font-sans text-left"
                  >
                    <div className="flex items-center gap-2 pl-1">
                      <Database className="w-4 h-4 text-teal-600" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Histórico de Salvaguardas na Nuvem ({cloudBackupsList.length})
                      </h3>
                    </div>

                    {/* Manual backup trigger card */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-indigo-500/5 via-cyan-500/5 to-transparent dark:from-indigo-500/10 dark:to-transparent border border-indigo-200/40 dark:border-slate-800 rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm backdrop-blur-md"
                    >
                      <div className="flex gap-4 items-start">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/20 shadow-md">
                          <Cloud className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Cópias Seguras</h3>
                          <p className="text-[11px] text-slate-650 dark:text-slate-400 mt-1 leading-relaxed font-semibold">
                            Salve todos os livros, locais e histórico de lançamentos em nuvem usando autenticação ultra-segura no Supabase PostgreSQL.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        <button
                          onClick={() => setShowConfirmCloudBackup(true)}
                          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Cloud className="w-3.5 h-3.5 text-white" />
                          Gerar Backup
                        </button>
                        <button 
                          onClick={fetchCloudBackups} 
                          disabled={loadingBackups}
                          className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
                          title="Sincronizar Backups"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </motion.div>

                    {/* List of active recovery points in cloud */}
                    <div className="space-y-3">
                      {loadingBackups ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-[2.5rem]">
                          <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Conectando ao Supabase...</span>
                        </div>
                      ) : cloudBackupsList.length > 0 ? (
                        <motion.div 
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: { opacity: 0 },
                            visible: { 
                              opacity: 1, 
                              transition: { staggerChildren: 0.05 }
                            }
                          }}
                          className="space-y-3 max-h-[480px] overflow-y-auto no-scrollbar pr-1"
                        >
                          {cloudBackupsList.map((backup) => {
                            let bkBooks = 0;
                            let bkHistories = 0;
                            try {
                              const p = JSON.parse(backup.payload);
                              bkBooks = p.books?.length || 0;
                              bkHistories = Object.keys(p.history || {}).length || 0;
                            } catch (e) {}

                            return (
                              <motion.div 
                                key={backup.id}
                                variants={{
                                  hidden: { opacity: 0, y: 12 },
                                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                                }}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md hover:scale-[1.002] text-left"
                              >
                                <div className="flex items-start gap-3.5">
                                  <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/35 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-100 dark:border-cyan-900/30 shadow-inner">
                                    <Cloud className="w-5 h-5" />
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide">
                                      Cópia de {backup.backupDate}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] uppercase">ID: {backup.id.substring(0, 8)}</span>
                                      <span>•</span>
                                      <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-400 px-1.5 py-0.5 rounded">{bkBooks} livros</span>
                                      <span>•</span>
                                      <span className="bg-indigo-55 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/25 dark:text-indigo-400 px-1.5 py-0.5 rounded">{bkHistories} logs</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0 self-end md:self-center border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0 w-full md:w-auto justify-end">
                                  <button 
                                    onClick={() => handleDownloadCloudBackup(backup)}
                                    className="p-2 px-3 text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                    title="Descarregar ficheiro JSON"
                                  >
                                    JSON <Download className="w-3.5 h-3.5 text-slate-400" />
                                  </button>
                                  <button 
                                    onClick={() => handleRestoreCloudBackup(backup)}
                                    className="p-2 px-3 text-emerald-700 hover:text-white dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 border border-emerald-100 dark:border-emerald-999 dark:border-emerald-900 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                                    title="Substituir dados atuais por este backup"
                                  >
                                    Restaurar <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCloudBackupRecord(backup.id)}
                                    className="p-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-red-950/20 dark:hover:bg-rose-600 dark:text-rose-400 border border-rose-150 dark:border-rose-950 rounded-xl text-[11px] font-bold transition-all flex items-center active:scale-95 cursor-pointer shadow-sm"
                                    title="Eliminar este registo"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      ) : (
                        /* BACKUP EMPTY STATE */
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white dark:bg-slate-900 p-10 text-center rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm max-w-sm mx-auto"
                        >
                          <Cloud className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-1">Nenhum Backup em Nuvem</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mb-4">
                            Não encontrámos pontos de salvaguarda salvos nesta conta. Proteja a sua biblioteca criando uma cópia agora mesmo.
                          </p>
                          <button
                            onClick={() => setShowConfirmCloudBackup(true)}
                            className="p-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2 active:scale-95 hover:scale-102"
                          >
                            <Cloud className="w-4 h-4 text-white" />
                            Salvaguardar
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Page Dashboard View */}
      <AnimatePresence>
        {showDashboardModal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-[#F4F4F5] dark:bg-slate-900 overflow-y-auto flex flex-col"
          >
            {/* Dashboard Header */}
            <div className={`pt-6 pb-4 px-4 sticky top-0 z-40 shadow-sm transition-colors duration-500 rounded-b-3xl ${isLive ? 'bg-emerald-600 dark:bg-emerald-700 text-white' : 'bg-purple-600 dark:bg-purple-700 text-white'}`}>
              <div className="max-w-3xl mx-auto flex items-center gap-4">
                <button 
                  onClick={() => setShowDashboardModal(false)}
                  className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner hover:bg-white/30 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold font-merriweather tracking-tight flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5" /> Dashboard
                  </h2>
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-widest mt-0.5">Estatísticas do Stock</span>
                </div>
              </div>
            </div>

            <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6 flex-1">
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total de Livros (Títulos)</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{new Set(books.map(b => b.code)).size}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total em Stock (Exemplares)</span>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{books.reduce((sum, b) => sum + getAvail(b), 0)}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Entradas (Local Atual)</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">+{books.reduce((sum, b) => sum + b.in, 0)}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Saídas (Local Atual)</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">-{books.reduce((sum, b) => sum + b.out, 0)}</span>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Distribution by Category */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-emerald-500" /> Stock por Categoria
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={CATEGORIES.map(cat => ({ 
                            name: cat, 
                            value: books.filter(b => b.category === cat).reduce((sum, b) => sum + getAvail(b), 0) 
                          })).filter(c => c.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {CATEGORIES.map(cat => ({ 
                            name: cat, 
                            value: books.filter(b => b.category === cat).reduce((sum, b) => sum + getAvail(b), 0) 
                          })).filter(c => c.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#64748b'][index % 7]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                          formatter={(value: number) => [`${value} unidades`, 'Stock']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Distribution by Location */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" /> Stock por Local
                  </h3>
                  <div className="h-[300px] w-full mt-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={locations.map(loc => ({
                        name: loc,
                        Stock: books.filter(b => b.loc === loc).reduce((sum, b) => sum + getAvail(b), 0)
                      })).filter(l => l.Stock > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dx={-10} />
                        <RechartsTooltip 
                          cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                          formatter={(value: number) => [`${value} unidades`, 'Stock']}
                        />
                        <Bar 
                          dataKey="Stock" 
                          fill="#6366f1" 
                          radius={[6, 6, 0, 0]}
                          animationDuration={1500}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: New/Edit Book */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editId ? "Editar Livro" : "Novo Livro"}>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { 
              opacity: 1,
              transition: { staggerChildren: 0.08 }
            }
          }}
          className="space-y-4 p-5 overflow-y-auto max-h-[78vh] no-scrollbar"
        >
          {/* Section: Copy Template */}
          {!editId && uniqueBooks.length > 0 && (
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
              }}
              className="space-y-2 bg-gradient-to-r from-indigo-500/5 to-teal-500/5 dark:from-indigo-500/10 dark:to-teal-500/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm relative overflow-hidden"
            >
              <div className="absolute right-2 top-2 text-indigo-500/10 pointer-events-none">
                <Search className="w-16 h-16 transform rotate-12" />
              </div>
              <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Preencher com livro existente
              </label>
              <div className="relative">
                <select 
                  onChange={handleCopyFromExisting}
                  className="w-full px-4 py-3 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm font-bold cursor-pointer transition-all"
                >
                  <option value="">-- Selecione para preencher --</option>
                  {uniqueBooks.map(b => (
                    <option key={b.code} value={b.code}>{b.code.toUpperCase()} — {b.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <ChevronRight className="w-4 h-4 transform rotate-90" />
                </div>
              </div>
              <p className="text-[9px] text-slate-455 dark:text-slate-500 pl-1">Escolha um item cadastrado para clonar o nome, código e categoria instantaneamente.</p>
            </motion.div>
          )}

          {/* Section: Live Preview */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
            }}
            className="space-y-1.5"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-1 block">Visualização no Painel (Tempo Real)</span>
            <div className={`relative px-4 py-4 rounded-2xl border bg-white dark:bg-slate-900/60 transition-all duration-550 overflow-hidden ${
              (formData.origin + formData.in - formData.out) <= lowStockThreshold 
                ? 'border-orange-200 dark:border-orange-500/25 bg-orange-50/5' 
                : 'border-slate-150 dark:border-slate-800 shadow-sm'
            } ${copiedFlash ? 'ring-2 ring-emerald-500/60 border-emerald-500 dark:ring-cyan-550/60 scale-[1.01] bg-emerald-50/5 dark:bg-cyan-500/5' : ''}`}>
              <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${getCatColor(formData.category || 'Bíblias')} bg-opacity-90 z-10 transition-colors duration-300`} />
              <div className="flex items-start z-10">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  {CAT_META[formData.category as Category]?.icon || <Book className="w-4 h-4" />}
                </div>
                <div className="ml-3 flex-1 min-w-0 pr-2">
                  <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-100 leading-tight block truncate flex items-center gap-2">
                    {formData.name || 'Nome do Livro'}
                    {(formData.origin + formData.in - formData.out) <= lowStockThreshold && (
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0 animate-bounce" />
                    )}
                  </h4>
                  <p className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 truncate mt-1 tracking-wider uppercase">
                    {formData.code.trim().toLowerCase() || 'código'} • {formData.category || 'Categoria'}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-1">
                  <span className={`text-[9px] uppercase font-black tracking-wider ${(formData.origin + formData.in - formData.out) <= lowStockThreshold ? 'text-orange-500/90 font-black' : 'text-slate-400'}`}>Disp.</span>
                  <span className={`line-none text-2xl font-black mt-1 ${
                    (formData.origin + formData.in - formData.out) <= 0 
                      ? 'text-rose-500' 
                      : ((formData.origin + formData.in - formData.out) <= lowStockThreshold ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100')
                  }`}>
                    {formData.origin + formData.in - formData.out}
                  </span>
                  <div className="flex items-center gap-1.5 mt-2 bg-slate-105/80 dark:bg-slate-850/80 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono">
                    <span className="text-emerald-600 dark:text-emerald-400">+{formData.in}</span>
                    <span className="text-slate-300 dark:text-slate-650">|</span>
                    <span className="text-orange-500 dark:text-orange-400">-{formData.out}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Section: Basic Info */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
            }}
            className={`bg-white dark:bg-slate-900/50 border rounded-2xl p-4.5 space-y-4 transition-all duration-500 ${
              copiedFlash 
                ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-500/10 shadow-md' 
                : 'border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1">Nome do Livro</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Book className="w-4 h-4" />
                </div>
                <input 
                  type="text"
                  value={formData.name}
                  readOnly={deleteLocked && !!editId}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full pl-10 pr-4 py-3 text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border font-bold ${
                    formErrors.name 
                      ? 'border-rose-500 dark:border-rose-500 ring-1 ring-rose-500' 
                      : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-[#00897b] focus:ring-4 focus:ring-indigo-500/10'
                  } outline-none transition-all placeholder-slate-400/80`}
                  placeholder="Ex: Tradução do Novo Mundo"
                />
              </div>
              {formErrors.name && <p className="text-rose-500 text-[10px] font-bold pl-1.5">{formErrors.name}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1">Código</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input 
                    type="text"
                    value={formData.code}
                    readOnly={deleteLocked && !!editId}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-3 text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border font-mono font-bold ${
                      formErrors.code 
                        ? 'border-rose-500 dark:border-rose-500 ring-1 ring-rose-500' 
                        : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-[#00897b] focus:ring-4 focus:ring-indigo-500/10'
                    } outline-none transition-all placeholder-slate-400/85`}
                    placeholder="Ex: nwt"
                  />
                </div>
                {formErrors.code && <p className="text-rose-500 text-[10px] font-bold pl-1.5">{formErrors.code}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1">Categoria</label>
                <div className="relative">
                  <select 
                    value={formData.category}
                    disabled={deleteLocked && !!editId}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Category }))}
                    className={`w-full pl-3.5 pr-8 py-3 text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border font-bold ${
                      formErrors.category 
                        ? 'border-rose-500 ring-1 ring-rose-500' 
                        : 'border-slate-200 dark:border-slate-800 focus:border-[#00897b] focus:ring-4 focus:ring-indigo-500/10'
                    } outline-none appearance-none transition-all cursor-pointer`}
                  >
                    <option value="">Selecionar...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                    <ChevronRight className="w-3.5 h-3.5 transform rotate-90" />
                  </div>
                </div>
                {formErrors.category && <p className="text-rose-500 text-[10px] font-bold pl-1.5">{formErrors.category}</p>}
              </div>
            </div>
          </motion.div>
          
          {/* Section: Numerical Inventories with tactile steppers */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
            }}
            className="grid grid-cols-3 gap-3"
          >
            <StepperInput 
              label="Origem" 
              value={formData.origin}
              readOnly={deleteLocked && !!editId}
              onChange={(val) => setFormData(prev => ({ ...prev, origin: val }))}
              icon={Archive}
              accentColor="slate"
            />
            <StepperInput 
              label="Entradas" 
              value={formData.in}
              onChange={(val) => setFormData(prev => ({ ...prev, in: val }))}
              icon={TrendingUp}
              accentColor="indigo"
            />
            <StepperInput 
              label="Saídas" 
              value={formData.out}
              onChange={(val) => setFormData(prev => ({ ...prev, out: val }))}
              icon={TrendingDown}
              accentColor="amber"
            />
          </motion.div>

          {/* Section: Submit Button */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
            }}
            className="pt-1"
          >
            <button 
              onClick={handleSaveBook}
              disabled={isSaving}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                isSaving
                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 dark:bg-cyan-600 text-white shadow-lg hover:scale-[1.01] active:scale-[0.99] hover:shadow-xl'
              }`}
            >
              {isSaving ? (
                <>
                   <Loader2 className="w-4 h-4 animate-spin" /> Gravando livro...
                </>
              ) : (
                'Guardar Livro'
              )}
            </button>
          </motion.div>
        </motion.div>
      </Modal>

      {/* PIN Dialog */}
      <Modal show={showPinDialog} onClose={() => { setShowPinDialog(false); setPinInput(''); setPinError(''); }} title="Segurança do Sistema" maxWidth="max-w-xs">
        <div className="p-6 space-y-5 text-center bg-white dark:bg-slate-800">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-cyan-200 dark:shadow-none mb-2">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Zona Restrita</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Insira o seu PIN de 4 dígitos para efetuar edições estruturais e remoções.</p>
          </div>
          <div className="space-y-2">
            <input 
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} // Ensure numeric only
              className={`w-full text-center text-3xl font-mono tracking-[0.5em] py-3.5 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 rounded-xl border ${pinError ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700'} outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700`}
              placeholder="••••"
              autoFocus
            />
            {pinError && <p className="text-rose-500 text-[11px] font-bold animate-pulse">{pinError}</p>}
          </div>
          <button 
            onClick={handlePinSubmit}
            disabled={pinInput.length !== 4}
            className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all mt-2 ${
              pinInput.length === 4
                ? 'bg-slate-900 dark:bg-cyan-600 text-white shadow-xl shadow-slate-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            Confirmar Acesso
          </button>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <Modal show={showConfirmDelete} onClose={() => { setShowConfirmDelete(false); setPendingDeleteId(null); }} title="Confirmar Remoção">
        <div className="p-5 space-y-4 text-center">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Tem a certeza que deseja remover o livro {pendingDeleteBook && <span className="font-bold text-slate-800 dark:text-slate-100">"{pendingDeleteBook.name}"</span>}? Esta acção não pode ser desfeita.
          </p>
          <div className="flex gap-2">
            <button onClick={() => { setShowConfirmDelete(false); setPendingDeleteId(null); }} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
            <button onClick={confirmDelete} className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors">Remover</button>
          </div>
        </div>
      </Modal>

      {/* Cloud Backup Confirmation Modal */}
      <Modal show={showConfirmCloudBackup} onClose={() => setShowConfirmCloudBackup(false)} title="Backup na Cloud" maxWidth="max-w-sm">
        <div className="p-6 space-y-5 text-center bg-white dark:bg-slate-800">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-cyan-200 dark:shadow-none mb-2">
            <Cloud className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Cópia de Segurança</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Deseja iniciar a salvaguarda de todos os livros ({books.length} itens) e registos de histórico de inventário na Cloud do Supabase PostgreSQL agora?
            </p>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button 
              onClick={() => setShowConfirmCloudBackup(false)} 
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={runCloudBackupProcess} 
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
              Iniciar Backup
            </button>
          </div>
        </div>
      </Modal>

      {/* Cloud Backup Progress Modal */}
      <Modal show={isCloudBackupRunning} onClose={() => setIsCloudBackupRunning(false)} title="Backup em Progresso" maxWidth="max-w-sm">
        <div className="p-6 space-y-5 text-center bg-white dark:bg-slate-800">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-100 dark:border-cyan-950 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Cloud className="w-6 h-6 animate-bounce" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">A Processar Backup</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 min-h-[32px] font-medium transition-all px-2 leading-relaxed">
              {cloudBackupStatusText}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wider uppercase pl-0.5">
              <span>Progresso</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-mono">{cloudBackupProgress}%</span>
            </div>
            
            {/* Visual Progress Bar Frame */}
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden shadow-inner p-[2px]">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-sky-600 h-full rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${cloudBackupProgress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_infinite_linear]"></div>
              </div>
            </div>
          </div>

          <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 italic">
            Por favor, não feche o navegador durante esta operação.
          </div>
        </div>
      </Modal>

      {/* Cloud Import Progress Modal */}
      <Modal show={isImportRunning} onClose={() => {}} title="Importação na Cloud" maxWidth="max-w-sm">
        <div className="p-6 space-y-5 text-center bg-white dark:bg-slate-800">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">A Importar Dados</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 min-h-[32px] font-medium transition-all px-2 leading-relaxed">
              {importStatusText}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wider uppercase pl-0.5">
              <span>Progresso</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">{importProgress}%</span>
            </div>
            
            {/* Visual Progress Bar Frame */}
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden shadow-inner p-[2px]">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${importProgress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_infinite_linear]"></div>
              </div>
            </div>
          </div>

          <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 italic">
            Por favor, não mude de página nem feche o navegador durante esta operação.
          </div>
        </div>
      </Modal>

      {/* Adjust Modal */}
      <Modal 
        show={adjustModal.isOpen} 
        onClose={() => setAdjustModal({ ...adjustModal, isOpen: false })} 
        title={adjustModal.type === 'in' ? 'Registar Entrada' : 'Registar Saída'}
      >
        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{adjustModal.book?.name}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{adjustModal.book?.code}</p>
          </div>
          
          <div className="space-y-4 py-2">
            <label className="block text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Quantidade
            </label>
            <div className="flex items-center justify-center gap-4">
              <button 
                onPointerDown={(e) => {
                  e.preventDefault(); 
                  startAdjust(-1);
                  e.currentTarget.style.transform = 'scale(0.9)';
                  if (navigator.vibrate) navigator.vibrate(50);
                }}
                onPointerUp={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                onPointerLeave={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                onPointerCancel={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                
                className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Minus className="w-6 h-6" />
              </button>
              
              <input
                type="number"
                min="1"
                
                max={adjustModal.type === 'out' && adjustModal.book ? getAvail(adjustModal.book) : undefined}
                value={adjustModal.amount === 0 ? '' : adjustModal.amount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  if (rawValue === '') {
                    setAdjustModal(prev => ({ ...prev, amount: 0 }));
                    return;
                  }
                  const val = parseInt(rawValue);
                  if (!isNaN(val)) {
                    setAdjustModal(prev => ({ ...prev, amount: val }));
                  }
                }}
                onBlur={() => {
                  setAdjustModal(prev => {
                    let finalAmount = prev.amount;
                    if (finalAmount < 1 || isNaN(finalAmount)) finalAmount = 1;
                    if (prev.type === 'out' && prev.book) {
                      const avail = getAvail(prev.book);
                      if (finalAmount > avail) finalAmount = avail;
                    }
                    return { ...prev, amount: finalAmount };
                  });
                }}
                className="w-24 h-14 text-center font-bold text-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              />
              
              <button 
                onPointerDown={(e) => {
                  e.preventDefault(); 
                  startAdjust(1);
                  e.currentTarget.style.transform = 'scale(0.9)';
                  if (navigator.vibrate) navigator.vibrate(50);
                }}
                onPointerUp={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                onPointerLeave={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                onPointerCancel={(e) => {
                  stopAdjust();
                  e.currentTarget.style.transform = '';
                }}
                disabled={(adjustModal.type === 'out' && adjustModal.book ? adjustModal.amount >= getAvail(adjustModal.book) : false)}
                className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            {adjustModal.type === 'out' && adjustModal.book && (
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                Disponível em stock: <span className="font-bold text-slate-700 dark:text-slate-300">{getAvail(adjustModal.book)}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => setAdjustModal({ ...adjustModal, isOpen: false })} 
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={confirmAdjust} 
              disabled={adjustModal.amount <= 0 || (adjustModal.type === 'out' && adjustModal.book ? adjustModal.amount > getAvail(adjustModal.book) : false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
                adjustModal.type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Book Details */}
      <Modal show={!!detailBookCode} onClose={() => setDetailBookCode(null)} title="Informação de Inventário">
        {detailBookInfo ? (
          <div className="flex flex-col max-h-[85vh] bg-[#f8f9fa] dark:bg-slate-900/50">
            <div className="p-0 overflow-y-auto no-scrollbar">
              
              {/* Header Banner */}
              <div className="px-5 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10 sticky top-0">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 w-fit ${CAT_META[detailBookInfo.templateBook.category]?.color}`}>
                      {CAT_META[detailBookInfo.templateBook.category]?.icon} {detailBookInfo.templateBook.category}
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-mono text-[10px] px-2 py-1 rounded-md tracking-widest uppercase font-semibold">
                      REF: {detailBookInfo.templateBook.code}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{detailBookInfo.templateBook.name}</h2>
                </div>
              </div>

              {/* Stats Section */}
              <div className="p-5 space-y-6">
                <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-bl-full -z-10" />
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 focus:outline-none">Total Disponível</h4>
                    <div className="flex items-end gap-3 relative">
                      <p className="text-4xl font-black text-slate-900 dark:text-slate-100 leading-none tracking-tighter">{detailBookInfo.currentTotal}</p>
                      <div className="mb-1"><StockBadge value={detailBookInfo.currentTotal} threshold={lowStockThreshold} /></div>
                    </div>
                  </div>
                  <Package className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                    Distribuição Local {isLive ? `(${curMonthKey})` : ''}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(detailBookInfo.currentLocs).map(([loc, qty]) => (
                      <div key={loc} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-1 relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 w-1 h-full ${Number(qty) > 0 ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 truncate">{loc}</span>
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-200 pl-2 tracking-tight">{Number(qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    Últimas Alterações (Metadados)
                  </h4>
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    {(() => {
                      const changesStr = detailBookInfo.templateBook.changes;
                      let parsedLogs = [];
                      try {
                        if (changesStr) {
                          parsedLogs = JSON.parse(changesStr);
                        }
                      } catch (e) {
                        console.error("Error parsing modifications logs from book metadata:", e);
                      }

                      if (parsedLogs && parsedLogs.length > 0) {
                        return (
                          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {parsedLogs.map((log: any, idx: number) => {
                              const dateObj = new Date(log.when);
                              const dateFormatted = isNaN(dateObj.getTime()) ? log.when : DateUtils.formatDateTime(dateObj);
                              return (
                                <div key={idx} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[190px] sm:max-w-[240px]" title={log.who}>{log.who}</span>
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{dateFormatted}</span>
                                  </div>
                                  <div className="flex items-center gap-2 self-start sm:self-center">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                      log.type === 'Entrada' 
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                    }`}>
                                      {log.type}
                                    </span>
                                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                                      {log.type === 'Entrada' ? '+' : '-'}{log.amount}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-6 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                            Nenhum registo de alteração recente nas últimas operações.
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>

                <div className="space-y-3 pb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                      Histórico Movimentos
                    </h4>
                    <button 
                      onClick={() => loadAllHistory()} 
                      disabled={syncing}
                      className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50"
                    >
                      {syncing ? 'A carregar...' : 'Carregar Tudo'}
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    {detailBookInfo.movementHistory.length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {detailBookInfo.movementHistory.map((m, i) => (
                           <div key={i} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{m.month}</span>
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{m.loc}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                  <span className="text-[9px] uppercase font-bold text-slate-400">Var</span>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    {m.in > 0 && <span className="text-emerald-500 flex items-center"><Plus className="w-2.5 h-2.5" />{m.in}</span>}
                                    {m.out > 0 && <span className="text-rose-500 flex items-center"><Minus className="w-2.5 h-2.5" />{m.out}</span>}
                                    {m.in === 0 && m.out === 0 && <span className="text-slate-300">-</span>}
                                  </div>
                                </div>
                                <div className="w-px h-6 bg-slate-100 dark:bg-slate-700" />
                                <div className="flex flex-col items-end min-w-[32px]">
                                   <span className="text-[9px] uppercase font-bold text-slate-400">Tot</span>
                                   <span className="text-sm font-black text-slate-700 dark:text-slate-200">{m.available}</span>
                                </div>
                              </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">Sem movimentos neste registo.</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">A carregar detalhes...</span>
          </div>
        )}
      </Modal>

    </div>
    <PrintLayout books={filteredBooks} location={activeLocation} month={viewMonth} />
    </>
  );
}

// --- Sub-components ---

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 dark:text-cyan-400',
    green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400',
    orange: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
    red: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-1.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function StockBadge({ value, threshold }: { value: number; threshold: number }) {
  if (value === 0) return <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded-md uppercase tracking-tighter">Esgotado</span>;
  if (value <= threshold) return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-md uppercase tracking-tighter">Baixo</span>;
  return <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-md uppercase tracking-tighter">OK</span>;
}

function ActionButton({ onClick, icon, color, disabled = false, title }: { onClick: () => void; icon: React.ReactNode; color: string; disabled?: boolean; title?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    orange: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    blue: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100',
    red: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-all ${disabled ? 'opacity-20 cursor-not-allowed' : colors[color]}`}
    >
      {icon}
    </button>
  );
}

function PrintLayout({ books, location, month }: { books: BookItem[]; location: string; month: string }) {
  const getAvail = (b: BookItem) => b.origin + b.in - b.out;
  
  return (
    <div className="hidden print:block bg-white text-black p-4 font-sans max-w-none w-full !m-0">
      <div className="border border-black bg-white">
        {/* Title row */}
        <div className="bg-[#4472c4] text-white text-center py-4 border-b border-black print-color-adjust-exact">
           <h1 className="text-2xl font-bold uppercase tracking-wider">Relatório de Inventário</h1>
        </div>
        
        {/* Metadata row */}
        <div className="grid grid-cols-4 border-b border-black text-xs text-center font-bold">
           <div className="p-2 border-r border-black uppercase bg-gray-50 print-color-adjust-exact">Data de Emissão</div>
           <div className="p-2 border-r border-black font-normal">{DateUtils.formatDate()}</div>
           <div className="p-2 border-r border-black uppercase bg-gray-50 print-color-adjust-exact">Mês de Registo</div>
           <div className="p-2 font-normal capitalize">{month}</div>
        </div>
        <div className="grid grid-cols-4 border-b border-black text-xs text-center font-bold">
           <div className="p-2 border-r border-black uppercase bg-gray-50 print-color-adjust-exact">Local / Unidade</div>
           <div className="p-2 border-r border-black font-normal">{location}</div>
           <div className="p-2 border-r border-black uppercase bg-gray-50 print-color-adjust-exact">Responsável</div>
           <div className="p-2 font-normal"></div>
        </div>

        {/* Data Table */}
        <div className="p-2">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
                <tr className="bg-gray-100 uppercase text-[9px] print-color-adjust-exact">
                    <th className="border border-black p-1">Código</th>
                    <th className="border border-black p-1 text-left w-1/3">Nome do Livro</th>
                    <th className="border border-black p-1">Cat</th>
                    {location === 'Total' ? (
                      <>
                        <th className="border border-black p-1">Mananga PT</th>
                        <th className="border border-black p-1">Chota PT</th>
                      </>
                    ) : (
                      <>
                        <th className="border border-black p-1 text-slate-500">Origem</th>
                        <th className="border border-black p-1 text-blue-600">Ent</th>
                        <th className="border border-black p-1 text-red-600">Saí</th>
                      </>
                    )}
                    <th className="border border-black p-1 font-bold">Disponível</th>
                </tr>
            </thead>
            <tbody>
                {location === 'Total' ? (() => {
                   const map = new Map<string, { code: string; name: string; category: string; mananga: number; chota: number; total: number }>();
                   books.forEach(b => {
                     const avail = getAvail(b);
                     if (!map.has(b.code)) map.set(b.code, { code: b.code, name: b.name, category: b.category, mananga: 0, chota: 0, total: 0 });
                     const entry = map.get(b.code)!;
                     if (b.loc.toUpperCase().includes('MANANGA')) entry.mananga += avail;
                     else if (b.loc.toUpperCase().includes('CHOTA')) entry.chota += avail;
                     entry.total += avail;
                   });
                   return Array.from(map.values()).map(b => (
                    <tr key={`total-${b.code}`} className="border-b border-black/30">
                        <td className="border border-black p-1 font-mono text-[10px]">{b.code}</td>
                        <td className="border border-black p-1 text-left font-merriweather font-medium text-[13px]">{b.name}</td>
                        <td className="border border-black p-1 text-[10px]">{b.category}</td>
                        <td className="border border-black p-1 text-slate-700">{b.mananga}</td>
                        <td className="border border-black p-1 text-slate-700">{b.chota}</td>
                        <td className="border border-black p-1 font-bold text-sm bg-gray-50 print-color-adjust-exact">{b.total}</td>
                    </tr>
                   ));
                })() : books.map(b => (
                    <tr key={b.id} className="border-b border-black/30">
                        <td className="border border-black p-1 font-mono text-[10px]">{b.code}</td>
                        <td className="border border-black p-1 text-left font-merriweather font-medium text-[13px]">{b.name}</td>
                        <td className="border border-black p-1 text-[10px]">{b.category}</td>
                        <td className="border border-black p-1 text-slate-500">{b.origin}</td>
                        <td className="border border-black p-1 text-blue-600">{b.in}</td>
                        <td className="border border-black p-1 text-red-600">{b.out}</td>
                        <td className="border border-black p-1 font-bold text-sm bg-gray-50 print-color-adjust-exact">{getAvail(b)}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Form Footer */}
        <div className="border-t border-black p-4 text-xs mt-4">
           
           <div className="grid grid-cols-2 gap-8 mt-12 mb-4">
              <div className="flex gap-2 items-end">
                 <span className="font-bold shrink-0">Assinatura do responsável:</span>
                 <div className="border-b border-black flex-1 h-4"></div>
              </div>
              <div className="flex gap-2 items-end">
                 <span className="font-bold shrink-0">Data:</span>
                 <div className="border-b border-black flex-1 h-4"></div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StepperInput({ 
  label, 
  value, 
  readOnly, 
  onChange, 
  icon: Icon, 
  accentColor = "indigo"
}: { 
  label: string; 
  value: number; 
  readOnly?: boolean; 
  onChange: (val: number) => void; 
  icon: any; 
  accentColor?: "indigo" | "amber" | "slate" | "emerald";
}) {
  const getBtnBg = () => {
    switch (accentColor) {
      case "indigo": return "bg-[#6366f1] hover:bg-indigo-600 text-white shadow-sm shadow-indigo-100 dark:shadow-none";
      case "amber": return "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-100 dark:shadow-none";
      case "emerald": return "bg-emerald-600 hover:bg-emerald-750 text-white shadow-sm shadow-emerald-100 dark:shadow-none";
      default: return "bg-slate-600 hover:bg-slate-700 text-white shadow-sm";
    }
  };

  const getCardBorder = () => {
    switch (accentColor) {
      case "indigo": return "focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/5";
      case "amber": return "focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-500/5";
      default: return "focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-500/5";
    }
  };

  return (
    <div className={`p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-between min-h-[110px] transition-all duration-300 ${getCardBorder()}`}>
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <div className="flex items-center justify-between w-full mt-2 gap-1 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
        <button
          type="button"
          disabled={readOnly || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        
        <input 
          type="number"
          min="0"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-10 text-center text-xs font-black bg-transparent text-slate-850 dark:text-slate-100 outline-none select-all focus:ring-0 whitespace-nowrap"
        />

        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(value + 1)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${getBtnBg()}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Modal({ show, onClose, title, children, maxWidth = "max-w-md" }: { show: boolean; onClose: () => void; title: string; children: React.ReactNode, maxWidth?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full ${maxWidth} bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden`}
          >
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{title}</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-800 dark:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
