import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox'; // Importar Checkbox
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService } from '../../services/api';
import type { User } from '../../services/api';
import { Eye, EyeOff, Lock, Mail, Apple, HeartHandshake, UserPlus } from 'lucide-react'; // Adicionar ícones
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('admin@empresa.com'); // Alterado para admin@empresa.com
  const [loginPassword, setLoginPassword] = useState('admin123'); // Valor padrão
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para visibilidade da senha
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);

  // Estados para Cadastro
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpPasswordConfirm] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Tentando login com:', loginEmail, loginPassword);
      const user = await apiService.login(loginEmail, loginPassword);
      console.log('Resultado do login:', user);
      
      if (user) {
        setLoggedInUser(user);
        // Se o usuário deve forçar mudança de senha, abre o diálogo
        if (user.forcePasswordChange) {
          console.log('Usuário precisa alterar senha');
          setChangePasswordOpen(true);
        } else {
          console.log('Login bem-sucedido, entrando no sistema');
          onLoginSuccess(user);
        }
      } else {
        console.log('Login falhou - usuário ou senha inválidos');
        setError('Email ou senha inválidos');
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsSigningUp(true);
    try {
      const newUser = await apiService.register(
        signUpEmail, 
        signUpPassword, 
        signUpName, 
        'operational', 
        false // forcePasswordChange: false para auto-cadastro
      );
      
      if (newUser) {
        toast.success('Conta criada com sucesso! Faça login para continuar.');
        setLoginEmail(signUpEmail);
        setLoginPassword(signUpPassword);
        setSignUpOpen(false);
        // Limpar campos
        setSignUpName('');
        setSignUpEmail('');
        setSignUpPassword('');
        setSignUpPasswordConfirm('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setIsSigningUp(false);
    }
  };

  const handlePasswordChanged = () => {
    // Ao alterar a senha, faz login automático
    if (loggedInUser) {
      onLoginSuccess({
        ...loggedInUser,
        forcePasswordChange: false,
      });
    }
  };

  return (
    <>
      <div className="min-h-screen w-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4 py-10 font-sans antialiased">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-7 w-7 text-indigo-600" />
                <span className="text-lg font-bold text-gray-900">SEAGID</span>
              </div>
              <div>
                <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
                <CardDescription>
                  Insira seu e-mail e senha para acessar.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-gray-700">Email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@empresa.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-gray-700">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember-me" className="h-4 w-4" />
                    <Label htmlFor="remember-me" className="text-sm text-gray-900">Lembrar de mim</Label>
                  </div>
                  <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    Esqueceu a senha?
                  </a>
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-gray-600">Não tem uma conta? </span>
                <Dialog open={signUpOpen} onOpenChange={setSignUpOpen}>
                  <DialogTrigger asChild>
                    <button className="font-medium text-indigo-600 hover:text-indigo-500">
                      Registre-se agora
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-600" />
                        Criar Nova Conta
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados abaixo para começar a usar o SEAGID.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSignUp} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Nome Completo</Label>
                        <Input
                          id="signup-name"
                          placeholder="Ex: João Silva"
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">E-mail Corporativo</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="seu@empresa.com"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Senha</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                        <Input
                          id="signup-confirm"
                          type="password"
                          placeholder="Repita sua senha"
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSigningUp}>
                        {isSigningUp ? 'Criando Conta...' : 'Criar Minha Conta'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Social Login */}
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-gray-500">Ou faça login com</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full flex items-center justify-center">
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M44.5 20H24v8.5h11.8c-.7 4.5-4.5 7.9-9.8 7.9-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.9 1.4 7.9 3.4l6.1-5.9c-3.7-3.6-8.7-5.8-14-5.8-11.7 0-21.2 9.5-21.2 21.2s9.5 21.2 21.2 21.2c11.7 0 20.3-8.8 20.3-20.7 0-1.2-.1-2.3-.3-3.4z" fill="#FFC107"/>
                      <path d="M6.8 24c0-2.5.4-4.9 1.1-7H24v3.5H10.1c-.2 1.2-.4 2.5-.4 3.5s.2 2.3.4 3.5H24v3.5H7.9c-.7-2.1-1.1-4.5-1.1-7z" fill="#4285F4"/>
                      <path d="M24 44.5c5.3 0 9.8-1.8 13.1-4.8l-6.1-5.9c-2 1.4-4.5 2.2-7.1 2.2-5.9 0-10.7-4.8-10.7-10.7H6.8c.7 4.9 3.8 8.9 8.2 11.2l-1.3 1.3-4.4 4.3 1.3 1.3 4.4 4.3 1.3 1.3 4.4 4.3 1.3 1.3z" fill="#34A853"/>
                      <path d="M44.5 20H24v8.5h11.8c-.7 4.5-4.5 7.9-9.8 7.9-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.9 1.4 7.9 3.4l6.1-5.9c-3.7-3.6-8.7-5.8-14-5.8-11.7 0-21.2 9.5-21.2 21.2s9.5 21.2 21.2 21.2c11.7 0 20.3-8.8 20.3-20.7 0-1.2-.1-2.3-.3-3.4z" fill="#EA4335"/>
                    </svg>
                    Google
                  </Button>
                  <Button variant="outline" className="w-full flex items-center justify-center">
                    <Apple className="mr-2 h-5 w-5" />
                    Apple
                  </Button>
                </div>
              </div>

              {/* Login Simplificado e Contas de Demonstração */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">Contas de Demonstração (Mockadas)</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><span className="font-medium">admin@empresa.com</span> / <span className="font-medium">admin123</span></li>
                  <li><span className="font-medium">diretor@empresa.com</span> / <span className="font-medium">diretor123</span></li>
                  <li><span className="font-medium">gerente@empresa.com</span> / <span className="font-medium">gerente123</span></li>
                  <li><span className="font-medium">responsavel.tecnico@empresa.com</span> / <span className="font-medium">tecnico123</span></li>
                  <li><span className="font-medium">operacional@empresa.com</span> / <span className="font-medium">operacional123</span></li>
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-600 mb-2">
                    <strong>Problema ao logar?</strong> Clique no botão abaixo para limpar o cache local.
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => {
                      localStorage.clear();
                      window.location.reload();
                    }}
                  >
                    🔄 Limpar Cache e Recarregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
            <span>Copyright © 2025 SEAGID.</span>
            <a href="#" className="hover:underline">Privacy Policy</a>
          </div>
        </div>
      </div>

      {loggedInUser && (
        <ChangePasswordDialog
          user={loggedInUser}
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
          onPasswordChanged={handlePasswordChanged}
          forceChange={loggedInUser.forcePasswordChange}
        />
      )}
    </>
  );
}