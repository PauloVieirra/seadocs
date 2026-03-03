import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox'; // Importar Checkbox
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService } from '../../services/api';
import type { User } from '../../services/api';
import { Eye, EyeOff, Lock, Mail, HeartHandshake } from 'lucide-react'; // Adicionar ícones
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para visibilidade da senha
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await apiService.login(loginEmail, loginPassword);
      if (user) {
        setLoggedInUser(user);
        if (user.forcePasswordChange) {
          setChangePasswordOpen(true);
        } else {
          onLoginSuccess(user);
        }
      } else {
        setError('Email ou senha inválidos');
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
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