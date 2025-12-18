import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox'; // Importar Checkbox
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService } from '../../services/api';
import type { User } from '../../services/api';
import { Eye, EyeOff, Lock, Mail, Apple, HeartHandshake } from 'lucide-react'; // Adicionar ícones

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('admin@empresa.com'); // Alterado para admin@empresa.com
  const [loginPassword, setLoginPassword] = useState('••••••••'); // Valor inicial para simular a imagem
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para visibilidade da senha

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await apiService.login(loginEmail, loginPassword);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Email ou senha inválidos');
      }
    } catch (err) {
      setError('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
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
              <p className="font-semibold mb-2">Contas de Demonstração</p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="font-medium">admin@empresa.com</span> (Administrador)</li>
                <li><span className="font-medium">gerente@empresa.com</span> (Gerente)</li>
                <li><span className="font-medium">tecnico@empresa.com</span> (Responsável Técnico)</li>
                <li><span className="font-medium">operacional@empresa.com</span> (Operacional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
          <span>Copyright © 2025 SEAGID.</span>
          <a href="#" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}