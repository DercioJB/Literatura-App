import { useCallback, useEffect, useState } from 'react';
import { checkSupabaseStatus, isSupabaseConfigured, supabase, SupabaseStatus } from './supabase';

export interface BookItemCloud {
  id: string; // Row uuid
  workspaceId: string;
  accessList: string[];
  name: string;
  code: string;
  category: string;
  loc: string;
  origin: number;
  in: number;
  out: number;
  lastDate: string;
  lastMonth: string;
  changes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Map PostgreSQL snake_case columns to Javascript camelCase properties
function mapDbBookToJs(dbBook: any): BookItemCloud {
  return {
    id: dbBook.id,
    workspaceId: dbBook.workspace_id,
    accessList: Array.isArray(dbBook.access_list) ? dbBook.access_list : [],
    name: dbBook.name || '',
    code: dbBook.code || '',
    category: dbBook.category || '',
    loc: dbBook.loc || '',
    origin: Number(dbBook.origin) || 0,
    in: Number(dbBook.qty_in) || 0,
    out: Number(dbBook.qty_out) || 0,
    lastDate: dbBook.last_date || '',
    lastMonth: dbBook.last_month || '',
    changes: typeof dbBook.changes === 'object' ? JSON.stringify(dbBook.changes) : (dbBook.changes || '[]'),
    createdAt: dbBook.created_at,
    updatedAt: dbBook.updated_at,
  };
}

function mapJsBookToDb(jsBook: any, workspaceId: string, accessList: string[]) {
  return {
    workspace_id: workspaceId,
    access_list: accessList ?? [],
    name: jsBook.name || '',
    code: jsBook.code || '',
    category: jsBook.category || '',
    loc: jsBook.loc || '',
    origin: Number(jsBook.origin) || 0,
    qty_in: Number(jsBook.in) || 0,
    qty_out: Number(jsBook.out) || 0,
    last_date: jsBook.lastDate || new Date().toISOString().split('T')[0],
    last_month: jsBook.lastMonth || '',
    changes: typeof jsBook.changes === 'string' ? JSON.parse(jsBook.changes || '[]') : (jsBook.changes ?? []),
    updated_at: new Date().toISOString()
  };
}

export function useSupabaseSync() {
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [workspace, setWorkspace] = useState<{ id: string; accessList: string[]; locations: string[]; lowStockThreshold: number }>({
    id: 'global_workspace',
    accessList: [],
    locations: ['MANANGA PT', 'CHOTA PT'],
    lowStockThreshold: 10
  });
  const [books, setBooks] = useState<BookItemCloud[]>([]);
  const [historyDocs, setHistoryDocs] = useState<Record<string, BookItemCloud[]>>({});
  const [syncing, setSyncing] = useState(true);
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>({
    configured: isSupabaseConfigured,
    reachable: isSupabaseConfigured,
  });
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  const recheckConnection = useCallback(async () => {
    const status = await checkSupabaseStatus(true);
    setSupabaseStatus(status);
    if (status.configured && status.reachable) {
      setConnectionEpoch((prev) => prev + 1);
    }
    return status;
  }, []);

  // 1. Listen to Auth State change utilizing Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSupabaseStatus({ configured: false, reachable: false, code: 'NOT_CONFIGURED' });
      setUser(null);
      setAuthLoading(false);
      setSyncing(false);
      return;
    }

    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const syncProfile = async (u: any) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const name = u.user_metadata?.full_name || u.user_metadata?.displayName || u.email?.split('@')[0] || '';
        await supabase.from('profiles').upsert({
          id: u.id,
          name: name,
          email: u.email || '',
          role: (u.email && ['derciojaimebalane21@gmail.com', 'derciojaimebalane@outlook.com'].includes(u.email.toLowerCase().trim())) ? 'admin' : 'user'
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn("Error syncing profile to database:", e);
      }
    };

