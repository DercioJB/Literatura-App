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
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

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
        const { data, error } = await supabase.auth.signUp({
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
        
        // Indicate registration succeeded
        setRegistrationSuccess(true);
      }
    } catch (err: any) {
      console.error("Supabase auth error details:", err);
      let errMsg = err.message || 'Erro no servidor de autenticação do Supabase.';
      
      if (errMsg.toLowerCase().includes('email not confirmed')) {
        errMsg = "E-mail não confirmado! Para resolver isto imediatamente, vá ao painel de controlo do seu Supabase, em Authentication > Providers > Email (clique para expandir). A opção \"Confirm email\" está no topo do formulário de Email, logo abaixo de \"Enable Email provider\" (antes das definições de SMTP). Desative-a e guarde as alterações.";
      }
      
      setError(errMsg);
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
        
        {registrationSuccess ? (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-10 h-10 animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                Conta registada!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Caso tenha a confirmação de e-mail ativa no seu Supabase, terá de clicar no link enviado para <strong className="text-[#00897b]">{email}</strong> antes de conseguir fazer login.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 text-left p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00897b] dark:text-[#00897b]">Dica de Programador:</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed font-bold">
                Como desativar a confirmação de e-mail no Supabase (não precisa de configurar SMTP):
              </p>
              <ul className="list-decimal list-inside text-[11px] text-slate-600 dark:text-slate-350 font-semibold space-y-1.5 mt-1 pl-1">
                <li>Aceda ao painel em <strong className="text-slate-700 dark:text-slate-200">supabase.com</strong></li>
                <li>Vá a <strong className="text-slate-700 dark:text-slate-200">Authentication &gt; Providers &gt; Email</strong> (clique para abrir)</li>
                <li>No topo deste menu, verá o interruptor <strong className="text-red-500 font-bold">"Confirm email"</strong>. Fica logo abaixo de "Enable Email provider" e <strong>antes</strong> do cabeçalho de SMTP.</li>
                <li>Desative-o e clique em <strong className="text-slate-700 dark:text-slate-200">Save</strong> no fundo do card.</li>
              </ul>
            </div>

            <button
              onClick={() => {
                setRegistrationSuccess(false);
                setView('login');
              }}
              className="w-full py-3.5 bg-[#00897b] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-teal-600 transition-all cursor-pointer shadow-md active:scale-95 duration-200"
            >
              Ir para o Login
            </button>
          </div>
        ) : (
          <>
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
                <div id="auth-error" className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed animate-shake whitespace-pre-line">
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
          </>
        )}

      </div>
    </div>
  );
}
