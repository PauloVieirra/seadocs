import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox'; // Importar Checkbox
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'; // Não será mais usado diretamente
// import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'; // Não será mais usado
import { apiService } from '../../services/api';
import type { User } from '../../services/api';
import { Eye, EyeOff, Lock, Mail, ChevronRight, Apple, HeartHandshake } from 'lucide-react'; // Adicionar ícones

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
    <div className="w-screen h-screen bg-white overflow-hidden flex font-sans antialiased"> {/* Expandido para tela cheia, removido arredondado e sombra */}

        {/* Left Panel - Login Form */}
        <div className="w-full lg:w-1/2 p-12 flex flex-col justify-between">
          <div>
            {/* Logo */}
            <div className="flex items-center space-x-2 mb-16">
              <HeartHandshake className="h-8 w-8 text-indigo-600" /> {/* Ícone similar ao da imagem */}
              <span className="text-xl font-bold text-gray-900">SEAGID</span>
            </div>

            {/* Welcome Text */}
            <div className="mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Bem-vindo de Volta!</h2>
              <p className="text-gray-500 text-lg">Insira seu e-mail e senha para acessar sua conta no SEAGID.</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
              </div>
              
              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Checkbox id="remember-me" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                  <Label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">Lembrar de Mim</Label>
                </div>
                <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">Esqueceu sua senha?</a>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            {/* Social Login */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Ou faça login com</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full flex items-center justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  {/* Substituir por ícone Google real */}
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M44.5 20H24v8.5h11.8c-.7 4.5-4.5 7.9-9.8 7.9-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.9 1.4 7.9 3.4l6.1-5.9c-3.7-3.6-8.7-5.8-14-5.8-11.7 0-21.2 9.5-21.2 21.2s9.5 21.2 21.2 21.2c11.7 0 20.3-8.8 20.3-20.7 0-1.2-.1-2.3-.3-3.4z" fill="#FFC107"/>
                    <path d="M6.8 24c0-2.5.4-4.9 1.1-7H24v3.5H10.1c-.2 1.2-.4 2.5-.4 3.5s.2 2.3.4 3.5H24v3.5H7.9c-.7-2.1-1.1-4.5-1.1-7z" fill="#4285F4"/>
                    <path d="M24 44.5c5.3 0 9.8-1.8 13.1-4.8l-6.1-5.9c-2 1.4-4.5 2.2-7.1 2.2-5.9 0-10.7-4.8-10.7-10.7H6.8c.7 4.9 3.8 8.9 8.2 11.2l-1.3 1.3-4.4 4.3 1.3 1.3 4.4 4.3 1.3 1.3 4.4 4.3 1.3 1.3z" fill="#34A853"/>
                    <path d="M44.5 20H24v8.5h11.8c-.7 4.5-4.5 7.9-9.8 7.9-5.9 0-10.7-4.8-10.7-10.7s4.8-10.7 10.7-10.7c3.2 0 5.9 1.4 7.9 3.4l6.1-5.9c-3.7-3.6-8.7-5.8-14-5.8-11.7 0-21.2 9.5-21.2 21.2s9.5 21.2 21.2 21.2c11.7 0 20.3-8.8 20.3-20.7 0-1.2-.1-2.3-.3-3.4z" fill="#EA4335"/>
                  </svg>
                  Google
                </Button>
                <Button variant="outline" className="w-full flex items-center justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  <Apple className="mr-3 h-5 w-5" />
                  Apple
                </Button>
              </div>
            </div>

            {/* Login Simplificado e Contas de Demonstração */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">
              <p className="font-semibold mb-2">💡 Contas de Demonstração (Login Simplificado):</p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="font-medium">admin@empresa.com</span> (Administrador)</li>
                <li><span className="font-medium">gerente@empresa.com</span> (Gerente)</li>
                <li><span className="font-medium">tecnico@empresa.com</span> (Responsável Técnico)</li>
                <li><span className="font-medium">operacional@empresa.com</span> (Operacional)</li>
              </ul>
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-between text-xs text-gray-400 mt-10">
            <span>Copyright © 2025 SEAGID Enterprises LTD.</span>
            <a href="#" className="hover:underline">Privacy Policy</a>
          </div>
        </div>

        {/* Right Panel - Promotional Content */}
        <div className="hidden lg:flex w-1/2 bg-indigo-700 p-12 flex-col justify-between items-center text-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 to-indigo-900 opacity-90"></div>
          <div className="absolute inset-0" style={{ backgroundImage: "url('https://source.unsplash.com/random/1200x800?office,abstract')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1 }}></div>

          <div className="relative z-10 text-white mt-10">
            <h2 className="text-5xl font-bold leading-tight mb-4">Gerencie seus documentos com inteligência e eficiência.</h2>
            <p className="text-lg opacity-80">Acesse o painel SEAGID para criar e gerenciar documentos com IA.</p>
          </div>

          {/* Dashboard Mockup - placeholders */}
          <div className="relative z-10 w-full max-w-lg mt-12 flex flex-col items-center space-y-4">
            {/* Top row cards */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 shadow-lg text-white text-left">
                <p className="text-sm opacity-70">Documentos Gerados</p>
                <p className="text-2xl font-bold">189</p>
                <p className="text-xs text-green-400">+1.3%</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 shadow-lg text-white text-left">
                <p className="text-sm opacity-70">Modelos Disponíveis</p>
                <p className="text-2xl font-bold">30</p>
                <p className="text-xs text-green-400">+1.9%</p>
              </div>
            </div>
            {/* Middle card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 shadow-lg text-white text-left w-full">
              <p className="text-sm opacity-70">Colaboradores Ativos</p>
              <p className="text-2xl font-bold">25</p>
              <div className="h-12 bg-indigo-500/30 rounded-md mt-2"></div>
            </div>
            {/* Bottom card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 shadow-lg text-white text-left w-full">
              <div className="flex justify-between items-center">
                <p className="text-sm opacity-70">Projetos Ativos</p>
                <span className="text-xs opacity-70">Semanal <ChevronRight className="inline-block h-3 w-3" /></span>
              </div>
              <div className="h-20 bg-indigo-500/30 rounded-md mt-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">12 Projetos</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-white opacity-60 mt-10">
            Desenvolvido por SEAGID AI
          </div>
        </div>
    </div>
  );
}