    const mapSupabaseUser = (u: any) => ({
      uid: u.id,
      email: u.email || '',
      displayName: u.user_metadata?.full_name || u.user_metadata?.displayName || u.email?.split('@')[0] || '',
      photoURL: u.user_metadata?.avatar_url || u.user_metadata?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.email || 'user')}`,
    });

    (async () => {
      const status = await checkSupabaseStatus(true);
      if (!isMounted) return;
      setSupabaseStatus(status);

      if (!status.configured || !status.reachable) {
        setUser(null);
        setAuthLoading(false);
        setSyncing(false);
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Unable to restore Supabase session:", error.message);
        }
        if (!isMounted) return;
        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
          syncProfile(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("Unexpected error initializing Supabase session:", err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
          syncProfile(session.user);
        } else {
          setUser(null);
          setBooks([]);
          setHistoryDocs({});
          setWorkspace({
            id: 'global_workspace',
            accessList: [],
            locations: ['MANANGA PT', 'CHOTA PT'],
            lowStockThreshold: 10
          });
        }
        setAuthLoading(false);
      });
      authSubscription = subscription;
    })();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, [connectionEpoch]);

  // 2. Fetch or initialize the Workspace
  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseStatus.reachable || !user) return;

    let isMounted = true;

    const fetchWorkspace = async () => {
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', 'global_workspace')
          .maybeSingle();

        if (error) {
          console.error("Error setting up workspace in Supabase:", error);
          return;
        }

        if (data && isMounted) {
          setWorkspace({
            id: 'global_workspace',
            accessList: Array.isArray(data.access_list) ? data.access_list : [],
            locations: Array.isArray(data.locations) ? data.locations : ['MANANGA PT', 'CHOTA PT'],
            lowStockThreshold: data.low_stock_threshold ?? 10
          });
        } else if (isMounted) {
          // If workspace doesn't exist, bootstrap it in public.workspaces
          const { data: newW, error: initErr } = await supabase
            .from('workspaces')
            .upsert({
              id: 'global_workspace',
              owner_id: user.uid,
              access_list: [],
              locations: ['MANANGA PT', 'CHOTA PT'],
              low_stock_threshold: 10
            })
            .select()
            .single();

          if (initErr) {
            console.error("Error creating global workspace standard config:", initErr);
          } else if (newW && isMounted) {
            setWorkspace({
              id: 'global_workspace',
              accessList: Array.isArray(newW.access_list) ? newW.access_list : [],
              locations: Array.isArray(newW.locations) ? newW.locations : ['MANANGA PT', 'CHOTA PT'],
              lowStockThreshold: newW.low_stock_threshold ?? 10
            });
          }
        }
      } catch (err) {
        console.error("Auth / Workspace subscription error: ", err);
      }
    };

    fetchWorkspace();

    // Live workspace changes
    const channel = supabase
      .channel('workspace-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspaces', filter: 'id=eq.global_workspace' },
        (payload) => {
          if (payload.new && isMounted) {
            const data = payload.new as any;
            setWorkspace({
              id: 'global_workspace',
              accessList: Array.isArray(data.access_list) ? data.access_list : [],
              locations: Array.isArray(data.locations) ? data.locations : ['MANANGA PT', 'CHOTA PT'],
              lowStockThreshold: data.low_stock_threshold ?? 10
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateWorkspaceSettings = async (locations: string[], threshold: number) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          locations,
          low_stock_threshold: threshold,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global_workspace');

      if (error) throw error;

      setWorkspace(prev => ({
        ...prev,
        locations,
        lowStockThreshold: threshold
      }));
    } catch(err) {
      console.error(err);
      throw err;
    }
  };

  const updateWorkspaceAccessList = async (accessList: any[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          access_list: accessList,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global_workspace');

      if (error) throw error;

      setWorkspace(prev => ({
        ...prev,
        accessList
      }));
    } catch(err) {
      console.error(err);
      throw err;
    }
  };

  // 3. Books synchronization
  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseStatus.reachable || !user || !workspace) return;
    setSyncing(true);

    const fetchBooks = async () => {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('workspace_id', workspace.id);

        if (error) {
          console.error("Error fetching books from Supabase Postgres:", error);
          return;
        }

        if (data) {
          setBooks(data.map(mapDbBookToJs));
        }
      } catch (err) {
        console.error("Error running query books inside Supabase sync: ", err);
      } finally {
        setSyncing(false);
      }
    };

    fetchBooks();

    // Subscribe to realtime changes!
    const channel = supabase
      .channel('books-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'books', filter: `workspace_id=eq.${workspace.id}` },
        () => {
          fetchBooks(); // Quick refresh
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, workspace.id]);

  // 4. Monthly History and Statistics management
  const loadHistoryMonth = async (monthKey: string) => {
    if (!workspace) return;
    if (loadedMonths.has(monthKey)) return;

    setSyncing(true);
    setLoadedMonths(prev => new Set(prev).add(monthKey));

    try {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('month_key', monthKey)
        .maybeSingle();

      if (error) {
        console.error("Failed to load history for month:", monthKey, error);
        return;
      }

      if (data && data.snapshots) {
        const parsedRaw = typeof data.snapshots === 'string' ? JSON.parse(data.snapshots) : data.snapshots;
        const parsed = Array.isArray(parsedRaw)
          ? parsedRaw.map((b: any, idx: number) => ({
              ...b,
              id: b.id || `hist-${monthKey}-${b.code || ''}-${b.loc || ''}-${idx}`
            }))
          : [];
        setHistoryDocs(prev => ({ ...prev, [monthKey]: parsed }));
      }
    } catch (e) {
      console.error("Failed to load history for month:", monthKey, e);
    } finally {
      setSyncing(false);
    }
  };

  const syncHistoryMonth = async (monthKey: string, monthBooks: BookItemCloud[]) => {
    if (!workspace) return;

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('history')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('month_key', monthKey)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      // Clean books snapshots while preserving unique id for React list rendering
      const snapshotsClean = monthBooks.map((b, idx) => {
        const { id, ...cleanData } = b;
        return {
          ...cleanData,
          id: id || `hist-${monthKey}-${b.code || ''}-${b.loc || ''}-${idx}`,
          changes: typeof b.changes === 'string' ? JSON.parse(b.changes || '[]') : (b.changes ?? [])
        };
      });

      const payload = {
        workspace_id: workspace.id,
        access_list: workspace.accessList,
        month_key: monthKey,
        snapshots: snapshotsClean,
        updated_at: new Date().toISOString()
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('history')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('history')
          .insert({
            ...payload,
            created_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      // Update local React state to reflect immediate saving for smooth UI
      setHistoryDocs(prev => ({
        ...prev,
        [monthKey]: monthBooks
      }));
    } catch (err) {
      console.error("Error syncing history month:", err);
      throw err;
    }
  };

  const loadAllHistory = async () => {
    if (!workspace) return {};
    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('workspace_id', workspace.id);

      if (error) throw error;

      const hist: Record<string, BookItemCloud[]> = {};
      const loaded = new Set<string>();

      if (data) {
        data.forEach(row => {
          if (row.snapshots && row.month_key) {
            try {
              const snapshotsRaw = typeof row.snapshots === 'string' ? JSON.parse(row.snapshots) : row.snapshots;
              const snapshotsObj = Array.isArray(snapshotsRaw)
                ? snapshotsRaw.map((b: any, idx: number) => ({
                    ...b,
                    id: b.id || `hist-${row.month_key}-${b.code || ''}-${b.loc || ''}-${idx}`
                  }))
                : [];
              hist[row.month_key] = snapshotsObj;
              loaded.add(row.month_key);
            } catch (err) {
              console.error(err);
            }
          }
        });
      }

      setHistoryDocs(hist);
      setLoadedMonths(loaded);
      return hist;
    } catch (err) {
      console.error("Failed to load all history", err);
      return {};
    } finally {
      setSyncing(false);
    }
  };

  // 5. CRUD implementations for books and items
  const saveBook = async (bookData: Omit<BookItemCloud, 'id' | 'workspaceId' | 'accessList'>, bookId?: string) => {
    if (!workspace) return;
    try {
      const dbPayload = mapJsBookToDb(bookData, workspace.id, workspace.accessList);

      if (bookId) {
        const { error } = await supabase
          .from('books')
          .update(dbPayload)
          .eq('id', bookId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('books')
          .insert({
            ...dbPayload,
            created_at: new Date().toISOString()
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error("Error saving book:", err);
      throw err;
    }
  };

  const deleteBook = async (bookId: string) => {
    if (!workspace) return;
    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting book:", err);
      throw err;
    }
  };

  // 6. Manual and cloud-hosted historical database backups
  const saveBackupToCloud = async (backupPayload: { books: any[], history: any }) => {
    if (!workspace) return;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('backups')
        .insert({
          workspace_id: workspace.id,
          access_list: workspace.accessList,
          backup_date: todayStr,
          payload: backupPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error("Error saving backup to cloud:", err);
      throw err;
    }
  };

  const loadCloudBackups = async () => {
    if (!workspace) return [];
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .eq('workspace_id', workspace.id);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        accessList: Array.isArray(row.access_list) ? row.access_list : [],
        backupDate: row.backup_date,
        payload: typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })).sort((a, b) => b.backupDate.localeCompare(a.backupDate));
    } catch (err) {
      console.error("Error loading backups:", err);
      return [];
    }
  };

  const deleteCloudBackup = async (backupId: string) => {
    if (!workspace) return;
    try {
      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('id', backupId);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting backup:", err);
      throw err;
    }
  };

  // 7. Auto migration logic (Firebase local data -> Supabase tables)
  const migrateLocalToCloud = async (
    localBooks: any[],
    localHistory: any,
    onProgress?: (percent: number, statusText: string) => void
  ) => {
    if (!workspace) return;

    if (onProgress) {
      onProgress(5, "A preparar migração e ligar ao Supabase PostgreSQL...");
    }

    try {
      // 1. Bulk insert books
      const cleanBooks = localBooks.map(b => ({
        workspace_id: workspace.id,
        access_list: workspace.accessList,
        name: b.name || '',
        code: b.code || '',
        category: b.category || '',
        loc: b.loc || '',
        origin: Number(b.origin) || 0,
        qty_in: Number(b.in) || 0,
        qty_out: Number(b.out) || 0,
        last_date: b.lastDate || new Date().toISOString().split('T')[0],
        last_month: b.lastMonth || '',
        changes: typeof b.changes === 'string' ? JSON.parse(b.changes || '[]') : (b.changes ?? []),
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Insert in chunks of 50 to avoid any database payload restrictions
      const chunkSize = 50;
      for (let i = 0; i < cleanBooks.length; i += chunkSize) {
        const chunk = cleanBooks.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('books')
          .insert(chunk);

        if (error) throw error;

        if (onProgress) {
          const percent = Math.min(80, Math.floor(((i + chunk.length) / cleanBooks.length) * 75) + 5);
          onProgress(percent, `A migrar livros de stock: ${i + chunk.length} de ${cleanBooks.length}...`);
        }
      }

      // 2. Insert history logs
      const historyKeys = Object.keys(localHistory);
      for (let j = 0; j < historyKeys.length; j++) {
        const monthKey = historyKeys[j];
        await syncHistoryMonth(monthKey, localHistory[monthKey]);

        if (onProgress) {
          const percent = Math.min(98, 80 + Math.floor(((j + 1) / historyKeys.length) * 18));
          onProgress(percent, `A migrar histórico mensal: ${j + 1} de ${historyKeys.length} (${monthKey})...`);
        }
      }

      if (onProgress) {
        onProgress(100, "Dados de stock e histórico importados com sucesso para o Supabase PostgreSQL!");
      }
    } catch (err) {
      console.error("Migration error:", err);
      if (onProgress) {
        onProgress(0, "Ocorreu um erro durante a migração no Supabase.");
      }
      throw err;
    }
  };

  const updateUserDisplayName = async (newName: string) => {
    if (!user) return;
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName, displayName: newName }
    });
    if (error) throw error;
    setUser(prev => prev ? { ...prev, displayName: newName } : null);
  };

  return {
    books,
    history: historyDocs,
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
    updateWorkspaceSettings,
    updateWorkspaceAccessList,
    updateUserDisplayName,
    supabaseStatus,
    recheckConnection
  };
}

// Backward compatibility alias
export function useFirebaseSync() {
  return useSupabaseSync();
}
