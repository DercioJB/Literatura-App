import React, { useState } from 'react';
import { supabase } from '../supabase';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  Camera
} from 'lucide-react';

export default function LoginScreen() {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#00897b'); // Default nice teal
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Predefined elegant avatar colors for new accounts
  const avatarPresets = [
    { name: 'Teal', value: '#00897b' },
    { name: 'Purple', value: '#7b1fa2' },
    { name: 'Blue', value: '#0284c7' },
    { name: 'Rose', value: '#e11d48' },
    { name: 'Amber', value: '#d97706' },
  ];

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao autenticar com o Google (${err.message || 'Desconhecido'}). Tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (view === 'register' && !name.trim()) {
      setError('Por favor, introduza o seu nome.');
      return;
    }

    if (password.length < 6) {
      setError('A palavra-passe deve conter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
      } else {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=${avatarColor.replace('#', '')}`;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: name.trim(),
              avatar_url: avatarUrl,
              displayName: name.trim(),
              photoURL: avatarUrl
            }
          }
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Supabase auth error details:", err);
      setError(err.message || 'Erro no servidor de autenticação do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-portal" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-300">
      {/* Decorative ambient background lights */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#00897b]/10 dark:bg-[#00897b]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#7b1fa2]/10 dark:bg-[#7b1fa2]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden relative z-10 transition-all duration-300">
        
        {/* Superior Header Branding */}
        <div className="pt-10 pb-6 px-8 text-center flex flex-col items-center">
          <div className="relative mb-4 group">
            <img 
              src="/icon.png" 
              alt="Literatura Logo" 
              className="w-16 h-16 rounded-2xl shadow-lg object-cover bg-white ring-4 ring-[#00897b]/10 transition-transform duration-500 group-hover:scale-105" 
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center shadow-md">
              <ShieldCheck className="w-3 h-3 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            {view === 'login' ? 'Iniciar Sessão' : 'Criar Conta'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {view === 'login' 
              ? 'Controle o inventário e movimentos de literatura' 
              : 'Registe o seu utilizador para sincronização em tempo real'}
          </p>
        </div>

        {/* Auth Forms */}
        <div className="px-8 pb-8 space-y-6">
          {error && (
            <div id="auth-error" className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form id="auth-form" onSubmit={handleEmailPasswordSubmit} className="space-y-4.5">
            {view === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Nome Completo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-5 py-3 bg-slate-50 dark:bg-slate-950/40 text-slate-950 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 focus:border-[#00897b] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#00897b]/10 dark:focus:ring-emerald-500/10 outline-none text-xs font-bold transition-all"
                    placeholder="Como deseja ser chamado"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Endereço de E-mail</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-5 py-3 bg-slate-50 dark:bg-slate-950/40 text-slate-950 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 focus:border-[#00897b] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#00897b]/10 dark:focus:ring-emerald-500/10 outline-none text-xs font-bold transition-all"
                  placeholder="Email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Palavra-passe</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-950/40 text-slate-950 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 focus:border-[#00897b] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#00897b]/10 dark:focus:ring-emerald-500/10 outline-none text-xs font-bold transition-all font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
                  placeholder="No mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {view === 'register' && (
              <div className="space-y-2.5 pt-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-slate-400" /> Cor Temática do Perfil
                </label>
                <div className="flex gap-2.5">
                  {avatarPresets.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setAvatarColor(p.value)}
                      style={{ backgroundColor: p.value }}
                      className={`w-8 h-8 rounded-xl transition-all relative active:scale-95 cursor-pointer ${
                        avatarColor === p.value 
                          ? 'ring-4 ring-slate-200 dark:ring-slate-700 scale-110 shadow-sm' 
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={p.name}
                    >
                      {avatarColor === p.value && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-white rounded-full" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-white shadow-md hover:shadow-lg mt-6 ${
                view === 'login'
                  ? 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 
                  {view === 'login' ? 'Iniciando Sessão...' : 'Criando Conta...'}
                </>
              ) : (
                <>
                  {view === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" /> Entrar no Inventário
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> Registar Novo Utilizador
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ou prosseguir com</span>
            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100/80 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Conta Google Autêntica
          </button>

          {/* Toggle Button */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setView(view === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-slate-500 dark:text-slate-400 hover:text-[#00897b] dark:hover:text-emerald-400 text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5 focus:outline-none"
            >
              {view === 'login' ? (
                <>
                  Não tem uma conta própria? <span className="text-[#00897b] dark:text-emerald-400 font-extrabold flex items-center gap-0.5">Registe-se já <Sparkles className="w-3.5 h-3.5 animate-pulse" /></span>
                </>
              ) : (
                <>
                  Já tem conta registada? <span className="text-[#00897b] dark:text-emerald-400 font-extrabold">Inicie aqui a sessão</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
